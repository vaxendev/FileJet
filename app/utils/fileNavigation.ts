const fileReturnPages: Record<string, string> = {
    '/home': 'Home',
    '/files': 'Files',
    '/folders': 'Folders',
    '/notes': 'Notes',
    '/favorites': 'Favorites',
    '/hidden': 'Hidden',
    '/settings/hidden': 'Hidden',
    '/shared': 'Shared',
    '/inbox': 'Inbox',
    '/trash': 'Trash',
    '/settings/preferences': 'Preferences',
    '/settings/personalization': 'Personalization'
}

export const getFileReturnPage = (value: unknown) => {
    if (typeof value !== 'string') return null

    const pathname = value.split(/[?#]/, 1)[0]?.replace(/\/$/, '') ?? ''

    const name =
        fileReturnPages[pathname] ||
        (/^\/folders\/[0-9a-f-]{36}$/i.test(pathname) ? 'Folder' : undefined) ||
        (/^\/inbox\/[0-9a-f-]{36}$/i.test(pathname) ? 'Inbox' : undefined)

    return name ? { path: value, name } : null
}

export function isHiddenNavigation(fullPath: string) {
    let location = fullPath
    while (location) {
        const [path = '', ...query] = location.split('#', 1)[0]!.split('?')
        if (/^\/(settings\/)?hidden\/?$/.test(path!)) return true
        if (!/^\/(files|folders|notes)\/[^/]+\/?$/.test(path!)) return false
        location = new URLSearchParams(query.join('?')).get('from') ?? ''
    }
    return false
}
