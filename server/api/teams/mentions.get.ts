import type { TeamMentionNotification } from '../../../shared/types/teamCollaboration'
import { prisma } from '../../utils/prisma'
import { teamActor } from '../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const rows = await prisma.team_chat_mentions.findMany({
        where: {
            user_id: actor,
            message: {
                created_at: { gte: new Date(Date.now() - 30 * 86400000) },
                team: { OR: [{ owner_id: actor }, { members: { some: { user_id: actor } } }] }
            }
        },
        orderBy: { message_id: 'desc' },
        take: 50,
        select: {
            message_id: true,
            message: { select: { team_id: true, team: { select: { name: true } }, author: { select: { username: true } } } }
        }
    })
    const mentions: TeamMentionNotification[] = rows.map(row => ({
        id: row.message_id.toString(),
        teamId: row.message.team_id,
        teamName: row.message.team.name,
        authorName: row.message.author?.username ?? null
    }))
    return { mentions }
})
