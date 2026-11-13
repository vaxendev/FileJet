import { prisma } from '~~/server/utils/prisma'
import { getAuthSession } from '~~/server/utils/auth'
import { assertShareOrigin } from '~~/server/utils/shares'
import { readShareBody } from '~~/server/utils/shareBody'
import { throwError } from '~~/server/utils/error'
import { lockStorageUser } from '~~/server/utils/storage'
import { libraryFolderScopes, ownedLibraryVisibility } from '~~/server/utils/hiddenItems'
import { isUuid } from '~~/server/utils/validation'
import { protectHiddenRows } from '~~/server/utils/hiddenAccess'

export default defineEventHandler(async event => {
    assertShareOrigin(event)
    const userId = getAuthSession(event)?.userId
    if (!userId) throwError(401, 'You need to be logged in.')
    const id = getRouterParam(event, 'itemId')
    if (!id || !isUuid(id)) throwError(400, 'Invalid item ID.')
    const type = getRouterParam(event, 'itemType')
    if (type !== 'file' && type !== 'folder' && type !== 'note') throwError(400, 'Invalid item type.')
    const { hidden } = await readShareBody(event)
    if (typeof hidden !== 'boolean') throwError(400, 'Invalid request body.')
    enforceRateLimit(event, `hidden-items:${userId}`, 60, 60000)
    setHeader(event, 'Cache-Control', 'private, no-store')

    await prisma.$transaction(async tx => {
        await lockStorageUser(tx, userId)
        const item = await ownedLibraryVisibility(userId, id, type, tx)
        if (!item) throwError(404, 'Item not found.')
        if (!hidden) await protectHiddenRows(event, userId, [item], tx)
        if (hidden && item.folderId && (await libraryFolderScopes(userId, tx)).teamFolders.has(item.folderId))
            throwError(400, 'Team items cannot be hidden.')
        const where = { id, user_id: userId }, data = { hidden }
        const updated = type === 'file' ? await tx.files.updateMany({ where, data })
            : type === 'folder' ? await tx.folders.updateMany({ where, data }) : await tx.notes.updateMany({ where, data })
        if (!updated.count) throwError(404, 'Item not found.')
    })
    return { hidden }
})
