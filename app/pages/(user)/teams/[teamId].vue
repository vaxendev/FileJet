<script setup lang="ts">
import { $fetch as teamFetch } from 'ofetch'
import { teamCan, type TeamDetails, type TeamSettings, type TeamRole, type TeamMember } from '~~/shared/types/team'
import type { LibraryItem } from '~~/shared/types/library'
import type { QuickPreviewItem } from '~~/shared/types/quickPreview'
import { getFileIcon, formatFileSize, formatFileTime } from '~/utils/file'
definePageMeta({ middleware: 'auth', layout: 'user', key: route => route.path })
const route = useRoute(),
    router = useRouter(),
    user = useAuthUser(),
    id = String(route.params.teamId)
const folderId = computed(() => (typeof route.query.folder === 'string' ? route.query.folder : undefined))
const { data, pending, error, refresh } = await useFetch<TeamDetails>(`/api/teams/${encodeURIComponent(id)}`, {
    key: `team:${id}:${user.value?.id}`,
    query: { folderId }
})
useHead(() => ({ title: `${data.value?.name ?? localize('Team spaces')} · FileJet` }))
const { openToast } = useToast(),
    { confirm } = useConfirm()
const tab = ref<'files' | 'members'>('files'),
    working = ref(false),
    search = ref('')
const view = ref<'grid' | 'list'>('grid'),
    sort = ref<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest')
const canUpload = computed(() => teamCan(data.value?.role, 'upload')),
    canEdit = computed(() => teamCan(data.value?.role, 'edit')),
    canManage = computed(() => teamCan(data.value?.role, 'manage'))
const filtered = computed(() =>
    (data.value?.items ?? []).filter(item =>
        item.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
    )
)
const { sortedItems } = useSort(
    filtered,
    sort,
    item => item.name,
    item => item.created_at
)
const perPage = computed(() => (view.value === 'grid' ? 24 : 12))
const { currentPage, totalPages, paginatedItems } = usePagination(sortedItems, perPage)
watch([search, sort, view, folderId], () => {
    currentPage.value = 1
})
watch(totalPages, total => {
    currentPage.value = Math.min(currentPage.value, Math.max(1, total))
})
const preview = ref<QuickPreviewItem | null>(null)
watch(folderId, () => {
    search.value = ''
    preview.value = null
})
const openItem = (item: LibraryItem) => {
    if (item.type === 'folder') return router.push({ path: route.path, query: { folder: item.id } })
    preview.value = { ...item, type: 'file' }
}
const download = (item: LibraryItem) =>
    `/api/teams/${encodeURIComponent(id)}/files/${encodeURIComponent(item.id)}/download`
const icon = (item: LibraryItem) =>
    item.type === 'folder' ? 'solar:folder-bold' : getFileIcon(item.mime_type ?? null, item.name)
const mutate = async (run: () => Promise<unknown>, message: string) => {
    if (working.value) return false
    working.value = true
    try {
        await run()
        await refresh()
        if (error.value)
            openToast(localize('Change saved, but the view could not be refreshed. Try again.'), 'error')
        else openToast(message, 'success')
        return true
    } catch (failure) {
        openToast(resolveApiError(failure), 'error')
        return false
    } finally {
        working.value = false
    }
}
const itemFormOpen = ref(false),
    editingItem = ref<LibraryItem | null>(null),
    itemError = ref('')
const openItemForm = (item: LibraryItem | null = null) => {
    if (working.value || !canUpload.value || (item && !canEdit.value)) return
    editingItem.value = item
    itemError.value = ''
    itemFormOpen.value = true
}
const saveItem = async (name: string) => {
    if (working.value) return
    working.value = true
    itemError.value = ''
    try {
        if (editingItem.value)
            await teamFetch(`/api/teams/${id}/items/${editingItem.value.id}`, {
                method: 'PATCH',
                query: { type: editingItem.value.type },
                body: { name }
            })
        else
            await teamFetch(`/api/teams/${id}/folders`, {
                method: 'POST',
                body: { name, folderId: data.value?.folderId }
            })
        itemFormOpen.value = false
        openToast(
            editingItem.value ? localize('Changes saved.') : localize('Folder created successfully.'),
            'success'
        )
        await refresh()
        if (error.value)
            openToast(localize('Change saved, but the view could not be refreshed. Try again.'), 'error')
    } catch (failure) {
        itemError.value = resolveApiError(failure)
    } finally {
        working.value = false
    }
}
const removeItem = async (item: LibraryItem) => {
    if (!canEdit.value || working.value) return
    if (
        !(await confirm({
            title: localize('Remove item?'),
            message: localize("This item will move to the owner's Trash."),
            confirmText: localize('Remove'),
            variant: 'danger'
        }))
    )
        return
    await mutate(
        () => teamFetch(`/api/teams/${id}/items/${item.id}`, { method: 'DELETE', query: { type: item.type } }),
        localize('Item removed.')
    )
}
const upload = async (files: FileList) => {
    if (!canUpload.value || working.value) return
    const values = Array.from(files)
    if (
        !values.length ||
        values.length > 6 ||
        values.some(file => file.size > 25 * 1024 * 1024) ||
        values.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024
    ) {
        openToast(localize('Choose up to 6 files, 25 MB each and 50 MB in total.'), 'error')
        return
    }
    const body = new FormData()
    values.forEach(file => body.append('files', file))
    await mutate(
        () =>
            teamFetch(`/api/teams/${id}/files`, {
                method: 'POST',
                query: { folderId: data.value?.folderId },
                body
            }),
        localize('Upload complete')
    )
}
const username = ref(''),
    newRole = ref<TeamRole>('VIEWER'),
    roleOptions = computed(teamRoleOptions)
const addMember = async () => {
    if (!canManage.value || !username.value.trim()) return
    if (
        await mutate(
            () =>
                teamFetch(`/api/teams/${id}/members`, {
                    method: 'POST',
                    body: { username: username.value.trim(), role: newRole.value }
                }),
            localize('Member added.')
        )
    )
        username.value = ''
}
const changeRole = async (member: TeamMember, role: string) => {
    if (!canManage.value || member.role === role) return
    await mutate(
        () => teamFetch(`/api/teams/${id}/members/${member.id}`, { method: 'PATCH', body: { role } }),
        localize('Permissions updated.')
    )
}
const removeMember = async (member: TeamMember) => {
    if (!canManage.value || working.value) return
    if (
        !(await confirm({
            title: localize('Remove member?'),
            message: localize('Access ends immediately.'),
            confirmText: localize('Remove'),
            variant: 'danger'
        }))
    )
        return
    await mutate(
        () => teamFetch(`/api/teams/${id}/members/${member.id}`, { method: 'DELETE' }),
        localize('Member removed.')
    )
}
const teamFormOpen = ref(false),
    teamError = ref('')
const openTeamForm = () => {
    teamError.value = ''
    teamFormOpen.value = true
}
const saveTeam = async (body: TeamSettings) => {
    if (working.value || !canManage.value) return
    working.value = true
    teamError.value = ''
    try {
        await teamFetch(`/api/teams/${id}`, { method: 'PATCH', body })
        teamFormOpen.value = false
        await refresh()
        openToast(localize('Changes saved.'), 'success')
    } catch (failure) {
        teamError.value = resolveApiError(failure)
    } finally {
        working.value = false
    }
}
const inviteError = ref('')
const inviteUrl = computed(() => {
    if (!data.value?.inviteToken || import.meta.server) return ''
    const path = router.resolve(`/teams/join/${data.value.inviteToken}`).href
    return new URL(path, window.location.origin).href
})
const updateInvite = async (method: 'PUT' | 'DELETE') => {
    if (!data.value || !canManage.value || working.value) return
    working.value = true
    inviteError.value = ''
    try {
        const result = await teamFetch<{ inviteToken?: string }>(`/api/teams/${id}/invite`, { method })
        data.value = { ...data.value, inviteToken: result.inviteToken ?? null }
    } catch (failure) {
        inviteError.value = resolveApiError(failure)
    } finally {
        working.value = false
    }
}
const copyInvite = async () => {
    try {
        await navigator.clipboard.writeText(inviteUrl.value)
        openToast(localize('Invitation link copied.'), 'success')
    } catch {
        openToast(localize('Could not copy the link. You can select and copy it from the link field.'), 'error')
    }
}
const exitTeam = async () => {
    if (working.value || !data.value) return
    const owner = canManage.value
    if (
        !(await confirm({
            title: owner ? localize('Delete team space?') : localize('Leave team space?'),
            message: owner
                ? localize("Members lose access. Content moves to the owner's Trash.")
                : localize('You will lose access to this team space.'),
            confirmText: owner ? localize('Delete') : localize('Leave'),
            variant: 'danger'
        }))
    )
        return
    working.value = true
    try {
        await teamFetch(owner ? `/api/teams/${id}` : `/api/teams/${id}/members/${user.value!.id}`, {
            method: 'DELETE'
        })
        await navigateTo('/teams')
        openToast(owner ? localize('Team space deleted.') : localize('You left the team space.'), 'success')
    } catch (failure) {
        openToast(resolveApiError(failure), 'error')
    } finally {
        working.value = false
    }
}
</script>

<template>
    <div class="team-detail min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex w-full max-w-350 flex-col gap-4 p-5 max-mobile:p-3">
            <NuxtLink to="/teams" class="inline-flex w-fit items-center gap-2 text-sm text-accent no-underline"
                ><Icon name="solar:arrow-left-linear" />{{ $msg('Team spaces') }}</NuxtLink
            >
            <div v-if="error || !data" class="rounded-2xl border border-divider bg-surface p-10 text-center">
                <p class="text-sm text-label" role="alert">
                    {{
                        error ? resolveApiError(error, $msg('Could not load team space.')) : $msg('Loading...')
                    }}
                </p>
                <button class="inbox-button mt-4" @click="refresh()">{{ $msg('Try again') }}</button>
            </div>
            <template v-else>
                <header class="rounded-2xl border border-divider bg-surface p-6 max-mobile:p-4">
                    <div class="flex flex-wrap items-start justify-between gap-4">
                        <div class="flex min-w-0 flex-1 items-start gap-3">
                            <span
                                class="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"
                                ><Icon name="solar:users-group-rounded-linear" size="27"
                            /></span>
                            <div class="min-w-0">
                                <h2 class="break-words text-xl font-semibold text-foreground">
                                    {{ data.name }}
                                </h2>
                                <p
                                    v-if="data.description"
                                    class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-label"
                                >
                                    {{ data.description }}
                                </p>
                                <p class="mt-2 text-xs text-muted">
                                    {{ $msg('Owner') }}: {{ data.ownerName }} · {{ teamRoleLabel(data.role) }} ·
                                    {{ data.isPublic ? $msg('Public team') : $msg('Private team') }}
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-if="canManage"
                                class="inbox-button"
                                :disabled="working"
                                @click="openTeamForm"
                            >
                                <Icon name="solar:settings-linear" />{{ $msg('Team settings') }}</button
                            ><button class="inbox-button text-danger!" :disabled="working" @click="exitTeam">
                                {{ canManage ? $msg('Delete team space') : $msg('Leave team space') }}
                            </button>
                        </div>
                    </div>
                    <div
                        class="mt-5 flex gap-2 border-t border-divider pt-4"
                        role="group"
                        :aria-label="$msg('Team sections')"
                    >
                        <button
                            class="inbox-button"
                            :class="{ 'inbox-primary': tab === 'files' }"
                            :aria-pressed="tab === 'files'"
                            @click="tab = 'files'"
                        >
                            {{ $msg('Files') }}</button
                        ><button
                            class="inbox-button"
                            :class="{ 'inbox-primary': tab === 'members' }"
                            :aria-pressed="tab === 'members'"
                            @click="tab = 'members'"
                        >
                            {{ $msg('Members') }} <span class="text-xs opacity-70">{{ data.memberCount }}</span>
                        </button>
                    </div>
                </header>
                <section
                    v-if="tab === 'files'"
                    class="rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3"
                >
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <nav
                            :aria-label="$msg('Folder path')"
                            class="flex min-w-0 flex-wrap items-center gap-2 text-sm"
                        >
                            <template v-for="(crumb, index) in data.breadcrumbs" :key="crumb.id"
                                ><span v-if="index" class="text-muted">/</span
                                ><NuxtLink
                                    :to="{ path: route.path, query: index ? { folder: crumb.id } : {} }"
                                    class="max-w-64 truncate text-accent no-underline"
                                    :title="crumb.name"
                                    >{{ crumb.name }}</NuxtLink
                                ></template
                            >
                        </nav>
                        <div v-if="canUpload" class="flex flex-wrap gap-2">
                            <button
                                class="inbox-button inbox-primary"
                                :disabled="working || pending"
                                @click="openItemForm()"
                            >
                                <Icon name="solar:add-folder-bold" />{{ $msg('New folder') }}</button
                            ><UploadButton
                                :text="$msg('Upload Files')"
                                variant="secondary"
                                :disabled="working || pending"
                                @files="upload"
                            />
                        </div>
                    </div>
                    <div
                        class="my-4 flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-4"
                    >
                        <SearchBox
                            v-model="search"
                            class="w-full! min-w-0! flex-1! basis-60!"
                            :placeholder="$msg('Search this folder...')"
                        />
                        <div class="ml-auto flex items-center gap-2">
                            <SortDropdown v-model="sort" /><ViewSwitcher v-model="view" />
                        </div>
                    </div>
                    <p v-if="working" role="status" class="mb-4 text-xs text-accent">{{ $msg('Working…') }}</p>
                    <p v-if="!paginatedItems.length" class="py-12 text-center text-sm text-muted">
                        {{ search ? $msg('No matching items') : $msg('This folder is empty') }}
                    </p>
                    <ItemGrid v-else-if="view === 'grid'" class="team-grid">
                        <ItemGridCard
                            v-for="item in paginatedItems"
                            :key="item.id"
                            :title="item.name"
                            :icon="icon(item)"
                            tabindex="0"
                            @click="openItem(item)"
                            @keydown.enter.self="openItem(item)"
                        >
                            <template #actions
                                ><div class="ml-auto flex gap-1" @click.stop @keydown.stop>
                                    <a
                                        v-if="item.type === 'file'"
                                        :href="download(item)"
                                        download
                                        class="team-icon"
                                        :aria-label="$msg('Download')"
                                        ><Icon name="solar:download-linear" /></a
                                    ><button
                                        v-if="canEdit"
                                        class="team-icon"
                                        :disabled="working"
                                        :aria-label="$msg('Rename')"
                                        @click="openItemForm(item)"
                                    >
                                        <Icon name="solar:pen-linear" /></button
                                    ><button
                                        v-if="canEdit"
                                        class="team-icon text-danger!"
                                        :disabled="working"
                                        :aria-label="$msg('Remove')"
                                        @click="removeItem(item)"
                                    >
                                        <Icon name="solar:trash-bin-trash-linear" />
                                    </button></div
                            ></template>
                            <template #metadata
                                ><span
                                    >{{ item.type === 'folder' ? $msg('Folder') : formatFileSize(item.size) }} ·
                                    {{ formatFileTime(item.created_at) }}</span
                                ></template
                            >
                        </ItemGridCard>
                    </ItemGrid>
                    <div v-else class="divide-y divide-divider">
                        <div
                            v-for="item in paginatedItems"
                            :key="item.id"
                            class="flex min-w-0 flex-wrap items-center gap-3 py-3"
                        >
                            <button
                                class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                                @click="openItem(item)"
                            >
                                <Icon :name="icon(item)" size="24" class="shrink-0 text-accent" /><span
                                    class="min-w-0"
                                    ><strong class="block truncate text-sm text-foreground">{{
                                        item.name
                                    }}</strong
                                    ><span class="text-xs text-muted"
                                        >{{
                                            item.type === 'folder' ? $msg('Folder') : formatFileSize(item.size)
                                        }}
                                        · {{ formatFileTime(item.created_at) }}</span
                                    ></span
                                ></button
                            ><a
                                v-if="item.type === 'file'"
                                :href="download(item)"
                                download
                                class="team-icon"
                                :aria-label="$msg('Download')"
                                ><Icon name="solar:download-linear" /></a
                            ><button
                                v-if="canEdit"
                                class="team-icon"
                                :disabled="working"
                                :aria-label="$msg('Rename')"
                                @click="openItemForm(item)"
                            >
                                <Icon name="solar:pen-linear" /></button
                            ><button
                                v-if="canEdit"
                                class="team-icon text-danger!"
                                :disabled="working"
                                :aria-label="$msg('Remove')"
                                @click="removeItem(item)"
                            >
                                <Icon name="solar:trash-bin-trash-linear" />
                            </button>
                        </div>
                    </div>
                    <Pagination v-model="currentPage" :total-pages="totalPages" :view-mode="view" />
                    <p class="mt-4 text-xs leading-5 text-muted">
                        {{
                            $msg("Files use the owner's storage quota. Removed items go to the owner's Trash.")
                        }}
                        <span v-if="canUpload">{{
                            $msg('Choose up to 6 files, 25 MB each and 50 MB in total.')
                        }}</span>
                    </p>
                </section>
                <section v-else class="rounded-2xl border border-divider bg-surface p-5 max-mobile:p-3">
                    <h2 class="text-base font-semibold text-foreground">{{ $msg('Members') }}</h2>
                    <p class="mt-2 text-xs leading-6 text-muted">
                        {{
                            $msg(
                                'Viewers can view and download. Uploaders can also add files and folders. Editors can also rename and remove items.'
                            )
                        }}
                    </p>
                    <section v-if="canManage" class="mt-5 flex flex-col gap-3 rounded-xl border border-divider bg-canvas p-4">
                        <h3 class="text-sm font-semibold text-foreground">{{ $msg('Invitation link') }}</h3>
                        <p v-if="!data.isPublic" class="text-xs leading-5 text-muted">
                            {{ data.hasJoinPassword ? $msg('Share the team password separately from the invitation link.') : $msg('Set a team password in Team settings before creating a link.') }}
                        </p>
                        <div v-if="data.inviteToken" class="flex flex-wrap items-center gap-2">
                            <input :value="inviteUrl" :aria-label="$msg('Invitation link')" class="inbox-input min-w-0 flex-1" readonly />
                            <button type="button" class="inbox-button" :disabled="!inviteUrl" @click="copyInvite">
                                {{ $msg('Copy link') }}
                            </button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" class="inbox-button" :disabled="working || (!data.isPublic && !data.hasJoinPassword)" @click="updateInvite('PUT')">
                                {{ data.inviteToken ? $msg('Replace invitation link') : $msg('Create invitation link') }}
                            </button>
                            <button v-if="data.inviteToken" type="button" class="inbox-button text-danger!" :disabled="working" @click="updateInvite('DELETE')">
                                {{ $msg('Revoke invitation link') }}
                            </button>
                        </div>
                        <p v-if="inviteError" role="alert" class="text-sm text-danger">{{ inviteError }}</p>
                    </section>
                    <form
                        v-if="canManage"
                        class="my-5 flex flex-wrap items-end gap-3 rounded-xl border border-divider bg-canvas p-4"
                        @submit.prevent="addMember"
                    >
                        <label class="flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted"
                            >{{ $msg('Existing username')
                            }}<input
                                v-model="username"
                                required
                                maxlength="50"
                                autocomplete="off"
                                class="inbox-input"
                                :disabled="working"
                        /></label>
                        <div class="w-44 max-w-full">
                            <FormSelect
                                v-model="newRole"
                                :label="$msg('Team role')"
                                :options="roleOptions"
                                :disabled="working"
                            />
                        </div>
                        <button
                            class="inbox-button inbox-primary"
                            :disabled="working || !username.trim()"
                            type="submit"
                        >
                            {{ $msg('Add member') }}
                        </button>
                    </form>
                    <ul class="mt-4 divide-y divide-divider">
                        <li
                            v-for="member in data.members"
                            :key="member.id"
                            class="flex flex-wrap items-center justify-between gap-3 py-4"
                        >
                            <span class="min-w-0 break-all text-sm font-medium text-foreground"
                                >{{ member.username
                                }}<span v-if="member.id === user?.id" class="ml-2 text-xs text-muted">{{
                                    $msg('(you)')
                                }}</span></span
                            >
                            <div class="flex items-center gap-2">
                                <div v-if="canManage && member.role !== 'OWNER'" class="w-40">
                                    <FormSelect
                                        :model-value="member.role"
                                        :label="$msg('Team role')"
                                        :options="roleOptions"
                                        :disabled="working"
                                        @update:model-value="role => changeRole(member, role)"
                                    />
                                </div>
                                <span v-else class="rounded-md bg-control px-2 py-1 text-xs text-label">{{
                                    teamRoleLabel(member.role)
                                }}</span
                                ><button
                                    v-if="canManage && member.role !== 'OWNER'"
                                    type="button"
                                    class="team-icon text-danger!"
                                    :disabled="working"
                                    :aria-label="$msg('Remove member')"
                                    @click="removeMember(member)"
                                >
                                    <Icon name="solar:trash-bin-trash-linear" />
                                </button>
                            </div>
                        </li>
                    </ul>
                </section>
            </template>
        </div>
        <TeamFormModal
            :open="teamFormOpen"
            :busy="working"
            :error="teamError"
            :team="data"
            @close="teamFormOpen = false"
            @save="saveTeam"
        />
        <TeamItemModal
            :open="itemFormOpen"
            :busy="working"
            :error="itemError"
            :item="editingItem"
            @close="itemFormOpen = false"
            @save="saveItem"
        />
        <FileQuickPreview
            :item="preview"
            :api-base="preview ? `/api/teams/${id}/files/${preview.id}` : undefined"
            @close="preview = null"
        />
    </div>
</template>
<style scoped>
.team-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid var(--color-control-border);
    border-radius: 0.625rem;
    background: var(--color-control);
    color: var(--color-secondary);
    cursor: pointer;
}
.team-icon:hover {
    background: var(--color-raised);
    color: var(--color-foreground);
}
.team-icon:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
}
.team-icon:disabled {
    opacity: 0.5;
    cursor: wait;
}
.team-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
}
</style>
