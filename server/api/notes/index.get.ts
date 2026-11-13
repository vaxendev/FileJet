import { throwError } from '~~/server/utils/error'
import { prisma } from '~~/server/utils/prisma'
import { getAuthSession } from '~~/server/utils/auth'
import { libraryFolderScopes } from '~~/server/utils/hiddenItems'

export default defineEventHandler(async event => {
    try {
        const session = getAuthSession(event)

        if (!session) {
            throwError(401, 'You need to be logged in.')
        }

        const notes = await prisma.$transaction(async tx => {
            const { hiddenFolders } = await libraryFolderScopes(session.userId, tx)
            return tx.notes.findMany({
                where: {
                    user_id: session.userId,
                    hidden: false,
                    OR: [{ folder_id: null }, { folder_id: { notIn: [...hiddenFolders] } }]
                },
                orderBy: { created_at: 'desc' }
            })
        }, { isolationLevel: 'RepeatableRead' })

        return {
            notes: notes.map(note => ({ ...note, size: note.size.toString() }))
        }
    } catch (err: any) {
        if (err.statusCode) throw err

        throwError(500, 'Failed to fetch notes.')
    }
})
