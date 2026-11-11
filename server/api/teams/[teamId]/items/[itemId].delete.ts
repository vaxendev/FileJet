import { throwError } from '../../../../utils/error'
import { teamWrite, teamParam, trashTeamItem } from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const id = teamParam(event, 'itemId'),
        type = getQuery(event).type
    if (type !== 'file' && type !== 'folder') throwError(400, 'Unsupported item type.')
    await teamWrite(event, 'edit', async (tx, team) => {
        if (id === team.root_folder_id) throwError(403, 'Only the owner can delete the team space.')
        await trashTeamItem(tx, team, type, id)
    })
    return { success: true }
})
