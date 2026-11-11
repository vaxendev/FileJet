import { throwError } from '../../../../utils/error'
import { teamWrite, teamActor, teamParam } from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const actor = teamActor(event),
        id = teamParam(event, 'userId')
    await teamWrite(event, id === actor ? 'view' : 'manage', async (tx, team) => {
        if (id === team.owner_id) throwError(400, 'The owner must delete the team space instead of leaving it.')
        const removed = await tx.team_members.deleteMany({ where: { team_id: team.id, user_id: id } })
        if (!removed.count) throwError(404, 'Team member not found.')
    })
    return { success: true }
})
