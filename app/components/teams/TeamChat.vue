<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { $fetch as teamFetch, type FetchError } from 'ofetch'
import { teamMessageLimit, type TeamChatMessage, type TeamChatPage } from '~~/shared/types/teamChat'

const props = defineProps<{ teamId: string }>()
const user = useAuthUser()
const endpoint = `/api/teams/${encodeURIComponent(props.teamId)}/messages`
const timestamp = computed(() => new Intl.DateTimeFormat(currentLocaleTag(), { dateStyle: 'short', timeStyle: 'short' }))
const messages = ref<TeamChatMessage[]>([])
const scroller = ref<HTMLDivElement | null>(null)
const loaded = ref(false)
const loading = ref(false)
const hasOlder = ref(false)
const unavailable = ref(false)
const readError = ref('')
const sendError = ref('')
const draft = ref('')
const sending = ref(false)
let receivedThrough: string | undefined
let pendingSend: { message: string; requestId: string } | undefined

const scrollToEnd = async () => {
    await nextTick()
    const region = scroller.value
    if (region) region.scrollTop = region.scrollHeight
}

function mergeMessages(incoming: TeamChatMessage[]) {
    if (!incoming.length) return
    const byId = new Map(messages.value.map(message => [message.id, message]))
    for (const message of incoming) byId.set(message.id, message)
    messages.value = [...byId.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
}

function chatError(failure: unknown, fallback: string) {
    const status = (failure as FetchError | undefined)?.statusCode ?? 0
    if ([401, 403, 404].includes(status)) {
        unavailable.value = true
        messages.value = []
    }
    return resolveApiError(failure, fallback)
}

const load = async (older = false) => {
    if (loading.value || unavailable.value || (older && !hasOlder.value)) return
    loading.value = true
    try {
        const page = await teamFetch<TeamChatPage>(endpoint, {
            query: older ? { before: messages.value[0]?.id } : { after: receivedThrough },
            timeout: 10000
        })
        if (unavailable.value) return
        const region = scroller.value
        const previousHeight = region?.scrollHeight ?? 0
        const previousTop = region?.scrollTop ?? 0
        const follow = !region || previousHeight - previousTop - region.clientHeight < 48

        if (older || !receivedThrough) hasOlder.value = page.hasMore
        if (!older && page.messages.length) receivedThrough = page.messages.at(-1)?.id
        mergeMessages(page.messages)
        loaded.value = true
        readError.value = ''

        if (older && region) {
            await nextTick()
            region.scrollTop = previousTop + region.scrollHeight - previousHeight
        } else if (follow && page.messages.length) {
            await scrollToEnd()
        }
    } catch (failure) {
        readError.value = chatError(failure, localize('Could not load team messages.'))
    } finally {
        loading.value = false
    }
}

const send = async () => {
    const input = draft.value
    const message = input.trim()
    if (sending.value || unavailable.value || !loaded.value || !message || message.length > teamMessageLimit) return
    sending.value = true
    sendError.value = ''
    try {
        if (pendingSend?.message !== message) pendingSend = { message, requestId: crypto.randomUUID() }
        const saved = await teamFetch<{ message: TeamChatMessage }>(endpoint, {
            method: 'POST',
            body: pendingSend,
            timeout: 10000
        })
        pendingSend = undefined
        if (draft.value === input) draft.value = ''
        if (!unavailable.value) {
            mergeMessages([saved.message])
            await scrollToEnd()
        }
    } catch (failure) {
        sendError.value = chatError(failure, localize('Could not send the message.'))
    } finally {
        sending.value = false
    }
}

const visibility = useDocumentVisibility()
useIntervalFn(() => {
    if (visibility.value === 'visible') void load()
}, 4000)
watch(visibility, state => {
    if (state === 'visible') void load()
})
onMounted(() => void load())
</script>

<template>
    <section class="flex min-w-0 flex-col gap-3 rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3">
        <h2 class="text-base font-semibold text-foreground">{{ $msg('Team chat') }}</h2>
        <div
            ref="scroller"
            role="region"
            tabindex="0"
            :aria-label="$msg('Team messages')"
            class="h-96 min-h-48 max-h-[55dvh] overflow-y-auto rounded-xl border border-divider bg-canvas p-4 max-mobile:p-3"
        >
            <div v-if="hasOlder && !unavailable" class="mb-4 flex justify-center">
                <button type="button" class="inbox-button" :disabled="loading" @click="load(true)">
                    {{ $msg('Load older messages') }}
                </button>
            </div>
            <p v-if="!loaded && !readError" role="status" class="py-8 text-center text-sm text-muted">
                {{ $msg('Loading...') }}
            </p>
            <p v-else-if="loaded && !messages.length && !unavailable" class="py-8 text-center text-sm text-muted">
                {{ $msg('No messages yet.') }}
            </p>
            <ol v-if="messages.length" class="flex flex-col gap-3">
                <li
                    v-for="message in messages"
                    :key="message.id"
                    class="w-fit max-w-[90%] rounded-xl border border-divider bg-surface px-3 py-2"
                    :class="{ 'self-end border-accent/25 bg-accent/10': message.authorId === user?.id }"
                >
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span class="break-all text-xs font-semibold text-foreground">
                            {{ message.authorName ?? $msg('Deleted user') }}
                        </span>
                        <time :datetime="message.createdAt" class="text-xs text-muted">
                            {{ timestamp.format(new Date(message.createdAt)) }}
                        </time>
                    </div>
                    <p class="mt-1 whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-foreground">{{ message.body }}</p>
                </li>
            </ol>
        </div>
        <div v-if="readError" class="flex flex-wrap items-center justify-between gap-2">
            <p role="alert" class="text-sm text-danger">{{ readError }}</p>
            <button v-if="!unavailable" type="button" class="inbox-button" :disabled="loading" @click="load()">
                {{ $msg('Try again') }}
            </button>
        </div>
        <form v-if="!unavailable" class="flex flex-wrap items-end gap-2" @submit.prevent="send">
            <label class="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
                {{ $msg('Message') }}
                <textarea v-model="draft" class="inbox-input max-h-40 resize-y" rows="2" :maxlength="teamMessageLimit" required />
            </label>
            <button type="submit" class="inbox-button inbox-primary" :disabled="!loaded || sending || !draft.trim()">
                <Icon name="solar:plain-linear" aria-hidden="true" />
                {{ sending ? $msg('Sending...') : $msg('Send') }}
            </button>
        </form>
        <p v-if="sendError" role="alert" class="text-sm text-danger">{{ sendError }}</p>
    </section>
</template>
