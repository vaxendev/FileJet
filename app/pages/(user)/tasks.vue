<script setup lang="ts">
import { $fetch as fetchTasks } from 'ofetch'
import { assignedTaskFilters, type AssignedTaskFilter, type AssignedTeamTask, type TeamListPage, type TeamTask } from '~~/shared/types/teamCollaboration'
import { formatTaskDay, localTaskDay } from '~/utils/taskDates'

definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('My tasks')} · FileJet` }))
const route = useRoute()
const taskId = computed(() => typeof route.query.task === 'string' ? route.query.task : undefined)
const filter = ref<AssignedTaskFilter>('all')
const labels = { all: 'All', upcoming: 'Upcoming', overdue: 'Overdue', completed: 'Completed' } as const
const tasks = ref<AssignedTeamTask[]>([])
const next = ref<string | null>(null)
const pending = ref(true)
const updating = ref<string>()
const error = ref('')
let generation = 0

const load = async (more = false) => {
    const request = ++generation
    pending.value = true
    error.value = ''
    try {
        const page = await fetchTasks<TeamListPage<AssignedTeamTask>>('/api/teams/assigned-tasks', {
            query: { today: localTaskDay(), filter: filter.value, task: taskId.value, cursor: more ? next.value : undefined },
            timeout: 10000
        })
        if (request !== generation) return
        tasks.value = more ? [...tasks.value, ...page.items] : page.items
        next.value = page.next
    } catch (failure) {
        if (request === generation) error.value = resolveApiError(failure)
    } finally {
        if (request === generation) pending.value = false
    }
}
const updateTask = async (task: AssignedTeamTask) => {
    if (updating.value) return
    updating.value = task.id
    error.value = ''
    try {
        const updated = await fetchTasks<{ task: TeamTask }>(`/api/teams/${task.teamId}/tasks/${task.id}`, {
            method: 'PATCH', body: { completed: !task.completed }, timeout: 10000
        })
        if (filter.value === 'all') tasks.value = tasks.value.map(item => item.id === task.id ? { ...item, ...updated.task } : item)
        else await load()
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        updating.value = undefined
    }
}
watch([filter, taskId], () => {
    tasks.value = []
    next.value = null
    void load()
})
onMounted(() => void load())
onBeforeUnmount(() => { generation++ })
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <section class="max-w-4xl rounded-xl border border-divider bg-surface p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                <NuxtLink v-if="taskId" to="/tasks" class="inbox-button">{{ $msg('Show all tasks') }}</NuxtLink>
                <div v-else class="flex flex-wrap gap-2" role="group" :aria-label="$msg('Filter tasks')">
                    <button v-for="option in assignedTaskFilters" :key="option" type="button" class="inbox-button"
                        :class="{ 'inbox-primary': filter === option }" :aria-pressed="filter === option" @click="filter = option">
                        {{ $msg(labels[option]) }}
                    </button>
                </div>
                <button type="button" class="inbox-button" :disabled="pending || Boolean(updating)" @click="load()">
                    {{ $msg('Refresh') }}
                </button>
            </div>
            <p v-if="error" role="alert" class="mb-3 text-sm text-danger">{{ error }}</p>
            <p v-if="pending && !tasks.length" role="status" class="py-5 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <p v-else-if="!error && !tasks.length" class="py-5 text-sm text-muted">
                {{ taskId ? $msg('This task is unavailable.') : $msg('No assigned tasks match this filter.') }}
            </p>
            <ul v-else class="divide-y divide-divider">
                <li v-for="task in tasks" :key="task.id" class="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div class="min-w-0">
                        <h2 class="wrap-anywhere text-sm font-semibold text-foreground">{{ task.title }}</h2>
                        <NuxtLink :to="{ path: `/teams/${task.teamId}`, query: { tab: 'tasks' } }"
                            class="wrap-anywhere text-sm text-accent hover:underline">{{ task.teamName }}</NuxtLink>
                        <p class="mt-1 text-xs text-muted">
                            {{ $msg('Due {date}', { date: formatTaskDay(task.dueOn, currentLocaleTag()) }) }} ·
                            {{ task.completed ? $msg('Completed') : task.dueOn < localTaskDay() ? $msg('Overdue') : $msg('Open task') }}
                        </p>
                    </div>
                    <button type="button" class="inbox-button" :disabled="Boolean(updating)" @click="updateTask(task)">
                        {{ task.completed ? $msg('Reopen') : $msg('Mark complete') }}
                    </button>
                </li>
            </ul>
            <button v-if="next" type="button" class="inbox-button mt-3" :disabled="pending || Boolean(updating)" @click="load(true)">
                {{ $msg('Load more') }}
            </button>
        </section>
    </div>
</template>
