import { teamMessageLimit } from '../../../../shared/types/teamChat'
import { teamMentionNames } from '../../../../shared/utils/teamMentions'
import { throwError } from '../../../utils/error'
import { readTeamBody, teamFile, teamWrite } from '../../../utils/teamSpaces'
import { collaborationId, teamReferenceIds } from '../../../utils/teamCollaboration'
import { serializeTeamChatMessage, teamChatCursor, teamChatMessageSelect } from '../../../utils/teamChat'
import { isUuid } from '../../../utils/validation'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const requestId = body.requestId
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const fileId = body.fileId === undefined ? null : collaborationId(body.fileId)
    const replyTo = teamChatCursor(body.replyTo) ?? null
    if (typeof requestId !== 'string' || !isUuid(requestId)) throwError(400, 'Invalid message ID.')
    if ((!message && !fileId) || message.length > teamMessageLimit || message.includes('\0'))
        throwError(400, 'Enter a message between 1 and 2,000 characters.')

    return teamWrite(event, 'view', async (tx, team, actor) => {
        const existing = await tx.team_messages.findUnique({
            where: { team_id_request_id: { team_id: team.id, request_id: requestId } },
            select: { ...teamChatMessageSelect, file_id: true, reply_to_id: true }
        })
        if (existing) {
            if (existing.author_id !== actor || existing.body !== message || existing.reply_to_id !== replyTo || existing.file_id !== fileId)
                throwError(409, 'This message ID has already been used.')
            const visible = existing.file_id ? await teamReferenceIds(tx, team, [existing.file_id]) : []
            return { message: serializeTeamChatMessage(existing, new Set(visible.map(row => row.id))) }
        }
        if (fileId) await teamFile(tx, team, fileId)
        if (replyTo && !(await tx.team_messages.findFirst({
            where: { team_id: team.id, id: replyTo }, select: { id: true }
        }))) throwError(404, 'Team message not found.')

        const names = teamMentionNames(message)
        const mentioned = names.size ? await tx.users.findMany({
            where: {
                id: { not: actor },
                OR: [{ id: team.owner_id }, { team_memberships: { some: { team_id: team.id } } }]
            },
            select: { id: true, username: true }
        }) : []
        const saved = await tx.team_messages.create({
            data: {
                team_id: team.id, author_id: actor, request_id: requestId, body: message,
                file_id: fileId, reply_to_id: replyTo,
                mentions: { create: mentioned.filter(user => names.has(user.username.toLowerCase())).map(user => ({ user_id: user.id })) }
            },
            select: teamChatMessageSelect
        })
        return { message: serializeTeamChatMessage(saved, new Set(fileId ? [fileId] : [])) }
    })
})
