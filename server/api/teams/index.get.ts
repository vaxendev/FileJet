import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const teams = await prisma.team_spaces.findMany({
        where: { OR: [{ owner_id: actor }, { members: { some: { user_id: actor } } }] },
        include: {
            owner: { select: { username: true } },
            members: { where: { user_id: actor }, select: { role: true } },
            _count: { select: { members: true } }
        },
        orderBy: { created_at: 'desc' }
    })
    return {
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
                          createdAt: team.created_at.toISOString()
                      }
                  ]
                : []
        })
    }
})
