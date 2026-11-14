import { $fetch as fetchAccess } from 'ofetch'
import { isHiddenNavigation } from '~/utils/fileNavigation'

type HiddenAccess = { configured: boolean; expiresAt: number | null }
const accessUrl = '/api/items/hidden/access'

export default defineNuxtPlugin(() => {
    const router = useRouter()
    let pending: Promise<unknown> = Promise.resolve()
    const queue = <T>(run: () => Promise<T>) => {
        const result = pending.then(run)
        pending = result.catch(() => {})
        return result
    }
    const lock = () => queue(() => fetchAccess(accessUrl, { method: 'DELETE', timeout: 10000, keepalive: true }))
    let needsLock = true
    const revoke = async () => {
        needsLock = true
        await lock()
        needsLock = false
    }
    let exitLock: Promise<unknown> | undefined
    router.afterEach((to, from, failure) => {
        if (!failure && isHiddenNavigation(from.fullPath) && !isHiddenNavigation(to.fullPath)) {
            exitLock = revoke().catch(() => {})
        }
    })

    window.addEventListener('pagehide', () => {
        if (!isHiddenNavigation(router.currentRoute.value.fullPath)) return
        needsLock = true
        void fetch(accessUrl, { method: 'DELETE', keepalive: true }).catch(() => {})
    })
    window.addEventListener('pageshow', event => {
        if (event.persisted && isHiddenNavigation(router.currentRoute.value.fullPath)) window.location.reload()
    })

    return {
        provide: {
            hiddenAccess: {
                async status() {
                    await exitLock
                    if (needsLock) await revoke()
                    return fetchAccess<HiddenAccess>(accessUrl, { timeout: 10000 })
                },
                unlock: (body: { setup: boolean; password: string; confirmPassword: string }) =>
                    queue(() => fetchAccess<HiddenAccess>(accessUrl, { method: 'POST', body, timeout: 15000 })),
                lock
            }
        }
    }
})
