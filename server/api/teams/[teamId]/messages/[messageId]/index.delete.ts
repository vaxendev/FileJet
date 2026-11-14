import { requireAdmin } from '../../../../../utils/admin'
import { throwError } from '../../../../../utils/error'
import { teamChatCursor } from '../../../../../utils/teamChat'
import { teamWrite } from '../../../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const id = teamChatCursor(getRouterParam(event, 'messageId'))
    if (id === undefined) throwError(400, 'Invalid message ID.')

    return teamWrite(event, 'view', async (tx, team, actor) => {
        const message = await tx.team_messages.findFirst({
            where: { team_id: team.id, id },
            select: { author_id: true, deleted_at: true, edit_version: true }
        })
        if (!message) throwError(404, 'Team message not found.')
        if (message.author_id !== actor) await requireAdmin(event, tx)
        if (message.deleted_at) return { id: id.toString(), body: null, editVersion: message.edit_version!.toString() }

        const [deleted] = await tx.$queryRaw<{ edit_version: bigint }[]>`
            UPDATE team_messages
            SET deleted_at = now(), body = '', file_id = NULL, reply_to_id = NULL,
                pinned_at = NULL, edit_version = nextval('team_message_edit_version_seq')
            WHERE team_id = ${team.id}::uuid AND id = ${id}
            RETURNING edit_version
        `
        await tx.team_messages.updateMany({ where: { team_id: team.id, reply_to_id: id }, data: { reply_to_id: null } })
        await tx.team_chat_mentions.deleteMany({ where: { message_id: id } })
        await tx.team_tasks.updateMany({ where: { team_id: team.id, message_id: id }, data: { message_id: null } })

        return { id: id.toString(), body: null, editVersion: deleted!.edit_version.toString() }
    })
})
