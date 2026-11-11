import { throwError } from '../../../../utils/error'
import { readTeamBody, teamWrite, memberRole, teamParam } from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const id = teamParam(event, 'userId'),
        body = await readTeamBody(event),
        role = memberRole(body.role)
    await teamWrite(event, 'manage', async (tx, team) => {
        if (id === team.owner_id) throwError(400, 'The team owner role cannot be changed.')
        const changed = await tx.team_members.updateMany({
            where: { team_id: team.id, user_id: id },
            data: { role }
        })
        if (!changed.count) throwError(404, 'Team member not found.')
    })
    return { success: true }
})
