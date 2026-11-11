import { teamWrite, trashTeamItem } from '../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    await teamWrite(event, 'manage', async (tx, team) => {
        await tx.team_spaces.delete({ where: { id: team.id } })
        await trashTeamItem(tx, team, 'folder', team.root_folder_id)
    })
    return { success: true }
})
