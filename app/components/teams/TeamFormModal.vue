<script setup lang="ts">
const props = defineProps<{
    open: boolean
    busy: boolean
    error: string
    team?: { name: string; description: string } | null
}>()
const emit = defineEmits<{ close: []; save: [value: { name: string; description: string }] }>()
const dialog = ref<HTMLDialogElement | null>(null),
    input = ref<HTMLInputElement | null>(null)
const name = ref(''),
    description = ref(''),
    id = useId()
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
        name.value = props.team?.name ?? ''
        description.value = props.team?.description ?? ''
        await nextTick()
        if (props.open && dialog.value?.isConnected) {
            dialog.value.showModal()
            input.value?.focus()
        }
    },
    { flush: 'post', immediate: true }
)
const save = () => {
    if (!props.busy && name.value.trim() && name.value.trim().length <= 120)
        emit('save', { name: name.value.trim(), description: description.value.trim() })
}
</script>
<template>
    <Teleport to="#teleports">
        <dialog
            ref="dialog"
            :aria-labelledby="id"
            class="team-form-modal m-auto w-[min(30rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-divider bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/60"
            @cancel.prevent="close"
            @click.self="close"
        >
            <form class="flex flex-col gap-5" @submit.prevent="save">
                <div class="flex items-center justify-between gap-3">
                    <h2 :id="id" class="text-lg font-semibold">
                        {{ team ? $msg('Team settings') : $msg('Create team space') }}
                    </h2>
                    <button
                        type="button"
                        :disabled="busy"
                        class="inbox-icon"
                        :aria-label="$msg('Close')"
                        @click="close"
                    >
                        <Icon name="solar:close-circle-linear" size="23" />
                    </button>
                </div>
                <label class="flex flex-col gap-2 text-sm text-label"
                    >{{ $msg('Team name')
                    }}<input
                        ref="input"
                        v-model="name"
                        class="inbox-input"
                        maxlength="120"
                        required
                        :disabled="busy"
                        autocomplete="off"
                /></label>
                <label class="flex flex-col gap-2 text-sm text-label"
                    >{{ $msg('Description')
                    }}<textarea
                        v-model="description"
                        class="inbox-input min-h-24 resize-y"
                        maxlength="500"
                        :disabled="busy"
                    />
                </label>
                <p class="text-xs leading-5 text-muted">
                    {{ $msg("Files use the owner's storage quota. Removed items go to the owner's Trash.") }}
                </p>
                <p v-if="error" role="alert" class="text-sm text-danger">{{ $msg(error) }}</p>
                <footer class="flex justify-end gap-2">
                    <button type="button" class="inbox-button" :disabled="busy" @click="close">
                        {{ $msg('Cancel') }}</button
                    ><button type="submit" class="inbox-button inbox-primary" :disabled="busy || !name.trim()">
                        {{ busy ? $msg('Saving...') : team ? $msg('Save changes') : $msg('Create team space') }}
                    </button>
                </footer>
            </form>
        </dialog>
    </Teleport>
</template>
