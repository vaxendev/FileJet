<script setup lang="ts">
import { $fetch as teamFetch } from 'ofetch'
import type { TeamMember } from '~~/shared/types/team'
import type { TeamFileReference } from '~~/shared/types/teamCollaboration'

const props = defineProps<{
    teamId: string
    members: TeamMember[]
    source: { kind: 'tasks' } | { kind: 'reviews'; file: TeamFileReference } | null
}>()
const emit = defineEmits<{ close: []; saved: [tab: 'tasks' | 'reviews'] }>()
const user = useAuthUser()
const dialog = ref<HTMLDialogElement | null>(null)
const labelId = useId()
const pointerStartedOutside = ref(false)
const assignee = ref('')
const title = ref('')
const dueOn = ref('')
const note = ref('')
const busy = ref(false)
const error = ref('')
const isTask = computed(() => props.source?.kind === 'tasks')
const candidates = computed(() => props.members.filter(member => isTask.value || member.id !== user.value?.id))
let taskRequest: { id: string; input: string } | undefined

watch(() => props.source, async source => {
    if (!source) {
        dialog.value?.close()
        return
    }
    assignee.value = ''
    dueOn.value = ''
    note.value = ''
    error.value = ''
    title.value = ''
    taskRequest = undefined
    await nextTick()
    if (props.source === source && !dialog.value?.open) dialog.value?.showModal()
}, { flush: 'post' })

const close = () => { if (!busy.value) emit('close') }
const outside = (event: MouseEvent) => {
    const rect = dialog.value?.getBoundingClientRect()
    return event.target === dialog.value && !!rect &&
        (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
}
const save = async () => {
    const source = props.source
    if (!source || busy.value || !assignee.value) return
    busy.value = true
    error.value = ''
    try {
        let body
        if (source.kind === 'tasks') {
            const task = { title: title.value.trim(), assigneeId: assignee.value, dueOn: dueOn.value }
            const input = JSON.stringify(task)
            if (taskRequest?.input !== input) taskRequest = { id: crypto.randomUUID(), input }
            body = { ...task, requestId: taskRequest.id }
        } else {
            body = { fileId: source.file.id, reviewerId: assignee.value, note: note.value }
        }
        await teamFetch(`/api/teams/${props.teamId}/${source.kind}`, { method: 'POST', body, timeout: 10000 })
        emit('saved', source.kind)
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <Teleport to="#teleports">
        <dialog ref="dialog" :aria-labelledby="labelId"
            class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-divider bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/60"
            @cancel.prevent="close" @pointerdown="pointerStartedOutside = outside($event)"
            @click.self="pointerStartedOutside && outside($event) && close()">
            <form class="flex flex-col gap-4" @submit.prevent="save">
                <h2 :id="labelId" class="text-lg font-semibold">{{ isTask ? $msg('Create task') : $msg('Request file review') }}</h2>
                <p v-if="source && 'file' in source" class="wrap-anywhere text-sm text-muted">{{ source.file.name }}</p>
                <label v-if="isTask" class="flex flex-col gap-1 text-sm text-label">
                    {{ $msg('Task title') }}
                    <input v-model="title" class="inbox-input" maxlength="160" required />
                </label>
                <label class="flex flex-col gap-1 text-sm text-label">
                    {{ isTask ? $msg('Assign to') : $msg('Reviewer') }}
                    <select v-model="assignee" class="inbox-input" required>
                        <option value="">{{ $msg('Choose a member') }}</option>
                        <option v-for="member in candidates" :key="member.id" :value="member.id">{{ member.username }}</option>
                    </select>
                </label>
                <label v-if="isTask" class="flex flex-col gap-1 text-sm text-label">
                    {{ $msg('Due date') }}
                    <input v-model="dueOn" class="inbox-input" type="date" required />
                </label>
                <label v-else class="flex flex-col gap-1 text-sm text-label">
                    {{ $msg('Review note') }}
                    <textarea v-model="note" class="inbox-input max-h-40 resize-y" maxlength="1000" rows="3" />
                </label>
                <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
                <footer class="flex flex-wrap justify-end gap-2">
                    <button type="button" class="inbox-button" :disabled="busy" @click="close">{{ $msg('Cancel') }}</button>
                    <button type="submit" class="inbox-button inbox-primary" :disabled="busy || !assignee || (isTask && !title.trim())">
                        {{ busy ? $msg('Saving...') : isTask ? $msg('Create task') : $msg('Request review') }}
                    </button>
                </footer>
            </form>
        </dialog>
    </Teleport>
</template>
