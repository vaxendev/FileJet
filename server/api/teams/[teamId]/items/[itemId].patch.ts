import { folderNameSchema } from '~~/shared/schemas/folder'
import { throwError } from '../../../../utils/error'
import {
    readTeamBody,
    teamWrite,
    teamFile,
    teamFolder,
    teamParam,
    teamNameAvailable
} from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const id = teamParam(event, 'itemId'),
        type = getQuery(event).type,
        body = await readTeamBody(event)
    if (type !== 'file' && type !== 'folder') throwError(400, 'Unsupported item type.')
    const name = folderNameSchema.safeParse(body.name)
    if (!name.success) throwError(400, name.error.issues[0]?.message ?? 'Invalid folder name.')
    await teamWrite(event, 'edit', async (tx, team) => {
        if (type === 'file') {
            if (/[\r\n]/.test(name.data)) throwError(400, 'Invalid filename.')
            const file = await teamFile(tx, team, id)
            await teamNameAvailable(tx, team, file.folder_id!, name.data, id)
            await tx.files.update({
                where: { id },
                data: { name: name.data, original_name: name.data, updated_at: new Date() }
            })
        } else {
            if (id === team.root_folder_id) throwError(403, 'Only the owner can change team settings.')
            await teamFolder(tx, team, id)
            const folder = await tx.folders.findUniqueOrThrow({ where: { id } })
            await teamNameAvailable(tx, team, folder.parent_folder_id!, name.data, id)
            await tx.folders.update({ where: { id }, data: { name: name.data, updated_at: new Date() } })
        }
    })
    return { success: true }
})
