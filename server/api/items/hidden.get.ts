import type { LibraryItem } from '~~/shared/types/library'
import { prisma } from '~~/server/utils/prisma'
import { getAuthSession } from '~~/server/utils/auth'
import { throwError } from '~~/server/utils/error'

export default defineEventHandler(async event => {
    const userId = getAuthSession(event)?.userId
    if (!userId) throwError(401, 'You need to be logged in.')
    setHeader(event, 'Cache-Control', 'private, no-store')
    const where = { user_id: userId, hidden: true }
    const dates = { id: true, created_at: true, updated_at: true } as const
    const [files, folders, notes] = await prisma.$transaction([
        prisma.files.findMany({ where, select: { ...dates, original_name: true, mime_type: true, size: true } }),
        prisma.folders.findMany({ where, select: { ...dates, name: true } }),
        prisma.notes.findMany({ where, select: { ...dates, title: true, size: true } })
    ], { isolationLevel: 'RepeatableRead' })
    const rows = [
        ...files.map(({ original_name, size, ...row }) => ({ ...row, name: original_name, size: size.toString(), type: 'file' as const })),
        ...folders.map(row => ({ ...row, size: '0', type: 'folder' as const })),
        ...notes.map(({ title, size, ...row }) => ({ ...row, name: title, size: size.toString(), type: 'note' as const }))
    ]
    const items: LibraryItem[] = rows.map(row => ({
        ...row,
        created_at: row.created_at?.toISOString() ?? null,
        updated_at: row.updated_at?.toISOString() ?? null
    }))
    return { items }
})
