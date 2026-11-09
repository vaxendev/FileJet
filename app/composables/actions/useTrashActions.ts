import type { TrashItemType, TrashMoveResult } from '~~/shared/types/trash'

export const useTrashActions = () => {
    const router = useRouter()
    const { syncTrash } = useUser()
    const { openToast } = useToast()

    const notifyTrashed = (result: TrashMoveResult, type?: TrashItemType, bulk = false) => {
        if (!result.success || !result.deletedIds.length || !result.trashIds.length) return

        const trashIds = [...new Set(result.trashIds)]
        const label = type ? type[0]!.toUpperCase() + type.slice(1) : 'Item'
        const count = result.deletedIds.length

        openToast(bulk ? localize("{p0} items moved to Trash", { p0: count }) : localize("{p0} moved to Trash", { p0: label }), 'success', {
            duration: 8000,
            notification: { get title() { return localize("Moved to Trash") }, category: 'library', href: '/trash' },
            action: {
                get label() { return localize("Undo") },
                variant: 'trash-undo',
                run: async () => {
                    if (trashIds.length === 1) {
                        await $fetch(`/api/trash/${encodeURIComponent(trashIds[0]!)}`, {
                            method: 'PATCH'
                        })
                    } else {
                        await $fetch('/api/trash/bulk-restore', {
                            method: 'POST',
                            body: { itemIds: trashIds }
                        })
                    }

                    await syncTrash()

                    const route = router.currentRoute.value

                    if (route.path.startsWith('/folders/') && route.params.folderId) {
                        await refreshNuxtData(`folder-details:${route.params.folderId}`)
                    }

                    openToast(
                        bulk
                            ? localize("{p0} items restored successfully", { p0: count })
                            : localize("{p0} restored successfully", { p0: label }),
                        'success',
                        { notification: { get title() { return localize("Items restored") }, category: 'library', href: '/files' } }
                    )
                }
            }
        })
    }

    return { notifyTrashed }
}
