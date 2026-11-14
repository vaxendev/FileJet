import type { TeamFileReference } from './teamCollaboration'

export const teamMessageLimit = 2000

export interface TeamChatQuote {
    id: string
    authorName: string | null
    excerpt: string
    editVersion: string
}

export interface TeamChatMessage {
    id: string
    authorId: string | null
    authorName: string | null
    body: string
    createdAt: string
    editVersion: string
    reply: TeamChatQuote | null
    file: TeamFileReference | null
}

export type TeamChatEdit = Pick<TeamChatMessage, 'id' | 'body' | 'editVersion'>

export interface TeamChatPage {
    messages: TeamChatMessage[]
    hasMore: boolean
    pinned: TeamChatQuote[]
    unreadCount: number
    edits: TeamChatEdit[]
    editCursor: string
}
