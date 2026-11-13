import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { teamActor, teamParam, teamAccess, teamFile } from './teamSpaces'
import { safeStoragePath } from './fileSecurity'
import { throwError } from './error'
import { getInboxPreview, inboxPreviewRange } from '../../shared/utils/inboxPreview'

export async function deliverTeamFile(event: H3Event, previewOnly: boolean) {
    const actor = teamActor(event),
        id = teamParam(event),
        fileId = teamParam(event, 'fileId')
    const revision = getQuery(event).revision
    if (revision !== undefined && (typeof revision !== 'string' || !/^[1-9][0-9]{0,9}$/.test(revision)))
        throwError(400, 'Invalid file version.')
    const team = await teamAccess(prisma, id, actor),
        file = await teamFile(prisma, team, fileId)
    if (revision !== undefined && file.revision !== Number(revision))
        throwError(409, 'This file version has changed. Request a new review.')
    const path = await safeStoragePath(team.owner_id, file.storage_key)
    // Antivirus checks may be slow. Do not deliver bytes using an expired membership.
    const current = await prisma.$transaction(
        async tx => {
            const access = await teamAccess(tx, id, actor)
            return teamFile(tx, access, fileId)
        },
        { isolationLevel: 'RepeatableRead' }
    )
    if (file.storage_key !== current.storage_key)
        throwError(409, 'The stored file changed during scanning. Access remains blocked.')
    if (revision !== undefined && current.revision !== Number(revision))
        throwError(409, 'This file version has changed. Request a new review.')
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) throwError(404, 'Stored file not found.')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    if (!previewOnly) {
        setHeader(event, 'Content-Type', 'application/octet-stream')
        setHeader(event, 'Content-Length', info.size)
        setHeader(
            event,
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(current.original_name)}`
        )
        return event.method === 'HEAD' ? '' : sendStream(event, createReadStream(path))
    }
    const preview = getInboxPreview(current.original_name, current.mime_type)
    if (preview.kind === 'unsupported') throwError(415, 'Preview is not available for this file type.')
    setHeader(event, 'Content-Type', preview.contentType)
    setHeader(
        event,
        'Content-Security-Policy',
        "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'"
    )
    setHeader(
        event,
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(current.original_name)}`
    )
    if (preview.kind === 'text') {
        const size = Math.min(info.size, 1024 * 1024)
        setHeader(event, 'X-Preview-Truncated', String(info.size > size))
        setHeader(event, 'Content-Length', size)
        return size ? sendStream(event, createReadStream(path, { start: 0, end: size - 1 })) : ''
    }
    setHeader(event, 'Accept-Ranges', 'bytes')
    const header = getHeader(event, 'range')
    if (header) {
        const range = inboxPreviewRange(header, info.size)
        if (!range) {
            setResponseStatus(event, 416)
            setHeader(event, 'Content-Range', `bytes */${info.size}`)
            return ''
        }
        setResponseStatus(event, 206)
        setHeader(event, 'Content-Range', `bytes ${range.start}-${range.end}/${info.size}`)
        setHeader(event, 'Content-Length', range.end - range.start + 1)
        return sendStream(event, createReadStream(path, range))
    }
    setHeader(event, 'Content-Length', info.size)
    return sendStream(event, createReadStream(path))
}
