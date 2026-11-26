import { getAuthSession } from '~~/server/utils/auth'
import { throwError } from '~~/server/utils/error'
import { libraryFolderScopes } from '~~/server/utils/hiddenItems'
import { prisma } from '~~/server/utils/prisma'

export default defineEventHandler(async event => {
    const session = getAuthSession(event)
    if (!session) throwError(401, 'You need to be logged in.')
    setHeader(event, 'Cache-Control', 'private, no-store')

    try {
        const files = await prisma.$transaction(async tx => {
            const { hiddenFolders } = await libraryFolderScopes(session.userId, tx)
            return tx.files.findMany({
                where: {
                    user_id: session.userId,
                    hidden: false,
                    OR: [{ folder_id: null }, { folder_id: { notIn: [...hiddenFolders] } }]
                },
                orderBy: [{ created_at: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
                take: 12,
                select: { id: true, name: true, original_name: true, mime_type: true, size: true, created_at: true }
            })
        }, { isolationLevel: 'RepeatableRead' })

        return { files: files.map(file => ({ ...file, size: file.size.toString() })) }
    } catch (error: any) {
        if (error.statusCode) throw error
        throwError(500, 'Failed to fetch files.')
    }
})
