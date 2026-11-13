import argon2 from 'argon2'
import { prisma } from '../../../utils/prisma'
import { hiddenAccount, hiddenPasswordHash, unlockHidden } from '../../../utils/hiddenAccess'
import { assertShareOrigin } from '../../../utils/shares'
import { throwError } from '../../../utils/error'
import { readShareBody } from '../../../utils/shareBody'

export default defineEventHandler(async event => {
    assertShareOrigin(event)
    const id = hiddenAccount(event)
    enforceRateLimit(event, `hidden-password:${id}`, 6, 60000)
    const { password, confirmPassword, setup } = await readShareBody(event)
    if (typeof password !== 'string' || !password.trim() || password.length > 128)
        throwError(400, 'Enter a valid Hidden password.')
    let hash = await hiddenPasswordHash(id)
    if (setup === true) {
        if (hash) throwError(409, 'A Hidden password is already set.')
        if (password.length < 8) throwError(400, 'Use at least 8 characters for the Hidden password.')
        if (password !== confirmPassword) throwError(400, 'Passwords do not match.')
        hash = await argon2.hash(password)
        const result = await prisma.users.updateMany({
            where: { id, hidden_password_hash: null }, data: { hidden_password_hash: hash }
        })
        if (!result.count) throwError(409, 'A Hidden password is already set.')
    } else {
        if (!hash) throwError(409, 'Set a Hidden password first.')
        if (!await argon2.verify(hash, password)) throwError(401, 'Incorrect Hidden password.')
    }
    return { configured: true, expiresAt: unlockHidden(event, hash) }
})
