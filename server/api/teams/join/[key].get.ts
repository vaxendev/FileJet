import type { TeamJoinPreview } from '../../../../shared/types/team'
import { prisma } from '../../../utils/prisma'
import { findTeamJoinTarget } from '../../../utils/teamJoining'
import { teamActor, teamMemberRole } from '../../../utils/teamSpaces'

export default defineEventHandler(async (event): Promise<TeamJoinPreview> => {
    const actor = teamActor(event)
    const team = await findTeamJoinTarget(prisma, getRouterParam(event, 'key'))
    const isMember = Boolean(await teamMemberRole(prisma, team, actor))
    return {
        teamId: isMember ? team.id : null,
        name: team.is_public ? team.name : null,
        requiresPassword: !team.is_public && !isMember
    }
})
