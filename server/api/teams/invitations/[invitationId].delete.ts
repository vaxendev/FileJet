import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { teamActor, teamParam } from '../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const id = teamParam(event, 'invitationId')
    const removed = await prisma.team_invitations.deleteMany({
        where: { id, OR: [{ user_id: actor }, { team: { owner_id: actor } }] }
    })
    if (!removed.count) throwError(404, 'This team invitation is unavailable.')
    return { success: true }
})
