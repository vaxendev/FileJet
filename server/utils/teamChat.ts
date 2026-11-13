import type { Prisma } from '~~/src/generated/prisma/client'
import type { TeamChatMessage, TeamChatQuote } from '../../shared/types/teamChat'
import { throwError } from './error'
import { teamFileReference, teamFileReferenceSelect } from './teamCollaboration'
import type { TeamDB } from './teamSpaces'

export const teamChatQuoteSelect = {
    id: true,
    author: { select: { username: true } },
    body: true
} satisfies Prisma.team_messagesSelect
export const teamChatMessageSelect = {
    ...teamChatQuoteSelect,
    author_id: true,
    created_at: true,
    reply_to: { select: teamChatQuoteSelect },
    file: { select: teamFileReferenceSelect }
} satisfies Prisma.team_messagesSelect

type TeamChatRow = Prisma.team_messagesGetPayload<{ select: typeof teamChatMessageSelect }>
type TeamChatQuoteRow = Prisma.team_messagesGetPayload<{ select: typeof teamChatQuoteSelect }>

export const serializeTeamChatQuote = (message: TeamChatQuoteRow): TeamChatQuote => ({
    id: message.id.toString(), authorName: message.author?.username ?? null, excerpt: message.body.slice(0, 180)
})

export const serializeTeamChatMessage = (message: TeamChatRow, visibleFiles: Set<string>): TeamChatMessage => ({
    id: message.id.toString(),
    authorId: message.author_id,
    authorName: message.author?.username ?? null,
    body: message.body,
    createdAt: message.created_at.toISOString(),
    reply: message.reply_to ? serializeTeamChatQuote(message.reply_to) : null,
    file: message.file && visibleFiles.has(message.file.id) ? teamFileReference(message.file) : null
})

export function teamUnreadCounts(db: TeamDB, actor: string, teamIds: string[]) {
    return db.$queryRaw<{ team_id: string; unread: bigint }[]>`
        SELECT m.team_id, count(*) AS unread
        FROM team_messages m LEFT JOIN team_chat_reads r ON r.team_id = m.team_id AND r.user_id = ${actor}::uuid
        WHERE m.team_id = ANY(${teamIds}::uuid[]) AND m.id > COALESCE(r.last_read_id, 0)
          AND m.author_id IS DISTINCT FROM ${actor}::uuid
        GROUP BY m.team_id
    `
}

export function teamChatCursor(value: unknown): bigint | undefined {
    if (value === undefined) return
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value))
        throwError(400, 'Invalid message cursor.')
    const cursor = BigInt(value)
    if (cursor > 9223372036854775807n) throwError(400, 'Invalid message cursor.')
    return cursor
}
