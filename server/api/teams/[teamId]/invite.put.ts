import { randomBytes } from 'node:crypto'
import { throwError } from '../../../utils/error'
import { teamWrite } from '../../../utils/teamSpaces'

export default defineEventHandler(event => teamWrite(event, 'manage', async (tx, team) => {
    if (!team.is_public && !team.join_password_hash)
        throwError(400, 'Set a team password before creating a private invitation.')
    const inviteToken = randomBytes(32).toString('base64url')
    await tx.team_spaces.update({ where: { id: team.id }, data: { invite_token: inviteToken } })
    return { inviteToken }
}))
