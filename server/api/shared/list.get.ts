import { prisma } from '~~/server/utils/prisma'
import { getAuthSession } from '~~/server/utils/auth'
import { throwError } from '~~/server/utils/error'
import type { SharedItemType } from '~~/shared/types/share'
import { libraryFolderScopes } from '../../utils/hiddenItems'

export default defineEventHandler(async event => {
    try {
        const session = getAuthSession(event)

        if (!session) {
            throwError(401, 'You need to be logged in.')
        }

        setHeader(event, 'Cache-Control', 'no-store')

        const sharedItems = await prisma.shared_items.findMany({
            where: {
                user_id: session.userId
            },
            orderBy: {
                created_at: 'desc'
            },
            select: {
                id: true,
                item_id: true,
                item_type: true,
                token: true,
                created_at: true,
                expires_at: true,
                password_hash: true,
                max_downloads: true,
                download_count: true
            }
        })

        const shares = sharedItems.filter((item): item is typeof item & { item_type: SharedItemType } =>
            item.item_type === 'file' || item.item_type === 'folder' || item.item_type === 'note')
        const ids = (type: SharedItemType) => shares.filter(item => item.item_type === type).map(item => item.item_id)

        if (!shares.length) return []

        const [files, folders, notes, { hiddenFolders }] = await prisma.$transaction(tx => Promise.all([
            tx.files.findMany({
                where: { user_id: session.userId, id: { in: ids('file') } },
                select: { id: true, name: true, mime_type: true, size: true, hidden: true, folder_id: true }
            }),
            tx.folders.findMany({
                where: { user_id: session.userId, id: { in: ids('folder') } },
                select: { id: true, name: true }
            }),
            tx.notes.findMany({
                where: { user_id: session.userId, id: { in: ids('note') } },
                select: { id: true, title: true, size: true, hidden: true, folder_id: true }
            }),
            libraryFolderScopes(session.userId, tx)
        ]), { isolationLevel: 'RepeatableRead' })

        const targets = new Map<string, { name: string; mimeType: string | null; size: string | null }>()
        const hiddenTargets = new Set<string>()

        for (const file of files) {
            const key = `file:${file.id}`
            if (file.hidden || (file.folder_id && hiddenFolders.has(file.folder_id))) hiddenTargets.add(key)
            else targets.set(key, { name: file.name, mimeType: file.mime_type, size: file.size.toString() })
        }
        for (const folder of folders) {
            const key = `folder:${folder.id}`
            if (hiddenFolders.has(folder.id)) hiddenTargets.add(key)
            else targets.set(key, { name: folder.name, mimeType: null, size: null })
        }
        for (const note of notes) {
            const key = `note:${note.id}`
            if (note.hidden || (note.folder_id && hiddenFolders.has(note.folder_id))) hiddenTargets.add(key)
            else targets.set(key, { name: note.title, mimeType: 'text/plain', size: note.size.toString() })
        }

        const origin = getRequestURL(event).origin

        return shares.filter(item => !hiddenTargets.has(`${item.item_type}:${item.item_id}`)).map(item => {
            const target = targets.get(`${item.item_type}:${item.item_id}`)

            return {
                id: item.id,
                itemId: item.item_id,
                itemType: item.item_type,
                name: target?.name ?? `Unavailable ${item.item_type}`,
                mimeType: target?.mimeType ?? null,
                size: target?.size ?? null,
                token: item.token,
                url: `${origin}/shared/${item.token}`,
                createdAt: item.created_at.toISOString(),
                hasPassword: Boolean(item.password_hash),
                expiresAt: item.expires_at?.toISOString() ?? null,
                isExpired: Boolean(item.expires_at && item.expires_at.getTime() <= Date.now()),
                maxDownloads: item.max_downloads,
                downloadCount: item.download_count,
                isLimitReached: item.max_downloads != null && item.download_count >= item.max_downloads,
                isAvailable: Boolean(target)
            }
        })
    } catch (err: any) {
        if (err.statusCode) throw err

        throwError(500, 'An error occurred while getting shared items.')
    }
})
