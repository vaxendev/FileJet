import type { TeamChatPage } from '../../../../shared/types/teamChat'
import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { teamAccess, teamActor, teamParam } from '../../../utils/teamSpaces'
import { serializeTeamChatMessage, teamChatCursor, teamChatMessageSelect } from '../../../utils/teamChat'

const pageSize = 50

export default defineEventHandler(async (event): Promise<TeamChatPage> => {
    const actor = teamActor(event)
    const teamId = teamParam(event)
    const query = getQuery(event)
    const before = teamChatCursor(query.before)
    const after = teamChatCursor(query.after)
    if (before !== undefined && after !== undefined) throwError(400, 'Invalid message cursor.')

    const rows = await prisma.$transaction(async tx => {
        await teamAccess(tx, teamId, actor)
        return tx.team_messages.findMany({
            where: { team_id: teamId, id: { lt: before, gt: after } },
            select: teamChatMessageSelect,
            orderBy: { id: after === undefined ? 'desc' : 'asc' },
            take: pageSize + 1
        })
    }, { isolationLevel: 'RepeatableRead' })

    const page = rows.slice(0, pageSize)
    if (after === undefined) page.reverse()
    return { messages: page.map(serializeTeamChatMessage), hasMore: rows.length > pageSize }
})
