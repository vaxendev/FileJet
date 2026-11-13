import { hiddenAccount, hiddenGrantExpiry, hiddenPasswordHash } from '../../../utils/hiddenAccess'

export default defineEventHandler(async event => {
    const hash = await hiddenPasswordHash(hiddenAccount(event))
    return { configured: Boolean(hash), expiresAt: hiddenGrantExpiry(event, hash) }
})
