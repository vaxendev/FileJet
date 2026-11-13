import { prisma } from '../../../utils/prisma'
import { collaborationId, teamReferenceIds } from '../../../utils/teamCollaboration'
import { teamAccess, teamActor, teamParam } from '../../../utils/teamSpaces'
import { reviewSelect, serializeTeamReview } from '../../../utils/teamWork'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const teamId = teamParam(event)
    const cursor = getQuery(event).cursor
    const before = cursor === undefined ? undefined : collaborationId(cursor)
    return prisma.$transaction(async tx => {
        const team = await teamAccess(tx, teamId, actor)
        const anchor = before ? await tx.team_file_reviews.findFirst({
            where: { id: before, team_id: teamId }, select: { id: true }
        }) : null
        const rows = await tx.team_file_reviews.findMany({
            where: { team_id: teamId },
            ...(anchor ? { cursor: { id: anchor.id }, skip: 1 } : {}),
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: 31, select: reviewSelect
        })
        const page = rows.slice(0, 30)
        const files = page.length ? await teamReferenceIds(tx, team, page.map(review => review.file.id)) : []
        const visible = new Set(files.map(file => file.id))
        return {
            items: page.map(review => serializeTeamReview(review, actor, visible.has(review.file.id))),
            next: rows.length > 30 ? rows[29]!.id : null
        }
    }, { isolationLevel: 'RepeatableRead' })
})
