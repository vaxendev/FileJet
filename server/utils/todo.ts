import type { H3Event } from 'h3'
import { todoTitleLimit } from '../../shared/types/todo'
import { getAuthSession } from './auth'
import { throwError } from './error'
import { enforceRateLimit } from './rateLimit'
import { assertShareOrigin } from './shares'
import { isUuid } from './validation'

export const todoSelect = { id: true, title: true, completed: true } as const

export function todoOwner(event: H3Event) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    const actor = getAuthSession(event)?.userId
    if (!actor) throwError(401, 'You need to be logged in.')
    if (event.method !== 'GET') {
        assertShareOrigin(event)
        enforceRateLimit(event, `todo:${actor}`, 120, 60000)
    }
    return actor
}

export function todoId(value: unknown) {
    if (typeof value !== 'string' || !isUuid(value)) throwError(400, 'Invalid request body.')
    return value.toLowerCase()
}

export function todoTitle(value: unknown) {
    const title = typeof value === 'string' ? value.trim() : ''
    if (!title || title.length > todoTitleLimit || /[\u0000-\u001f\u007f]/.test(title))
        throwError(400, 'Enter a to-do title of up to 200 characters.')
    return title
}
