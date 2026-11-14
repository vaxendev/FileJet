<script setup lang="ts">
import { $fetch as fetchTodo } from 'ofetch'
import { todoTitleLimit, type TodoItem } from '~~/shared/types/todo'

definePageMeta({ middleware: 'auth', layout: 'user' })
useHead(() => ({ title: `${localize('Todo List')} · FileJet` }))

const filters = ['All', 'Open', 'Completed'] as const
const filter = ref<typeof filters[number]>('All')
const items = ref<TodoItem[]>([])
const visibleItems = computed(() => filter.value === 'All'
    ? items.value
    : items.value.filter(item => item.completed === (filter.value === 'Completed')))
const pending = ref(true)
const loaded = ref(false)
const saving = ref(false)
const error = ref('')
const draft = ref('')
const addInput = ref<HTMLInputElement>()
const editInput = ref<HTMLInputElement[]>()
const editing = ref<{ id: string; title: string }>()
let addRequest: { id: string; title: string } | undefined

const load = async () => {
    pending.value = true
    error.value = ''
    try {
        const result = await fetchTodo<{ items: TodoItem[] }>('/api/todo', { timeout: 10000 })
        items.value = result.items
        loaded.value = true
    } catch (failure) {
        error.value = resolveApiError(failure)
    } finally {
        pending.value = false
    }
}
const save = async (action: () => Promise<void>) => {
    if (saving.value || pending.value || !loaded.value) return false
    saving.value = true
    error.value = ''
    try {
        await action()
        return true
    } catch (failure) {
        error.value = resolveApiError(failure)
        return false
    } finally {
        saving.value = false
    }
}
const add = async () => {
    const title = draft.value.trim()
    if (!title) return
    if (await save(async () => {
        if (addRequest?.title !== title) addRequest = { id: crypto.randomUUID(), title }
        const result = await fetchTodo<{ item: TodoItem }>('/api/todo', { method: 'POST', body: addRequest, timeout: 10000 })
        items.value = [result.item, ...items.value.filter(item => item.id !== result.item.id)]
        addRequest = undefined
        draft.value = ''
        filter.value = 'All'
    })) {
        await nextTick()
        addInput.value?.focus()
    }
}
const update = async (id: string, body: { title: string } | { completed: boolean }) => {
    const result = await fetchTodo<{ item: TodoItem }>(`/api/todo/${id}`, { method: 'PATCH', body, timeout: 10000 })
    items.value = items.value.map(item => item.id === id ? result.item : item)
}
const toggleCompleted = async (item: TodoItem, event: Event) => {
    const checkbox = event.currentTarget as HTMLInputElement
    const completed = checkbox.checked
    if (!await save(() => update(item.id, { completed }))) checkbox.checked = item.completed
}
const startEdit = async (item: TodoItem) => {
    error.value = ''
    editing.value = { id: item.id, title: item.title }
    await nextTick()
    editInput.value?.[0]?.focus()
}
const submitEdit = async () => {
    const item = editing.value
    if (!item?.title.trim()) return
    if (await save(() => update(item.id, { title: item.title }))) editing.value = undefined
}
const remove = (id: string) => save(async () => {
    await fetchTodo(`/api/todo/${id}`, { method: 'DELETE', timeout: 10000 })
    items.value = items.value.filter(item => item.id !== id)
    if (editing.value?.id === id) editing.value = undefined
})
onMounted(load)
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <section class="max-w-3xl rounded-xl border border-divider bg-surface p-4 sm:p-5">
            <form class="flex flex-wrap gap-2" @submit.prevent="add">
                <input ref="addInput" v-model="draft" class="inbox-input min-w-0 flex-1 basis-40"
                    :aria-label="$msg('New to-do')" :placeholder="$msg('New to-do')" :maxlength="todoTitleLimit"
                    :disabled="pending || !loaded || saving" required />
                <button type="submit" class="inbox-button inbox-primary gap-1.5" :disabled="pending || !loaded || saving || !draft.trim()">
                    <Icon name="solar:add-circle-linear" aria-hidden="true" />{{ $msg('Add') }}
                </button>
            </form>
            <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>
            <p v-if="pending" role="status" class="py-5 text-sm text-muted">{{ $msg('Loading...') }}</p>
            <button v-else-if="!loaded" type="button" class="inbox-button mt-4" @click="load">{{ $msg('Try again') }}</button>
            <template v-else>
                <div v-if="items.length" class="mt-4 flex flex-wrap gap-2 border-b border-divider pb-3"
                    role="group" :aria-label="$msg('Filter to-dos')">
                    <button v-for="option in filters" :key="option" type="button" class="inbox-button"
                        :class="{ 'inbox-primary': filter === option }" :aria-pressed="filter === option" :disabled="saving"
                        @click="filter = option; editing = undefined">
                        {{ $msg(option) }}
                    </button>
                </div>
                <p v-if="!visibleItems.length" class="py-5 text-sm text-muted">
                    {{ items.length ? $msg('No matching to-dos.') : $msg('No to-dos yet.') }}
                </p>
                <ul v-else class="divide-y divide-divider">
                    <li v-for="item in visibleItems" :key="item.id" class="py-3">
                        <form v-if="editing?.id === item.id" class="flex flex-wrap items-center gap-2"
                            @submit.prevent="submitEdit" @keydown.esc.prevent="!saving && (editing = undefined)">
                            <input ref="editInput" v-model="editing.title" class="inbox-input min-w-0 flex-1 basis-40"
                                :aria-label="$msg('Edit to-do')" :maxlength="todoTitleLimit" :disabled="saving" required />
                            <button type="submit" class="inbox-button inbox-primary" :disabled="saving || !editing.title.trim()">{{ $msg('Save') }}</button>
                            <button type="button" class="inbox-button" :disabled="saving" @click="editing = undefined">{{ $msg('Cancel') }}</button>
                        </form>
                        <div v-else class="flex flex-wrap items-center gap-2">
                            <label class="flex min-w-0 flex-1 basis-36 items-start gap-3 text-sm">
                                <input type="checkbox" class="mt-0.5 size-4 shrink-0 accent-accent" :checked="item.completed"
                                    :disabled="saving" @change="toggleCompleted(item, $event)" />
                                <span class="wrap-anywhere" :class="item.completed ? 'text-muted line-through' : 'text-foreground'">{{ item.title }}</span>
                            </label>
                            <div class="flex shrink-0 gap-1">
                                <button type="button" class="inbox-button" :aria-label="$msg('Edit to-do')" :title="$msg('Edit to-do')"
                                    :disabled="saving" @click="startEdit(item)">
                                    <Icon name="solar:pen-linear" aria-hidden="true" />
                                </button>
                                <button type="button" class="inbox-button text-danger!" :aria-label="$msg('Delete to-do')" :title="$msg('Delete to-do')"
                                    :disabled="saving" @click="remove(item.id)">
                                    <Icon name="solar:trash-bin-trash-linear" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </li>
                </ul>
            </template>
        </section>
    </div>
</template>
