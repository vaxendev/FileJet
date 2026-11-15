<template>
    <div class="view-switcher w-24 h-10 max-mobile:h-11 pointer-coarse:h-11 shrink-0 flex items-center
        justify-center bg-surface-hover p-0.75 gap-0.75 border border-divider rounded-lg">
        <UButton
            v-for="view in views"
            :key="view.value"
            type="button"
            :aria-label="view.label"
            :aria-pressed="modelValue === view.value"
            :color="modelValue === view.value ? 'primary' : 'neutral'"
            :variant="modelValue === view.value ? 'solid' : 'ghost'"
            :icon="view.icon"
            class="view-button h-full min-w-0 flex-1 justify-center rounded-md p-0"
            @click="emit('update:modelValue', view.value)"
        />
    </div>
</template>

<script setup lang="ts">
const views = [
    { value: 'grid', get label() { return localize("Grid view") }, icon: 'solar:widget-4-linear' },
    { value: 'list', get label() { return localize("List view") }, icon: 'solar:list-linear' }
] as const

defineProps<{
    modelValue: 'grid' | 'list'
}>()

const emit = defineEmits<{
    'update:modelValue': [value: 'grid' | 'list']
}>()
</script>
