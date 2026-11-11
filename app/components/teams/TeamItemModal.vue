<script setup lang="ts">
import { folderNameSchema } from '~~/shared/schemas/folder'
import type { LibraryItem } from '~~/shared/types/library'
const props = defineProps<{ open: boolean; busy: boolean; error: string; item: LibraryItem | null }>()
const emit = defineEmits<{ close: []; save: [name: string] }>()
const dialog = ref<HTMLDialogElement | null>(null),
    input = ref<HTMLInputElement | null>(null),
    name = ref(''),
    id = useId()
const valid = computed(() => folderNameSchema.safeParse(name.value))
const validationMessage = computed(() =>
    name.value && !valid.value.success ? localize(valid.value.error.issues[0]?.message) : ''
)
const close = () => {
    if (!props.busy) emit('close')
}
watch(
    () => props.open,
    async open => {
        if (!open) {
            dialog.value?.close()
            return
        }
        name.value = props.item?.name ?? ''
        await nextTick()
        if (props.open && dialog.value?.isConnected) {
            dialog.value.showModal()
            input.value?.focus()
            input.value?.select()
        }
    },
    { flush: 'post', immediate: true }
)
const save = () => {
    if (!props.busy && valid.value.success) emit('save', valid.value.data)
}
</script>
<template>
    <Teleport to="#teleports">
        <dialog
            ref="dialog"
            :aria-labelledby="id"
            class="team-item-modal m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-divider bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/60"
            @cancel.prevent="close"
            @click.self="close"
        >
            <form class="flex flex-col gap-5" @submit.prevent="save">
                <h2 :id="id" class="text-lg font-semibold">{{ item ? $msg('Rename') : $msg('New folder') }}</h2>
                <label class="flex flex-col gap-2 text-sm text-label"
                    >{{ $msg('Name')
                    }}<input
                        ref="input"
                        v-model="name"
                        class="inbox-input"
                        maxlength="255"
                        required
                        :disabled="busy"
                        autocomplete="off"
                /></label>
                <p v-if="error || validationMessage" role="alert" class="text-sm text-danger">
                    {{ $msg(error || validationMessage) }}
                </p>
                <footer class="flex justify-end gap-2">
                    <button type="button" class="inbox-button" :disabled="busy" @click="close">
                        {{ $msg('Cancel') }}</button
                    ><button
                        type="submit"
                        class="inbox-button inbox-primary"
                        :disabled="busy || !valid.success || Boolean(item && name.trim() === item.name)"
                    >
                        {{ busy ? $msg('Saving...') : item ? $msg('Save changes') : $msg('Create folder') }}
                    </button>
                </footer>
            </form>
        </dialog>
    </Teleport>
</template>
