import { throwError } from '../../../../utils/error'
import { readTeamBody, teamParam, teamWrite } from '../../../../utils/teamSpaces'
import { serializeTeamTask, taskCanUpdate, taskSelect } from '../../../../utils/teamWork'

export default defineEventHandler(async event => {
    const id = teamParam(event, 'taskId')
    const body = await readTeamBody(event)
    if (typeof body.completed !== 'boolean') throwError(400, 'Invalid request body.')
    const completed = body.completed
    return teamWrite(event, 'view', async (tx, team, actor) => {
        const task = await tx.team_tasks.findFirst({ where: { id, team_id: team.id }, select: taskSelect })
        if (!task) throwError(404, 'Team task not found.')
        if (!taskCanUpdate(task, team, actor)) throwError(403, 'Your team role does not allow this action.')
        const updated = Boolean(task.completed_at) === completed ? task : await tx.team_tasks.update({
            where: { id }, data: { completed_at: completed ? new Date() : null }, select: taskSelect
        })
        return { task: serializeTeamTask(updated, team, actor) }
    })
})
