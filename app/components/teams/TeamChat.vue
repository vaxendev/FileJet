<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { $fetch as teamFetch, type FetchError } from 'ofetch'
import { teamMessageLimit, type TeamChatMessage, type TeamChatPage, type TeamChatQuote } from '~~/shared/types/teamChat'
import type { TeamMember } from '~~/shared/types/team'
import type { TeamFileReference } from '~~/shared/types/teamCollaboration'
import { teamMentionText } from '~~/shared/utils/teamMentions'

const props = defineProps<{
    teamId: string
    members: TeamMember[]
    files: TeamFileReference[]
    selectedFile: TeamFileReference | null
    focusMessage?: string
    canPin: boolean
}>()
const emit = defineEmits<{
    preview: [file: TeamFileReference]
    task: [message: TeamChatMessage]
    'file-change': [file: TeamFileReference | null]
    unread: [count: number]
}>()
const user = useAuthUser()
const endpoint = `/api/teams/${encodeURIComponent(props.teamId)}/messages`
const timestamp = computed(() => new Intl.DateTimeFormat(currentLocaleTag(), { dateStyle: 'short', timeStyle: 'short' }))
const messages = ref<TeamChatMessage[]>([])
const pins = ref<TeamChatQuote[]>([])
const reply = ref<TeamChatQuote | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const jumpTarget = ref<string | undefined>(props.focusMessage)
const highlighted = ref<string>()
const missingTarget = ref(false)
const pinBusy = ref(false)
const catchingUp = ref(false)
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
let acknowledged: string | undefined
let markingRead = false
let pendingSend: { message: string; requestId: string; fileId?: string; replyTo?: string } | undefined
const atBottom = () => {
    const region = scroller.value
    return !region || region.scrollHeight - region.scrollTop - region.clientHeight < 48
}

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
        pins.value = []
    }
    return resolveApiError(failure, fallback)
}

const markRead = async () => {
    const through = receivedThrough
    if (!through || missingTarget.value || catchingUp.value || markingRead || visibility.value !== 'visible' ||
        !atBottom() || (acknowledged && BigInt(acknowledged) >= BigInt(through))) return
    markingRead = true
    try {
        const result = await teamFetch<{ unreadCount: number }>(`${endpoint}/read`, {
            method: 'PUT', body: { through }, timeout: 10000
        })
        acknowledged = through
        if (receivedThrough === through) emit('unread', result.unreadCount)
    } catch {
        // Keep the cursor pending for the next successful refresh.
    } finally {
        markingRead = false
    }
}

const load = async (older = false, reset = false) => {
    if (loading.value || unavailable.value || (older && !hasOlder.value)) return
    loading.value = true
    try {
        const target = jumpTarget.value
        const query = older
            ? { before: messages.value[0]?.id }
            : reset || !loaded.value ? { at: target } : { after: receivedThrough }
        const page = await teamFetch<TeamChatPage>(endpoint, {
            query,
            timeout: 10000
        })
        if (unavailable.value) return
        const region = scroller.value
        const previousHeight = region?.scrollHeight ?? 0
        const previousTop = region?.scrollTop ?? 0
        const follow = atBottom()

        if (reset) {
            messages.value = []
            receivedThrough = undefined
            missingTarget.value = Boolean(target && !page.messages.some(message => message.id === target))
        }
        if (!older) catchingUp.value = Boolean(!reset && receivedThrough && page.hasMore)
        if (older || !receivedThrough) hasOlder.value = page.hasMore
        if (!older && page.messages.length) receivedThrough = page.messages.at(-1)?.id
        pins.value = page.pinned
        emit('unread', page.unreadCount)
        mergeMessages(page.messages)
        loaded.value = true
        readError.value = ''

        if (older && region) {
            await nextTick()
            region.scrollTop = previousTop + region.scrollHeight - previousHeight
        } else if ((reset || !target && follow) && page.messages.length) {
            await scrollToEnd()
        }
        if (!older && !catchingUp.value) void markRead()
    } catch (failure) {
        readError.value = chatError(failure, localize('Could not load team messages.'))
    } finally {
        loading.value = false
    }
}

const jump = async (id?: string) => {
    if (loading.value || unavailable.value) return
    jumpTarget.value = id
    highlighted.value = id
    await load(false, true)
    if (id) {
        await nextTick()
        document.getElementById(`team-message-${id}`)?.focus({ preventScroll: true })
    }
}

const addMention = async (event: Event) => {
    const select = event.target as HTMLSelectElement
    const member = props.members.find(member => member.id === select.value)
    select.value = ''
    if (!member) return
    const position = composer.value?.selectionStart ?? draft.value.length
    const before = draft.value.slice(0, position)
    const after = draft.value.slice(position)
    const insertion = (before && !/\s$/.test(before) ? ' ' : '') + teamMentionText(member.username) + ' '
    if (draft.value.length + insertion.length > teamMessageLimit) return
    draft.value = before + insertion + after
    await nextTick()
    composer.value?.focus()
    composer.value?.setSelectionRange(position + insertion.length, position + insertion.length)
}

const togglePin = async (id: string) => {
    if (pinBusy.value || !props.canPin) return
    pinBusy.value = true
    try {
        const pinned = !pins.value.some(pin => pin.id === id)
        await teamFetch(`${endpoint}/${id}/pin`, {
            method: 'PUT', body: { pinned }
        })
        const message = messages.value.find(message => message.id === id)
        if (pinned && message) {
            pins.value = [{ id, authorName: message.authorName, excerpt: message.body.slice(0, 180) }, ...pins.value]
        } else if (!pinned) {
            pins.value = pins.value.filter(pin => pin.id !== id)
        }
        await load(false, Boolean(jumpTarget.value))
    } catch (failure) {
        sendError.value = resolveApiError(failure)
    } finally {
        pinBusy.value = false
    }
}

const send = async () => {
    const input = draft.value
    const message = input.trim()
    const fileId = props.selectedFile?.id
    const replyTo = reply.value?.id
    if (sending.value || unavailable.value || !loaded.value || (!message && !fileId) || message.length > teamMessageLimit) return
    sending.value = true
    sendError.value = ''
    try {
        if (!pendingSend || pendingSend.message !== message || pendingSend.fileId !== fileId || pendingSend.replyTo !== replyTo)
            pendingSend = { message, requestId: crypto.randomUUID(), fileId, replyTo }
        const saved = await teamFetch<{ message: TeamChatMessage }>(endpoint, {
            method: 'POST',
            body: pendingSend,
            timeout: 10000
        })
        pendingSend = undefined
        if (draft.value === input) draft.value = ''
        if (props.selectedFile?.id === fileId) emit('file-change', null)
        if (reply.value?.id === replyTo) reply.value = null
        if (!unavailable.value) {
            mergeMessages([saved.message])
            if (jumpTarget.value) await jump()
            else await scrollToEnd()
        }
    } catch (failure) {
        sendError.value = chatError(failure, localize('Could not send the message.'))
    } finally {
        sending.value = false
    }
}

const visibility = useDocumentVisibility()
useIntervalFn(() => {
    if (visibility.value === 'visible' && !jumpTarget.value) void load()
}, 4000)
watch(visibility, state => {
    if (state === 'visible' && !jumpTarget.value) void load()
})
watch(() => props.focusMessage, id => void jump(id))
onMounted(() => void jump(props.focusMessage))
</script>

<template>
    <section class="flex min-w-0 flex-col gap-3 rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3">
        <h2 class="text-base font-semibold text-foreground">{{ $msg('Team chat') }}</h2>
        <div v-if="pins.length" class="rounded-lg border border-divider px-3 py-2">
            <h3 class="mb-1 text-xs font-semibold text-muted">{{ $msg('Pinned messages') }}</h3>
            <ul class="max-h-24 divide-y divide-divider overflow-y-auto">
                <li v-for="pin in pins" :key="pin.id" class="flex items-center gap-2">
                    <button type="button" class="min-w-0 flex-1 truncate py-1.5 text-left text-sm text-accent" :disabled="loading" @click="jump(pin.id)">
                        {{ pin.authorName ?? $msg('Deleted user') }} · {{ pin.excerpt || $msg('Shared file') }}
                    </button>
                    <button v-if="canPin" type="button" class="shrink-0 text-xs text-muted" :disabled="pinBusy" @click="togglePin(pin.id)">
                        {{ $msg('Unpin') }}
                    </button>
                </li>
            </ul>
        </div>
        <button v-if="jumpTarget" type="button" class="inbox-button self-end" :disabled="loading" @click="jump()">
            {{ $msg('Back to latest messages') }}
        </button>
        <p v-if="missingTarget" role="status" class="text-sm text-muted">{{ $msg('Team message not found.') }}</p>
        <div
            ref="scroller"
            role="region"
            tabindex="0"
            @scroll.passive="markRead"
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
                    :id="`team-message-${message.id}`"
                    tabindex="-1"
                    class="w-fit max-w-[90%] rounded-xl border border-divider bg-surface px-3 py-2"
                    :class="{
                        'self-end border-accent/25 bg-accent/10': message.authorId === user?.id,
                        'ring-2 ring-accent/50': message.id === highlighted
                    }"
                >
                    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span class="break-all text-xs font-semibold text-foreground">
                            {{ message.authorName ?? $msg('Deleted user') }}
                        </span>
                        <time :datetime="message.createdAt" class="text-xs text-muted">
                            {{ timestamp.format(new Date(message.createdAt)) }}
                        </time>
                    </div>
                    <button v-if="message.reply" type="button" class="mt-2 block max-w-full border-l-2 border-accent px-2 text-left text-xs text-muted"
                        :disabled="loading" @click="jump(message.reply.id)">
                        <span class="block font-medium">{{ message.reply.authorName ?? $msg('Deleted user') }}</span>
                        <span class="line-clamp-2 wrap-anywhere">{{ message.reply.excerpt || $msg('Shared file') }}</span>
                    </button>
                    <p v-if="message.body" class="mt-1 whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-foreground">{{ message.body }}</p>
                    <button v-if="message.file" type="button" class="mt-2 flex max-w-full items-center gap-2 rounded-lg border border-divider px-3 py-2 text-left text-accent"
                        @click="emit('preview', message.file)">
                        <Icon name="solar:document-linear" class="shrink-0" />
                        <span class="min-w-0 wrap-anywhere text-sm">{{ message.file.name }}</span>
                    </button>
                    <p v-else-if="!message.body" class="mt-1 text-sm text-muted">{{ $msg('File is unavailable.') }}</p>
                    <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-accent">
                        <button type="button" @click="reply = { id: message.id, authorName: message.authorName, excerpt: message.body.slice(0, 180) }; composer?.focus()">
                            {{ $msg('Reply') }}
                        </button>
                        <button type="button" @click="emit('task', message)">{{ $msg('Create task') }}</button>
                        <button v-if="canPin" type="button" :disabled="pinBusy" @click="togglePin(message.id)">
                            {{ pins.some(pin => pin.id === message.id) ? $msg('Unpin') : $msg('Pin') }}
                        </button>
                    </div>
                </li>
            </ol>
        </div>
        <div v-if="readError" class="flex flex-wrap items-center justify-between gap-2">
            <p role="alert" class="text-sm text-danger">{{ readError }}</p>
            <button v-if="!unavailable" type="button" class="inbox-button" :disabled="loading" @click="jumpTarget ? jump(jumpTarget) : load()">
                {{ $msg('Try again') }}
            </button>
        </div>
        <form v-if="!unavailable" class="flex flex-wrap items-end gap-2" @submit.prevent="send">
            <div v-if="reply" class="flex w-full items-center justify-between gap-2 rounded-lg border border-divider px-3 py-2 text-xs text-muted">
                <span class="truncate">{{ $msg('Replying to {name}', { name: reply.authorName ?? $msg('Deleted user') }) }} · {{ reply.excerpt || $msg('Shared file') }}</span>
                <button type="button" class="shrink-0 text-accent" @click="reply = null">{{ $msg('Cancel') }}</button>
            </div>
            <div class="flex w-full flex-wrap items-end gap-2">
                <label class="min-w-0 text-xs text-muted">
                    {{ $msg('Mention a member') }}
                    <select class="inbox-input mt-1" @change="addMention">
                        <option value="">{{ $msg('Choose a member') }}</option>
                        <option v-for="member in members.filter(member => member.id !== user?.id)" :key="member.id" :value="member.id">
                            {{ member.username }}
                        </option>
                    </select>
                </label>
                <label v-if="files.length || selectedFile" class="min-w-0 max-w-full text-xs text-muted">
                    {{ $msg('Attach a team file') }}
                    <select class="inbox-input mt-1 max-w-64" :value="selectedFile?.id ?? ''"
                        @change="emit('file-change', files.find(file => file.id === ($event.target as HTMLSelectElement).value) ?? null)">
                        <option value="">{{ $msg('No file') }}</option>
                        <option v-if="selectedFile && !files.some(file => file.id === selectedFile?.id)" :value="selectedFile.id">{{ selectedFile.name }}</option>
                        <option v-for="file in files" :key="file.id" :value="file.id">{{ file.name }}</option>
                    </select>
                </label>
            </div>
            <label class="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted">
                {{ $msg('Message') }}
                <textarea ref="composer" v-model="draft" class="inbox-input max-h-40 resize-y" rows="2" :maxlength="teamMessageLimit" />
            </label>
            <button type="submit" class="inbox-button inbox-primary" :disabled="!loaded || sending || (!draft.trim() && !selectedFile)">
                <Icon name="solar:plain-linear" aria-hidden="true" />
                {{ sending ? $msg('Sending...') : $msg('Send') }}
            </button>
        </form>
        <p v-if="sendError" role="alert" class="text-sm text-danger">{{ sendError }}</p>
    </section>
</template>
