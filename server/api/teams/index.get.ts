import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'
import { teamUnreadCounts } from '../../utils/teamChat'
export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const { teams, invitations, unread } = await prisma.$transaction(async tx => {
        const [teams, invitations] = await Promise.all([
            tx.team_spaces.findMany({
                where: { OR: [{ owner_id: actor }, { members: { some: { user_id: actor } } }] },
                include: {
                    owner: { select: { username: true } },
                    members: { where: { user_id: actor }, select: { role: true } },
                    _count: { select: { members: true } }
                },
                orderBy: { created_at: 'desc' }
            }),
            tx.team_invitations.findMany({
                where: { user_id: actor },
                select: {
                    id: true,
                    role: true,
                    team: { select: { name: true, owner: { select: { username: true } } } }
                },
                orderBy: { created_at: 'desc' }
            })
        ])
        const counts = teams.length ? await teamUnreadCounts(tx, actor, teams.map(team => team.id)) : []
        return { teams, invitations, unread: new Map(counts.map(row => [row.team_id, Number(row.unread)])) }
    }, { isolationLevel: 'RepeatableRead' })
    return {
        invitations: invitations.map(invitation => ({
            id: invitation.id,
            role: invitation.role,
            teamName: invitation.team.name,
            ownerName: invitation.team.owner.username
        })),
        teams: teams.flatMap(team => {
            const role = team.owner_id === actor ? 'OWNER' : team.members[0]?.role
            return role
                ? [
                      {
                          id: team.id,
                          name: team.name,
                          description: team.description,
                          ownerId: team.owner_id,
                          ownerName: team.owner.username,
                          role,
                          isPublic: team.is_public,
                          memberCount: team._count.members + 1,
                          unreadCount: unread.get(team.id) ?? 0,
                          createdAt: team.created_at.toISOString()
                      }
                  ]
                : []
        })
    }
})
