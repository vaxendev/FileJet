<template>
    <div class="space-y-6">
        <NuxtLink to="/admin/users" class="inline-flex items-center gap-2 text-sm text-muted no-underline hover:text-foreground"><Icon name="solar:arrow-left-linear" size="17" /> {{ $msg("Back to users") }}</NuxtLink>
        <div v-if="error" role="alert" class="rounded-xl border border-danger-border bg-danger-surface p-5 text-sm text-danger">{{ error.statusCode === 404 ? $msg('User not found.') : $msg('Could not load this account.') }} <button class="ml-2 underline cursor-pointer" @click="refresh()">{{ $msg("Try again") }}</button></div>
        <p v-else-if="!data" role="status" class="text-sm text-muted">{{ $msg("Loading account…") }}</p>
        <template v-if="data">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0"><p class="mb-2 text-xs font-medium text-accent">{{ $msg("User details") }}</p><h1 class="wrap-anywhere text-2xl font-semibold tracking-tight text-foreground">{{ data.user.username }}</h1><p class="mt-2 text-sm text-muted">{{ data.user.email || $msg('No email address') }}</p></div>
                <button type="button" class="admin-button" :disabled="pending || deleting" @click="refresh()">{{ $msg("Refresh") }}</button>
            </div>

            <section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                <h2 class="text-sm font-semibold text-foreground">{{ $msg("Account information") }}</h2>
                <dl class="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 text-sm max-mobile:grid-cols-1">
                    <div><dt class="text-xs text-muted">{{ $msg("Username") }}</dt><dd class="mt-1 text-content wrap-anywhere">{{ data.user.username }}</dd></div>
                    <div><dt class="text-xs text-muted">{{ $msg("Email") }}</dt><dd class="mt-1 text-content wrap-anywhere">{{ data.user.email || $msg('Not provided') }}</dd></div>
                    <div><dt class="text-xs text-muted">{{ $msg("Role") }}</dt><dd class="mt-1 text-content">{{ data.user.role === 'ADMIN' ? $msg('Administrator') : $msg('User') }}<span v-if="isSelf" class="ml-2 text-xs text-accent">{{ $msg("Your account") }}</span></dd></div>
                    <div><dt class="text-xs text-muted">{{ $msg("Created") }}</dt><dd class="mt-1 text-content">{{ formatDate(data.user.createdAt) }}</dd></div>
                    <div class="col-span-2 max-mobile:col-span-1"><dt class="text-xs text-muted">{{ $msg("Account ID") }}</dt><dd class="mt-1 font-mono text-xs text-content wrap-anywhere">{{ data.user.id }}</dd></div>
                </dl>
            </section>

            <div class="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
                <section v-for="stat in storageStats" :key="stat.label" class="rounded-2xl border border-divider bg-surface p-5"><h2 class="text-xs text-muted">{{ stat.label }}</h2><p class="mt-3 text-2xl font-semibold text-foreground">{{ stat.value }}</p><p class="mt-2 text-xs leading-5 text-muted">{{ stat.description }}</p></section>
            </div>

            <div class="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
                <section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                    <h2 class="text-sm font-semibold text-foreground">{{ $msg("Storage breakdown") }}</h2>
                    <p class="mt-1 text-xs leading-5 text-muted">{{ $msg("Includes current files, notes, Trash, saved versions and pending Inbox files.") }}</p>
                    <dl class="mt-4 divide-y divide-divider"><div v-for="category in categories" :key="category.label" class="flex justify-between gap-3 py-3 text-sm"><dt class="text-muted">{{ category.label }}</dt><dd class="font-medium text-content">{{ formatFileSize(category.bytes) }}</dd></div></dl>
                    <p class="mt-3 text-xs leading-5 text-muted">{{ $msg("Saved versions:") }} {{ formatFileSize(data.bytes.versions) }} {{ $msg("· Pending Inbox:") }} {{ formatFileSize(data.bytes.pending) }}</p>
                </section>
                <section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                    <h2 class="text-sm font-semibold text-foreground">{{ $msg("Content & sharing") }}</h2>
                    <dl class="mt-4 grid grid-cols-2 gap-4"><div v-for="stat in counts" :key="stat.label" class="rounded-xl bg-control/50 p-3"><dt class="text-xs text-muted">{{ stat.label }}</dt><dd class="mt-1 text-xl font-semibold text-foreground">{{ stat.value }}</dd></div></dl>
                </section>
            </div>

            <section class="overflow-hidden rounded-2xl border border-divider bg-surface">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-divider p-5"><h2 class="text-sm font-semibold text-foreground">{{ $msg("Recent account activity") }}</h2><NuxtLink :to="{path:'/admin/activity',query:{userId:id}}" class="text-xs text-accent no-underline hover:underline">{{ $msg("Full history →") }}</NuxtLink></div><div class="p-5"><p v-if="historyError" role="alert" class="text-sm text-danger">{{ $msg("Could not load account activity.") }} <button type="button" class="underline cursor-pointer" @click="refreshHistory()">{{ $msg("Retry") }}</button></p><AdminActivityList v-else :user-items="history?.source==='user'?history.items:[]" /></div>
            </section>

            <section class="overflow-hidden rounded-2xl border border-divider bg-surface">
                <div class="border-b border-divider p-5"><h2 class="text-sm font-semibold text-foreground">{{ $msg("Recent files & notes") }}</h2><p class="mt-1 text-xs text-muted">{{ $msg("The five most recently updated files and notes of each type. Contents stay private.") }}</p></div>
                <ul class="divide-y divide-divider"><li v-for="item in data.recent" :key="`${item.type}:${item.id}`" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div class="min-w-0 flex-1"><p class="text-sm text-content wrap-anywhere">{{ item.name }}</p><p class="mt-1 text-xs text-muted">{{ item.type === 'file' ? $msg('File') : $msg('Note') }} · {{ formatFileSize(item.size) }}</p></div><time class="text-xs text-muted" :datetime="item.updatedAt ?? undefined">{{ formatDate(item.updatedAt) }}</time></li><li v-if="!data.recent.length" class="p-5 text-sm text-muted">{{ $msg("No files or notes yet.") }}</li></ul>
            </section>

            <section class="rounded-2xl border border-danger-border bg-surface p-6 max-mobile:p-4">
                <h2 class="text-sm font-semibold text-danger">{{ $msg("Delete account") }}</h2>
                <p v-if="isSelf" class="mt-2 text-sm text-muted">{{ $msg("You cannot delete your own account from administration.") }}</p>
                <form v-else class="mt-3 space-y-4" @submit.prevent="deleteUser">
                    <p class="text-sm leading-6 text-muted">{{ $msg("Permanently delete this account and all of its files, folders, notes, saved versions, Inbox submissions and Trash. Its share and upload links will stop working. This cannot be undone.") }}</p>
                    <label class="block text-sm text-content"><span class="block mb-2">{{ $msg("Type") }} <strong>{{ data.user.username }}</strong> {{ $msg("to confirm") }}</span><input v-model="confirmationName" type="text" autocomplete="off" :disabled="deleting" class="h-11 w-full max-w-100 rounded-lg border border-control-border bg-input px-3 text-sm text-content outline-none focus:border-danger" /></label>
                    <p v-if="deleteError" role="alert" class="text-sm text-danger">{{ $msg(deleteError || '') }}</p>
                    <button type="submit" class="admin-button border-danger-border! text-danger!" :disabled="deleting || confirmationName !== data.user.username">{{ deleting ? $msg('Deleting…') : $msg('Delete user permanently') }}</button>
                </form>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { formatFileSize } from '~/utils/file'

definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
const route = useRoute(), currentUser = useAuthUser()
const id = computed(() => String(route.params.id))
const { data, error, pending, refresh } = await useFetch(() => `/api/admin/users/${encodeURIComponent(id.value)}`)
const { data:history,error:historyError,refresh:refreshHistory } = await useFetch('/api/admin/activity',{query:{source:'user',userId:id,limit:5}})
useHead({ title: computed(() => `${data.value?.user.username ?? 'User details'} · FileJet Admin`) })
const isSelf = computed(() => data.value?.user.id === currentUser.value?.id)
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(currentLocaleTag(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC' : localize("Not available")
const storageStats = computed(() => data.value ? [
    { get label() { return localize("Storage used") }, value: formatFileSize(data.value!.user.storageUsed), get description() { return localize("All stored content charged to this account") } },
    { get label() { return localize("Storage limit") }, value: formatFileSize(data.value!.user.storageLimit), get description() { return localize("Allocated account quota") } },
    { get label() { return localize("Unfinished uploads") }, value: data.value!.counts.unfinishedUploads, get description() { return localize("{p0} reserved for active uploads", { p0: formatFileSize(data.value!.bytes.unfinished) }) } }
] : [])
const categories = computed(() => data.value ? Object.entries(data.value!.storage.categories).map(([label, bytes]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), bytes })) : [])
const counts = computed(() => data.value ? [
    { get label() { return localize("Files") }, value: data.value!.counts.files }, { get label() { return localize("Folders") }, value: data.value!.counts.folders },
    { get label() { return localize("Notes") }, value: data.value!.counts.notes }, { get label() { return localize("Favorites") }, value: data.value!.counts.favorites },
    { get label() { return localize("Share links") }, value: localize("{p0} active / {p1}", { p0: data.value!.counts.activeShares, p1: data.value!.counts.shares }) },
    { get label() { return localize("Inboxes") }, value: data.value!.counts.inboxes }, { get label() { return localize("Saved versions") }, value: data.value!.counts.versions },
    { get label() { return localize("Trash items") }, value: data.value!.counts.trash }, { get label() { return localize("Pending Inbox files") }, value: data.value!.counts.pendingFiles }
] : [])
const confirmationName = ref(''), deleteError = ref(''), deleting = ref(false)
const { confirm } = useConfirm(), { openToast } = useToast()
watch(id, () => { confirmationName.value = ''; deleteError.value = '' })
onBeforeRouteLeave(() => !deleting.value)
const deleteUser = async () => {
    if (deleting.value || !data.value || isSelf.value || confirmationName.value !== data.value!.user.username) return
    const user = data.value!.user
    const accepted = await confirm({ get title() { return localize("Delete {p0}?", { p0: user.username }) }, get message() { return localize("This permanently removes the account and all of its content. This cannot be undone.") }, get confirmText() { return localize("Delete account") }, variant: 'danger' })
    if (!accepted || deleting.value || id.value !== user.id) return
    deleting.value = true; deleteError.value = ''
    let deleted = false
    try {
        const result = await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', body: { confirmUsername: confirmationName.value } })
        deleted = true
        openToast(result.cleanupPending ? localize("Account deleted. Stored file cleanup is queued and will retry automatically.") : localize("User and stored files deleted."), 'success')
    } catch (error: any) { deleteError.value = resolveApiError(error, localize("Could not delete this account.")) }
    finally { deleting.value = false }
    if (deleted) await navigateTo('/admin/users')
}
</script>

<style scoped>
@reference "~/assets/css/tailwind.css";
@layer components { .admin-button { @apply inline-flex min-h-11 items-center justify-center rounded-lg border border-control-border bg-raised px-4 text-sm text-content cursor-pointer hover:bg-control disabled:opacity-50 disabled:cursor-not-allowed; } }
</style>
