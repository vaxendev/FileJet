import type { TeamFileReference } from './teamCollaboration'

export const teamMessageLimit = 2000

export interface TeamChatQuote {
    id: string
    authorName: string | null
    excerpt: string
}

export interface TeamChatMessage {
    id: string
    authorId: string | null
    authorName: string | null
    body: string
    createdAt: string
    reply: TeamChatQuote | null
    file: TeamFileReference | null
}

export interface TeamChatPage {
    messages: TeamChatMessage[]
    hasMore: boolean
    pinned: TeamChatQuote[]
    unreadCount: number
}
