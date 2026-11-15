<template>
    <header class="header-bar flex h-16 w-full items-center justify-between rounded-2xl border border-divider bg-surface px-4">
        <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="solar:hamburger-menu-linear"
            class="navigation-toggle mr-2 hidden size-11 shrink-0 justify-center max-laptop:inline-flex"
            :aria-label='$msg("Open navigation")'
            aria-controls="mobile-navigation"
            aria-haspopup="dialog"
            :aria-expanded="navigationOpen"
            @click="$emit('openNavigation')"
        />
        <div class="title flex-1 min-w-0 mr-4">
            <ClientOnly>
                <nav
                    v-if="fileHeader && isFileDetails"
                    class="header-breadcrumb flex items-center gap-3 min-w-0 text-sm leading-normal"
                >
                    <NuxtLink
                        :to="fileHeader.returnPath"
                        class="header-back inline-flex items-center gap-2 shrink-0 text-accent no-underline font-medium
                            hover:text-accent"
                    >
                        <Icon
                            name="solar:arrow-left-linear"
                            size="1.2rem"
                        />
                        <span>{{ $msg("Back to") }} {{ $msg(fileHeader.returnName) }}</span>
                    </NuxtLink>
                    <span class="header-separator text-muted">/</span>
                    <span
                        class="header-filename min-w-0 text-content truncate"
                        :title="fileHeader.fileName"
                        >{{ fileHeader.fileName }}</span
                    >
                </nav>
                <h1 class="m-0 text-foreground text-2xl font-semibold leading-tight" v-else>{{ $msg(title) }}</h1>
                <template #fallback>
                    <h1 class="m-0 text-foreground text-2xl font-semibold leading-tight">{{ $msg(title) }}</h1>
                </template>
            </ClientOnly>
        </div>

        <div class="header-actions header-workspace-actions shrink-0 flex items-center gap-2">
            <UButton class="header-theme-shortcut" color="neutral" variant="ghost" type="button" :disabled="!preferencesLoaded"
                :aria-label="resolvedTheme === 'dark' ? $msg('Switch to light theme') : $msg('Switch to dark theme')"
                :title="resolvedTheme === 'dark' ? $msg('Switch to light theme') : $msg('Switch to dark theme')"
                :icon="resolvedTheme === 'dark' ? 'solar:sun-2-linear' : 'solar:moon-linear'"
                @click="setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')" />

            <NotificationCenter />

            <div class="header-account hidden max-laptop:block">
                <AccountMenu placement="header" />
            </div>
        </div>
    </header>
</template>

<script setup lang="ts">
import AccountMenu from './AccountMenu.vue'
import NotificationCenter from './NotificationCenter.vue'

defineProps({
    navigationOpen: { type: Boolean, default: false },
    title: {
        type: String,
        default: 'Dashboard'
    }
})

defineEmits<{ openNavigation: [] }>()

const fileHeader = useFileHeader()
const route = useRoute()
const { resolvedTheme, setTheme } = useTheme()
const { preferencesLoaded } = usePreferences()

const isFileDetails = computed(
    () =>
        /^\/(files|notes|folders)\/[^/]+\/?$/.test(route.path) &&
        fileHeader.value?.fileId ===
            (route.params.id ?? route.params.noteId ?? route.params.folderId)
)
</script>
