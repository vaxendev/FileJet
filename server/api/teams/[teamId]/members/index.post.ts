import { throwError } from '../../../../utils/error'
import { readTeamBody, teamWrite, memberRole, teamMemberRole } from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const body = await readTeamBody(event),
        role = memberRole(body.role ?? 'VIEWER')
    if (typeof body.username !== 'string' || !body.username.trim() || body.username.trim().length > 50)
        throwError(400, 'Enter an existing username.')
    const username = body.username.trim()
    await teamWrite(event, 'manage', async (tx, team) => {
        const user = await tx.users.findUnique({ where: { username }, select: { id: true } })
        if (!user) throwError(404, 'User not found.')
        if (await teamMemberRole(tx, team, user.id))
            throwError(409, 'This user is already a team member.')
        const invitation = await tx.team_invitations.createMany({
            data: { team_id: team.id, user_id: user.id, role },
            skipDuplicates: true
        })
        if (!invitation.count) throwError(409, 'This user already has a pending invitation.')
    })
    return { success: true }
})
