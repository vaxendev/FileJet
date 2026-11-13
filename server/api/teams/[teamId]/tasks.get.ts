import { prisma } from '../../../utils/prisma'
import { collaborationId } from '../../../utils/teamCollaboration'
import { teamAccess, teamActor, teamParam } from '../../../utils/teamSpaces'
import { serializeTeamTask, taskSelect } from '../../../utils/teamWork'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const teamId = teamParam(event)
    const cursor = getQuery(event).cursor
    const before = cursor === undefined ? undefined : collaborationId(cursor)
    return prisma.$transaction(async tx => {
        const team = await teamAccess(tx, teamId, actor)
        const anchor = before ? await tx.team_tasks.findFirst({
            where: { id: before, team_id: teamId }, select: { id: true }
        }) : null
        const rows = await tx.team_tasks.findMany({
            where: { team_id: teamId },
            ...(anchor ? { cursor: { id: anchor.id }, skip: 1 } : {}),
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: 31, select: taskSelect
        })
        return {
            items: rows.slice(0, 30).map(task => serializeTeamTask(task, team, actor)),
            next: rows.length > 30 ? rows[29]!.id : null
        }
    }, { isolationLevel: 'RepeatableRead' })
})
