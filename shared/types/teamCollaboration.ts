export interface TeamFileReference {
    id: string
    name: string
    size: string
    mime_type: string | null
    revision?: number
}

export interface TeamTask {
    id: string
    messageId: string | null
    title: string
    assigneeName: string | null
    dueOn: string
    completed: boolean
    canUpdate: boolean
}

export type TeamReviewStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED'

export interface TeamFileReview {
    id: string
    file: TeamFileReference | null
    revision: number
    stale: boolean
    reviewerName: string | null
    requesterName: string | null
    status: TeamReviewStatus
    requestNote: string
    responseNote: string
    canRespond: boolean
}

export interface TeamListPage<T> {
    items: T[]
    next: string | null
}

export interface TeamMentionNotification {
    id: string
    teamId: string
    teamName: string
    authorName: string | null
}
