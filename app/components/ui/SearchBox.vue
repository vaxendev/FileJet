<template>
    <UInput
        class="search-box w-128 min-w-0"
        type="search"
        size="lg"
        icon="solar:magnifer-linear"
        :aria-label="placeholder || $msg('Search')"
        :model-value="modelValue"
        :placeholder="placeholder || $msg('Search...')"
        :ui="{ base: 'h-10 rounded-lg bg-surface ring-divider max-mobile:h-11 pointer-coarse:h-11', leadingIcon: 'text-muted' }"
        @update:model-value="emit('update:modelValue', String($event ?? ''))"
    />
</template>

<script setup lang="ts">
defineProps<{
    modelValue: string
    placeholder?: string
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string]
}>()
</script>
