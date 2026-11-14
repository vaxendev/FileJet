<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import type { TeamInvitation, TeamSettings, TeamSummary } from '~~/shared/types/team'
definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Team spaces')} · FileJet` }))
const user = useAuthUser(),
    search = ref(''),
    modal = ref(false),
    busy = ref(false),
    formError = ref('')
const { openToast } = useToast()
const { data, pending, error, refresh } = await useFetch<{ teams: TeamSummary[]; invitations: TeamInvitation[] }>('/api/teams', {
    key: `teams:${user.value?.id}`
})
const visibility = useDocumentVisibility()
useIntervalFn(() => {
    if (visibility.value === 'visible' && !pending.value) void refresh()
}, 20000)
const teams = computed(() =>
    (data.value?.teams ?? []).filter(team =>
        [team.name, team.description, team.ownerName].some(text =>
            text.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
        )
    )
)
const respondingTo = ref<string | null>(null)
const respondToInvitation = async (invitation: TeamInvitation, method: 'POST' | 'DELETE') => {
    if (respondingTo.value) return
    respondingTo.value = invitation.id
    try {
        await $fetch(`/api/teams/invitations/${invitation.id}`, { method })
        openToast(method === 'POST' ? localize('Team invitation accepted.') : localize('Team invitation declined.'), 'success')
    } catch (failure) {
        openToast(resolveApiError(failure), 'error')
    } finally {
        await refresh()
        respondingTo.value = null
    }
}
const openCreate = () => {
    formError.value = ''
    modal.value = true
}
const create = async (body: TeamSettings) => {
    if (busy.value) return
    busy.value = true
    formError.value = ''
    try {
        const result = await $fetch<{ id: string }>('/api/teams', { method: 'POST', body })
        modal.value = false
        openToast(localize('Team space created.'), 'success')
        await navigateTo(`/teams/${result.id}`)
    } catch (failure) {
        formError.value = resolveApiError(failure, localize('Could not create team space.'))
    } finally {
        busy.value = false
    }
}
</script>
<template>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="flex w-full min-w-0 flex-col gap-3">
            <section
                class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-divider bg-surface p-3"
            >
                <div>
                    <p class="text-sm text-muted">
                        {{ $msg('Shared folders, files and permissions in one place.') }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <NuxtLink to="/tasks" class="inbox-button">{{ $msg('My tasks') }}</NuxtLink>
                    <NuxtLink to="/teams/explore" class="inbox-button">{{ $msg('Public teams') }}</NuxtLink>
                    <button type="button" class="inbox-button inbox-primary" @click="openCreate">
                        <Icon name="solar:users-group-rounded-linear" size="20" />{{ $msg('Create team space') }}
                    </button>
                </div>
            </section>
            <section v-if="data?.invitations?.length" class="rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3">
                <h2 class="font-semibold text-foreground">{{ $msg('Team invitations') }}</h2>
                <ul class="mt-2 divide-y divide-divider">
                    <li v-for="invitation in data.invitations" :key="invitation.id"
                        class="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div class="min-w-0">
                            <h3 class="break-words text-sm font-medium text-foreground">{{ invitation.teamName }}</h3>
                            <p class="mt-1 break-words text-xs text-muted">
                                {{ $msg('Owner') }}: {{ invitation.ownerName }} · {{ teamRoleLabel(invitation.role) }}
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-2" :aria-busy="respondingTo === invitation.id">
                            <button type="button" class="inbox-button" :disabled="respondingTo !== null"
                                @click="respondToInvitation(invitation, 'DELETE')">{{ $msg('Decline') }}</button>
                            <button type="button" class="inbox-button inbox-primary" :disabled="respondingTo !== null"
                                @click="respondToInvitation(invitation, 'POST')">{{ $msg('Accept') }}</button>
                        </div>
                    </li>
                </ul>
            </section>
            <SearchBox
                v-model="search"
                class="w-full! max-w-none!"
                :placeholder="$msg('Search team spaces...')"
            />
            <div v-if="error" role="alert" class="rounded-xl border border-divider bg-surface p-8 text-center">
                <p class="text-sm text-danger">
                    {{ resolveApiError(error, $msg('Could not load team spaces.')) }}
                </p>
                <button class="inbox-button mt-4" @click="refresh()">{{ $msg('Try again') }}</button>
            </div>
            <p v-else-if="pending" role="status" class="p-10 text-center text-sm text-muted">
                {{ $msg('Loading...') }}
            </p>
            <div
                v-else-if="!teams.length"
                class="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-divider p-8 text-center"
            >
                <Icon name="solar:users-group-rounded-linear" size="40" class="text-accent" />
                <h2 class="font-semibold text-foreground">
                    {{ search ? $msg('No matching team spaces') : $msg('Create your first team space') }}
                </h2>
                <p class="max-w-100 text-sm leading-6 text-muted">
                    {{ $msg('Create a space or ask its owner to invite you by username.') }}
                </p>
            </div>
            <div v-else class="grid grid-cols-3 gap-4 max-laptop:grid-cols-2 max-tablet:grid-cols-1">
                <NuxtLink
                    v-for="team in teams"
                    :key="team.id"
                    :to="`/teams/${team.id}`"
                    class="flex min-w-0 flex-col gap-4 rounded-2xl border border-divider bg-surface p-5 no-underline transition-colors hover:border-accent/50 hover:bg-surface-hover"
                >
                    <div class="flex items-center justify-between gap-3">
                        <span class="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent"
                            ><Icon name="solar:users-group-rounded-linear" size="25" /></span
                        ><span class="rounded-md bg-control px-2 py-1 text-xs text-muted">{{
                            teamRoleLabel(team.role)
                        }}</span>
                    </div>
                    <div>
                        <h2 class="truncate font-semibold text-foreground">{{ team.name }}</h2>
                        <p class="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                            {{ team.description || $msg('Shared folders for your team.') }}
                        </p>
                    </div>
                    <footer
                        class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3 text-xs text-muted"
                    >
                        <span>{{ $countMsg('teamMembers', team.memberCount) }}</span
                        ><span>{{ $msg('Owner') }}: {{ team.ownerName }}</span>
                        <span v-if="team.unreadCount" class="rounded-md bg-accent/10 px-2 py-1 font-medium text-accent">
                            {{ $msg('{count} unread', { count: team.unreadCount }) }}
                        </span>
                    </footer>
                </NuxtLink>
            </div>
        </div>
        <TeamFormModal :open="modal" :busy="busy" :error="formError" @close="modal = false" @save="create" />
    </div>
</template>
