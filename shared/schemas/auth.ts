import { messageKey } from '../utils/locale.ts'
import { z } from 'zod'

export const loginSchema = z.object({
    username: z
        .string()
        .min(3, messageKey("Username must contain at least 3 characters."))
        .max(50, messageKey("Username cannot exceed 50 characters.")),

    password: z
        .string()
        .min(6, messageKey("Password must contain at least 6 characters."))
        .max(100, messageKey("Password cannot exceed 100 characters."))
})
