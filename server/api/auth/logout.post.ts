import { throwError } from '~~/server/utils/error'
import { lockHidden } from '~~/server/utils/hiddenAccess'
export default defineEventHandler(event => {
    try {
        clearAuthSession(event)
        lockHidden(event)

        return {
            success: true
        }
    } catch {
        throwError(500, 'An error occurred while logging out.')
    }
})
