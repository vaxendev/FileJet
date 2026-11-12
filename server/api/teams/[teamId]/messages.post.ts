import { teamMessageLimit } from '../../../../shared/types/teamChat'
import { throwError } from '../../../utils/error'
import { readTeamBody, teamWrite } from '../../../utils/teamSpaces'
import { serializeTeamChatMessage, teamChatMessageSelect } from '../../../utils/teamChat'
import { isUuid } from '../../../utils/validation'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const requestId = body.requestId
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (typeof requestId !== 'string' || !isUuid(requestId)) throwError(400, 'Invalid message ID.')
    if (!message || message.length > teamMessageLimit || message.includes('\0'))
        throwError(400, 'Enter a message between 1 and 2,000 characters.')

    const saved = await teamWrite(event, 'view', async (tx, team, actor) => {
        const existing = await tx.team_messages.findUnique({
            where: { team_id_request_id: { team_id: team.id, request_id: requestId } },
            select: teamChatMessageSelect
        })
        if (existing) {
            if (existing.author_id !== actor || existing.body !== message)
                throwError(409, 'This message ID has already been used.')
            return existing
        }
        return tx.team_messages.create({
            data: { team_id: team.id, author_id: actor, request_id: requestId, body: message },
            select: teamChatMessageSelect
        })
    })
    return { message: serializeTeamChatMessage(saved) }
})
