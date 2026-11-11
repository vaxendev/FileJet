import { throwError } from '../../../../utils/error'
import { readTeamBody, teamWrite, memberRole } from '../../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const body = await readTeamBody(event),
        role = memberRole(body.role ?? 'VIEWER')
    if (typeof body.username !== 'string' || !body.username.trim() || body.username.trim().length > 50)
        throwError(400, 'Enter an existing username.')
    const username = body.username.trim()
    await teamWrite(event, 'manage', async (tx, team) => {
        if ((await tx.team_members.count({ where: { team_id: team.id } })) >= 99)
            throwError(400, 'A team space can have up to 100 members.')
        const user = await tx.users.findUnique({ where: { username }, select: { id: true } })
        if (!user) throwError(404, 'User not found.')
        if (
            user.id === team.owner_id ||
            (await tx.team_members.findUnique({
                where: { team_id_user_id: { team_id: team.id, user_id: user.id } }
            }))
        )
            throwError(409, 'This user is already a team member.')
        await tx.team_members.create({ data: { team_id: team.id, user_id: user.id, role } })
    })
    return { success: true }
})
