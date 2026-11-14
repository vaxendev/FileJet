import type { TeamTaskNotification } from '../../../shared/types/teamCollaboration'
import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'
import { assignedTaskWhere, taskDueDate } from '../../utils/teamWork'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const today = taskDueDate(getQuery(event).today ?? new Date().toISOString().slice(0, 10))
    const soon = new Date(today.getTime())
    soon.setUTCDate(soon.getUTCDate() + 2)
    const where = assignedTaskWhere(actor)
    const select = { id: true, title: true, due_on: true, team: { select: { name: true } } } as const
    const [assigned, due] = await Promise.all([
        prisma.team_tasks.findMany({
            where: { ...where, created_at: { gte: new Date(Date.now() - 30 * 86400000) } },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 25, select
        }),
        prisma.team_tasks.findMany({
            where: { ...where, completed_at: null, due_on: { gte: today, lte: soon } },
            orderBy: [{ due_on: 'asc' }, { id: 'asc' }], take: 25, select
        })
    ])
    const notification = (task: typeof assigned[number], kind: TeamTaskNotification['kind']): TeamTaskNotification => ({
        id: task.id, title: task.title, teamName: task.team.name, dueOn: task.due_on.toISOString().slice(0, 10), kind
    })
    return { notifications: [...assigned.reverse().map(task => notification(task, 'assigned')), ...due.reverse().map(task => notification(task, 'due'))] }
})
