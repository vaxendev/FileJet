import { messageKey } from '../utils/locale.ts'
import { z } from 'zod'

const currentPassword = z.string().min(1, messageKey("Enter your current password.")).max(100, messageKey("Password cannot exceed 100 characters."))

export const accountProfileSchema = z.object({
    username: z.string().trim().min(3, messageKey("Username must contain at least 3 characters.")).max(50, messageKey("Username cannot exceed 50 characters."))
        .refine(value => !/[\u0000-\u001f\u007f]/.test(value), messageKey("Username contains invalid characters.")),
    email: z.string().trim().toLowerCase().max(255, messageKey("Email cannot exceed 255 characters."))
        .refine(value => value === '' || z.email().safeParse(value).success, messageKey("Enter a valid email address."))
        .transform(value => value || null)
}).strict()

export const passwordChangeSchema = z.object({
    currentPassword,
    newPassword: z.string().min(8, messageKey("New password must contain at least 8 characters.")).max(100, messageKey("Password cannot exceed 100 characters.")),
    confirmPassword: z.string().min(1, messageKey("Confirm your new password.")).max(100, messageKey("Password cannot exceed 100 characters."))
}).strict()
    .refine(value => value.newPassword === value.confirmPassword, { message: messageKey("New passwords do not match."), path: ['confirmPassword'] })
    .refine(value => value.newPassword !== value.currentPassword, { message: messageKey("Choose a password different from your current password."), path: ['newPassword'] })
