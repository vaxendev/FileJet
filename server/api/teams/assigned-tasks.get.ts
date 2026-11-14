import { assignedTaskFilters, type AssignedTaskFilter, type AssignedTeamTask, type TeamListPage } from '../../../shared/types/teamCollaboration'
import { collaborationId } from '../../utils/teamCollaboration'
import { throwError } from '../../utils/error'
import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'
import { assignedTaskSelect, assignedTaskWhere, serializeTeamTask, taskDueDate } from '../../utils/teamWork'

const pageSize = 30

export default defineEventHandler(async (event): Promise<TeamListPage<AssignedTeamTask>> => {
    const actor = teamActor(event)
    const query = getQuery(event)
    const today = taskDueDate(query.today ?? new Date().toISOString().slice(0, 10))
    const filter = query.filter ?? 'all'
    const taskId = query.task === undefined ? undefined : collaborationId(query.task)
    if (!assignedTaskFilters.includes(filter as AssignedTaskFilter)) throwError(400, 'Invalid task filter.')

    let position
    if (query.cursor !== undefined) {
        if (typeof query.cursor !== 'string' || query.cursor.length !== 47 || query.cursor[10] !== ':')
            throwError(400, 'Invalid task cursor.')
        const date = taskDueDate(query.cursor.slice(0, 10))
        const id = collaborationId(query.cursor.slice(11))
        position = { OR: [{ due_on: { gt: date } }, { due_on: date, id: { gt: id } }] }
    }
    const completed = filter === 'completed' ? { not: null } : filter === 'all' ? undefined : null
    const due = filter === 'upcoming' ? { gte: today } : filter === 'overdue' ? { lt: today } : undefined
    const rows = await prisma.team_tasks.findMany({
        where: { ...assignedTaskWhere(actor), id: taskId, completed_at: completed, due_on: due, ...position },
        orderBy: [{ due_on: 'asc' }, { id: 'asc' }],
        take: pageSize + 1,
        select: assignedTaskSelect
    })
    const items = rows.slice(0, pageSize).map(task => ({
        ...serializeTeamTask(task, { role: 'VIEWER' }, actor), teamId: task.team.id, teamName: task.team.name
    }))
    const last = items.at(-1)
    return { items, next: rows.length > pageSize && last ? `${last.dueOn}:${last.id}` : null }
})
