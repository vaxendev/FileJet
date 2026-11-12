import { prisma } from '../../../utils/prisma'
import { teamActor, teamParam, teamAccess, teamFolder, teamFolderQuery } from '../../../utils/teamSpaces'
import { getFolderContents } from '../../../utils/folderContents'
export default defineEventHandler(async event => {
    const actor = teamActor(event),
        id = teamParam(event),
        folderId = teamFolderQuery(event)
    return prisma.$transaction(
        async tx => {
            const team = await teamAccess(tx, id, actor)
            const folder = await teamFolder(tx, team, folderId)
            const [contents, members, invitations] = await Promise.all([
                getFolderContents(team.owner_id, folder.id, false, tx),
                tx.team_members.findMany({
                    where: { team_id: team.id },
                    include: { user: { select: { username: true } } },
                    orderBy: { created_at: 'asc' }
                }),
                team.role === 'OWNER'
                    ? tx.team_invitations.findMany({
                          where: { team_id: team.id },
                          select: { id: true, role: true, user: { select: { username: true } } },
                          orderBy: { created_at: 'desc' }
                      })
                    : undefined
            ])
            return {
                id: team.id,
                name: team.name,
                description: team.description,
                ownerId: team.owner_id,
                ownerName: team.owner.username,
                role: team.role,
                isPublic: team.is_public,
                hasJoinPassword: team.role === 'OWNER' && Boolean(team.join_password_hash),
                ...(team.role === 'OWNER' ? { inviteToken: team.invite_token } : {}),
                ...(invitations ? {
                    invitations: invitations.map(({ id, role, user }) => ({ id, role, username: user.username }))
                } : {}),
                memberCount: members.length + 1,
                createdAt: team.created_at.toISOString(),
                folderId: folder.id,
                breadcrumbs: folder.breadcrumbs,
                items: contents.items.filter(item => item.type !== 'note'),
                members: [
                    { id: team.owner_id, username: team.owner.username, role: 'OWNER' },
                    ...members.map(member => ({
                        id: member.user_id,
                        username: member.user.username,
                        role: member.role
                    }))
                ]
            }
        },
        { isolationLevel: 'RepeatableRead' }
    )
})
