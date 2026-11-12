import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { addTeamMember, lockTeam, teamActor, teamMemberRole, teamParam } from '../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const id = teamParam(event, 'invitationId')
    const where = { id, user_id: actor }
    const invitation = await prisma.team_invitations.findFirst({
        where,
        select: {
            role: true,
            team: {
                select: { id: true, owner_id: true, root: { select: { user_id: true, parent_folder_id: true } } }
            }
        }
    })
    if (!invitation) throwError(404, 'This team invitation is unavailable.')
    const { team, role } = invitation
    if (team.root.user_id !== team.owner_id || team.root.parent_folder_id !== null)
        throwError(404, 'This team invitation is unavailable.')

    return prisma.$transaction(async tx => {
        await lockTeam(tx, team)
        // Claim the invitation before creating membership. A failed join rolls back the claim.
        const claimed = await tx.team_invitations.deleteMany({ where })
        if (!claimed.count) throwError(404, 'This team invitation is unavailable.')
        if (!(await teamMemberRole(tx, team, actor))) await addTeamMember(tx, team.id, actor, role)
        return { teamId: team.id }
    })
})
