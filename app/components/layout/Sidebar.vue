<template>
    <aside class="sidebar-area w-64 h-full min-h-0 overflow-hidden p-4 bg-surface border border-divider rounded-xl
        shrink-0 flex flex-col gap-5">
        <NuxtLink to="/home" :aria-label='$msg("FileJet home")' class="logo-area flex w-40 h-12 items-center gap-1 overflow-hidden no-underline">
            <BrandMark />
            <span class="text-xl font-bold tracking-tight text-foreground">FileJet</span>
        </NuxtLink>

        <nav :aria-label='$msg("Main navigation")' class="sidebar-navigation min-h-0 flex-1 overflow-y-auto overscroll-contain flex flex-col gap-5">
            <div v-for="section in navigation" :key="section.label" class="menu-section flex flex-col gap-1">
                <span class="menu-title mx-3 mb-1 text-xs font-medium leading-normal text-muted">{{ section.label }}</span>
                <NuxtLink
                    v-for="item in section.items"
                    :key="item.to"
                    :to="item.to"
                    class="sidebar-link"
                    :class="{ active: isActive(item.to) }"
                >
                    <Icon
                        class="shrink-0 text-[1.3rem]"
                        :name="isActive(item.to) ? item.activeIcon : item.icon"
                    />
                    {{ item.label }}
                </NuxtLink>
            </div>
        </nav>

        <div class="sidebar-account shrink-0 border-t border-divider pt-3 max-laptop:hidden">
            <AccountMenu placement="sidebar" />
        </div>
    </aside>
</template>

<script setup lang="ts">
import AccountMenu from './AccountMenu.vue'
import BrandMark from '~/components/ui/BrandMark.vue'

const route = useRoute()
const isActive = (path: string) => route.path === path || (['/inbox', '/teams'].includes(path) && route.path.startsWith(path + '/'))

const currentUser = useAuthUser()
const navigation = computed(() => [
    {
        get label() { return localize("MAIN MENU") },
        items: [
            { get label() { return localize("Home") }, to: '/home', icon: 'solar:home-2-linear', activeIcon: 'solar:home-2-bold' },
            { get label() { return localize("Files") }, to: '/files', icon: 'solar:document-linear', activeIcon: 'solar:document-bold' },
            { get label() { return localize("Folders") }, to: '/folders', icon: 'solar:folder-linear', activeIcon: 'solar:folder-bold' },
            { get label() { return localize("Notes") }, to: '/notes', icon: 'solar:notebook-linear', activeIcon: 'solar:notebook-bold' }
        ]
    },
    {
        get label() { return localize("OTHERS") },
        items: [
            { get label() { return localize("Favorites") }, to: '/favorites', icon: 'solar:star-outline', activeIcon: 'solar:star-bold' },
            { get label() { return localize('Hidden') }, to: '/hidden', icon: 'solar:eye-closed-linear', activeIcon: 'solar:eye-closed-bold' },
            { get label() { return localize("Shared") }, to: '/shared', icon: 'solar:share-circle-linear', activeIcon: 'solar:share-circle-bold' },
            { get label() { return localize("Inbox") }, to: '/inbox', icon: 'solar:inbox-in-linear', activeIcon: 'solar:inbox-in-bold' },
            { get label() { return localize('Team spaces') }, to: '/teams', icon: 'solar:users-group-rounded-linear', activeIcon: 'solar:users-group-rounded-bold' },
            { get label() { return localize("Quarantine") }, to: '/quarantine', icon: 'solar:shield-warning-linear', activeIcon: 'solar:shield-warning-bold' },
            { get label() { return localize("Activity") }, to: '/activity', icon: 'solar:history-linear', activeIcon: 'solar:history-bold' },
            { get label() { return localize("Trash") }, to: '/trash', icon: 'material-symbols:delete-outline-rounded', activeIcon: 'material-symbols:delete-rounded' }
        ]
    },
    ...(currentUser.value?.role === 'ADMIN' ? [{
        get label() { return localize("ADMINISTRATION") },
        items: [{ get label() { return localize("Admin") }, to: '/admin', icon: 'solar:shield-user-linear', activeIcon: 'solar:shield-user-bold' }]
    }] : [])
])
</script>

<style scoped>
@reference "~/assets/css/tailwind.css";

@layer components {
    .sidebar-link {
        @apply flex items-center gap-2 w-full py-2 px-3 text-foreground;
        @apply bg-transparent border-0 rounded-md no-underline text-sm font-medium cursor-pointer;
        @apply leading-normal min-h-9 hover:bg-control is-active:bg-primary is-active:text-on-primary;
        @apply is-active:font-semibold is-active:hover:bg-primary;
        @apply is-active:hover:text-on-primary;
    }
}
</style>
