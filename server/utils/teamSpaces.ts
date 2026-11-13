import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import type { Prisma } from '~~/src/generated/prisma/client'
import { prisma } from './prisma'
import { getAuthSession } from './auth'
import { throwError } from './error'
import { isUuid } from './validation'
import { lockStorageUser } from './storage'
import { assertShareOrigin } from './shares'
import { teamCan, type TeamPermission, type TeamRole } from '../../shared/types/team'

export type TeamDB = Prisma.TransactionClient
export const teamActor = (event: H3Event) => {
    const actor = getAuthSession(event)?.userId
    if (!actor) throwError(401, 'You need to be logged in.')
    setHeader(event, 'Cache-Control', 'private, no-store')
    if (!event.context.teamRequestChecked) {
        const reading = event.method === 'GET' || event.method === 'HEAD'
        if (!reading) assertShareOrigin(event)
        enforceRateLimit(event, `teams:${actor}:${event.method}`, reading ? 240 : 30, 60000)
        event.context.teamRequestChecked = true
    }
    return actor
}
export async function readTeamBody(event: H3Event): Promise<Record<string, unknown>> {
    teamActor(event)
    const body = await readBody(event)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throwError(400, 'Invalid request body.')
    return body
}
export const teamParam = (event: H3Event, name = 'teamId') => {
    const value = getRouterParam(event, name)
    if (!value || !isUuid(value)) throwError(400, 'Invalid team resource ID.')
    return value
}
export const teamFolderQuery = (event: H3Event): string | undefined => {
    const value = getQuery(event).folderId
    if (value === undefined) return
    if (typeof value !== 'string' || !isUuid(value)) throwError(400, 'Invalid folder ID.')
    return value
}
export async function teamAccess(db: TeamDB, id: string, actor: string, permission: TeamPermission = 'view') {
    const team = await db.team_spaces.findUnique({
        where: { id },
        include: {
            owner: { select: { username: true } },
            root: { select: { user_id: true, parent_folder_id: true } }
        }
    })
    if (!team || team.root.user_id !== team.owner_id || team.root.parent_folder_id !== null)
        throwError(404, 'Team space not found.')
    const role = await teamMemberRole(db, team, actor)
    if (!role) throwError(404, 'Team space not found.')
    if (!teamCan(role, permission)) throwError(403, 'Your team role does not allow this action.')
    return { ...team, role }
}
export type TeamAccess = Awaited<ReturnType<typeof teamAccess>>

export async function teamMemberRole(db: TeamDB, team: { id: string; owner_id: string }, actor: string): Promise<TeamRole | undefined> {
    if (team.owner_id === actor) return 'OWNER'
    const member = await db.team_members.findUnique({
        where: { team_id_user_id: { team_id: team.id, user_id: actor } },
        select: { role: true }
    })
    return member?.role
}

export async function lockTeam(tx: TeamDB, team: { id: string; owner_id: string }) {
    await lockStorageUser(tx, team.owner_id)
    await tx.$queryRaw`SELECT id FROM team_spaces WHERE id = ${team.id}::uuid FOR UPDATE`
}

export async function addTeamMember(tx: TeamDB, teamId: string, userId: string, role: Exclude<TeamRole, 'OWNER'>) {
    if ((await tx.team_members.count({ where: { team_id: teamId } })) >= 99)
        throwError(400, 'A team space can have up to 100 members.')
    await tx.team_members.create({ data: { team_id: teamId, user_id: userId, role } })
}

// Team writes and membership changes share this lock. Recheck membership after
// slow uploads/scans so revocation cannot race a write. Match personal storage's lock order.
export async function teamWrite<T>(
    event: H3Event,
    permission: TeamPermission,
    run: (tx: TeamDB, team: TeamAccess, actor: string) => Promise<T>
) {
    const actor = teamActor(event),
        id = teamParam(event)
    const initial = await teamAccess(prisma, id, actor, permission)
    return prisma.$transaction(
        async tx => {
            await lockTeam(tx, initial)
            const team = await teamAccess(tx, id, actor, permission)
            return run(tx, team, actor)
        },
        { maxWait: 10000, timeout: 60000 }
    )
}

export async function teamFolder(db: TeamDB, team: TeamAccess, id = team.root_folder_id) {
    if (!isUuid(id)) throwError(400, 'Invalid folder ID.')
    const seen = new Set<string>(),
        breadcrumbs: { id: string; name: string }[] = []
    let current: string | null = id
    while (current && !seen.has(current)) {
        seen.add(current)
        const folder: {
            id: string
            name: string
            parent_folder_id: string | null
            team_space: { id: string } | null
        } | null = await db.folders.findFirst({
            where: { id: current, user_id: team.owner_id, hidden: false },
            select: { id: true, name: true, parent_folder_id: true, team_space: { select: { id: true } } }
        })
        if (!folder || (folder.team_space && folder.id !== team.root_folder_id)) break
        breadcrumbs.unshift({
            id: folder.id,
            name: folder.id === team.root_folder_id ? team.name : folder.name
        })
        if (folder.id === team.root_folder_id) return { id, breadcrumbs }
        current = folder.parent_folder_id
    }
    throwError(404, 'Item not found in this team space.')
}

export async function teamFile(db: TeamDB, team: TeamAccess, id: string) {
    const file = await db.files.findFirst({ where: { id, user_id: team.owner_id, hidden: false } })
    if (!file?.folder_id) throwError(404, 'File not found.')
    await teamFolder(db, team, file.folder_id)
    return file
}

export const teamName = (value: unknown) => {
    if (
        typeof value !== 'string' ||
        !value.trim() ||
        value.trim().length > 120 ||
        /[\u0000-\u001f\u007f]/.test(value)
    )
        throwError(400, 'Enter a team name between 1 and 120 characters.')
    return value.trim()
}
export const teamDescription = (value: unknown) => {
    if (value === undefined) return ''
    if (typeof value !== 'string' || value.length > 500)
        throwError(400, 'Team description must be 500 characters or fewer.')
    return value.trim()
}
export const memberRole = (value: unknown): 'VIEWER' | 'UPLOADER' | 'EDITOR' => {
    if (value !== 'VIEWER' && value !== 'UPLOADER' && value !== 'EDITOR')
        throwError(400, 'Choose a valid team role.')
    return value
}
export async function teamNameAvailable(
    db: TeamDB,
    team: TeamAccess,
    folderId: string,
    name: string,
    except?: string
) {
    const match = { equals: name, mode: 'insensitive' as const }
    const [folder, file] = await Promise.all([
        db.folders.findFirst({
            where: {
                user_id: team.owner_id,
                parent_folder_id: folderId,
                name: match,
                ...(except ? { id: { not: except } } : {})
            },
            select: { id: true }
        }),
        db.files.findFirst({
            where: {
                user_id: team.owner_id,
                folder_id: folderId,
                original_name: match,
                ...(except ? { id: { not: except } } : {})
            },
            select: { id: true }
        })
    ])
    if (folder || file) throwError(409, 'An item with this name already exists in the destination.')
}

// Reuse personal Trash semantics: versions, bytes and content stay recoverable
// by the space owner. Physical files are never removed before a committed change.
export async function trashTeamItem(tx: TeamDB, team: TeamAccess, type: 'file' | 'folder', id: string) {
    if (type === 'file') {
        const file = await teamFile(tx, team, id)
        const deleted = await tx.trash.create({
            data: {
                user_id: team.owner_id,
                item_id: file.id,
                item_type: 'file',
                tags: file.tags,
                hidden: file.hidden,
                name: file.name,
                original_name: file.original_name,
                mime_type: file.mime_type,
                size: file.size,
                revision: file.revision,
                storage_key: file.storage_key,
                folder_id: file.folder_id
            }
        })
        await tx.favorites.deleteMany({ where: { file_id: id } })
        await tx.files.delete({ where: { id } })
        return deleted.id
    }
    await teamFolder(tx, team, id)
    const ids = new Set([id])
    let pending = [id]
    while (pending.length) {
        const children = await tx.folders.findMany({
            where: { user_id: team.owner_id, parent_folder_id: { in: pending } },
            select: { id: true }
        })
        pending = children.filter(child => !ids.has(child.id)).map(child => child.id)
        pending.forEach(child => ids.add(child))
    }
    const where = { user_id: team.owner_id },
        folderIds = [...ids]
    const [folders, files, notes] = await Promise.all([
        tx.folders.findMany({ where: { ...where, id: { in: folderIds } } }),
        tx.files.findMany({ where: { ...where, folder_id: { in: folderIds } } }),
        tx.notes.findMany({ where: { ...where, folder_id: { in: folderIds } } })
    ])
    await tx.trash.createMany({
        data: [
            ...folders.map(folder => ({
                ...where,
                item_id: folder.id,
                item_type: 'folder',
                name: folder.id === team.root_folder_id ? team.name : folder.name,
                tags: folder.tags,
                hidden: folder.hidden,
                parent_folder_id: folder.parent_folder_id,
                root_folder_id: id
            })),
            ...files.map(file => ({
                ...where,
                item_id: file.id,
                item_type: 'file',
                name: file.name,
                original_name: file.original_name,
                tags: file.tags,
                hidden: file.hidden,
                mime_type: file.mime_type,
                size: file.size,
                revision: file.revision,
                storage_key: file.storage_key,
                folder_id: file.folder_id,
                root_folder_id: id
            })),
            ...notes.map(note => ({
                ...where,
                item_id: note.id,
                item_type: 'note',
                name: note.title,
                content: note.content,
                size: note.size,
                tags: note.tags,
                hidden: note.hidden,
                revision: note.revision,
                folder_id: note.folder_id,
                root_folder_id: id
            }))
        ]
    })
    await tx.favorites.deleteMany({
        where: {
            OR: [
                { folder_id: { in: folderIds } },
                { file_id: { in: files.map(file => file.id) } },
                { note_id: { in: notes.map(note => note.id) } }
            ]
        }
    })
    await tx.folders.deleteMany({ where: { ...where, id: { in: folderIds } } })
    return id
}
export const newTeamId = () => randomUUID()
