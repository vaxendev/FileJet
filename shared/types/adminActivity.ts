import type { ActivityEntry } from './activity'
export const adminActionLabels = {
    account_created: 'Account created',
    account_updated: 'Account updated',
    account_deleted: 'Account deleted',
    team_message_deleted: 'Team message deleted'
} as const
export type AdminAction = keyof typeof adminActionLabels
export type AdminAccountAction = Exclude<AdminAction, 'team_message_deleted'>
export interface AdminEvent {
    id: string; actorId: string | null; actorName: string; userId: string | null; username: string | null; action: AdminAction
    team?: { id: string; name: string; messageId: string }
    roleBefore: 'USER' | 'ADMIN' | null; roleAfter: 'USER' | 'ADMIN' | null
    quotaBefore: string | null; quotaAfter: string | null; createdAt: string
}
export interface AdminUserActivity extends ActivityEntry { userId: string; username: string }
export type AdminHistoryPage = { source: 'user'; items: AdminUserActivity[]; nextCursor: string | null } | { source: 'admin'; items: AdminEvent[]; nextCursor: string | null }
