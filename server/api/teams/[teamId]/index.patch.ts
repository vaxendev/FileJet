import { readTeamBody, teamWrite, teamName, teamDescription } from '../../../utils/teamSpaces'
export default defineEventHandler(async event => {
    const body = await readTeamBody(event),
        name = teamName(body.name),
        description = teamDescription(body.description)
    await teamWrite(event, 'manage', async (tx, team) => {
        await tx.team_spaces.update({ where: { id: team.id }, data: { name, description } })
    })
    return { success: true }
})
