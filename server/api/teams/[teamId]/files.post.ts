import { unlink } from 'node:fs/promises'
import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import {
    teamActor,
    teamParam,
    teamAccess,
    teamFolderQuery,
    teamWrite,
    teamFolder,
    teamNameAvailable
} from '../../../utils/teamSpaces'
import { readInboxUpload } from '../../../utils/inboxMultipart'
import { MAX_REQUEST_FILE_SIZE, validateRequestFiles } from '../../../utils/inboxValidation'
import { scanUploadParts } from '../../../utils/fileSecurity'
import { saveFileToStorage, storagePath } from '../../../utils/files'
import { lockStorageUser, reserveStorage } from '../../../utils/storage'
export default defineEventHandler(async event => {
    const actor = teamActor(event),
        team = await teamAccess(prisma, teamParam(event), actor, 'upload')
    const folderId = teamFolderQuery(event)
    await teamFolder(prisma, team, folderId)
    const { parts } = await readInboxUpload(event, MAX_REQUEST_FILE_SIZE)
    const bytes = validateRequestFiles(parts, MAX_REQUEST_FILE_SIZE)
    const names = parts.map(part => part.filename.toLowerCase())
    if (new Set(names).size !== names.length) throwError(409, 'Duplicate file names in upload.')
    const proofs = await scanUploadParts(parts),
        keys: string[] = []
    try {
        const uploaded = await teamWrite(event, 'upload', async (tx, current) => {
            const folder = await teamFolder(tx, current, folderId)
            for (const part of parts) await teamNameAvailable(tx, current, folder.id, part.filename)
            await reserveStorage(tx, current.owner_id, bytes)
            for (const part of parts) {
                const { storageKey } = await saveFileToStorage(
                    current.owner_id,
                    part,
                    undefined,
                    tx,
                    proofs.get(part)
                )
                keys.push(storageKey)
                await tx.files.create({
                    data: {
                        user_id: current.owner_id,
                        folder_id: folder.id,
                        name: part.filename,
                        original_name: part.filename,
                        mime_type: part.type && part.type.length <= 150 ? part.type : null,
                        size: BigInt(part.data.length),
                        storage_key: storageKey
                    }
                })
            }
            return parts.length
        })
        setResponseStatus(event, 201)
        return { uploaded }
    } catch (error) {
        // Wait for the writer's lock before checking a commit with an unknown outcome.
        // The scan record is committed with the upload and survives moves to Trash.
        if (keys.length) {
            try {
                await prisma.$transaction(async tx => {
                    await lockStorageUser(tx, team.owner_id)
                    const scans = await tx.file_scans.findMany({
                        where: { user_id: team.owner_id, storage_key: { in: keys } },
                        select: { storage_key: true }
                    })
                    const committed = new Set(scans.map(scan => scan.storage_key))
                    for (const key of keys) {
                        if (!committed.has(key)) {
                            await unlink(storagePath(key)).catch(cleanup => {
                                if (cleanup.code !== 'ENOENT') console.error('[TEAM UPLOAD CLEANUP]', cleanup)
                            })
                        }
                    }
                })
            } catch (cleanup) {
                console.error('[TEAM UPLOAD CLEANUP]', cleanup)
            }
        }
        throw error
    }
})
