<script setup lang="ts">
import { isTeamJoinKey, type TeamJoinPreview } from '~~/shared/types/team'

const route = useRoute()
const user = useAuthUser()
const key = String(route.params.key)
const valid = isTeamJoinKey(key)
const endpoint = `/api/teams/join/${encodeURIComponent(key)}`
const { data, error, status, refresh } = await useFetch<TeamJoinPreview>(endpoint, {
    immediate: Boolean(user.value && valid),
    watch: false
})
const password = ref('')
const busy = ref(false)
const joinError = ref('')

useHead(() => ({
    title: `${localize('Team invitation')} · FileJet`,
    meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }]
}))
useResponseHeader('Cache-Control').value = 'private, no-store'

if (data.value?.teamId) await navigateTo(`/teams/${data.value.teamId}`, { replace: true })

const join = async () => {
    if (!data.value || busy.value) return
    busy.value = true
    joinError.value = ''
    try {
        const result = await $fetch<{ teamId: string }>(endpoint, {
            method: 'POST',
            body: data.value.requiresPassword ? { password: password.value } : {}
        })
        password.value = ''
        await navigateTo(`/teams/${result.teamId}`, { replace: true })
    } catch (failure) {
        joinError.value = resolveApiError(failure)
        if ([404, 409].includes((failure as { statusCode?: number }).statusCode ?? 0)) await refresh()
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <main class="grid min-h-dvh place-items-center bg-canvas p-4 text-foreground">
        <section class="w-full max-w-lg rounded-3xl border border-divider bg-surface p-8 max-mobile:p-5">
            <div class="mb-5 flex items-center font-semibold">
                <BrandMark /> FileJet
            </div>
            <h1 class="break-words text-2xl font-semibold">{{ data?.name || $msg('Team invitation') }}</h1>
            <p v-if="!valid || error" role="alert" class="mt-3 text-sm text-danger">
                {{ error ? resolveApiError(error, $msg('This team invitation is unavailable.')) : $msg('This team invitation is unavailable.') }}
            </p>
            <template v-else-if="!user">
                <p class="mt-3 text-sm text-secondary">{{ $msg('Sign in to accept this team invitation.') }}</p>
                <NuxtLink :to="{ path: '/login', query: { teamInvite: key } }" class="inbox-button inbox-primary mt-5 w-fit">
                    {{ $msg('Login') }}
                </NuxtLink>
            </template>
            <p v-else-if="status === 'pending'" role="status" class="mt-3 text-sm text-secondary">
                {{ $msg('Loading...') }}
            </p>
            <form v-else-if="data" class="mt-3 flex flex-col items-start gap-4" @submit.prevent="join">
                <p class="text-sm text-secondary">
                    {{ data.requiresPassword ? $msg('Enter the password shared by the project owner.') : $msg('Join this public team as a viewer.') }}
                </p>
                <label v-if="data.requiresPassword" class="flex w-full flex-col gap-2 text-sm text-label">
                    {{ $msg('Team password') }}
                    <input
                        v-model="password"
                        type="password"
                        class="inbox-input"
                        required
                        maxlength="128"
                        autocomplete="off"
                        :disabled="busy"
                    />
                </label>
                <p v-if="joinError" role="alert" class="text-sm text-danger">{{ joinError }}</p>
                <button type="submit" class="inbox-button inbox-primary" :disabled="busy">
                    {{ busy ? $msg('Joining...') : $msg('Join team') }}
                </button>
            </form>
        </section>
    </main>
</template>
