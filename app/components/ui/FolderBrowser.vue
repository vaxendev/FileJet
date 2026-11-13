<template>
    <QuickPreviewScope :items="paginatedItems" :selected-ids="selected"
        class="folder-browser group/folder-browser flex-1 min-h-0 min-w-0 flex flex-col gap-3 p-5 max-phone:p-3"
        :class="{ 'is-read-only': readOnly }"
    >
        <div class="contents-toolbar flex shrink-0 flex-col gap-3">
            <div class="contents-heading-row flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2.5">
                    <h2 class="m-0 text-sm font-semibold text-foreground">{{ $msg('Contents') }}</h2>
                    <span class="rounded-md bg-control px-2 py-1 text-xs text-muted">{{ $countMsg('folderItems', items.length) }}</span>
                </div>
                <div v-if="$slots.controls" class="contents-actions ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <slot name="controls" />
                </div>
            </div>
            <div class="contents-toolbar-top border-b border-divider pb-3">
                <SearchBox class="contents-search min-w-0"
                    v-model="search"
                    :placeholder='$msg("Search this folder...")'
                />
                <div v-if="!readOnly" class="contents-controls flex min-w-0 items-center">
                    <TagFilter v-model="activeTag" :items="items" />
                </div>
                <div class="contents-display-controls flex items-center gap-2">
                    <SortDropdown v-model="sort" />
                    <ViewSwitcher v-model="view" />
                </div>
            </div>
        </div>
        <DataView
            :view-mode="view"
            :is-loading="pending"
        >
            <template #loading>
                <div class="contents-empty flex flex-col items-center justify-center gap-3 min-h-48 text-muted">{{ $msg("Loading folder contents...") }}</div>
            </template>
            <template
                v-if="!pending && !filtered.length"
                #empty
            >
                <div class="contents-empty flex flex-col items-center justify-center gap-3 min-h-48 text-muted">
                    <Icon
                        name="solar:folder-linear"
                        size="2.5rem"
                    />
                    <strong>{{ search ? $msg('No matching items') : $msg('This folder is empty') }}</strong>
                </div>
            </template>
            <template #list>
                <div class="table-scroll min-h-0 overflow-auto">
                    <table class="mobile-item-table contents-table table-fixed border-collapse w-full min-w-144 text-left text-[0.85rem]
                        text-secondary">
                        <thead>
                            <tr>
                                <th class="w-14 p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted" v-if="!readOnly">
                                    <input
                                        type="checkbox"
                                        class="item-checkbox file-checkbox"
                                        :checked="allSelected"
                                        :indeterminate="partiallySelected"
                                        :disabled="busy"
                                        @change="toggleSelectAll"
                                    />
                                </th>
                                <th class="w-[42%] p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted">{{ $msg("Name") }}</th>
                                <th class="p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted">{{ $msg("Type") }}</th>
                                <th class="p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted">{{ $msg("Size") }}</th>
                                <th class="p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted">{{ $msg("Modified") }}</th>
                                <th class="p-3 border-b border-b-divider sticky top-0 bg-surface font-medium text-heading-muted" v-if="!readOnly">{{ $msg("Actions") }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="cursor-pointer hover:bg-surface-hover selected:bg-surface-hover"
                                v-for="item in paginatedItems"
                                :key="item.id"
                                :data-preview-id="item.id" tabindex="0" aria-keyshortcuts="Space"
                                :class="{ selected: selected.includes(item.id) }"
                                @click="$emit('open', item)"
                                @contextmenu.prevent.stop="contextMenu($event, item)"
                            >
                                <td class="item-selection-cell p-3 border-b border-b-divider"
                                    v-if="!readOnly"
                                    @click.stop
                                >
                                    <input
                                        v-model="selected"
                                        type="checkbox"
                                        class="item-checkbox file-checkbox"
                                        :value="item.id"
                                        :disabled="busy"
                                    />
                                </td>
                                <td class="item-name-cell p-3 border-b border-b-divider">
                                    <div class="item-name flex items-center gap-3 min-w-0">
                                        <span class="item-icon grid place-items-center shrink-0 rounded-[10px] bg-accent/12 text-accent text-lg
                                            size-[2.7rem]"><Icon :name="icon(item)" /></span>
                                        <strong class="min-w-0 flex-1 truncate" :title="item.name">{{ item.name }}</strong>
                                    </div>
                                <ItemTags :tags="item.tags" />
                                </td>
                                <td :data-label='$msg("Type")' class="item-meta-cell p-3 border-b border-b-divider">{{ item.type }}</td>
                                <td :data-label='$msg("Size")' class="item-meta-cell p-3 border-b border-b-divider">
                                    {{ item.type === 'folder' ? '—' : formatFileSize(item.size) }}
                                </td>
                                <td :data-label='$msg("Modified")' class="item-meta-cell p-3 border-b border-b-divider">{{ formatFileTime(item.updated_at ?? item.created_at) }}</td>
                                <td class="item-actions-cell p-3 border-b border-b-divider"
                                    v-if="!readOnly"
                                    @click.stop
                                >
                                    <ItemMenu
                                        :ref="menu => setMenu(item.id, menu)"
                                        hideable
                                        @hide="$emit('action', 'hide', item)"
                                        :type="item.type"
                                        :is-favorite="favoriteIds.includes(item.id)"
                                        :can-copy="
                                            item.type === 'file' &&
                                            canCopyFile(item.mime_type, item.original_name)
                                        "
                                        @open="$emit('open', item)"
                                        @edit="$emit('action', 'edit', item)"
                                        @rename="$emit('action', 'rename', item)"
                                        @download="$emit('action', 'download', item)"
                                        @copy="$emit('action', 'copy', item)"
                                        @favorite="$emit('action', 'favorite', item)"
                                        @delete="$emit('action', 'delete', item)"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
            <template #grid>
                <ItemGrid class="group-[.is-read-only]/folder-browser:grid-cols-[repeat(auto-fill,_minmax(min(100%,_14rem),_1fr))]">
                    <ItemGridCard :tags="item.tags"
                        v-for="item in paginatedItems"
                        :key="item.id"
                                :data-preview-id="item.id" tabindex="0" aria-keyshortcuts="Space"
                        :title="item.name"
                        :icon="icon(item)"
                        :selected="selected.includes(item.id)"
                        :class="'item-type-' + item.type"
                        @click="$emit('open', item)"
                        @contextmenu.prevent.stop="contextMenu($event, item)"
                    >
                        <template
                            v-if="
                                item.type === 'file' &&
                                previewUrl &&
                                (item.mime_type?.startsWith('image/') ||
                                    item.mime_type?.startsWith('video/'))
                            "
                            #preview
                        >
                            <img
                                v-if="item.mime_type?.startsWith('image/')"
                                :src="previewUrl(item)"
                                :alt="item.name"
                                class="item-preview object-cover size-full"
                                loading="lazy"
                            />
                            <video
                                v-else
                                :src="previewUrl(item)"
                                class="item-preview object-cover size-full"
                                preload="metadata"
                                muted
                                playsinline
                            />
                        </template>
                        <template
                            v-if="!readOnly"
                            #actions
                        >
                            <label class="file-select flex items-center justify-center bg-selection-surface border border-selection-border
                                rounded-full cursor-pointer size-8">
                                <input
                                    v-model="selected"
                                    type="checkbox"
                                    class="item-checkbox file-checkbox m-0 accent-accent cursor-pointer size-[1.1rem]"
                                    :value="item.id"
                                    :disabled="busy"
                                />
                            </label>
                            <ItemMenu
                                :ref="menu => setMenu(item.id, menu)"
                                hideable
                                @hide="$emit('action', 'hide', item)"
                                :type="item.type"
                                :is-favorite="favoriteIds.includes(item.id)"
                                :can-copy="
                                    item.type === 'file' &&
                                    canCopyFile(item.mime_type, item.original_name)
                                "
                                @open="$emit('open', item)"
                                @edit="$emit('action', 'edit', item)"
                                @rename="$emit('action', 'rename', item)"
                                @download="$emit('action', 'download', item)"
                                @copy="$emit('action', 'copy', item)"
                                @favorite="$emit('action', 'favorite', item)"
                                @delete="$emit('action', 'delete', item)"
                            />
                        </template>
                        <template #metadata>
                            <span class="min-w-0 first:shrink-0 truncate">{{
                                item.type === 'folder' ? $msg('Folder') : formatFileSize(item.size)
                            }}</span>
                            &middot;
                            <span class="min-w-0 first:shrink-0 truncate">{{ formatFileTime(item.created_at) }}</span>
                        </template>
                    </ItemGridCard>
                </ItemGrid>
            </template>
        </DataView>
        <Pagination
            v-model="currentPage"
            :total-pages="totalPages"
            :view-mode="view"
        />
        <SelectionToolbar
            v-if="!readOnly"
            :items="selectionItems"
            :busy="busy || pending"
            :current-folder-id="currentFolderId"
            @clear="selected = []"
            @delete="
                $emit(
                    'deleteSelected',
                    items.filter(item => selected.includes(item.id))
                )
            "
            @moved="handleSelectionMoved"
        />
    </QuickPreviewScope>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { LibraryItem } from '~~/shared/types/library'
import type ItemMenu from './ItemMenu.vue'
import { canCopyFile, formatFileSize, formatFileTime, getFileIcon } from '~/utils/file'

const props = withDefaults(
    defineProps<{
        items: LibraryItem[]
        favoriteIds?: string[]
        pending?: boolean
        busy?: boolean
        readOnly?: boolean
        currentFolderId?: string | null
        previewUrl?: (item: LibraryItem) => string
    }>(),
    { favoriteIds: () => [], pending: false, busy: false, readOnly: false }
)

const emit = defineEmits<{
    open: [item: LibraryItem]
    action: [action: string, item: LibraryItem]
    deleteSelected: [items: LibraryItem[]]
    moved: []
}>()

const activeTag = ref('')
const matchesTaggedSearch = (name: string, tags: string[] | undefined, value: string) => {
    const query = value.trim().normalize('NFKC').toLowerCase(), values = tags ?? []
    return (!activeTag.value || values.some(tag => tag.toLowerCase() === activeTag.value)) && (query.startsWith('#') ? values.some(tag => tag.toLowerCase() === query.slice(1)) : [name, ...values].some(text => text.toLowerCase().includes(query)))
}
const search = ref('')
const view = ref<'grid' | 'list'>('grid')
const sort = ref<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest')

const filtered = computed(() =>
    props.items.filter(item => matchesTaggedSearch(item.name, item.tags, search.value))
)

const { sortedItems } = useSort(
    filtered,
    sort,
    item => item.name,
    item => item.created_at
)

const perPage = computed(() => (view.value === 'list' ? 12 : 24))
const { currentPage, totalPages, paginatedItems } = usePagination(sortedItems, perPage)
const { selectedItems: selected, allSelected, toggleSelectAll } = useSelection(paginatedItems)

const selectionItems = computed(() =>
    props.items
        .filter(item => selected.value.includes(item.id))
        .map(item => ({ id: item.id, type: item.type }))
)

const handleSelectionMoved = () => {
    selected.value = []
    emit('moved')
}

const partiallySelected = computed(
    () => !allSelected.value && paginatedItems.value.some(item => selected.value.includes(item.id))
)

const menus = new Map<string, InstanceType<typeof ItemMenu>>()

const setMenu = (id: string, menu: Element | ComponentPublicInstance | null) => {
    if (menu) menus.set(id, menu as InstanceType<typeof ItemMenu>)
    else menus.delete(id)
}

const contextMenu = (event: MouseEvent, item: LibraryItem) => {
    if (!props.readOnly && !props.busy) menus.get(item.id)?.openAt(event.clientX, event.clientY)
}

const icon = (item: LibraryItem) =>
    item.type === 'folder'
        ? 'solar:folder-bold'
        : item.type === 'note'
          ? 'solar:notebook-bold'
          : getFileIcon(item.mime_type ?? null, item.original_name)

watch([search, activeTag, sort, view], () => {
    currentPage.value = 1
})
watch(totalPages, total => {
    currentPage.value = Math.min(currentPage.value, Math.max(1, total))
})
watch(
    () => props.items,
    items => {
        const available = new Set(items.map(item => item.id))
        selected.value = selected.value.filter(id => available.has(id))
    }
)
watch(activeTag, () => { selected.value = []; currentPage.value = 1 })
</script>

<style scoped>
.folder-browser { container-type: inline-size; }
.contents-heading-row { min-height: 2.5rem; }
.contents-toolbar-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: .75rem;
}
.is-read-only .contents-toolbar-top { grid-template-columns: minmax(0, 1fr) auto; }
.contents-display-controls { justify-self: end; }
.contents-search {
    flex: none;
    width: 100%;
    max-width: none;
    height: 2.75rem;
    border-radius: .75rem;
    background: var(--color-canvas);
}
@container (max-width: 44rem) {
    .contents-heading-row { min-height: 1.5rem; }
    .contents-toolbar-top { grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; }
    .contents-search { grid-column: 1 / -1; }
    .is-read-only .contents-display-controls { grid-column: 1 / -1; }
}
@container (max-width: 25rem) {
    .contents-display-controls :deep(.sort-trigger) { padding-inline: .5rem; font-size: .75rem; }
    .contents-display-controls :deep(.view-switcher) { width: 5.5rem; }
}
.contents-actions :deep(button) { height: 2.5rem; min-height: 2.5rem; border-radius: .625rem; }
@media (pointer: coarse) {
    .contents-actions :deep(button) { height: 2.75rem; min-height: 2.75rem; }
}
</style>
