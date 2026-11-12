import type { Prisma } from '~~/src/generated/prisma/client'
import type { PublicTeam } from '../../../shared/types/team'
import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const query = getQuery(event)
    const search = typeof query.q === 'string' ? query.q.trim().slice(0, 120) : ''
    const page = typeof query.page === 'string' && /^[1-9]\d{0,5}$/.test(query.page) ? Number(query.page) : 1
    const perPage = 24
    const filter = { contains: search.replace(/[\\%_]/g, char => '\\' + char), mode: 'insensitive' as const }
    const where: Prisma.team_spacesWhereInput = {
        is_public: true,
        ...(search ? { OR: [{ name: filter }, { description: filter }, { owner: { username: filter } }] } : {})
    }
    const [rows, total] = await prisma.$transaction([
        prisma.team_spaces.findMany({
            where,
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true, name: true, description: true, owner_id: true,
                owner: { select: { username: true } },
                members: { where: { user_id: actor }, select: { user_id: true } }
            }
        }),
        prisma.team_spaces.count({ where })
    ], { isolationLevel: 'RepeatableRead' })
    const teams: PublicTeam[] = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        ownerName: row.owner.username,
        isMember: row.owner_id === actor || row.members.length > 0
    }))
    return { teams, totalPages: Math.ceil(total / perPage) }
})
