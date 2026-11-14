<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Settings')} · FileJet` }))
const links = computed(() => [
    { title: localize('Account & preferences'), to: '/settings/preferences', icon: 'solar:user-circle-linear' },
    { title: localize('Appearance'), to: '/settings/personalization', icon: 'solar:palette-linear' },
    { title: localize('Quarantine'), to: '/quarantine', icon: 'solar:shield-warning-linear' },
    { title: localize('Activity history'), to: '/activity', icon: 'solar:history-linear' }
])
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <nav :aria-label="$msg('Settings')" class="max-w-2xl divide-y divide-divider rounded-xl border border-divider bg-surface">
            <NuxtLink v-for="link in links" :key="link.to" :to="link.to"
                class="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground first:rounded-t-xl last:rounded-b-xl hover:bg-control">
                <Icon :name="link.icon" size="20" aria-hidden="true" class="text-muted" />
                <span class="flex-1">{{ link.title }}</span>
                <Icon name="solar:alt-arrow-right-linear" size="16" aria-hidden="true" class="text-muted" />
            </NuxtLink>
        </nav>
    </div>
</template>
