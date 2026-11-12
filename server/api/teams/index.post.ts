import { prisma } from '../../utils/prisma'
import { lockStorageUser } from '../../utils/storage'
import { throwError } from '../../utils/error'
import { teamActor, readTeamBody, teamName, teamDescription, newTeamId } from '../../utils/teamSpaces'
import { hashTeamPassword, teamVisibility } from '../../utils/teamJoining'

export default defineEventHandler(async event => {
    const actor = teamActor(event),
        body = await readTeamBody(event)
    const name = teamName(body.name),
        description = teamDescription(body.description),
        isPublic = teamVisibility(body.isPublic),
        hash = isPublic ? null : await hashTeamPassword(body.password)
    const team = await prisma.$transaction(async tx => {
        await lockStorageUser(tx, actor)
        if ((await tx.team_spaces.count({ where: { owner_id: actor } })) >= 20)
            throwError(400, 'You can own up to 20 team spaces.')
        const id = newTeamId()
        const root = await tx.folders.create({ data: { user_id: actor, name: `Team ${id}` } })
        return tx.team_spaces.create({
            data: { id, name, description, owner_id: actor, root_folder_id: root.id, is_public: isPublic, join_password_hash: hash ?? null }
        })
    })
    setResponseStatus(event, 201)
    return { id: team.id }
})
