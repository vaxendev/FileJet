import { throwError } from '../../../utils/error'
import { teamChatCursor } from '../../../utils/teamChat'
import { collaborationText, requireTeamParticipant } from '../../../utils/teamCollaboration'
import { readTeamBody, teamWrite } from '../../../utils/teamSpaces'
import { serializeTeamTask, taskDueDate, taskSelect } from '../../../utils/teamWork'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const messageId = teamChatCursor(body.messageId)
    if (messageId === undefined) throwError(400, 'Invalid message ID.')
    const title = collaborationText(body.title, 160, true)
    const dueOn = taskDueDate(body.dueOn)
    return teamWrite(event, 'view', async (tx, team, actor) => {
        const message = await tx.team_messages.findFirst({
            where: { id: messageId, team_id: team.id }, select: { id: true }
        })
        if (!message) throwError(404, 'Team message not found.')
        const assignee = await requireTeamParticipant(tx, team, body.assigneeId)
        const existing = await tx.team_tasks.findUnique({ where: { message_id: messageId }, select: taskSelect })
        if (existing) {
            if (existing.created_by_id !== actor || existing.assignee_id !== assignee ||
                existing.title !== title || existing.due_on.getTime() !== dueOn.getTime())
                throwError(409, 'A task already exists for this message.')
            return { task: serializeTeamTask(existing, team, actor) }
        }
        const task = await tx.team_tasks.create({
            data: { team_id: team.id, message_id: messageId, created_by_id: actor, assignee_id: assignee, title, due_on: dueOn },
            select: taskSelect
        })
        return { task: serializeTeamTask(task, team, actor) }
    })
})
