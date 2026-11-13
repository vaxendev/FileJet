import { getAuthSession } from '~~/server/utils/auth'
import { throwError } from '~~/server/utils/error'
import { libraryFolderScopes } from '~~/server/utils/hiddenItems'

export default defineEventHandler(async event => {
    const session = getAuthSession(event)

    if (!session) throwError(401, 'You need to be logged in.')

    const { folders, hiddenFolders, teamFolders } = await libraryFolderScopes(session.userId)
    return { folders: folders.filter(folder => !teamFolders.has(folder.id) && !hiddenFolders.has(folder.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ id, name, parent_folder_id }) => ({ id, name, parent_folder_id })) }
})
