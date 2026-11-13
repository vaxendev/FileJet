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
export interface TeamSettings {
    name: string
    description: string
    isPublic: boolean
    password?: string
}

export interface PublicTeam {
    id: string
    name: string
    description: string
    ownerName: string
    isMember: boolean
}

export const isTeamJoinKey = (value: unknown): value is string =>
    typeof value === 'string' && (/^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value) || /^[A-Za-z0-9_-]{43}$/.test(value))

export interface TeamJoinPreview {
    teamId: string | null
    name: string | null
    requiresPassword: boolean
}

export interface TeamSummary {
    id: string
    name: string
    description: string
    ownerId: string
    ownerName: string
    role: TeamRole
    isPublic: boolean
    memberCount: number
    unreadCount: number
    createdAt: string
}
export interface TeamMember {
    id: string
    username: string
    role: TeamRole
}

export interface TeamInvitation {
    id: string
    teamName: string
    ownerName: string
    role: Exclude<TeamRole, 'OWNER'>
}

export interface SentTeamInvitation {
    id: string
    username: string
    role: Exclude<TeamRole, 'OWNER'>
}

export interface TeamDetails extends TeamSummary {
    hasJoinPassword: boolean
    inviteToken?: string | null
    folderId: string
    breadcrumbs: { id: string; name: string }[]
    items: LibraryItem[]
    members: TeamMember[]
    invitations?: SentTeamInvitation[]
}
