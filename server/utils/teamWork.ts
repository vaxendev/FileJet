import type { Prisma } from '~~/src/generated/prisma/client'
import type { TeamFileReview, TeamTask } from '../../shared/types/teamCollaboration'
import { teamFileReference, teamFileReferenceSelect } from './teamCollaboration'
import { throwError } from './error'
import type { TeamAccess } from './teamSpaces'

export const taskSelect = {
    id: true, message_id: true, title: true, due_on: true, completed_at: true, created_by_id: true,
    assignee_id: true, assignee: { select: { username: true } }
} satisfies Prisma.team_tasksSelect
type TaskRow = Prisma.team_tasksGetPayload<{ select: typeof taskSelect }>

export const taskCanUpdate = (task: TaskRow, team: TeamAccess, actor: string) =>
    team.role === 'OWNER' || task.assignee_id === actor || task.created_by_id === actor

export const serializeTeamTask = (task: TaskRow, team: TeamAccess, actor: string): TeamTask => ({
    id: task.id,
    messageId: task.message_id?.toString() ?? null,
    title: task.title,
    assigneeName: task.assignee?.username ?? null,
    dueOn: task.due_on.toISOString().slice(0, 10),
    completed: Boolean(task.completed_at),
    canUpdate: taskCanUpdate(task, team, actor)
})

export function taskDueDate(value: unknown): Date {
    if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
        throwError(400, 'Choose a valid due date.')
    const date = new Date(value + 'T00:00:00Z')
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
        throwError(400, 'Choose a valid due date.')
    return date
}

export const reviewSelect = {
    id: true, revision: true, status: true, request_note: true, response_note: true, reviewer_id: true,
    file: { select: { ...teamFileReferenceSelect, revision: true } },
    reviewer: { select: { username: true } },
    requester: { select: { username: true } }
} satisfies Prisma.team_file_reviewsSelect
type ReviewRow = Prisma.team_file_reviewsGetPayload<{ select: typeof reviewSelect }>

export function serializeTeamReview(review: ReviewRow, actor: string, visible: boolean): TeamFileReview {
    const stale = review.revision !== review.file.revision
    return {
        id: review.id,
        file: visible ? { ...teamFileReference(review.file), revision: review.revision } : null,
        revision: review.revision,
        stale,
        reviewerName: review.reviewer?.username ?? null,
        requesterName: review.requester?.username ?? null,
        status: review.status,
        requestNote: review.request_note,
        responseNote: review.response_note,
        canRespond: visible && !stale && review.status === 'PENDING' && review.reviewer_id === actor
    }
}
