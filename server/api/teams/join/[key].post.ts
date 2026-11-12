import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { enforceRateLimit } from '../../../utils/rateLimit'
import { findTeamJoinTarget, verifyTeamPassword } from '../../../utils/teamJoining'
import { addTeamMember, lockTeam, readTeamBody, teamActor, teamMemberRole } from '../../../utils/teamSpaces'

export default defineEventHandler(async event => {
    const actor = teamActor(event)
    const body = await readTeamBody(event)
    const key = getRouterParam(event, 'key')
    const initial = await findTeamJoinTarget(prisma, key)
    if (await teamMemberRole(prisma, initial, actor)) return { teamId: initial.id }
    if (!initial.is_public && initial.join_password_hash) {
        enforceRateLimit(event, 'team-join-password', 20, 60000)
        enforceRateLimit(event, `team-join-password:${initial.id}`, 5, 60000)
        await verifyTeamPassword(initial.join_password_hash, body.password)
    }
    return prisma.$transaction(async tx => {
        await lockTeam(tx, initial)
        const team = await findTeamJoinTarget(tx, key)
        if (team.id !== initial.id || team.is_public !== initial.is_public || team.join_password_hash !== initial.join_password_hash)
            throwError(409, 'Team invitation settings changed. Try again.')
        if (!(await teamMemberRole(tx, team, actor))) await addTeamMember(tx, team.id, actor, 'VIEWER')
        return { teamId: team.id }
    })
})
