<template>
    <div class="home-dashboard flex h-full min-h-0 flex-col gap-3 overflow-y-auto [scrollbar-color:var(--color-scrollbar)_transparent] [scrollbar-width:thin]">
        <section class="grid shrink-0 grid-cols-3 gap-3 max-mobile:gap-2" :aria-label="$msg('Dashboard')">
            <NuxtLink v-for="stat in libraryStats" :key="stat.to" :to="stat.to"
                class="flex min-h-32 min-w-0 items-center gap-4 rounded-[1.5rem] border border-divider bg-surface p-4 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-mobile:min-h-24 max-mobile:flex-col max-mobile:items-start max-mobile:gap-2 max-mobile:rounded-[0.75rem] max-mobile:p-3">
                <span class="grid size-[3.4rem] shrink-0 place-items-center rounded-[0.675rem] bg-accent/12 text-[1.6rem] text-accent max-mobile:size-8 max-mobile:rounded-[0.5rem] max-mobile:text-lg">
                    <Icon :name="stat.icon" aria-hidden="true" />
                </span>
                <span class="flex min-w-0 flex-col gap-1 max-mobile:gap-0.5">
                    <strong class="text-[1.7rem] leading-tight font-bold text-foreground max-mobile:text-xl">{{ stat.count.toLocaleString(currentLocaleTag()) }}</strong>
                    <span class="text-sm text-muted max-mobile:text-xs">{{ $msg(stat.label) }}</span>
                </span>
            </NuxtLink>
        </section>

        <div class="home-panels grid gap-3">
            <section class="home-panel flex min-h-0 flex-col">
                <header class="home-panel-header flex items-center justify-between gap-2">
                    <h2 class="home-panel-title">{{ $msg('Recent Files') }}</h2>
                    <NuxtLink to="/files" class="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                        {{ $msg('View all') }}
                        <Icon name="solar:arrow-right-linear" aria-hidden="true" />
                    </NuxtLink>
                </header>
                <div v-if="recentError" class="flex min-h-52 flex-col items-center justify-center gap-3 p-5 text-center">
                    <p role="alert" class="text-sm text-muted">{{ $msg('Unable to load files') }}</p>
                    <UButton color="neutral" variant="outline" :label="$msg('Try again')"
                        :disabled="recentStatus === 'pending'" @click="refreshRecentFiles()" />
                </div>
                <div v-else-if="!recentFiles.length" class="flex min-h-52 flex-col items-center justify-center gap-3 p-5 text-center">
                    <span class="grid size-12 place-items-center rounded-xl bg-control text-2xl text-accent">
                        <Icon name="solar:file-bold" aria-hidden="true" />
                    </span>
                    <strong class="text-sm font-semibold text-foreground">{{ $msg('No files yet') }}</strong>
                    <UButton to="/files" color="primary" variant="soft" :label="$msg('Open Files')" />
                </div>
                <ul v-else class="recent-files-grid grid min-h-0 content-start grid-cols-[repeat(auto-fill,minmax(min(100%,8.25rem),1fr))] gap-2.5 px-4 pt-1 pb-4 max-mobile:grid-cols-2">
                    <li v-for="file in recentFiles" :key="file.id" class="min-w-0">
                        <ItemGridCard :title="file.name" :icon="getFileIcon(file.mime_type, file.original_name)"
                            class="recent-file-card relative h-full min-h-0 rounded-[0.625rem] border-raised bg-subtle p-2">
                            <template v-if="hasMediaPreview(file)" #preview>
                                <img v-if="file.mime_type?.startsWith('image/')" :ref="element => checkPreview(file.id, element)"
                                    :src="`/api/files/${file.id}/preview`" alt="" class="size-full object-cover"
                                    loading="lazy" decoding="async" @error="failedPreviews.add(file.id)" />
                                <template v-else>
                                    <video :ref="element => checkPreview(file.id, element)" :src="`/api/files/${file.id}/preview`"
                                        class="size-full object-cover" aria-hidden="true" preload="metadata" muted playsinline
                                        @error="failedPreviews.add(file.id)" />
                                    <span class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
                                        <Icon name="solar:play-bold" class="box-content rounded-full bg-black/60 p-2.5 text-white" size="16" />
                                    </span>
                                </template>
                            </template>

                            <template #actions>
                                <ItemMenu class="ml-auto" type="file" :is-favorite="isFileFavorite(file.id)" hideable
                                    :can-copy="canCopyFile(file.mime_type, file.original_name)"
                                    @hide="setHidden('file', file.id, true, refreshRecentFiles)" @open="openFile(file)" @download="handleDownload(file.id)"
                                    @rename="startRename(file)" @copy="handleCopy(file)" @favorite="handleFavorite(file)" @delete="handleDelete(file)" />
                            </template>

                            <template #title>
                                <input v-if="editingFileId === file.id"
                                    :ref="element => { nameInput = element as HTMLInputElement | null }"
                                    v-model="editingFileName" type="text" class="grid-name-input active"
                                    :aria-label="$msg('Rename')" :readonly="isSavingRename"
                                    @keydown.enter.prevent="saveRename(file)" @keydown.esc.prevent="cancelRename" @blur="saveRename(file)" />
                                <NuxtLink v-else :to="{ path: '/files/' + file.id, query: { from: '/home' } }"
                                    class="block truncate text-[0.8rem] leading-5 font-semibold text-foreground after:absolute after:inset-0 after:rounded-[0.625rem] after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
                                    :aria-label="file.name" :title="file.name">{{ file.name }}</NuxtLink>
                            </template>

                            <template #metadata>
                                <span class="truncate text-[0.7rem]">{{ formatFileSize(file.size) }}<template v-if="file.created_at"> · {{ formatFileTime(file.created_at) }}</template></span>
                            </template>
                        </ItemGridCard>
                    </li>
                </ul>
            </section>

            <div class="home-side-panels grid min-w-0 gap-4">
                <section class="home-panel">
                    <header class="home-panel-header">
                        <h2 class="home-panel-title" :title="$msg('Includes items in Trash')">{{ $msg('Storage Usage') }}</h2>
                    </header>
                    <div class="px-5 pt-1 pb-5" :aria-busy="storageStatus === 'pending'">
                        <template v-if="storageUsage && !storageError">
                            <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <strong class="text-[1.3rem] font-bold tabular-nums text-foreground">
                                    {{ storagePercent.toLocaleString(currentLocaleTag(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}%
                                </strong>
                                <span class="text-sm text-muted"><b class="font-semibold text-foreground">{{ formatFileSize(storageUsage.storageUsed) }}</b> / {{ formatFileSize(storageUsage.storageLimit) }}</span>
                            </div>
                            <meter class="home-storage-meter" min="0" max="100" :value="Math.min(100, storagePercent)"
                                :aria-label="$msg('Storage used')" />
                            <dl class="mt-[clamp(1.5rem,5dvh,3rem)] grid gap-4">
                                <div v-for="type in storageTypes" :key="type.key" class="flex justify-between gap-2 text-sm">
                                    <dt class="flex min-w-0 items-center gap-2 text-muted" :title="type.key === 'documents' ? $msg('Document files and notes') : undefined">
                                        <span class="size-2 shrink-0 rounded-full" :class="type.color" aria-hidden="true" />{{ type.label }}
                                    </dt>
                                    <dd class="shrink-0 tabular-nums text-muted">{{ formatFileSize(storageUsage.categories[type.key]) }}</dd>
                                </div>
                            </dl>
                        </template>
                        <p v-else class="text-sm text-muted" :role="storageError ? 'alert' : 'status'">
                            {{ storageError ? $msg('Storage usage could not be loaded.') : $msg('Loading storage usage...') }}
                        </p>
                        <UButton v-if="storageError" class="mt-3" color="neutral" variant="outline" :label="$msg('Try again')"
                            :disabled="storageStatus === 'pending'" @click="refreshStorage()" />
                    </div>
                </section>

                <section class="home-panel">
                    <header class="home-panel-header">
                        <h2 class="home-panel-title">{{ $msg('Quick Actions') }}</h2>
                    </header>
                    <div class="grid grid-cols-2 gap-3 px-4 pb-4 max-mobile:gap-2">
                        <UploadButton class="min-w-0" :disabled="isUploading" @files="uploadRecentFiles">
                            <template #trigger="{ openPicker, disabled }">
                                <button type="button" class="home-action w-full" :disabled="disabled" @click="openPicker">
                                    <span class="home-action-icon home-action-icon-primary"><Icon name="solar:upload-linear" aria-hidden="true" /></span>
                                    {{ $msg('Upload File') }}
                                </button>
                            </template>
                        </UploadButton>
                        <button type="button" class="home-action" @click="folderFormOpen = true">
                            <span class="home-action-icon"><Icon name="solar:add-linear" aria-hidden="true" /></span>
                            {{ $msg('New Folder') }}
                        </button>
                        <button type="button" class="home-action" @click="noteFormOpen = true">
                            <span class="home-action-icon"><Icon name="solar:notebook-linear" aria-hidden="true" /></span>
                            {{ $msg('New Note') }}
                        </button>
                        <NuxtLink to="/inbox" class="home-action">
                            <span class="home-action-icon home-action-icon-primary"><Icon name="solar:users-group-rounded-linear" aria-hidden="true" /></span>
                            {{ $msg('Shared Inbox') }}
                        </NuxtLink>
                    </div>
                </section>
            </div>
        </div>

        <UploadProgress :active="isUploading" :progress="uploadProgress" :processing="isProcessing" />
        <FolderFormModal :open="folderFormOpen" @close="folderFormOpen = false" @saved="refreshDashboard" />
        <NoteFormModal :open="noteFormOpen" @close="noteFormOpen = false" @saved="refreshDashboard" />
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    middleware: 'auth',
    layout: 'user'
})

import { canCopyFile, getFileIcon, formatFileSize, formatFileTime } from '~/utils/file'
import type { StorageUsage } from '~~/shared/types/storage'

const { openToast } = useToast()

const { user, files, folders, notes, favorites, error, fetchAll } = useUser()
const { setHidden } = useHiddenItems()
const { deleteFile, renameFile, copyFile, downloadFile, uploadFiles, isDeleting, isUploading, uploadProgress, isProcessing } = useFileActions()
const { addFavorite, removeFavorite } = useFavoriteActions()
const folderFormOpen = ref(false)
const noteFormOpen = ref(false)

await fetchAll()

const { data: storageUsage, error: storageError, status: storageStatus, refresh: refreshStorage } =
    await useFetch<StorageUsage>('/api/users/@me/storage', { key: `storage-usage:${user.value?.id ?? 'current'}` })
type FileItem = Pick<(typeof files.value)[number], 'id' | 'name' | 'original_name' | 'mime_type' | 'size' | 'created_at'>
const { data: recentResult, error: recentError, status: recentStatus, refresh: refreshRecentFiles } =
    await useFetch<{ files: FileItem[] }>('/api/files/recent', { key: `recent-files:${user.value?.id ?? 'current'}` })

const storageTypes = [
    { key: 'images', get label() { return localize("Images") }, color: 'bg-[#5da9ff]' },
    { key: 'documents', get label() { return localize("Documents") }, color: 'bg-accent' },
    { key: 'videos', get label() { return localize("Videos") }, color: 'bg-[#55c2d4]' },
    { key: 'others', get label() { return localize("Others") }, color: 'bg-[#6b6b75]' }
] as const

if (error.value) {
    openToast(error.value, 'error')
}

const recentFiles = computed(() => recentResult.value?.files ?? [])
const libraryStats = computed(() => [
    { to: '/files', label: 'Files', icon: 'solar:document-linear', count: files.value.length },
    { to: '/folders', label: 'Folders', icon: 'solar:folder-linear', count: folders.value.length },
    { to: '/notes', label: 'Notes', icon: 'solar:notebook-linear', count: notes.value.length }
])

const refreshDashboard = async () => { await Promise.all([fetchAll(), refreshStorage(), refreshRecentFiles()]) }
const uploadRecentFiles = (selection: FileList) => uploadFiles(selection, refreshDashboard)

const failedPreviews = reactive(new Set<string>())
const hasMediaPreview = (file: FileItem) =>
    /^(image|video)\//.test(file.mime_type ?? '') && !failedPreviews.has(file.id)

const checkPreview = (id: string, element: Element | ComponentPublicInstance | null) => {
    // A request can fail before hydration attaches the error listener.
    if ((element instanceof HTMLImageElement && element.complete && !element.naturalWidth)
        || (element instanceof HTMLVideoElement && element.error)) {
        failedPreviews.add(id)
    }
}

const editingFileId = ref<string | null>(null)
const editingFileName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const isSavingRename = ref(false)
const isCopying = ref(false)
const isSavingFavorite = ref(false)

const openFile = (file: FileItem) => navigateTo({ path: `/files/${file.id}`, query: { from: '/home' } })

const startRename = async (file: FileItem) => {
    if (isSavingRename.value) return

    editingFileId.value = file.id
    editingFileName.value = file.name

    await nextTick()
    nameInput.value?.focus()
    nameInput.value?.select()
}

const cancelRename = () => {
    if (isSavingRename.value) return

    editingFileId.value = null
}

const saveRename = async (file: FileItem) => {
    if (editingFileId.value !== file.id || isSavingRename.value) return

    const newName = editingFileName.value.trim()

    if (!newName || newName === file.name) {
        cancelRename()

        return
    }

    isSavingRename.value = true

    try {
        await renameFile(file.id, newName)
        file.name = newName
        editingFileId.value = null
        await refreshDashboard()
        openToast(error.value || localize("File renamed successfully."), error.value ? 'error' : 'success')
    } catch (err: any) {
        openToast(resolveApiError(err, localize("File could not be renamed.")), 'error')
    } finally {
        isSavingRename.value = false
    }
}

const handleCopy = async (file: FileItem) => {
    if (isCopying.value || !canCopyFile(file.mime_type, file.original_name)) return

    isCopying.value = true

    try {
        await copyFile(file)
        openToast(localize("Copied to clipboard."), 'success')
    } catch (err: any) {
        openToast(
            resolveApiError(err, localize("File could not be copied to the clipboard.")),
            'error'
        )
    } finally {
        isCopying.value = false
    }
}

const handleDownload = async (fileId: string) => {
    try {
        await downloadFile(fileId)
    } catch (err: any) {
        openToast(resolveApiError(err, localize("File could not be downloaded.")), 'error')
    }
}

const handleDelete = async (file: FileItem) => {
    if (isDeleting.value) return

    try {
        await deleteFile(file.id)
        files.value = files.value.filter(item => item.id !== file.id)
        if (recentResult.value) {
            recentResult.value = { files: recentFiles.value.filter(item => item.id !== file.id) }
        }
        await Promise.all([refreshStorage(), refreshRecentFiles()])
    } catch (err: any) {
        openToast(resolveApiError(err, localize("File could not be deleted.")), 'error')
    }
}

const isFileFavorite = (fileId: string) => favorites.value.some(item => item.file_id === fileId)

const handleFavorite = async (file: FileItem) => {
    if (isSavingFavorite.value) return

    isSavingFavorite.value = true
    const wasFavorite = isFileFavorite(file.id)

    try {
        if (wasFavorite) {
            await removeFavorite(file.id, 'file')
        } else {
            await addFavorite(file.id, 'file')
        }

        await fetchAll()
        openToast(
            error.value ||
                (wasFavorite ? localize("File removed from favorites.") : localize("File favorited successfully.")),
            error.value ? 'error' : 'success'
        )
    } catch (err: any) {
        openToast(resolveApiError(err, localize("File could not be favorited.")), 'error')
    } finally {
        isSavingFavorite.value = false
    }
}

const storagePercent = computed(() => {
    const used = Number(storageUsage.value?.storageUsed ?? 0)
    const limit = Number(storageUsage.value?.storageLimit ?? 0)
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0
    return Math.max(0, used / limit * 100)
})
</script>

<style scoped>
.home-panel {
    min-width: 0;
    border: 1px solid var(--color-divider);
    border-radius: 1.5rem;
    background: var(--color-surface);
}

.home-panel-header {
    flex-shrink: 0;
    padding: 1rem;
}

.home-panel-title {
    color: var(--color-foreground);
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.25;
}

.home-storage-meter {
    display: block;
    width: 100%;
    height: 1rem;
    appearance: none;
    padding-block: 0.25rem;
    border-radius: 0.25rem;
    background: var(--color-meter-track);
}

.home-storage-meter::-webkit-meter-bar {
    border: 0;
    background: transparent;
    box-shadow: none;
}

.home-storage-meter::-webkit-meter-optimum-value {
    border-radius: 999px;
    background: var(--color-accent);
}

.home-storage-meter::-moz-meter-bar {
    border-radius: 999px;
    background: var(--color-accent);
}

.home-action {
    display: flex;
    min-width: 0;
    min-height: clamp(5rem, 11.7dvh, 7rem);
    align-items: center;
    gap: 0.75rem;
    padding: clamp(0.625rem, 0.85vw, 1rem);
    border: 1px solid var(--color-raised);
    border-radius: 1.5rem;
    background: var(--color-subtle);
    color: var(--color-foreground);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: start;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: background-color 150ms, border-color 150ms;
}

.home-action:hover {
    background: var(--color-raised);
    border-color: var(--color-hover-border);
}

.home-action:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
}

.home-action:disabled {
    cursor: default;
    opacity: 0.5;
}

.home-action-icon {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: clamp(2.5rem, 2.85vw, 3.4rem);
    aspect-ratio: 1;
    border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    color: var(--color-accent);
    font-size: 1.5rem;
}

.home-action-icon-primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-on-primary);
}

.recent-file-card :deep(.file-preview) {
    border-radius: 6px;
}

@media (width > 1100px) {
    .home-panels {
        flex: 1 0 0;
        min-height: 35rem;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    }

    .home-side-panels {
        grid-template-rows: repeat(2, minmax(min-content, 1fr));
    }

    .recent-files-grid {
        flex: 1 1 0;
        overflow-y: auto;
        scrollbar-color: var(--color-scrollbar) transparent;
        scrollbar-width: thin;
    }
}

@media (800px < width <= 1100px) {
    .home-side-panels {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (width <= 1100px) {
    :global(.user-content:has(> .home-dashboard)) {
        scrollbar-color: var(--color-scrollbar) transparent;
        scrollbar-width: thin;
    }
}

@media (width <= 600px) {
    .home-panel {
        border-radius: 1rem;
    }

    .home-action {
        gap: 0.5rem;
        border-radius: 0.875rem;
        font-size: 0.8125rem;
    }

    .home-action-icon {
        width: 2rem;
        font-size: 1.125rem;
    }
}
</style>
