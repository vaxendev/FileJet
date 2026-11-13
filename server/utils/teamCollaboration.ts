import type { TeamFileReference } from '../../shared/types/teamCollaboration'
import { throwError } from './error'
import { isUuid } from './validation'
import { teamMemberRole, type TeamAccess, type TeamDB } from './teamSpaces'

export function collaborationId(value: unknown): string {
    if (typeof value !== 'string' || !isUuid(value)) throwError(400, 'Invalid team resource ID.')
    return value.toLowerCase()
}

export function collaborationText(value: unknown, max: number, required = false): string {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text.length > max || text.includes('\0') || (required && !text))
        throwError(400, 'Enter valid text within the character limit.')
    return text
}

export async function requireTeamParticipant(tx: TeamDB, team: TeamAccess, value: unknown) {
    const id = collaborationId(value)
    if (!(await teamMemberRole(tx, team, id))) throwError(400, 'Choose a current team member.')
    return id
}

export const teamFileReferenceSelect = { id: true, original_name: true, size: true, mime_type: true } as const
type FileRow = { id: string; original_name: string; size: bigint; mime_type: string | null }
export const teamFileReference = (file: FileRow): TeamFileReference => ({
    id: file.id, name: file.original_name, size: file.size.toString(), mime_type: file.mime_type
})

// Walk ancestors of the referenced files so a chat page does not traverse the entire team.
export function teamReferenceIds(db: TeamDB, team: TeamAccess, fileIds: string[]) {
    return db.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE ancestors(file_id, folder_id) AS (
            SELECT id, folder_id FROM files
            WHERE user_id = ${team.owner_id}::uuid AND id = ANY(${fileIds}::uuid[]) AND NOT hidden
            UNION
            SELECT a.file_id, f.parent_folder_id FROM ancestors a JOIN folders f ON f.id = a.folder_id
            WHERE f.user_id = ${team.owner_id}::uuid
              AND NOT f.hidden
              AND f.id <> ${team.root_folder_id}::uuid
              AND NOT EXISTS (SELECT 1 FROM team_spaces t WHERE t.root_folder_id = f.id)
        )
        SELECT file_id AS id FROM ancestors WHERE folder_id = ${team.root_folder_id}::uuid
    `
}
