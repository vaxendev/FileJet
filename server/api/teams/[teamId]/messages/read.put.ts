import { throwError } from '../../../../utils/error'
import { teamChatCursor, teamUnreadCounts } from '../../../../utils/teamChat'
import { readTeamBody, teamWrite } from '../../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const through = teamChatCursor(body.through)
    if (through === undefined) throwError(400, 'Invalid message cursor.')
    return teamWrite(event, 'view', async (tx, team, actor) => {
        const message = await tx.team_messages.findFirst({
            where: { id: through, team_id: team.id }, select: { id: true }
        })
        if (!message) throwError(404, 'Team message not found.')
        await tx.$executeRaw`
            INSERT INTO team_chat_reads (team_id, user_id, last_read_id)
            VALUES (${team.id}::uuid, ${actor}::uuid, ${through})
            ON CONFLICT (team_id, user_id) DO UPDATE
            SET last_read_id = GREATEST(team_chat_reads.last_read_id, EXCLUDED.last_read_id)
        `
        const counts = await teamUnreadCounts(tx, actor, [team.id])
        return { unreadCount: Number(counts[0]?.unread ?? 0) }
    })
})
