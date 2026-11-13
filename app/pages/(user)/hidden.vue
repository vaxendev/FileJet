<script setup lang="ts">
import type { LibraryItem } from '~~/shared/types/library'
import { formatFileSize, getFileIcon } from '~/utils/file'

definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Hidden')} · FileJet` }))
const { busy, setHidden } = useHiddenItems()
const accessUrl = '/api/items/hidden/access'
type Access = { configured: boolean; expiresAt: number | null }
const access = ref<Access>()
const data = ref<LibraryItem[]>([])
const pending = ref(true)
const submitting = ref(false)
const error = ref('')
const password = ref('')
const confirmation = ref('')
let expiry: ReturnType<typeof setTimeout> | undefined
let disposed = false

const reset = (next: Access) => {
    clearTimeout(expiry)
    access.value = next
    data.value = []
    if (next.expiresAt) expiry = setTimeout(() => reset({ configured: true, expiresAt: null }),
        Math.max(0, next.expiresAt - Date.now()))
}
const refresh = async () => {
    const grant = access.value?.expiresAt
    if (!grant) return
    error.value = ''
    pending.value = true
    try {
        const result = await $fetch<{ items: LibraryItem[] }>('/api/items/hidden')
        if (!disposed && access.value?.expiresAt === grant) data.value = result.items
    } catch (failure) {
        if (disposed || access.value?.expiresAt !== grant) return
        if ((failure as { statusCode?: number }).statusCode === 423) reset({ configured: true, expiresAt: null })
        else error.value = resolveApiError(failure)
    } finally {
        pending.value = false
    }
}
const loadAccess = async () => {
    pending.value = true
    error.value = ''
    try {
        const next = await $fetch<Access>(accessUrl)
        if (disposed) return
        reset(next)
        await refresh()
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        pending.value = false
    }
}
const submit = async () => {
    if (!access.value || submitting.value) return
    submitting.value = true
    error.value = ''
    try {
        const next = await $fetch<Access>(accessUrl, {
            method: 'POST', body: { setup: !access.value.configured, password: password.value, confirmPassword: confirmation.value }
        })
        if (disposed) return
        password.value = ''
        confirmation.value = ''
        reset(next)
        await refresh()
    } catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode
        if (status === 409) await loadAccess()
        error.value = resolveApiError(failure)
    } finally {
        submitting.value = false
    }
}
const lock = async () => {
    if (submitting.value) return
    submitting.value = true
    error.value = ''
    try {
        await $fetch(accessUrl, { method: 'DELETE' })
        reset({ configured: true, expiresAt: null })
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        submitting.value = false
    }
}
onMounted(loadAccess)
onBeforeUnmount(() => { disposed = true; clearTimeout(expiry) })
const search = ref('')
const items = computed(() => data.value
    .filter(item => item.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)))
const { currentPage, totalPages, paginatedItems } = usePagination(items, ref(24))
watch(search, () => { currentPage.value = 1 })
watch(totalPages, total => { currentPage.value = Math.min(currentPage.value, Math.max(1, total)) })
const href = (item: LibraryItem) => `/${{ file: 'files', folder: 'folders', note: 'notes' }[item.type]}/${item.id}?from=/hidden`
const icon = (item: LibraryItem) => item.type === 'file' ? getFileIcon(item.mime_type ?? null, item.name)
    : item.type === 'folder' ? 'solar:folder-bold' : 'solar:notebook-bold'
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <section class="flex w-full min-w-0 flex-col gap-3">
            <div v-if="error" role="alert" class="rounded-xl border border-divider bg-surface p-3">
                <p class="text-sm text-danger">{{ error }}</p>
                <button v-if="!access || access.expiresAt" type="button" class="inbox-button mt-3" @click="loadAccess()">{{ $msg('Try again') }}</button>
            </div>
            <p v-if="pending && !access?.expiresAt" role="status" class="p-3 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <form v-else-if="access && !access.expiresAt" class="flex w-full max-w-md flex-col gap-3 rounded-xl border border-divider bg-surface p-4" @submit.prevent="submit">
                <h2 class="font-semibold text-foreground">{{ access.configured ? $msg('Unlock Hidden') : $msg('Set a Hidden password') }}</h2>
                <label class="flex flex-col gap-1 text-sm">
                    {{ $msg('Hidden password') }}
                    <input v-model="password" class="inbox-input" type="password" :autocomplete="access.configured ? 'current-password' : 'new-password'"
                        :minlength="access.configured ? undefined : 8" maxlength="128" required />
                </label>
                <label v-if="!access.configured" class="flex flex-col gap-1 text-sm">
                    {{ $msg('Confirm Hidden password') }}
                    <input v-model="confirmation" class="inbox-input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required />
                </label>
                <button type="submit" class="inbox-button inbox-primary self-start" :disabled="submitting">
                    {{ access.configured ? $msg('Unlock Hidden') : $msg('Set password') }}
                </button>
            </form>
            <template v-else-if="access?.expiresAt">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <SearchBox v-model="search" class="min-w-0 flex-1" :placeholder="$msg('Search hidden items…')" />
                <button type="button" class="inbox-button" :disabled="submitting || busy" @click="lock">{{ $msg('Lock Hidden') }}</button>
            </div>
            <p v-if="pending" role="status" class="p-3 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <p v-else-if="!items.length" class="rounded-xl border border-dashed border-divider p-5 text-center text-sm text-muted">
                {{ search.trim() ? $msg('No matching hidden items.') : $msg('No hidden items yet.') }}
            </p>
            <ul v-else class="divide-y divide-divider rounded-xl border border-divider bg-surface px-4">
                <li v-for="item in paginatedItems" :key="`${item.type}:${item.id}`" class="flex flex-wrap items-center justify-between gap-3 py-3">
                    <NuxtLink :to="href(item)" class="flex min-w-0 flex-1 items-center gap-3 text-foreground">
                        <Icon :name="icon(item)" size="24" class="shrink-0 text-accent" />
                        <span class="min-w-0">
                            <span class="block wrap-anywhere text-sm font-medium">{{ item.name }}</span>
                            <span class="text-xs text-muted">{{ localizeItemType(item.type) }}<template v-if="item.type !== 'folder'"> · {{ formatFileSize(item.size) }}</template></span>
                        </span>
                    </NuxtLink>
                    <button type="button" class="inbox-button" :disabled="busy" @click="setHidden(item.type, item.id, false, refresh)">
                        {{ $msg('Make visible') }}
                    </button>
                </li>
            </ul>
            <Pagination v-if="totalPages > 1" v-model="currentPage" :total-pages="totalPages" view-mode="list" />
            </template>
        </section>
    </div>
</template>
