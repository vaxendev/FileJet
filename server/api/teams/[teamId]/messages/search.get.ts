import type { TeamChatSearchPage } from '../../../../../shared/types/teamChat'
import { throwError } from '../../../../utils/error'
import { prisma } from '../../../../utils/prisma'
import { teamChatCursor } from '../../../../utils/teamChat'
import { teamReferenceIds } from '../../../../utils/teamCollaboration'
import { teamAccess, teamActor, teamParam } from '../../../../utils/teamSpaces'

const pageSize = 25
const literalText = (value: string) => value.replace(/[\\%_]/g, '\\$&')
function searchText(value: unknown) {
    if (value === undefined) return ''
    if (typeof value !== 'string' || value.length > 120 || value.includes('\0'))
        throwError(400, 'Invalid message search.')
    return value.trim()
}

export default defineEventHandler(async (event): Promise<TeamChatSearchPage> => {
    const actor = teamActor(event)
    const teamId = teamParam(event)
    const query = getQuery(event)
    const text = searchText(query.q)
    const file = searchText(query.file)
    const author = searchText(query.author)
    const before = teamChatCursor(query.before)
    if (!text && !file && !author) throwError(400, 'Enter a message, author, or file name to search.')

    return prisma.$transaction(async tx => {
        const team = await teamAccess(tx, teamId, actor)
        const matched = file ? await tx.$queryRaw<{ id: bigint }[]>`
            WITH RECURSIVE team_folders(id) AS (
                SELECT ${team.root_folder_id}::uuid
                UNION
                SELECT f.id FROM folders f JOIN team_folders p ON p.id = f.parent_folder_id
                WHERE f.user_id = ${team.owner_id}::uuid AND NOT f.hidden
                  AND NOT EXISTS (SELECT 1 FROM team_spaces t WHERE t.root_folder_id = f.id)
            )
            SELECT m.id FROM files f JOIN team_folders tf ON tf.id = f.folder_id
            JOIN team_messages m ON m.file_id = f.id
            LEFT JOIN users u ON u.id = m.author_id
            WHERE m.team_id = ${teamId}::uuid AND m.deleted_at IS NULL
              AND f.user_id = ${team.owner_id}::uuid AND NOT f.hidden
              AND strpos(lower(f.original_name), lower(${file})) > 0
              AND (${author} = '' OR strpos(lower(u.username), lower(${author})) > 0)
              AND (${before ?? null}::bigint IS NULL OR m.id < ${before ?? null}::bigint)
              AND (${text} = '' OR strpos(lower(m.body), lower(${text})) > 0)
            ORDER BY m.id DESC
            LIMIT ${pageSize + 1}
        ` : null
        const rows = await tx.team_messages.findMany({
            where: {
                team_id: teamId, deleted_at: null,
                author: !matched && author ? { username: { contains: literalText(author), mode: 'insensitive' } } : undefined,
                id: matched ? { in: matched.map(row => row.id) } : { lt: before },
                body: !matched && text ? { contains: literalText(text), mode: 'insensitive' } : undefined
            },
            orderBy: { id: 'desc' },
            take: pageSize + 1,
            select: { id: true, body: true, created_at: true, author: { select: { username: true } },
                file: { select: { id: true, original_name: true } } }
        })
        const page = rows.slice(0, pageSize)
        const fileIds = page.flatMap(row => row.file ? [row.file.id] : [])
        const visible = new Set(fileIds.length ? (await teamReferenceIds(tx, team, fileIds)).map(row => row.id) : [])
        return {
            items: page.map(row => {
                const start = text ? Math.max(0, row.body.toLowerCase().indexOf(text.toLowerCase()) - 50) : 0
                return {
                    id: row.id.toString(),
                    authorName: row.author?.username ?? null,
                    excerpt: (start ? '…' : '') + row.body.slice(start, start + 200) + (row.body.length > start + 200 ? '…' : ''),
                    createdAt: row.created_at.toISOString(),
                    fileName: row.file && visible.has(row.file.id) ? row.file.original_name : null
                }
            }),
            next: rows.length > pageSize ? page.at(-1)!.id.toString() : null
        }
    }, { isolationLevel: 'RepeatableRead' })
})
