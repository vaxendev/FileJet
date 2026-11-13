import { createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie, setHeader, type H3Event } from 'h3'
import type { Prisma } from '~~/src/generated/prisma/client'
import { getAuthSession, SESSION_COOKIE } from './auth'
import { prisma } from './prisma'
import { throwError } from './error'
import { hasHiddenAncestor } from './hiddenItems'

const cookieName = 'filejet_hidden'
const unlockSeconds = 15 * 60

export function hiddenAccount(event: H3Event) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    const id = getAuthSession(event)?.userId
    if (!id) throwError(401, 'You need to be logged in.')
    return id
}

export async function hiddenPasswordHash(id: string, db: Prisma.TransactionClient = prisma) {
    const account = await db.users.findUnique({ where: { id }, select: { hidden_password_hash: true } })
    if (!account) throwError(401, 'You need to be logged in.')
    return account.hidden_password_hash
}

function signature(event: H3Event, hash: string, expires: number) {
    const secret = process.env.AUTH_SECRET
    if (!secret || secret.length < 32) throwError(500, 'AUTH_SECRET is missing or too short.')
    return createHmac('sha256', secret)
        .update(JSON.stringify(['filejet-hidden-v1', getCookie(event, SESSION_COOKIE), hash, expires]))
        .digest('base64url')
}

export function hiddenGrantExpiry(event: H3Event, hash: string | null) {
    const grant = getCookie(event, cookieName)
    if (!hash || !grant || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(grant)) return null
    const expires = Number(grant.slice(0, 13))
    if (expires <= Date.now()) return null
    return timingSafeEqual(Buffer.from(grant.slice(14)), Buffer.from(signature(event, hash, expires))) ? expires : null
}

export function unlockHidden(event: H3Event, hash: string) {
    const expires = Date.now() + unlockSeconds * 1000
    setCookie(event, cookieName, `${expires}.${signature(event, hash, expires)}`, {
        path: '/', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: unlockSeconds
    })
    return expires
}

export const lockHidden = (event: H3Event) => deleteCookie(event, cookieName, { path: '/' })

export async function requireHiddenUnlock(event: H3Event, id: string, db: Prisma.TransactionClient = prisma) {
    setHeader(event, 'Cache-Control', 'private, no-store')
    if (!hiddenGrantExpiry(event, await hiddenPasswordHash(id, db)))
        throwError(423, 'Unlock Hidden to access this item.', { data: { hiddenLocked: true } })
}

export async function protectHiddenRows(event: H3Event, id: string, rows: { hidden?: boolean; folderId: string | null }[],
    db: Prisma.TransactionClient = prisma) {
    const parents = [...new Set(rows.flatMap(row => row.folderId ? [row.folderId] : []))]
    if (rows.some(row => row.hidden) || (parents.length && await hasHiddenAncestor(id, parents, db)))
        await requireHiddenUnlock(event, id, db)
}
