import { hiddenAccount, lockHidden } from '../../../utils/hiddenAccess'
import { assertShareOrigin } from '../../../utils/shares'

export default defineEventHandler(event => {
    assertShareOrigin(event)
    hiddenAccount(event)
    lockHidden(event)
    return { success: true }
})
