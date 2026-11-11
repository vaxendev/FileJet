import { prisma } from '~~/server/utils/prisma'
import { getAuthSession } from '~~/server/utils/auth'
import { throwError } from '~~/server/utils/error'

export default defineEventHandler(async event => {
    const session = getAuthSession(event)

    if (!session) throwError(401, 'You need to be logged in.')

    const folders = await prisma.folders.findMany({
        where: { user_id: session.userId },
        select: { id: true, name: true, parent_folder_id: true, team_space: { select: { id: true } } },
        orderBy: { name: 'asc' }
    })

    const children = new Map<string, string[]>()
    for (const folder of folders) if (folder.parent_folder_id) {
        const entries = children.get(folder.parent_folder_id) ?? []
        entries.push(folder.id)
        children.set(folder.parent_folder_id, entries)
    }
    const teamFolders = new Set(folders.filter(folder => folder.team_space).map(folder => folder.id))
    for (const parent of teamFolders) for (const child of children.get(parent) ?? []) teamFolders.add(child)
    return { folders: folders.filter(folder => !teamFolders.has(folder.id)).map(({ id, name, parent_folder_id }) => ({ id, name, parent_folder_id })) }
})
