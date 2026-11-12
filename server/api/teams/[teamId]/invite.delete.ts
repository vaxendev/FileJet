import { teamWrite } from '../../../utils/teamSpaces'

export default defineEventHandler(event => teamWrite(event, 'manage', async (tx, team) => {
    await tx.team_spaces.update({ where: { id: team.id }, data: { invite_token: null } })
    return { success: true }
}))
