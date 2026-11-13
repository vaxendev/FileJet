import type { Prisma } from '~~/src/generated/prisma/client'
import type { SharedItemType } from '../../shared/types/share'
import { prisma } from './prisma'
import { throwError } from './error'

export async function libraryFolderScopes(userId: string, db: Prisma.TransactionClient = prisma) {
    const folders = await db.folders.findMany({
        where: { user_id: userId },
        select: { id: true, name: true, parent_folder_id: true, hidden: true, team_space: { select: { id: true } } }
    })
    const children = new Map<string, string[]>()
    for (const folder of folders) {
        if (!folder.parent_folder_id) continue
        const entries = children.get(folder.parent_folder_id) ?? []
        entries.push(folder.id)
        children.set(folder.parent_folder_id, entries)
    }
    const descendants = (roots: string[]) => {
        const ids = new Set(roots)
        for (const id of ids) for (const child of children.get(id) ?? []) ids.add(child)
        return ids
    }
    return {
        folders,
        hiddenFolders: descendants(folders.filter(folder => folder.hidden).map(folder => folder.id)),
        teamFolders: descendants(folders.filter(folder => folder.team_space).map(folder => folder.id))
    }
}

export async function ownedLibraryVisibility(userId: string, id: string, type: SharedItemType, db: Prisma.TransactionClient = prisma) {
    const where = { id, user_id: userId }
    if (type === 'folder') {
        const folder = await db.folders.findFirst({ where, select: { id: true, hidden: true } })
        return folder && { hidden: folder.hidden, folderId: folder.id }
    }
    const select = { hidden: true, folder_id: true } as const
    const item = type === 'file'
        ? await db.files.findFirst({ where, select })
        : await db.notes.findFirst({ where, select })
    return item && { hidden: item.hidden, folderId: item.folder_id }
}

export async function hasHiddenAncestor(userId: string, folderId: string | null, db: Prisma.TransactionClient = prisma) {
    if (!folderId) return false
    const rows = await db.$queryRaw<{ hidden: boolean }[]>`
        WITH RECURSIVE ancestors AS (
            SELECT id, parent_folder_id, hidden FROM folders WHERE id = ${folderId}::uuid AND user_id = ${userId}::uuid
            UNION
            SELECT f.id, f.parent_folder_id, f.hidden FROM folders f JOIN ancestors a ON f.id = a.parent_folder_id
            WHERE f.user_id = ${userId}::uuid
        )
        SELECT EXISTS (SELECT 1 FROM ancestors WHERE hidden) AS hidden
    `
    return rows[0]?.hidden === true
}

export async function requireVisibleShareTarget(userId: string, id: string, type: string, db: Prisma.TransactionClient = prisma) {
    if (type !== 'file' && type !== 'folder' && type !== 'note') throwError(404, 'Shared item not found.')
    const item = await ownedLibraryVisibility(userId, id, type, db)
    if (!item || item.hidden || await hasHiddenAncestor(userId, item.folderId, db))
        throwError(404, 'Shared item not found.')
}
