<template>
    <aside class="sidebar-area flex h-full min-h-0 w-58 shrink-0 flex-col gap-5 overflow-hidden rounded-2xl border border-divider bg-surface p-3">
        <NuxtLink to="/home" :aria-label='$msg("FileJet home")' class="logo-area flex h-12 w-fit items-center gap-1 overflow-hidden rounded-md px-2 no-underline">
            <BrandMark />
            <span class="text-xl font-bold tracking-tight text-foreground">FileJet</span>
        </NuxtLink>

        <nav :aria-label='$msg("Main navigation")' class="sidebar-navigation min-h-0 flex-1 overflow-y-auto overscroll-contain flex flex-col gap-5">
            <div v-for="section in navigation" :key="section.label" class="menu-section flex flex-col gap-1">
                <span class="menu-title mx-3 mb-1 text-xs font-medium leading-normal text-muted">{{ section.label }}</span>
                <UButton
                    v-for="item in section.items"
                    :key="item.to"
                    :to="item.to"
                    color="neutral"
                    variant="ghost"
                    block
                    :active="isActive(item.to)"
                    active-color="primary"
                    active-variant="soft"
                    class="min-h-10 justify-start gap-2.5 px-3"
                    :class="isActive(item.to) ? 'bg-accent/12 text-accent hover:bg-accent/16' : undefined"
                    :aria-current="isActive(item.to) ? 'page' : undefined"
                    :leading-icon="isActive(item.to) ? item.activeIcon : item.icon"
                    :label="item.label"
                />
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
const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

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
            { get label() { return localize("Shared") }, to: '/shared', icon: 'solar:share-circle-linear', activeIcon: 'solar:share-circle-bold' },
            { get label() { return localize("Inbox") }, to: '/inbox', icon: 'solar:inbox-in-linear', activeIcon: 'solar:inbox-in-bold' },
            { get label() { return localize("Trash") }, to: '/trash', icon: 'material-symbols:delete-outline-rounded', activeIcon: 'material-symbols:delete-rounded' }
        ]
    },
    ...(currentUser.value?.role === 'ADMIN' ? [{
        get label() { return localize("ADMINISTRATION") },
        items: [{ get label() { return localize("Admin") }, to: '/admin', icon: 'solar:shield-user-linear', activeIcon: 'solar:shield-user-bold' }]
    }] : [])
])
</script>
