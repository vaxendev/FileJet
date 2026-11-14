import type { TeamChatPage } from '../../../../shared/types/teamChat'
import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { teamAccess, teamActor, teamParam } from '../../../utils/teamSpaces'
import { teamReferenceIds } from '../../../utils/teamCollaboration'
import { serializeTeamChatMessage, serializeTeamChatQuote, teamChatCursor, teamChatMessageSelect, teamChatQuoteSelect, teamUnreadCounts } from '../../../utils/teamChat'

const pageSize = 50

export default defineEventHandler(async (event): Promise<TeamChatPage> => {
    const actor = teamActor(event)
    const teamId = teamParam(event)
    const query = getQuery(event)
    const before = teamChatCursor(query.before)
    const after = teamChatCursor(query.after)
    const at = teamChatCursor(query.at)
    const editsAfter = query.editsAfter === '0' ? 0n : teamChatCursor(query.editsAfter)
    if ([before, after, at].filter(value => value !== undefined).length > 1)
        throwError(400, 'Invalid message cursor.')

    return prisma.$transaction(async tx => {
        const team = await teamAccess(tx, teamId, actor)
        const [rows, pinned, counts, edits] = await Promise.all([
            tx.team_messages.findMany({
                where: { team_id: teamId, deleted_at: null, id: { lt: before, gt: after, lte: at } },
                select: teamChatMessageSelect,
                orderBy: { id: after === undefined ? 'desc' : 'asc' },
                take: pageSize + 1
            }),
            tx.team_messages.findMany({
                where: { team_id: teamId, deleted_at: null, pinned_at: { not: null } },
                select: teamChatQuoteSelect,
                orderBy: [{ pinned_at: 'desc' }, { id: 'desc' }],
                take: 20
            }),
            teamUnreadCounts(tx, actor, [teamId]),
            tx.team_messages.findMany({
                where: { team_id: teamId, edit_version: editsAfter === undefined ? { not: null } : { gt: editsAfter } },
                orderBy: { edit_version: editsAfter === undefined ? 'desc' : 'asc' },
                select: { id: true, body: true, edit_version: true, deleted_at: true },
                take: editsAfter === undefined ? 1 : pageSize
            })
        ])
        const page = rows.slice(0, pageSize)
        if (after === undefined) page.reverse()
        const fileIds = page.flatMap(row => row.file ? [row.file.id] : [])
        const fileRows = fileIds.length ? await teamReferenceIds(tx, team, fileIds) : []
        const visibleFiles = new Set(fileRows.map(row => row.id))
        return {
            messages: page.map(message => serializeTeamChatMessage(message, visibleFiles)),
            hasMore: rows.length > pageSize,
            pinned: pinned.map(serializeTeamChatQuote),
            unreadCount: Number(counts[0]?.unread ?? 0),
            edits: editsAfter === undefined ? [] : edits.map(row => ({
                id: row.id.toString(), body: row.deleted_at ? null : row.body, editVersion: row.edit_version!.toString()
            })),
            editCursor: edits.at(-1)?.edit_version?.toString() ?? editsAfter?.toString() ?? '0'
        }
    }, { isolationLevel: 'RepeatableRead' })
})
