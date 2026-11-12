import argon2 from 'argon2'
import { isUuid } from './validation'
import { throwError } from './error'
import { isTeamJoinKey } from '../../shared/types/team'
import type { TeamDB } from './teamSpaces'

export const teamVisibility = (value: unknown, fallback = false) => {
    if (value === undefined) return fallback
    if (typeof value !== 'boolean') throwError(400, 'Choose a valid team visibility.')
    return value
}

export async function hashTeamPassword(value: unknown) {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !value.trim() || value.length < 8 || value.length > 128)
        throwError(400, 'Use a team password between 8 and 128 characters.')
    return argon2.hash(value)
}

export async function findTeamJoinTarget(db: TeamDB, key: string | undefined) {
    if (!isTeamJoinKey(key)) throwError(404, 'This team invitation is unavailable.')
    const byId = isUuid(key)
    const team = await db.team_spaces.findUnique({
        where: byId ? { id: key } : { invite_token: key },
        select: {
            id: true,
            name: true,
            owner_id: true,
            is_public: true,
            join_password_hash: true,
            root: { select: { user_id: true, parent_folder_id: true } }
        }
    })
    if (
        !team ||
        team.root.user_id !== team.owner_id ||
        team.root.parent_folder_id !== null ||
        (!team.is_public && (byId || !team.join_password_hash))
    ) throwError(404, 'This team invitation is unavailable.')
    return team
}

export async function verifyTeamPassword(hash: string, password: unknown) {
    if (typeof password !== 'string' || password.length < 1 || password.length > 128)
        throwError(400, 'Enter the team password.')
    if (!(await argon2.verify(hash, password))) throwError(403, 'Incorrect team password.')
}
