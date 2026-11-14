import type { Prisma } from '~~/src/generated/prisma/client'
import type { AdminAccountAction, AdminAction, AdminEvent } from '../../shared/types/adminActivity'
interface AccountSnapshot { id: string; username: string; role: 'USER' | 'ADMIN'; storage_limit: bigint | null }
export async function writeAdminEvent(tx: Prisma.TransactionClient, actor: { id: string; username: string }, action: AdminAccountAction, target: AccountSnapshot, before?: AccountSnapshot) {
    return tx.admin_events.create({ data: {
        actor_id: actor.id, actor_username: actor.username, target_user_id: target.id, target_username: target.username, action,
        role_before: before?.role ?? (action === 'account_deleted' ? target.role : null),
        role_after: action === 'account_deleted' ? null : target.role,
        quota_before: before?.storage_limit ?? (action === 'account_deleted' ? target.storage_limit : null),
        quota_after: action === 'account_deleted' ? null : target.storage_limit
    } })
}

export function writeMessageDeletionEvent(tx: Prisma.TransactionClient, actor: { id: string; username: string },
    team: { id: string; name: string }, message: { id: bigint; author_id: string | null; author: { username: string } | null }) {
    return tx.admin_events.create({ data: {
        action: 'team_message_deleted',
        actor_id: actor.id,
        actor_username: actor.username,
        target_user_id: message.author_id,
        target_username: message.author?.username,
        team_id: team.id,
        team_name: team.name,
        message_id: message.id
    } })
}

export const adminEventView = (row: Prisma.admin_eventsGetPayload<object>): AdminEvent => ({
    id: row.id, actorId: row.actor_id, actorName: row.actor_username, userId: row.target_user_id, username: row.target_username,
    action: row.action as AdminAction, roleBefore: row.role_before, roleAfter: row.role_after,
    quotaBefore: row.quota_before?.toString() ?? null, quotaAfter: row.quota_after?.toString() ?? null, createdAt: row.created_at.toISOString(),
    ...(row.team_id && row.team_name && row.message_id !== null
        ? { team: { id: row.team_id, name: row.team_name, messageId: row.message_id.toString() } } : {})
})
