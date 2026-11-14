import { throwError } from '../../../../../utils/error'
import { teamChatCursor } from '../../../../../utils/teamChat'
import { readTeamBody, teamWrite } from '../../../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const id = teamChatCursor(getRouterParam(event, 'messageId'))
    if (id === undefined || typeof body.pinned !== 'boolean') throwError(400, 'Invalid request body.')
    const pinned = body.pinned
    await teamWrite(event, 'edit', async (tx, team) => {
        const message = await tx.team_messages.findFirst({
            where: { team_id: team.id, id, deleted_at: null }, select: { pinned_at: true }
        })
        if (!message) throwError(404, 'Team message not found.')
        if (Boolean(message.pinned_at) === pinned) return
        if (pinned && await tx.team_messages.count({ where: { team_id: team.id, pinned_at: { not: null } } }) >= 20)
            throwError(409, 'You can pin up to 20 messages per team.')
        await tx.team_messages.update({ where: { id }, data: { pinned_at: pinned ? new Date() : null } })
    })
    return { success: true }
})
