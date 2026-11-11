import type { TeamRole } from '#shared/types/team'
export const teamRoleLabel = (role: TeamRole) =>
    localize({ OWNER: 'Owner', VIEWER: 'Viewer', UPLOADER: 'Uploader', EDITOR: 'Editor' }[role])
export const teamRoleOptions = () => [
    { value: 'VIEWER', label: localize('Viewer') },
    { value: 'UPLOADER', label: localize('Uploader') },
    { value: 'EDITOR', label: localize('Editor') }
]
