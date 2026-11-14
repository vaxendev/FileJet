import { throwError } from '../../../utils/error'
import { teamChatCursor } from '../../../utils/teamChat'
import { collaborationId, collaborationText, requireTeamParticipant } from '../../../utils/teamCollaboration'
import { readTeamBody, teamWrite } from '../../../utils/teamSpaces'
import { serializeTeamTask, taskDueDate, taskSelect } from '../../../utils/teamWork'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const messageId = teamChatCursor(body.messageId)
    const requestId = messageId === undefined && body.requestId !== undefined ? collaborationId(body.requestId) : undefined
    const title = collaborationText(body.title, 160, true)
    const dueOn = taskDueDate(body.dueOn)
    return teamWrite(event, 'view', async (tx, team, actor) => {
        if (messageId !== undefined && !await tx.team_messages.findFirst({
            where: { id: messageId, team_id: team.id, deleted_at: null }, select: { id: true }
        })) throwError(404, 'Team message not found.')
        const assignee = await requireTeamParticipant(tx, team, body.assigneeId)
        const key = messageId !== undefined ? { message_id: messageId }
            : requestId !== undefined ? { team_id_request_id: { team_id: team.id, request_id: requestId } }
            : null
        const existing = key ? await tx.team_tasks.findUnique({ where: key, select: taskSelect }) : null
        if (existing) {
            if (existing.created_by_id !== actor || existing.assignee_id !== assignee ||
                existing.title !== title || existing.due_on.getTime() !== dueOn.getTime())
                throwError(409, messageId !== undefined ? 'A task already exists for this message.' : 'Invalid request body.')
            return { task: serializeTeamTask(existing, team, actor) }
        }
        const task = await tx.team_tasks.create({
            data: { team_id: team.id, message_id: messageId, request_id: requestId, created_by_id: actor, assignee_id: assignee, title, due_on: dueOn },
            select: taskSelect
        })
        return { task: serializeTeamTask(task, team, actor) }
    })
})
