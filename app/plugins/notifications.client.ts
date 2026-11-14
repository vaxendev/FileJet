import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { $fetch as fetchActivity } from 'ofetch'
import type { TeamMentionNotification, TeamTaskNotification } from '~~/shared/types/teamCollaboration'
import { formatTaskDay, localTaskDay } from '~/utils/taskDates'
import { getStorageStatus } from '~/utils/notifications'

export default defineNuxtPlugin(() => {
    const currentUser = useAuthUser()
    const { user } = useUser()
    const { loadNotifications, addNotification } = useNotifications()
    const visibility = useDocumentVisibility()
    let mentionsPending = false
    let tasksPending = false
    const loadMentions = async () => {
        const account = currentUser.value
        if (!account || visibility.value !== 'visible' || mentionsPending) return
        mentionsPending = true
        try {
            const { mentions } = await $fetch<{ mentions: TeamMentionNotification[] }>('/api/teams/mentions', { timeout: 10000 })
            for (const mention of mentions.slice().reverse()) {
                addNotification({
                    title: 'You were mentioned in a team chat.',
                    message: [mention.teamName, mention.authorName].filter(Boolean).join(' · '),
                    href: `/teams/${mention.teamId}?tab=chat&message=${mention.id}`,
                    dedupeKey: `team-mention:${mention.id}`
                }, account.id)
            }
        } catch {
            // A transient failure is retried on the next refresh.
        } finally {
            mentionsPending = false
        }
    }
    useIntervalFn(loadMentions, 20000)

    const loadTasks = async () => {
        const account = currentUser.value
        if (!account || visibility.value !== 'visible' || tasksPending) return
        tasksPending = true
        try {
            const { notifications } = await fetchActivity<{ notifications: TeamTaskNotification[] }>('/api/teams/task-notifications', {
                query: { today: localTaskDay() }, timeout: 10000
            })
            for (const task of notifications) {
                const reminder = task.kind === 'due'
                addNotification({
                    title: reminder ? 'A task is due soon.' : 'A task was assigned to you.',
                    message: [task.title, task.teamName, formatTaskDay(task.dueOn, currentLocaleTag())].join(' · '),
                    kind: reminder ? 'warning' : 'success',
                    href: `/tasks?task=${task.id}`,
                    dedupeKey: reminder ? `task-due:${task.id}:${task.dueOn}` : `task-assigned:${task.id}`
                }, account.id)
            }
        } catch {
            // Retry on the next refresh.
        } finally {
            tasksPending = false
        }
    }
    useIntervalFn(loadTasks, 30000)

    onNuxtReady(() => {
        watch(() => currentUser.value?.id, loadNotifications, { immediate: true })
        watch([() => currentUser.value?.id, visibility], loadMentions, { immediate: true })
        watch([() => currentUser.value?.id, visibility], loadTasks, { immediate: true })
        watch(() => {
            const account = currentUser.value
            const profile = user.value?.id === account?.id ? user.value : account
            return [account?.id, profile?.storageUsed, profile?.storageLimit] as const
        }, () => {
            const account = currentUser.value
            if (!account) return
            const profile = user.value?.id === account.id ? user.value : account
            const status = getStorageStatus(profile.storageUsed, profile.storageLimit)
            if (status.level === 'normal') return
            addNotification({
                title: status.level === 'full' ? localize("Storage limit reached") : localize("Your storage is almost full"),
                message: status.level === 'full' ? localize("Free up some space before uploading more files.") : `${Math.floor(status.percent)}% of your storage is in use. Review your files or empty items you no longer need.`,
                kind: 'warning', category: 'storage', href: '/home',
                dedupeKey: `storage:${status.level}:${new Date().toISOString().slice(0, 10)}`
            }, account.id)
        }, { immediate: true })
    })
})
