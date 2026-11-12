export const teamMessageLimit = 2000

export interface TeamChatMessage {
    id: string
    authorId: string | null
    authorName: string | null
    body: string
    createdAt: string
}

export interface TeamChatPage {
    messages: TeamChatMessage[]
    hasMore: boolean
}
