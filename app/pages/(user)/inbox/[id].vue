<template>
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <NuxtLink to="/inbox" class="inline-flex min-h-10 w-fit items-center gap-2 text-sm text-accent no-underline hover:underline"><Icon name="solar:arrow-left-linear" size="18" />{{ $msg("All inboxes") }}</NuxtLink>
        <p v-if="loading && !request" role="status" class="p-6 text-center text-sm text-muted">{{ $msg("Loading inbox…") }}</p>
        <div v-else-if="loadError" role="alert" class="rounded-xl border border-divider bg-surface p-8 text-center"><p class="text-sm text-danger">{{ $msg(loadError || '') }}</p><button class="inbox-button mt-4" @click="load">{{ $msg("Try again") }}</button></div>
        <template v-else-if="request">
            <section class="rounded-xl border border-divider bg-surface p-5">
                <div class="flex flex-wrap items-start gap-3">
                    <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon name="solar:inbox-in-linear" size="25" /></span>
                    <div class="min-w-0 flex-1"><h2 class="break-words text-lg font-semibold text-foreground">{{ request.title }}</h2><p class="mt-1 text-xs text-muted">{{ $countMsg('filesReceived', request.receivedCount) }}</p></div>
                    <div class="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end"><span class="rounded-md px-2 py-1 text-xs" :class="status === 'Open' ? 'bg-accent/10 text-accent' : 'bg-control text-muted'">{{ $msg(status) }}</span><button class="inbox-button" :disabled="busy" @click="editOpen = true"><Icon name="solar:pen-linear" />{{ $msg("Edit inbox") }}</button></div>
                </div>
                <p v-if="request.description" class="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{{ request.description }}</p>
                <details class="mt-4 border-t border-divider pt-3">
                    <summary class="w-fit cursor-pointer rounded text-sm text-label focus-visible:outline-2 focus-visible:outline-accent">{{ $msg("Sharing & settings") }}</summary>
                    <div class="mt-4 flex flex-col gap-3">
                        <label class="flex flex-col gap-2 text-xs text-muted">{{ $msg("Upload link") }}<input :value="request.url" readonly class="inbox-input text-xs!" @focus="($event.target as HTMLInputElement).select()"></label>
                        <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"><span>{{ $msg("Default approval destination:") }} {{ request.folderName }}</span><span>{{ formatFileSize(request.maxFileSize) }} {{ $msg("per file") }}</span><span>{{ request.receivedCount }} / {{ request.maxFiles }} {{ $msg("files") }}</span><span>{{ request.expiresAt ? $msg('Expires {p0}', { p0: date(request.expiresAt) }) : $msg('No expiration') }}</span></div>
                        <div class="flex flex-wrap items-center gap-2">
                            <button class="inbox-button" :disabled="busy || status !== 'Open'" @click="copy"><Icon name="solar:copy-linear" />{{ $msg("Copy link") }}</button>
                            <button class="inbox-button" :disabled="busy || status !== 'Open'" @click="showQr = true"><Icon name="solar:qr-code-linear" />{{ $msg("QR code") }}</button>
                            <button class="inbox-button" :disabled="busy || (!request.isOpen && status !== 'Closed')" @click="toggle">{{ request.isOpen ? $msg('Close inbox') : $msg('Reopen inbox') }}</button>
                            <button class="inbox-button ml-auto text-danger!" :disabled="busy" @click="remove"><Icon name="solar:trash-bin-trash-linear" />{{ $msg("Remove inbox") }}</button>
                        </div>
                    </div>
                </details>
            </section>
            <div class="flex flex-wrap items-center justify-between gap-3"><SearchBox v-model="search" :placeholder='$msg("Search received files…")' :aria-label='$msg("Search received files")' class="min-w-0 max-w-128 flex-1 max-tablet:max-w-none" /><button type="button" class="inbox-button" :disabled="loading || busy" @click="load"><Icon name="solar:refresh-linear" :class="{ 'animate-spin': loading }" />{{ $msg("Refresh") }}</button></div>
            <div class="flex flex-wrap items-center gap-3"><p class="mr-auto text-sm text-muted"><span class="font-semibold text-foreground">{{ request.pendingCount }}</span> {{ $msg("awaiting your approval") }}</p><select v-model="reviewFilter" :aria-label='$msg("Filter files by review status")' class="inbox-input w-auto!"><option value="all">{{ $msg("All files") }}</option><option value="pending">{{ $msg("Pending") }}</option><option value="approved">{{ $msg("Approved") }}</option><option value="rejected">{{ $msg("Rejected") }}</option></select><button v-if="pendingUploads.length" class="inbox-button" :disabled="busy || loading" @click="approvalFiles = [...pendingUploads]">{{ $msg("Approve all (") }}{{ pendingUploads.length }})</button><button v-if="pendingUploads.length" class="inbox-button text-danger!" :disabled="busy || loading" @click="rejectFiles([...pendingUploads])">{{ $msg("Reject all (") }}{{ pendingUploads.length }})</button></div>
            <div v-if="selectedPending.length" role="region" :aria-label='$msg("Selected incoming files")' class="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-surface p-3 shadow-lg"><span class="mr-auto text-sm font-semibold text-foreground">{{ selectedPending.length }} {{ $msg("selected") }}</span><button class="inbox-button inbox-primary" :disabled="busy || loading" @click="approvalFiles = [...selectedPending]">{{ $msg("Approve selected") }}</button><button class="inbox-button text-danger!" :disabled="busy || loading" @click="rejectFiles([...selectedPending])">{{ $msg("Reject selected") }}</button><button class="inbox-button" :disabled="busy || loading" @click="selectedIds = []">{{ $msg("Clear selection") }}</button></div>
            <div v-if="!filteredUploads.length" class="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-divider p-6 text-center"><Icon name="solar:inbox-in-linear" size="36" class="text-accent" /><h3 class="font-semibold text-foreground">{{ search || reviewFilter !== 'all' ? $msg('No matching files') : $msg('No files received yet') }}</h3><p class="max-w-96 text-sm leading-6 text-muted">{{ search || reviewFilter !== 'all' ? $msg('Try another search or review status.') : $msg('Share this inbox’s upload link from Sharing & settings. Files sent to it will appear here.') }}</p></div>
            <div v-else class="shrink-0 overflow-hidden rounded-xl border border-divider bg-surface">
                <div v-if="filteredPending.length" class="flex flex-wrap items-center gap-3 border-b border-divider px-4 py-3"><label class="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-label"><input type="checkbox" class="file-checkbox" :checked="allPageSelected" :indeterminate="somePageSelected" :disabled="busy || loading || !pendingOnPage.length" :aria-label='$msg("Select pending files on this page")' @change="togglePage">{{ $msg("Select page") }}</label><button v-if="filteredPending.length > pendingOnPage.length" class="inbox-button ml-auto" :disabled="busy || loading" @click="selectedIds = filteredPending.map(file => file.id)">{{ $msg("Select all matching (") }}{{ filteredPending.length }})</button></div>
                <article v-for="file in paginatedItems" :key="file.id" class="flex flex-wrap items-center gap-3 border-b border-divider p-4 last:border-0" :class="{ 'bg-accent/8': selectedIds.includes(file.id) }">
                    <input v-if="file.status === 'pending'" v-model="selectedIds" type="checkbox" class="file-checkbox shrink-0" :value="file.id" :aria-label="$msg('Select {p0}', { p0: file.name })" :disabled="busy || loading">
                    <span v-else class="w-4 shrink-0" aria-hidden="true" />
                    <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon name="solar:document-linear" size="22" /></span>
                    <div class="min-w-0 flex-1"><NuxtLink v-if="file.fileId" :to="{ path: `/files/${file.fileId}`, query: { from: `/inbox/${request.id}` } }" class="block truncate text-sm font-semibold text-foreground hover:text-accent">{{ file.name }}</NuxtLink><button v-else-if="file.status === 'pending'" type="button" class="block w-full cursor-pointer truncate rounded text-left text-sm font-semibold text-foreground hover:text-accent focus-visible:outline-2 focus-visible:outline-accent" :title="$msg('Preview {p0}', { p0: file.name })" @click="previewFile = file">{{ file.name }}</button><p v-else class="truncate text-sm text-muted">{{ file.name }} <span v-if="file.status === 'approved'" class="text-xs">{{ $msg("(saved file removed)") }}</span></p><p class="mt-1 truncate text-xs text-muted">{{ file.senderName || $msg('Anonymous sender') }} · <span :class="file.status === 'pending' ? 'text-warning' : ''">{{ reviewLabels[file.status] }}</span><span v-if="file.senderName"> {{ $msg("· self-reported") }}</span></p><p v-if="file.senderNote" class="mt-2 whitespace-pre-wrap wrap-anywhere text-sm text-label">{{ file.senderNote }}</p></div>
                    <div class="shrink-0 text-right text-xs leading-6 text-muted"><p>{{ formatFileSize(file.size) }}</p><p>{{ date(file.createdAt) }}</p></div>
                    <div v-if="file.status === 'pending'" class="flex w-full justify-end gap-2 sm:w-auto"><button class="inbox-button inbox-primary" :disabled="busy || loading" @click="approvalFiles = [file]">{{ $msg("Approve") }}</button><button class="inbox-button text-danger!" :disabled="busy || loading" @click="reject(file)">{{ $msg("Reject") }}</button></div>
                </article>
            </div>
            <Pagination v-if="totalPages > 1" v-model="currentPage" :total-pages="totalPages" />
        </template>
        <ClientOnly>
            <RequestQrModal :item="showQr ? request : null" @close="showQr = false" />
            <FileRequestForm :open="editOpen" :inbox="request" @close="editOpen = false" @saved="edited" />
            <ApproveFileModal :request-id="id" :uploads="approvalFiles" :default-folder-id="request?.folderId ?? null" @close="approvalFiles = []" @saved="approved" />
            <InboxFilePreview :request-id="id" :upload="previewFile" @close="previewFile = null" @approve="approvalFiles = [$event]" @reject="reject" />
        </ClientOnly>
    </div>
</template>

<script setup lang="ts">
import type { FileRequestItem, ReceivedFile } from '~~/shared/types/inbox'
import RequestQrModal from '~/components/inbox/RequestQrModal.vue'
import FileRequestForm from '~/components/inbox/FileRequestForm.vue'
import ApproveFileModal from '~/components/inbox/ApproveFileModal.vue'
import InboxFilePreview from '~/components/inbox/InboxFilePreview.vue'
import { formatFileSize } from '~/utils/file'
import { getInboxStatus } from '~/utils/inbox'

definePageMeta({ middleware: 'auth', layout: 'user', key: route => String(route.params.id) })
const route = useRoute()
const id = String(route.params.id)
const request = ref<FileRequestItem | null>(null), uploads = ref<ReceivedFile[]>([])
const search = ref(''), loadError = ref(''), loading = ref(true), busy = ref(false), showQr = ref(false), now = ref(Date.now())
const editOpen = ref(false), approvalFiles = ref<ReceivedFile[]>([]), reviewFilter = ref('all'), selectedIds = ref<string[]>([])
const previewFile = ref<ReceivedFile | null>(null)
const reviewLabels = { pending: localize("Pending approval"), approved: 'Approved', rejected: 'Rejected' }
const { fetchUser, fetchFiles } = useUser()
const { openToast } = useToast(), { confirm } = useConfirm()
const status = computed(() => request.value ? getInboxStatus(request.value, now.value) : 'Unavailable')
const date = (value: string) => new Date(value).toLocaleDateString(currentLocaleTag(), { year: 'numeric', month: 'short', day: 'numeric' })
const filteredUploads = computed(() => uploads.value.filter(item => (reviewFilter.value === 'all' || item.status === reviewFilter.value) && `${item.name} ${item.senderName} ${item.senderNote ?? ''}`.toLowerCase().includes(search.value.toLowerCase())).sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending')))
const pendingUploads = computed(() => uploads.value.filter(file => file.status === 'pending'))
const selectedPending = computed(() => pendingUploads.value.filter(file => selectedIds.value.includes(file.id)))
const filteredPending = computed(() => filteredUploads.value.filter(file => file.status === 'pending'))
const { currentPage, totalPages, paginatedItems } = usePagination(filteredUploads, ref(25))
const pendingOnPage = computed(() => paginatedItems.value.filter(file => file.status === 'pending'))
const allPageSelected = computed(() => pendingOnPage.value.length > 0 && pendingOnPage.value.every(file => selectedIds.value.includes(file.id)))
const somePageSelected = computed(() => !allPageSelected.value && pendingOnPage.value.some(file => selectedIds.value.includes(file.id)))
const togglePage = (event: Event) => {
    const ids = new Set(selectedIds.value)
    for (const file of pendingOnPage.value) {
        if ((event.target as HTMLInputElement).checked) ids.add(file.id)
        else ids.delete(file.id)
    }
    selectedIds.value = [...ids]
}
watch([search, reviewFilter], () => { currentPage.value = 1; selectedIds.value = [] })
watch(pendingUploads, files => { const ids = new Set(files.map(file => file.id)); selectedIds.value = selectedIds.value.filter(id => ids.has(id)) })
watch(totalPages, total => { currentPage.value = Math.max(1, Math.min(currentPage.value, total)) })
useHead(() => ({ title: request.value ? `${request.value.title} · Inbox · FileJet` : localize("Inbox · FileJet") }))
const load = async () => {
    loading.value = true; loadError.value = ''
    try {
        const result = await $fetch<{ request: FileRequestItem; uploads: ReceivedFile[] }>(`/api/inbox/${encodeURIComponent(id)}`)
        request.value = result.request; uploads.value = result.uploads; now.value = Date.now()
    } catch (error: any) { loadError.value = resolveApiError(error, localize("Could not load inbox.")) }
    finally { loading.value = false }
}
const copy = async () => {
    if (!request.value) return
    try { await navigator.clipboard.writeText(request.value.url); openToast(localize("Upload link copied."), 'success') }
    catch { openToast(localize("Could not copy. Select and copy the upload link above."), 'error') }
}
const edited = async () => { openToast(localize("Inbox updated."), 'success'); await load() }
const approved = async (count: number) => { openToast(count === 1 ? localize("File approved and saved.") : localize("{p0} files approved and saved.", { p0: count }), 'success'); selectedIds.value = []; await Promise.all([load(), fetchUser(), fetchFiles()]) }
const reject = (file: ReceivedFile) => rejectFiles([file])
const rejectFiles = async (files: ReceivedFile[]) => {
    if (!files.length || busy.value || loading.value) return
    const multiple = files.length > 1
    if (!await confirm({ title: multiple ? localize("Reject {p0} incoming files?", { p0: files.length }) : localize("Reject incoming file?"), message: multiple ? localize("{p0} pending files will be permanently deleted and their storage space released.", { p0: files.length }) : localize("“{p0}” will be permanently deleted from Inbox and its storage space released.", { p0: files[0]!.name }), confirmText: multiple ? localize("Reject {p0} files", { p0: files.length }) : localize("Reject file"), variant: 'danger' })) return
    busy.value = true
    try {
        if (multiple) await $fetch(`/api/inbox/${id}/uploads/bulk-reject`, { method: 'POST', body: { uploadIds: files.map(file => file.id) } })
        else await $fetch(`/api/inbox/${id}/uploads/${files[0]!.id}/reject`, { method: 'POST' })
        openToast(multiple ? localize("{p0} files rejected.", { p0: files.length }) : localize("File rejected."), 'success'); selectedIds.value = []; await Promise.all([load(), fetchUser()])
    } catch (error: any) { openToast(resolveApiError(error, localize("Could not reject selected files.")), 'error') }
    finally { busy.value = false }
}
const toggle = async () => {
    if (!request.value || busy.value) return
    busy.value = true
    try { await $fetch(`/api/inbox/${id}`, { method: 'PATCH', body: { isOpen: !request.value.isOpen } }); await load() }
    catch (error: any) { openToast(resolveApiError(error, localize("Could not update inbox.")), 'error') }
    finally { busy.value = false }
}
const remove = async () => {
    if (!request.value || busy.value) return
    if (!await confirm({ get title() { return localize("Remove inbox?") }, get message() { return localize("The upload link and history for “{p0}” will be removed. Pending files will be permanently deleted. Approved files stay in your folders.", { p0: request.value!.title }) }, get confirmText() { return localize("Remove inbox") }, variant: 'danger' })) return
    busy.value = true
    try { await $fetch(`/api/inbox/${id}`, { method: 'DELETE' }); openToast(localize("Inbox removed."), 'success'); await fetchUser(); await navigateTo('/inbox') }
    catch (error: any) { openToast(resolveApiError(error, localize("Could not remove inbox.")), 'error') }
    finally { busy.value = false }
}
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { void load(); timer = setInterval(() => { now.value = Date.now() }, 30000) })
onBeforeUnmount(() => clearInterval(timer))
</script>
