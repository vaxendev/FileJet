import { getRequestURL } from 'h3'
import { getAuthSession } from '../utils/auth'
import { protectHiddenRows } from '../utils/hiddenAccess'
import { ownedLibraryVisibility } from '../utils/hiddenItems'
import { isUuid } from '../utils/validation'

export default defineEventHandler(async event => {
    let path: string
    try { path = decodeURIComponent(getRequestURL(event).pathname) } catch { return }
    const match = /^\/api\/(files|folders|notes)\/([^/]+)(?:\/|$)/i.exec(path)
    if (!match) return
    const id = match[2]!
    if (!isUuid(id)) return
    const session = getAuthSession(event)
    if (!session) return
    const collection = match[1]!.toLowerCase()
    const type = collection === 'files' ? 'file' : collection === 'folders' ? 'folder' : 'note'
    const item = await ownedLibraryVisibility(session.userId, id, type)
    if (item) await protectHiddenRows(event, session.userId, [item])
})
