import { messageKey } from '../utils/locale.ts'
import { z } from 'zod'

export const folderNameSchema = z
    .string()
    .trim()
    .min(1, messageKey("Folder name is required."))
    .refine(
        name => name !== '.' && name !== '..' && !/[/\\\0:]/.test(name),
        messageKey("Use a folder name without /, \\ or :; a single or double dot is not allowed.")
    )
    .refine(
        name => new TextEncoder().encode(name).length <= 255,
        messageKey("Folder name cannot exceed 255 bytes.")
    )

export const folderSchema = z.object({ name: folderNameSchema })
