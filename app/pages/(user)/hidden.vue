<script setup lang="ts">
import type { LibraryItem } from '~~/shared/types/library'
import { formatFileSize, getFileIcon } from '~/utils/file'

definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Hidden')} · FileJet` }))
const user = useAuthUser()
const { busy, setHidden } = useHiddenItems()
const { data, pending, error, refresh } = await useFetch<{ items: LibraryItem[] }>('/api/items/hidden', {
    key: `hidden-items:${user.value?.id}`,
    lazy: true
})
const search = ref('')
const items = computed(() => (data.value?.items ?? [])
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
        <section class="mx-auto flex max-w-350 flex-col gap-4 p-5 max-mobile:p-3">
            <SearchBox v-model="search" :placeholder="$msg('Search hidden items…')" />
            <div v-if="error" role="alert" class="rounded-xl border border-divider bg-surface p-5">
                <p class="text-sm text-danger">{{ resolveApiError(error) }}</p>
                <button type="button" class="inbox-button mt-3" @click="refresh()">{{ $msg('Try again') }}</button>
            </div>
            <p v-else-if="pending" role="status" class="p-6 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <p v-else-if="!items.length" class="rounded-xl border border-dashed border-divider p-8 text-center text-sm text-muted">
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
        </section>
    </div>
</template>
