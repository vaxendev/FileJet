import { teamMessageLimit } from '../../../../../../shared/types/teamChat'
import { sameTeamMentions } from '../../../../../../shared/utils/teamMentions'
import { throwError } from '../../../../../utils/error'
import { teamChatCursor } from '../../../../../utils/teamChat'
import { readTeamBody, teamWrite } from '../../../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const body = await readTeamBody(event)
    const id = teamChatCursor(getRouterParam(event, 'messageId'))
    if (!id || typeof body.message !== 'string' || typeof body.editVersion !== 'string')
        throwError(400, 'Invalid request body.')
    const { editVersion } = body
    if (editVersion !== '0') teamChatCursor(editVersion)
    const message = body.message.trim()
    if (message.length > teamMessageLimit || message.includes('\0'))
        throwError(400, 'Enter a message between 1 and 2,000 characters.')

    return teamWrite(event, 'view', async (tx, team, actor) => {
        const row = await tx.team_messages.findFirst({
            where: { team_id: team.id, id },
            select: { body: true, author_id: true, file_id: true, edit_version: true }
        })
        if (!row) throwError(404, 'Team message not found.')
        if (row.author_id !== actor) throwError(403, 'You can only edit your own messages.')
        const currentVersion = row.edit_version?.toString() ?? '0'
        if (!message && !row.file_id) throwError(400, 'Enter a message between 1 and 2,000 characters.')
        if (!sameTeamMentions(row.body, message))
            throwError(400, 'Keep the original mentions when editing a message.')
        if (row.body === message) return { id: id.toString(), body: row.body, editVersion: currentVersion }
        if (currentVersion !== editVersion) throwError(409, 'This message changed. Reopen the editor and try again.')

        const [updated] = await tx.$queryRaw<{ edit_version: bigint }[]>`
            UPDATE team_messages
            SET body = ${message}, edit_version = nextval('team_message_edit_version_seq')
            WHERE team_id = ${team.id}::uuid AND id = ${id}
            RETURNING edit_version
        `
        return { id: id.toString(), body: message, editVersion: updated!.edit_version.toString() }
    })
})
