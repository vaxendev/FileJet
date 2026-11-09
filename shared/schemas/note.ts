import { messageKey } from '../utils/locale.ts'
import { z } from 'zod'

export const noteSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, messageKey("Title is required."))
        .max(32, messageKey("Title cannot exceed 32 characters.")),

    // Leading indentation and trailing spaces carry meaning in Markdown.
    content: z.string().refine(value => value.trim().length > 0, messageKey("Content is required."))
})

export type NoteInput = z.infer<typeof noteSchema>
