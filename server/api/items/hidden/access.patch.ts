import argon2 from 'argon2'
import { hiddenAccount, hiddenPasswordHash, lockHidden } from '../../../utils/hiddenAccess'
import { prisma } from '../../../utils/prisma'
import { throwError } from '../../../utils/error'
import { readShareBody } from '../../../utils/shareBody'
import { assertShareOrigin } from '../../../utils/shares'

export default defineEventHandler(async event => {
    assertShareOrigin(event)
    const id = hiddenAccount(event)
    enforceRateLimit(event, `hidden-password:${id}`, 6, 60000)
    const { currentPassword, password, confirmPassword } = await readShareBody(event)
    if (typeof currentPassword !== 'string' || !currentPassword.trim() || currentPassword.length > 128 ||
        typeof password !== 'string' || !password.trim() || password.length > 128)
        throwError(400, 'Enter a valid Hidden password.')
    if (password.length < 8) throwError(400, 'Use at least 8 characters for the Hidden password.')
    if (password !== confirmPassword) throwError(400, 'Passwords do not match.')

    const hash = await hiddenPasswordHash(id)
    if (!hash) throwError(409, 'Set a Hidden password first.')
    if (!await argon2.verify(hash, currentPassword)) throwError(401, 'Incorrect Hidden password.')
    if (password === currentPassword) throwError(400, 'Choose a different Hidden password.')

    const result = await prisma.users.updateMany({
        where: { id, hidden_password_hash: hash },
        data: { hidden_password_hash: await argon2.hash(password) }
    })
    if (!result.count) throwError(409, 'The Hidden password changed. Try again.')
    lockHidden(event)
    return { configured: true, expiresAt: null }
})
