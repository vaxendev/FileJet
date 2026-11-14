<script setup lang="ts">
import { $fetch as fetchSearch } from 'ofetch'
import type { TeamChatSearchPage, TeamChatSearchResult } from '~~/shared/types/teamChat'

const props = defineProps<{ teamId: string; jumping: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const open = ref(false)
const text = ref('')
const author = ref('')
const file = ref('')
const pending = ref(false)
const error = ref('')
const results = ref<TeamChatSearchPage>()
const searchButton = ref<HTMLButtonElement>()
const searchInput = ref<HTMLInputElement>()
const panelId = useId()
const timestamp = computed(() => new Intl.DateTimeFormat(currentLocaleTag(), { dateStyle: 'short', timeStyle: 'short' }))
const canSearch = computed(() => Boolean(text.value.trim() || author.value.trim() || file.value.trim()))
let generation = 0

const toggle = async () => {
    open.value = !open.value
    await nextTick()
    if (open.value) {
        searchInput.value?.focus()
        if (results.value) void search()
    } else searchButton.value?.focus()
}
const search = async (more = false) => {
    if (pending.value || !canSearch.value) return
    const request = ++generation
    pending.value = true
    error.value = ''
    try {
        const page = await fetchSearch<TeamChatSearchPage>(`/api/teams/${props.teamId}/messages/search`, {
            query: { q: text.value.trim() || undefined, author: author.value.trim() || undefined, file: file.value.trim() || undefined,
                before: more ? results.value?.next : undefined },
            timeout: 10000
        })
        if (request !== generation) return
        results.value = more && results.value ? { ...page, items: [...results.value.items, ...page.items] } : page
    } catch (failure) {
        if (request === generation) error.value = resolveApiError(failure)
    } finally {
        if (request === generation) pending.value = false
    }
}
const select = (message: TeamChatSearchResult) => {
    open.value = false
    emit('select', message.id)
}
watch([text, author, file], () => {
    generation++
    results.value = undefined
    error.value = ''
    pending.value = false
})
onBeforeUnmount(() => { generation++ })
</script>

<template>
    <div class="flex flex-col items-start gap-3">
        <button ref="searchButton" type="button" class="inbox-button gap-2" :aria-expanded="open" :aria-controls="panelId" @click="toggle">
            <Icon name="solar:magnifer-linear" aria-hidden="true" />{{ $msg('Search messages') }}
        </button>
        <section v-show="open" :id="panelId" class="w-full rounded-lg border border-divider bg-canvas p-3"
            :aria-label="$msg('Search messages')" @keydown.esc.stop="toggle">
            <form class="flex flex-wrap items-end gap-2" @submit.prevent="search()">
                <label class="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted">
                    {{ $msg('Message text') }}
                    <input ref="searchInput" v-model="text" type="search" maxlength="120" class="inbox-input w-full" />
                </label>
                <label class="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted">
                    {{ $msg('Author') }}
                    <input v-model="author" type="search" maxlength="120" class="inbox-input w-full" />
                </label>
                <label class="flex min-w-36 flex-1 flex-col gap-1 text-xs text-muted">
                    {{ $msg('Attachment name') }}
                    <input v-model="file" type="search" maxlength="120" class="inbox-input w-full" />
                </label>
                <button type="submit" class="inbox-button inbox-primary" :disabled="pending || !canSearch">{{ $msg('Search') }}</button>
            </form>
            <p v-if="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
            <p v-if="pending" role="status" class="mt-3 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <p v-else-if="results && !results.items.length" class="mt-3 text-sm text-muted">{{ $msg('No matching messages.') }}</p>
            <ul v-if="results?.items.length" class="mt-3 max-h-72 divide-y divide-divider overflow-y-auto">
                <li v-for="message in results.items" :key="message.id">
                    <button type="button" class="flex w-full flex-col gap-1 rounded px-2 py-2 text-left hover:bg-control"
                        :disabled="jumping" @click="select(message)">
                        <span class="flex w-full flex-wrap items-baseline justify-between gap-2">
                            <strong class="wrap-anywhere text-sm">{{ message.authorName ?? $msg('Deleted user') }}</strong>
                            <time :datetime="message.createdAt" class="text-xs text-muted">{{ timestamp.format(new Date(message.createdAt)) }}</time>
                        </span>
                        <span v-if="message.excerpt" class="line-clamp-2 wrap-anywhere text-sm text-muted">{{ message.excerpt }}</span>
                        <span v-if="message.fileName" class="wrap-anywhere text-xs text-accent">{{ message.fileName }}</span>
                    </button>
                </li>
            </ul>
            <button v-if="results?.next" type="button" class="inbox-button mt-3" :disabled="pending" @click="search(true)">{{ $msg('Load more') }}</button>
        </section>
    </div>
</template>
