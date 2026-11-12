import type { Prisma } from '~~/src/generated/prisma/client'
import type { TeamChatMessage } from '../../shared/types/teamChat'
import { throwError } from './error'

export const teamChatMessageSelect = {
    id: true,
    author_id: true,
    author: { select: { username: true } },
    body: true,
    created_at: true
} satisfies Prisma.team_messagesSelect

type TeamChatRow = Prisma.team_messagesGetPayload<{ select: typeof teamChatMessageSelect }>

export const serializeTeamChatMessage = (message: TeamChatRow): TeamChatMessage => ({
    id: message.id.toString(),
    authorId: message.author_id,
    authorName: message.author?.username ?? null,
    body: message.body,
    createdAt: message.created_at.toISOString()
})

export function teamChatCursor(value: unknown): bigint | undefined {
    if (value === undefined) return
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value))
        throwError(400, 'Invalid message cursor.')
    const cursor = BigInt(value)
    if (cursor > 9223372036854775807n) throwError(400, 'Invalid message cursor.')
    return cursor
}
