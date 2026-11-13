import type { LibraryItem } from '~~/shared/types/library'

export const useHiddenItems = () => {
    const { fetchFiles, fetchFolders, fetchNotes, fetchFavorites } = useUser()
    const { openToast } = useToast()
    const { confirm } = useConfirm()
    const busy = useState('hidden-item-pending', () => false)

    const setHidden = async (type: LibraryItem['type'], id: string, hidden = true, refresh?: () => Promise<unknown>) => {
        if (busy.value) return false
        busy.value = true
        try {
            if (hidden && !(await confirm({
                title: localize('Hide this item?'),
                message: localize('The item will move out of regular lists. Share links to it and its contents will be unavailable while hidden.'),
                confirmText: localize('Hide item')
            }))) return false

            await $fetch(`/api/items/${type}/${encodeURIComponent(id)}/hidden`, { method: 'PATCH', body: { hidden } })
            openToast(hidden ? localize('Item hidden.') : localize('Item is visible again.'), 'success')
            await Promise.allSettled([fetchFiles(), fetchFolders(), fetchNotes(), fetchFavorites(), refresh?.()])
            return true
        } catch (failure) {
            openToast(resolveApiError(failure), 'error')
            return false
        } finally {
            busy.value = false
        }
    }
    return { busy, setHidden }
}
