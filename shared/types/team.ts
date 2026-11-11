import type { LibraryItem } from './library'
export type TeamPermission = 'view' | 'upload' | 'edit' | 'manage'
export type TeamRole = 'OWNER' | 'VIEWER' | 'UPLOADER' | 'EDITOR'
export const teamCan = (role: TeamRole | null | undefined, permission: TeamPermission) => {
    if (role === 'OWNER') return true
    if (permission === 'manage') return false
    if (permission === 'edit') return role === 'EDITOR'
    if (permission === 'upload') return role === 'EDITOR' || role === 'UPLOADER'
    return role === 'VIEWER' || role === 'UPLOADER' || role === 'EDITOR'
}
export interface TeamSummary {
    id: string
    name: string
    description: string
    ownerId: string
    ownerName: string
    role: TeamRole
    memberCount: number
    createdAt: string
}
export interface TeamMember {
    id: string
    username: string
    role: TeamRole
}
export interface TeamDetails extends TeamSummary {
    folderId: string
    breadcrumbs: { id: string; name: string }[]
    items: LibraryItem[]
    members: TeamMember[]
}
