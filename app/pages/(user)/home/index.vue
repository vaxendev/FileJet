<template>
    <div class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto [scrollbar-color:var(--color-scrollbar)_transparent] [scrollbar-width:thin]">
        <section class="grid shrink-0 grid-cols-3 gap-3 max-mobile:grid-cols-1" :aria-label="$msg('Dashboard')">
            <NuxtLink v-for="stat in libraryStats" :key="stat.to" :to="stat.to" class="group block rounded-xl">
                <UCard class="h-full bg-surface transition-colors group-hover:bg-surface-hover" variant="outline"
                    :ui="{ body: 'flex items-center gap-4 p-4 sm:p-5' }">
                    <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-xl text-accent">
                        <Icon :name="stat.icon" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block text-sm text-label">{{ $msg(stat.label) }}</span>
                        <strong class="block text-2xl font-semibold tracking-tight text-foreground">{{ stat.count.toLocaleString(currentLocaleTag()) }}</strong>
                    </span>
                    <Icon name="solar:alt-arrow-right-linear" class="shrink-0 text-muted group-hover:text-accent" aria-hidden="true" />
                </UCard>
            </NuxtLink>
        </section>

        <div class="grid grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] items-start gap-4 max-tablet:grid-cols-1">
            <UCard as="section" variant="outline" :ui="{ header: 'p-4 sm:px-5 sm:py-4', body: 'p-0 sm:p-0' }">
                <template #header>
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-base font-semibold text-foreground">{{ $msg('Recent Files') }}</h2>
                        <UButton to="/files" color="neutral" variant="ghost" :label="$msg('View all')" trailing-icon="solar:arrow-right-linear" />
                    </div>
                </template>
                <div v-if="!recentFiles.length" class="flex min-h-52 flex-col items-center justify-center gap-3 p-5 text-center">
                    <span class="grid size-12 place-items-center rounded-xl bg-control text-2xl text-accent">
                        <Icon name="solar:file-bold" aria-hidden="true" />
                    </span>
                    <strong class="text-sm font-semibold text-foreground">{{ $msg('No files yet') }}</strong>
                    <UButton to="/files" color="primary" variant="soft" :label="$msg('Open Files')" />
                </div>
                <ul v-else class="divide-y divide-divider px-3 sm:px-5">
                    <li v-for="file in recentFiles" :key="file.id" class="flex min-h-17 items-center gap-3 py-2">
                        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-control text-xl text-accent">
                            <Icon :name="getFileIcon(file.mime_type, file.original_name)" aria-hidden="true" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <input v-if="editingFileId === file.id"
                                :ref="element => { nameInput = element as HTMLInputElement | null }"
                                v-model="editingFileName" type="text" class="inbox-input"
                                :aria-label="$msg('Rename')" :readonly="isSavingRename"
                                @keydown.enter.prevent="saveRename(file)" @keydown.esc.prevent="cancelRename" @blur="saveRename(file)" />
                            <NuxtLink v-else :to="{ path: '/files/' + file.id, query: { from: '/home' } }"
                                class="block truncate rounded-sm text-sm font-semibold text-foreground hover:text-accent" :title="file.name">
                                {{ file.name }}
                            </NuxtLink>
                            <p class="mt-0.5 truncate text-xs text-muted">{{ getFileType(file.original_name) }} · {{ formatFileTime(file.created_at) }}</p>
                        </div>
                        <span class="shrink-0 text-xs text-muted max-mobile:hidden">{{ formatFileSize(file.size) }}</span>
                        <ItemMenu type="file" :is-favorite="isFileFavorite(file.id)" hideable
                            :can-copy="canCopyFile(file.mime_type, file.original_name)"
                            @hide="setHidden('file', file.id)" @open="openFile(file)" @download="handleDownload(file.id)"
                            @rename="startRename(file)" @copy="handleCopy(file)" @favorite="handleFavorite(file)" @delete="handleDelete(file)" />
                    </li>
                </ul>
            </UCard>

            <div class="grid min-w-0 gap-4">
                <UCard as="section" variant="outline" :ui="{ header: 'p-4 sm:px-5 sm:py-4', body: 'p-4 sm:p-5' }">
                    <template #header>
                        <h2 class="text-base font-semibold text-foreground" :title="$msg('Includes items in Trash')">{{ $msg('Storage Usage') }}</h2>
                    </template>
                    <div :aria-busy="storageStatus === 'pending'">
                        <template v-if="storageUsage && !storageError">
                            <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <strong class="text-2xl font-semibold tabular-nums text-foreground">
                                    {{ storagePercent.toLocaleString(currentLocaleTag(), { maximumFractionDigits: 2 }) }}%
                                </strong>
                                <span class="text-xs text-label">{{ formatFileSize(storageUsage.storageUsed) }} / {{ formatFileSize(storageUsage.storageLimit) }}</span>
                            </div>
                            <UProgress size="sm" :model-value="Math.min(100, storagePercent)"
                                :get-value-label="() => $msg('Storage used')" />
                            <dl class="mt-5 grid gap-3">
                                <div v-for="type in storageTypes" :key="type.key" class="flex justify-between gap-2 text-sm">
                                    <dt class="flex min-w-0 items-center gap-2 text-label" :title="type.key === 'documents' ? $msg('Document files and notes') : undefined">
                                        <span class="size-2 shrink-0 rounded-full" :class="type.color" aria-hidden="true" />{{ type.label }}
                                    </dt>
                                    <dd class="shrink-0 tabular-nums text-content">{{ formatFileSize(storageUsage.categories[type.key]) }}</dd>
                                </div>
                            </dl>
                        </template>
                        <p v-else class="text-sm text-muted" :role="storageError ? 'alert' : 'status'">
                            {{ storageError ? $msg('Storage usage could not be loaded.') : $msg('Loading storage usage...') }}
                        </p>
                        <UButton v-if="storageError" class="mt-3" color="neutral" variant="outline" :label="$msg('Try again')"
                            :disabled="storageStatus === 'pending'" @click="refreshStorage()" />
                    </div>
                </UCard>

                <UCard as="section" variant="outline" :ui="{ header: 'p-4 sm:px-5 sm:py-4', body: 'p-4 sm:p-5' }">
                    <template #header>
                        <h2 class="text-base font-semibold text-foreground">{{ $msg('Quick Actions') }}</h2>
                    </template>
                    <div class="grid grid-cols-2 gap-2 max-[375px]:grid-cols-1">
                        <UploadButton text="Upload File" variant="secondary" class="*:last:grow *:last:justify-start" :disabled="isUploading" @files="uploadRecentFiles" />
                        <UButton color="neutral" variant="outline" class="min-h-10" icon="solar:add-folder-linear" :label="$msg('New Folder')" @click="folderFormOpen = true" />
                        <UButton color="neutral" variant="outline" class="min-h-10" icon="solar:notebook-linear" :label="$msg('New Note')" @click="noteFormOpen = true" />
                        <UButton to="/inbox" color="neutral" variant="outline" class="min-h-10" icon="solar:inbox-in-linear" :label="$msg('Shared Inbox')" />
                    </div>
                </UCard>
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

import { canCopyFile, getFileIcon, getFileType, formatFileSize, formatFileTime } from '~/utils/file'
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
const storageTypes = [
    { key: 'images', get label() { return localize("Images") }, color: 'bg-[#5da9ff]' },
    { key: 'documents', get label() { return localize("Documents") }, color: 'bg-accent' },
    { key: 'videos', get label() { return localize("Videos") }, color: 'bg-[#55c2d4]' },
    { key: 'others', get label() { return localize("Others") }, color: 'bg-[#6b6b75]' }
] as const

if (error.value) {
    openToast(error.value, 'error')
}

const recentFiles = computed(() => files.value.slice(0, 12))
const libraryStats = computed(() => [
    { to: '/files', label: 'Files', icon: 'solar:document-linear', count: files.value.length },
    { to: '/folders', label: 'Folders', icon: 'solar:folder-linear', count: folders.value.length },
    { to: '/notes', label: 'Notes', icon: 'solar:notebook-linear', count: notes.value.length }
])

const refreshDashboard = async () => { await Promise.all([fetchAll(), refreshStorage()]) }
const uploadRecentFiles = (selection: FileList) => uploadFiles(selection, refreshDashboard)

type FileItem = (typeof files.value)[number]

const editingFileId = ref<string | null>(null)
const editingFileName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const isSavingRename = ref(false)
const isCopying = ref(false)
const isSavingFavorite = ref(false)

const openFile = (file: FileItem) => navigateTo(`/files/${file.id}`)

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
        await Promise.all([fetchAll(), refreshStorage()])
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
        await refreshStorage()
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
