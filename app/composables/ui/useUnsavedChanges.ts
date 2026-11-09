import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

export const useUnsavedChanges = (dirty: Ref<boolean>, saving: Ref<boolean>, flush?: () => Promise<boolean>) => {
    const { confirm } = useConfirm()

    onBeforeRouteLeave(async () => {
        if (flush && (dirty.value || saving.value) && await flush()) return true
        if (saving.value) return false
        if (!dirty.value) return true

        const discard = await confirm({
            get title() { return localize("Unsaved changes") },
            get message() { return localize("Your changes will be lost if you leave this page.") },
            get confirmText() { return localize("Discard changes") },
            get cancelText() { return localize("Keep editing") },
            variant: 'neutral'
        })

        return discard && !saving.value
    })

    useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
        if (!dirty.value && !saving.value) return

        event.preventDefault()
        event.returnValue = ''
    })
}
