<script setup lang="ts">
import { $fetch as teamFetch } from 'ofetch'
import type { TeamFileReference, TeamFileReview, TeamListPage, TeamTask } from '~~/shared/types/teamCollaboration'

const props = defineProps<{ teamId: string; kind: 'tasks' | 'reviews' }>()
const emit = defineEmits<{ preview: [file: TeamFileReference]; message: [id: string] }>()
const endpoint = `/api/teams/${props.teamId}/${props.kind}`
const tasks = ref<TeamTask[]>([])
const reviews = ref<TeamFileReview[]>([])
const next = ref<string | null>(null)
const loaded = ref(false)
const loading = ref(false)
const busyId = ref<string | null>(null)
const error = ref('')
const notes = ref<Record<string, string>>({})
const dueDate = (date: string) => new Intl.DateTimeFormat(currentLocaleTag(), { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(date + 'T00:00:00Z'))
const reviewStatus = (review: TeamFileReview) => {
    if (review.stale && review.status === 'PENDING') return localize('File version changed')
    return localize({ PENDING: 'Awaiting review', APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested' }[review.status])
}

const load = async (more = false) => {
    if (loading.value || (more && !next.value)) return
    loading.value = true
    error.value = ''
    try {
        const query = more ? { cursor: next.value } : undefined
        if (props.kind === 'tasks') {
            const page = await teamFetch<TeamListPage<TeamTask>>(endpoint, { query, timeout: 10000 })
            tasks.value = more ? [...tasks.value, ...page.items] : page.items
            next.value = page.next
        } else {
            const page = await teamFetch<TeamListPage<TeamFileReview>>(endpoint, { query, timeout: 10000 })
            reviews.value = more ? [...reviews.value, ...page.items] : page.items
            next.value = page.next
        }
        loaded.value = true
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        loading.value = false
    }
}
const change = async (id: string, run: () => Promise<void>) => {
    if (busyId.value) return
    busyId.value = id
    error.value = ''
    try {
        await run()
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        busyId.value = null
    }
}
const updateTask = (task: TeamTask) => change(task.id, async () => {
    const result = await teamFetch<{ task: TeamTask }>(`${endpoint}/${task.id}`, {
        method: 'PATCH', body: { completed: !task.completed }, timeout: 10000
    })
    tasks.value = tasks.value.map(item => item.id === task.id ? result.task : item)
})
const respond = (review: TeamFileReview, status: 'APPROVED' | 'CHANGES_REQUESTED') => change(review.id, async () => {
    const result = await teamFetch<{ review: TeamFileReview }>(`${endpoint}/${review.id}`, {
        method: 'PATCH', body: { status, note: notes.value[review.id] ?? '' }, timeout: 10000
    })
    reviews.value = reviews.value.map(item => item.id === review.id ? result.review : item)
    delete notes.value[review.id]
})
onMounted(() => void load())
</script>

<template>
    <section class="min-w-0 rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold text-foreground">{{ kind === 'tasks' ? $msg('Tasks') : $msg('File reviews') }}</h2>
            <button type="button" class="inbox-button" :disabled="loading || busyId !== null" @click="load()">{{ $msg('Refresh') }}</button>
        </div>
        <p v-if="error" role="alert" class="mb-3 text-sm text-danger">{{ error }}</p>
        <p v-if="!loaded && loading" role="status" class="py-5 text-sm text-muted">{{ $msg('Loading...') }}</p>
        <p v-else-if="loaded && !tasks.length && !reviews.length" class="py-5 text-sm text-muted">
            {{ kind === 'tasks' ? $msg('Create a task from a chat message.') : $msg('Request a review from a team file.') }}
        </p>
        <ul v-if="kind === 'tasks'" class="divide-y divide-divider">
            <li v-for="task in tasks" :key="task.id" class="flex flex-wrap items-center justify-between gap-3 py-4">
                <div class="min-w-0">
                    <h3 class="wrap-anywhere text-sm font-semibold text-foreground">{{ task.title }}</h3>
                    <p class="mt-1 text-xs text-muted">
                        {{ task.assigneeName ?? $msg('Deleted user') }} ·
                        {{ $msg('Due {date}', { date: dueDate(task.dueOn) }) }} ·
                        {{ task.completed ? $msg('Completed') : $msg('Open task') }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" class="inbox-button" @click="emit('message', task.messageId)">{{ $msg('View message') }}</button>
                    <button v-if="task.canUpdate" type="button" class="inbox-button" :disabled="busyId !== null" @click="updateTask(task)">
                        {{ task.completed ? $msg('Reopen') : $msg('Mark complete') }}
                    </button>
                </div>
            </li>
        </ul>
        <ul v-else class="divide-y divide-divider">
            <li v-for="review in reviews" :key="review.id" class="flex flex-col gap-2 py-4">
                <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="min-w-0">
                        <button v-if="review.file && !review.stale" type="button" class="wrap-anywhere text-left text-sm font-semibold text-accent" @click="emit('preview', review.file)">
                            {{ review.file.name }}
                        </button>
                        <h3 v-else class="wrap-anywhere text-sm font-semibold text-foreground">{{ review.file?.name ?? $msg('File is unavailable.') }}</h3>
                        <p class="mt-1 text-xs text-muted">
                            {{ $msg('Reviewer') }}: {{ review.reviewerName ?? $msg('Deleted user') }} · {{ $msg('Version {number}', { number: review.revision }) }}
                        </p>
                    </div>
                    <span class="rounded-md bg-control px-2 py-1 text-xs text-label">{{ reviewStatus(review) }}</span>
                </div>
                <p v-if="review.requestNote" class="whitespace-pre-wrap wrap-anywhere text-sm text-muted">{{ review.requesterName ?? $msg('Deleted user') }}: {{ review.requestNote }}</p>
                <p v-if="review.responseNote" class="whitespace-pre-wrap wrap-anywhere text-sm text-muted">{{ review.reviewerName ?? $msg('Deleted user') }}: {{ review.responseNote }}</p>
                <div v-if="review.canRespond" class="flex flex-wrap items-end gap-2">
                    <label class="min-w-44 flex-1 text-xs text-muted">
                        {{ $msg('Review response') }}
                        <textarea v-model="notes[review.id]" class="inbox-input mt-1 max-h-40 resize-y" rows="2" maxlength="1000" />
                    </label>
                    <button type="button" class="inbox-button" :disabled="busyId !== null" @click="respond(review, 'CHANGES_REQUESTED')">{{ $msg('Request changes') }}</button>
                    <button type="button" class="inbox-button inbox-primary" :disabled="busyId !== null" @click="respond(review, 'APPROVED')">{{ $msg('Approve') }}</button>
                </div>
            </li>
        </ul>
        <button v-if="next" type="button" class="inbox-button mt-3" :disabled="loading || busyId !== null" @click="load(true)">{{ $msg('Load more') }}</button>
    </section>
</template>
