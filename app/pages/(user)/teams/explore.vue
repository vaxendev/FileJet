<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { PublicTeam } from '~~/shared/types/team'

definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Public teams')} · FileJet` }))

const user = useAuthUser()
const search = ref('')
const query = ref('')
const page = ref(1)
watchDebounced(search, value => {
    page.value = 1
    query.value = value.trim()
}, { debounce: 250 })

const { data, pending, error, refresh } = await useFetch<{ teams: PublicTeam[]; totalPages: number }>('/api/teams/public', {
    key: `public-teams:${user.value?.id}`,
    query: { q: query, page }
})
watch(() => data.value?.totalPages, total => {
    if (total !== undefined && page.value > Math.max(1, total)) page.value = Math.max(1, total)
})
</script>

<template>
    <main class="min-h-0 flex-1 overflow-y-auto">
        <div class="flex w-full min-w-0 flex-col gap-3">
            <NuxtLink to="/teams" class="inline-flex w-fit items-center gap-2 text-sm text-accent no-underline">
                <Icon name="solar:arrow-left-linear" />{{ $msg('Team spaces') }}
            </NuxtLink>
            <header class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                <h1 class="text-xl font-semibold text-foreground">{{ $msg('Public teams') }}</h1>
            </header>
            <SearchBox v-model="search" class="w-full! max-w-none!" :placeholder="$msg('Search team spaces...')" />
            <div v-if="error" role="alert" class="rounded-xl border border-divider bg-surface p-6 text-center">
                <p class="text-sm text-danger">{{ resolveApiError(error, $msg('Could not load team spaces.')) }}</p>
                <button type="button" class="inbox-button mt-3" @click="refresh()">{{ $msg('Try again') }}</button>
            </div>
            <p v-else-if="pending" role="status" class="p-8 text-center text-sm text-muted">{{ $msg('Loading...') }}</p>
            <p v-else-if="!data?.teams.length" class="rounded-2xl border border-dashed border-divider p-8 text-center text-sm text-muted">
                {{ $msg('No public teams found.') }}
            </p>
            <ul v-else class="divide-y divide-divider rounded-2xl border border-divider bg-surface">
                <li v-for="team in data.teams" :key="team.id" class="flex flex-wrap items-center gap-4 p-5 max-mobile:p-4">
                    <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                        <Icon name="solar:users-group-rounded-linear" size="24" />
                    </span>
                    <div class="min-w-0 flex-1">
                        <h2 class="break-words font-semibold text-foreground">{{ team.name }}</h2>
                        <p v-if="team.description" class="mt-1 line-clamp-2 break-words text-sm text-secondary">{{ team.description }}</p>
                        <p class="mt-1 text-xs text-muted">{{ $msg('Owner') }}: {{ team.ownerName }}</p>
                    </div>
                    <NuxtLink
                        :to="team.isMember ? `/teams/${team.id}` : `/teams/join/${team.id}`"
                        class="inbox-button"
                    >
                        {{ team.isMember ? $msg('Open team') : $msg('Join team') }}
                    </NuxtLink>
                </li>
            </ul>
            <Pagination v-if="(data?.totalPages ?? 0) > 1" v-model="page" :total-pages="data?.totalPages ?? 0" view-mode="grid" />
        </div>
    </main>
</template>
