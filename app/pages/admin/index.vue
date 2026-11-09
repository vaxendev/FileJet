<template>
    <div class="space-y-7">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <p class="mb-2 text-xs font-medium text-accent">{{ $msg("Instance overview") }}</p>
                <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ $msg("Admin dashboard") }}</h1>
                <p class="mt-2 text-sm text-muted">{{ $msg("Accounts, storage and shared content across FileJet.") }}</p>
            </div>
            <button type="button" :disabled="pending || activityPending" class="flex min-h-10 items-center gap-2 rounded-xl border border-control-border bg-surface px-4 text-sm text-content cursor-pointer hover:bg-control disabled:opacity-50" @click="refreshOverview">
                <Icon name="solar:refresh-linear" size="17" aria-hidden="true" /> {{ pending ? $msg('Refreshing…') : $msg('Refresh') }}
            </button>
        </div>

        <div v-if="error" role="alert" class="rounded-xl border border-danger-border bg-danger-surface p-5 text-sm text-danger">{{ $msg("Could not load the dashboard. Select Refresh to try again.") }}</div>
        <p v-else-if="!data" role="status" class="p-5 text-sm text-muted">{{ $msg("Loading overview…") }}</p>

        <template v-if="data">
            <div class="grid grid-cols-4 gap-4 max-[1300px]:grid-cols-2 max-mobile:grid-cols-1">
                <section v-for="stat in stats" :key="stat.label" class="rounded-2xl border border-divider bg-surface p-5">
                    <div class="flex items-center justify-between gap-3">
                        <h2 class="text-xs font-medium text-muted">{{ stat.label }}</h2>
                        <span class="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent"><Icon :name="stat.icon" size="19" aria-hidden="true" /></span>
                    </div>
                    <p class="mt-5 text-3xl font-semibold tracking-tight text-foreground">{{ stat.value }}</p>
                    <p class="mt-2 text-xs leading-5 text-muted">{{ stat.description }}</p>
                </section>
            </div>

            <p v-if="activityError" role="alert" class="rounded-xl border border-danger-border bg-danger-surface p-4 text-sm text-danger">{{ $msg("Could not load activity summary. Select Refresh to try again.") }}</p>
            <section v-if="activity" class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-sm font-semibold text-foreground">{{ $msg("Activity overview") }}</h2><p class="mt-1 text-xs text-muted">{{ $msg("Successful changes across FileJet.") }}</p></div><NuxtLink to="/admin/activity" class="text-sm text-accent no-underline hover:underline">{{ $msg("Open history →") }}</NuxtLink></div>
                <dl class="my-5 grid grid-cols-3 gap-3 max-mobile:grid-cols-1"><div class="rounded-xl bg-control/60 p-4"><dt class="text-xs text-muted">{{ $msg("User changes · last 24 hours") }}</dt><dd class="mt-2 text-2xl font-semibold text-foreground">{{ activity.changes24h.toLocaleString(currentLocaleTag()) }}</dd></div><div class="rounded-xl bg-control/60 p-4"><dt class="text-xs text-muted">{{ $msg("Active accounts · last 24 hours") }}</dt><dd class="mt-2 text-2xl font-semibold text-foreground">{{ activity.activeAccounts24h.toLocaleString(currentLocaleTag()) }}</dd></div><div class="rounded-xl bg-control/60 p-4"><dt class="text-xs text-muted">{{ $msg("Admin actions · last 24 hours") }}</dt><dd class="mt-2 text-2xl font-semibold text-foreground">{{ activity.adminActions24h.toLocaleString(currentLocaleTag()) }}</dd></div></dl>
                <h3 class="text-xs font-medium text-muted">{{ $msg("User changes · last 7 days (UTC)") }}</h3><div class="mt-4 grid h-32 grid-cols-7 items-end gap-3" role="img" :aria-label="activity.days.map(day=>$msg('{p0}: {p1} changes', { p0: day.day, p1: day.count })).join('; ')"><div v-for="day in activity.days" :key="day.day" class="flex h-full min-w-0 flex-col items-center justify-end gap-1"><span class="text-xs text-content">{{ day.count }}</span><div class="w-full max-w-20 rounded-t-md" :class="day.count?'bg-accent':'bg-control'" :style="{height:`${Math.max(4,day.count/activityMax*75)}%`}" /><span class="text-[0.65rem] text-muted">{{ day.day.slice(5) }}</span></div></div>
            </section>

            <div v-if="activity" class="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1"><section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4"><div class="mb-5 flex items-center justify-between gap-2"><h2 class="text-sm font-semibold text-foreground">{{ $msg("Recent user activity") }}</h2><NuxtLink to="/admin/activity" class="text-xs text-accent no-underline hover:underline">{{ $msg("View all") }}</NuxtLink></div><AdminActivityList :user-items="activity.recent" /></section><section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4"><div class="mb-5 flex items-center justify-between gap-2"><h2 class="text-sm font-semibold text-foreground">{{ $msg("Recent admin actions") }}</h2><NuxtLink to="/admin/activity?source=admin" class="text-xs text-accent no-underline hover:underline">{{ $msg("View all") }}</NuxtLink></div><AdminActivityList :admin-items="activity.adminRecent" /></section></div>

            <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 max-[900px]:grid-cols-1">
                <section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-5">
                    <div class="flex items-start justify-between gap-3">
                        <div><h2 class="text-sm font-semibold text-foreground">{{ $msg("Storage allocation") }}</h2><p class="mt-1 text-xs leading-5 text-muted">{{ $msg("Usage across all accounts, including Trash and saved versions.") }}</p></div>
                        <Icon name="solar:server-square-linear" size="22" class="shrink-0 text-muted" aria-hidden="true" />
                    </div>
                    <p class="mt-7 text-3xl font-semibold text-foreground">{{ storagePercent.toLocaleString(currentLocaleTag(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }}<span class="ml-1 text-lg text-muted">%</span></p>
                    <div role="meter" :aria-label='$msg("Allocated account storage used")' :aria-valuenow="storagePercent" aria-valuemin="0" aria-valuemax="100" class="mt-4 h-2 overflow-hidden rounded-full bg-control">
                        <div class="h-full rounded-full bg-accent" :style="{ width: `${storagePercent}%` }" />
                    </div>
                    <dl class="mt-5 grid grid-cols-2 gap-4 text-xs">
                        <div><dt class="text-muted">{{ $msg("Used") }}</dt><dd class="mt-1 font-medium text-foreground">{{ formatFileSize(data.storageUsed) }}</dd></div>
                        <div><dt class="text-muted">{{ $msg("Allocated to accounts") }}</dt><dd class="mt-1 font-medium text-foreground">{{ formatFileSize(data.storageLimit) }}</dd></div>
                    </dl>
                    <p class="mt-5 border-t border-divider pt-4 text-xs leading-5 text-muted">{{ $msg("Allocation is the sum of account quotas. Adjust individual limits in Users.") }}</p>
                </section>

                <section class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-5">
                    <h2 class="text-sm font-semibold text-foreground">{{ $msg("Account roles") }}</h2>
                    <p class="mt-1 text-xs leading-5 text-muted">{{ $msg("Access to the administration console.") }}</p>
                    <dl class="mt-5 space-y-3">
                        <div class="flex items-center gap-3 rounded-xl bg-control/60 p-4">
                            <Icon name="solar:shield-user-linear" size="21" class="text-accent" aria-hidden="true" />
                            <dt class="flex-1 text-sm text-content">{{ $msg("Administrators") }}</dt><dd class="text-lg font-semibold text-foreground">{{ data.admins }}</dd>
                        </div>
                        <div class="flex items-center gap-3 rounded-xl bg-control/60 p-4">
                            <Icon name="solar:user-circle-linear" size="21" class="text-muted" aria-hidden="true" />
                            <dt class="flex-1 text-sm text-content">{{ $msg("Users") }}</dt><dd class="text-lg font-semibold text-foreground">{{ data.users - data.admins }}</dd>
                        </div>
                    </dl>
                    <NuxtLink to="/admin/users" class="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary no-underline hover:bg-primary/85">
                        {{ $msg("Manage users") }} <Icon name="solar:arrow-right-linear" size="17" aria-hidden="true" />
                    </NuxtLink>
                </section>
            </div>

            <section class="rounded-2xl border border-divider bg-surface px-6 py-5 max-mobile:px-5">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <div><h2 class="text-sm font-semibold text-foreground">{{ $msg("Your workspace") }}</h2><p class="mt-1 text-xs leading-5 text-muted">{{ $msg("Return to your files, folders, notes and sharing settings.") }}</p></div>
                    <NuxtLink to="/home" class="flex min-h-10 items-center gap-2 rounded-xl border border-control-border px-4 text-sm text-content no-underline hover:bg-control">{{ $msg("Open workspace") }} <Icon name="solar:arrow-right-up-linear" size="17" aria-hidden="true" /></NuxtLink>
                </div>
            </section>
        </template>
    </div>
</template>

<script setup lang="ts">
import { formatFileSize } from '~/utils/file'

definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useHead({ get title() { return localize("Admin dashboard · FileJet") } })
const [{ data, pending, error, refresh },{ data: activity, pending: activityPending, error: activityError, refresh: refreshActivity }] = await Promise.all([
    useFetch('/api/admin', { key: 'admin-overview' }), useFetch('/api/admin/activity/summary',{key:'admin-activity-summary'})
])
const activityMax = computed(()=>Math.max(1,...(activity.value?.days.map(day=>day.count)??[])))
const refreshOverview = () => Promise.all([refresh(),refreshActivity()])
const storagePercent = computed(() => {
    const limit = Number(data.value?.storageLimit ?? 0)
    return limit > 0 ? Math.min(100, Math.max(0, Number(data.value?.storageUsed ?? 0) / limit * 100)) : 0
})
const stats = computed(() => data.value ? [
    { get label() { return localize("Total accounts") }, value: data.value!.users.toLocaleString(currentLocaleTag()), get description() { return localizeCount("administrators", data.value!.admins) }, icon: 'solar:users-group-rounded-linear' },
    { get label() { return localize("Storage used") }, value: formatFileSize(data.value!.storageUsed), get description() { return localize("{p0} allocated quota", { p0: formatFileSize(data.value!.storageLimit) }) }, icon: 'solar:server-square-linear' },
    { get label() { return localize("Files & notes") }, value: (data.value!.files + data.value!.notes).toLocaleString(currentLocaleTag()), get description() { return [localizeCount("files", data.value!.files), localizeCount("notes", data.value!.notes), localizeCount("folders", data.value!.folders)].join(" · ") }, icon: 'solar:documents-linear' },
    { get label() { return localize("Share links") }, value: data.value!.shares.toLocaleString(currentLocaleTag()), get description() { return localize("Includes expired and limited links") }, icon: 'solar:link-round-linear' }
] : [])
</script>
