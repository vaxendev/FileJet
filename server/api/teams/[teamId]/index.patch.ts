import { readTeamBody, teamWrite, teamName, teamDescription } from '../../../utils/teamSpaces'
import { hashTeamPassword, teamVisibility } from '../../../utils/teamJoining'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event),
        name = teamName(body.name),
        description = teamDescription(body.description)
    await teamWrite(event, 'manage', async (tx, team) => {
        const isPublic = teamVisibility(body.isPublic, team.is_public)
        const hash = isPublic ? null : await hashTeamPassword(body.password)
        await tx.team_spaces.update({
            where: { id: team.id },
            data: {
                name,
                description,
                is_public: isPublic,
                ...(hash !== undefined ? { join_password_hash: hash } : {}),
                ...(isPublic !== team.is_public ? { invite_token: null } : {})
            }
        })
    })
    return { success: true }
})
