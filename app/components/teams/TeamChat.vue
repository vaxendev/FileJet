<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { $fetch as teamFetch, type FetchError } from 'ofetch'
import { teamMessageLimit, type TeamChatMessage, type TeamChatPage, type TeamChatQuote } from '~~/shared/types/teamChat'
import type { TeamMember } from '~~/shared/types/team'
import type { TeamFileReference } from '~~/shared/types/teamCollaboration'
import { teamMentionQuery, teamMentionText, teamMentionTokens } from '~~/shared/utils/teamMentions'

const props = defineProps<{
    teamId: string
    members: TeamMember[]
    canUpload: boolean
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
const picker = ref<HTMLInputElement | null>(null)
const localFile = ref<File | null>(null)
const uploadedFile = ref<TeamFileReference | null>(null)
const mention = ref<ReturnType<typeof teamMentionQuery>>(null)
const activeMention = ref(0)
const listId = useId()
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
const suggestions = computed(() => {
    if (!mention.value) return []
    const prefix = mention.value.query.toLowerCase()
    return props.members.filter(member => member.id !== user.value?.id && member.username.toLowerCase().startsWith(prefix))
        .slice(0, 8)
})
const memberNames = computed(() => new Map(props.members.map(member => [member.username.toLowerCase(), member.id])))
const initials = (value: string | null) => Array.from((value ?? '?').trim()).slice(0, 2).join('').toUpperCase()
const avatarColor = (value: string | null) => `hsl(${Array.from(value ?? '?').reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 0)} 35% 33%)`
const displayMessages = computed(() => messages.value.map((message, index) => {
    const previous = messages.value[index - 1]
    const segments: { text: string; mention: boolean }[] = []
    let offset = 0
    let mentionsMe = false
    for (const token of teamMentionTokens(message.body)) {
        const id = memberNames.value.get(token.name.toLowerCase())
        if (!id) continue
        if (token.start > offset) segments.push({ text: message.body.slice(offset, token.start), mention: false })
        segments.push({ text: '@' + token.name, mention: true })
        offset = token.end
        if (id === user.value?.id && id !== message.authorId) mentionsMe = true
    }
    segments.push({ text: message.body.slice(offset), mention: false })
    return { ...message, segments, mentionsMe, grouped: !message.reply && Boolean(message.authorId && previous?.authorId === message.authorId &&
        Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60000) }
}))
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

const updateMention = () => {
    const field = composer.value
    if (!field || document.activeElement !== field) return
    const next = field.selectionStart === field.selectionEnd ? teamMentionQuery(field.value, field.selectionStart) : null
    if (next?.query !== mention.value?.query || next?.start !== mention.value?.start) activeMention.value = 0
    mention.value = next
}
watch(draft, updateMention, { flush: 'post' })
const addMention = async (member: TeamMember) => {
    const query = mention.value
    if (!query) return
    const position = composer.value?.selectionStart ?? draft.value.length
    const insertion = teamMentionText(member.username) + ' '
    const next = draft.value.slice(0, query.start) + insertion + draft.value.slice(position)
    if (next.length > teamMessageLimit) return
    draft.value = next
    mention.value = null
    await nextTick()
    composer.value?.focus()
    composer.value?.setSelectionRange(query.start + insertion.length, query.start + insertion.length)
}
const composerKey = (event: KeyboardEvent) => {
    if (event.isComposing) return
    const options = suggestions.value
    if (options.length && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(event.key) && !event.shiftKey) {
        event.preventDefault()
        if (event.key === 'Escape') mention.value = null
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            activeMention.value = (activeMention.value + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        else void addMention(options[activeMention.value]!)
        return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void send()
    }
}
const clearAttachment = () => {
    localFile.value = null
    uploadedFile.value = null
    emit('file-change', null)
}
const chooseFile = (event: Event) => {
    const field = event.target as HTMLInputElement
    const file = field.files?.[0]
    field.value = ''
    if (!file) return
    if (file.size > 25 * 1024 * 1024) {
        sendError.value = localize('Choose a file up to 25 MB.')
        return
    }
    clearAttachment()
    localFile.value = file
    sendError.value = ''
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
    const file = localFile.value
    let fileId = file ? uploadedFile.value?.id : props.selectedFile?.id
    const replyTo = reply.value?.id
    if (sending.value || unavailable.value || !loaded.value || (!message && !fileId && !file) || message.length > teamMessageLimit) return
    sending.value = true
    sendError.value = ''
    try {
        if (file && !fileId) {
            const body = new FormData()
            body.append('files', file)
            const uploaded = await teamFetch<{ files: TeamFileReference[] }>(`/api/teams/${props.teamId}/files`, { method: 'POST', body, timeout: 180000 })
            uploadedFile.value = uploaded.files[0] ?? null
            if (!uploadedFile.value) throw new Error(localize('Could not send the message.'))
            fileId = uploadedFile.value.id
        }
        if (!pendingSend || pendingSend.message !== message || pendingSend.fileId !== fileId || pendingSend.replyTo !== replyTo)
            pendingSend = { message, requestId: crypto.randomUUID(), fileId, replyTo }
        const saved = await teamFetch<{ message: TeamChatMessage }>(endpoint, {
            method: 'POST',
            body: pendingSend,
            timeout: 10000
        })
        pendingSend = undefined
        if (draft.value === input) draft.value = ''
        if (file || props.selectedFile?.id === fileId) clearAttachment()
        if (reply.value?.id === replyTo) reply.value = null
        if (!unavailable.value) {
            mergeMessages([saved.message])
            if (jumpTarget.value) await jump()
            else await scrollToEnd()
        }
    } catch (failure) {
        sendError.value = resolveApiError(failure, localize('Could not send the message.'))
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
            class="h-[45dvh] min-h-48 overflow-y-auto rounded-lg border border-divider bg-canvas py-2"
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
            <ol v-if="messages.length" class="flex flex-col">
                <li
                    v-for="message in displayMessages"
                    :key="message.id"
                    :id="`team-message-${message.id}`"
                    tabindex="-1"
                    class="group/message relative border-l-2 border-transparent px-4 hover:bg-control focus-within:bg-control max-mobile:px-2"
                    :class="{
                        'mt-3 pt-1': !message.grouped,
                        'border-amber-400! bg-amber-400/8': message.mentionsMe,
                        'bg-accent/10 ring-1 ring-inset ring-accent/45': message.id === highlighted
                    }"
                >
                    <button v-if="message.reply" type="button" class="mb-0.5 ml-5 flex min-w-0 max-w-[calc(100%-1.25rem)] items-center gap-2 text-left text-xs text-muted hover:text-foreground"
                        :disabled="loading" @click="jump(message.reply.id)">
                        <span class="h-3 w-5 shrink-0 self-end rounded-tl-md border-t-2 border-l-2 border-current opacity-60" aria-hidden="true" />
                        <span class="grid size-4 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white"
                            :style="{ backgroundColor: avatarColor(message.reply.authorName) }" aria-hidden="true">{{ initials(message.reply.authorName) }}</span>
                        <strong class="max-w-1/2 shrink-0 truncate">@{{ message.reply.authorName ?? $msg('Deleted user') }}</strong>
                        <span class="min-w-0 truncate">{{ message.reply.excerpt || $msg('Shared file') }}</span>
                    </button>
                    <div class="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
                    <span v-if="!message.grouped" class="mt-0.5 grid size-9 place-items-center rounded-full text-xs font-bold text-white"
                        :style="{ backgroundColor: avatarColor(message.authorName) }" aria-hidden="true">{{ initials(message.authorName) }}</span>
                    <div class="col-start-2 min-w-0">
                    <div v-if="!message.grouped" class="flex flex-wrap items-baseline gap-x-2">
                        <span class="wrap-anywhere text-sm font-semibold text-foreground">{{ message.authorName ?? $msg('Deleted user') }}</span>
                        <time :datetime="message.createdAt" class="text-[11px] text-muted">{{ timestamp.format(new Date(message.createdAt)) }}</time>
                    </div>
                    <p v-if="message.body" class="whitespace-pre-wrap wrap-anywhere text-sm leading-6 text-foreground"><template v-for="(segment, index) in message.segments" :key="index"><span v-if="segment.mention" class="rounded-sm bg-accent/20 px-0.5 font-medium text-accent">{{ segment.text }}</span><template v-else>{{ segment.text }}</template></template></p>
                    <button v-if="message.file" type="button" class="mt-2 flex max-w-full items-center gap-2 rounded-lg border border-divider px-3 py-2 text-left text-accent"
                        @click="emit('preview', message.file)">
                        <Icon name="solar:document-linear" class="shrink-0" />
                        <span class="min-w-0 wrap-anywhere text-sm">{{ message.file.name }}</span>
                    </button>
                    <p v-else-if="!message.body" class="mt-1 text-sm text-muted">{{ $msg('File is unavailable.') }}</p>
                    </div>
                    </div>
                    <div class="absolute right-3 -top-3 flex rounded-md border border-divider bg-surface opacity-0 shadow-sm group-hover/message:opacity-100 group-focus-within/message:opacity-100 pointer-coarse:static pointer-coarse:ml-12 pointer-coarse:w-fit pointer-coarse:opacity-100">
                        <button type="button" class="grid size-8 place-items-center text-muted hover:text-accent" :title="$msg('Reply')" :aria-label="$msg('Reply')"
                            @click="reply = { id: message.id, authorName: message.authorName, excerpt: message.body.slice(0, 180) }; composer?.focus()">
                            <Icon name="solar:reply-linear" />
                        </button>
                        <button type="button" class="grid size-8 place-items-center text-muted hover:text-accent" :title="$msg('Create task')" :aria-label="$msg('Create task')" @click="emit('task', message)">
                            <Icon name="solar:checklist-linear" />
                        </button>
                        <button v-if="canPin" type="button" class="grid size-8 place-items-center text-muted hover:text-accent" :disabled="pinBusy"
                            :title="pins.some(pin => pin.id === message.id) ? $msg('Unpin') : $msg('Pin')"
                            :aria-label="pins.some(pin => pin.id === message.id) ? $msg('Unpin') : $msg('Pin')" @click="togglePin(message.id)">
                            <Icon name="solar:pin-linear" />
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
            <div v-if="localFile || selectedFile" class="flex w-full items-center gap-2 rounded-md border border-divider px-3 py-2 text-sm">
                <Icon name="solar:document-linear" />
                <span class="min-w-0 flex-1 truncate">{{ localFile?.name ?? selectedFile?.name }}</span>
                <button type="button" :disabled="sending" :aria-label="$msg('Remove attachment')" @click="clearAttachment">
                    <Icon name="solar:close-circle-linear" />
                </button>
            </div>
            <div class="relative flex w-full items-end gap-2 rounded-lg border border-divider bg-control p-1.5">
                <ul v-if="suggestions.length" :id="listId" role="listbox" :aria-label="$msg('Mention a member')"
                    class="absolute inset-x-0 bottom-full z-10 mb-1 max-h-60 overflow-y-auto rounded-lg border border-divider bg-surface p-1 shadow-lg">
                    <li v-for="(member, index) in suggestions" :id="`${listId}-${index}`" :key="member.id" role="option"
                        :aria-selected="index === activeMention" class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                        :class="{ 'bg-control': index === activeMention }" @pointerenter="activeMention = index"
                        @pointerdown.prevent @click="addMention(member)">
                        <span class="grid size-6 place-items-center rounded-full text-[10px] font-bold text-white"
                            :style="{ backgroundColor: avatarColor(member.username) }" aria-hidden="true">{{ initials(member.username) }}</span>
                        {{ member.username }}
                    </li>
                </ul>
                <input v-if="canUpload" ref="picker" type="file" hidden @change="chooseFile" />
                <button v-if="canUpload" type="button" class="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:text-accent"
                    :disabled="sending" :aria-label="$msg('Attach a file')" :title="$msg('Attach a file')" @click="picker?.click()">
                    <Icon name="solar:add-circle-linear" size="22" />
                </button>
                <textarea ref="composer" v-model="draft" rows="1" :maxlength="teamMessageLimit" :aria-label="$msg('Message')"
                    :placeholder="$msg('Message')" :aria-controls="suggestions.length ? listId : undefined"
                    :aria-activedescendant="suggestions.length ? `${listId}-${activeMention}` : undefined"
                    aria-autocomplete="list" class="field-sizing-content max-h-36 min-h-9 min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-sm text-foreground"
                    @click="updateMention" @keyup.left.right.home.end="updateMention"
                    @blur="mention = null" @keydown="composerKey" />
                <button type="submit" class="inbox-button inbox-primary shrink-0" :disabled="!loaded || sending || (!draft.trim() && !selectedFile && !localFile)">
                    <Icon name="solar:plain-linear" aria-hidden="true" />
                    {{ sending ? $msg('Sending...') : $msg('Send') }}
                </button>
            </div>
        </form>
        <p v-if="sendError" role="alert" class="text-sm text-danger">{{ sendError }}</p>
    </section>
</template>
