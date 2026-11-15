<template>
    <UDropdownMenu
        class="sort-dropdown shrink-0"
        :items="items"
        :content="{ align: 'end', sideOffset: 6 }"
        :ui="{ content: 'min-w-40' }"
    >
        <UButton
            type="button"
            color="neutral"
            variant="ghost"
            class="sort-trigger h-10 whitespace-nowrap max-mobile:h-11 pointer-coarse:h-11"
            icon="solar:sort-vertical-linear"
            trailing-icon="solar:alt-arrow-down-linear"
            :label="currentLabel"
        />
    </UDropdownMenu>
</template>

<script setup lang="ts">
const model = defineModel<'newest' | 'oldest' | 'name-asc' | 'name-desc'>({
    default: 'newest'
})

const options = [
    { get label() { return localize("Newest first") }, value: 'newest' },
    { get label() { return localize("Oldest first") }, value: 'oldest' },
    { get label() { return localize("Name A-Z") }, value: 'name-asc' },
    { get label() { return localize("Name Z-A") }, value: 'name-desc' }
] as const

const currentLabel = computed(() => options.find(option => option.value === model.value)?.label)

const items = computed(() => options.map(option => ({
    label: option.label,
    icon: model.value === option.value ? 'solar:check-circle-linear' : undefined,
    onSelect: () => { model.value = option.value }
})))
</script>
