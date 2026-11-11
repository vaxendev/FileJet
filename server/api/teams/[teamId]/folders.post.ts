import { folderNameSchema } from '~~/shared/schemas/folder'
import { throwError } from '../../../utils/error'
import { readTeamBody, teamWrite, teamFolder, teamNameAvailable } from '../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const body = await readTeamBody(event),
        name = folderNameSchema.safeParse(body.name)
    if (!name.success) throwError(400, name.error.issues[0]?.message ?? 'Invalid folder name.')
    const folder = await teamWrite(event, 'upload', async (tx, team) => {
        const destination = await teamFolder(
            tx,
            team,
            typeof body.folderId === 'string' ? body.folderId : undefined
        )
        if (body.folderId !== undefined && typeof body.folderId !== 'string')
            throwError(400, 'Invalid folder ID.')
        await teamNameAvailable(tx, team, destination.id, name.data)
        return tx.folders.create({
            data: { user_id: team.owner_id, parent_folder_id: destination.id, name: name.data }
        })
    })
    setResponseStatus(event, 201)
    return { id: folder.id }
})
