<script setup lang="ts">
import { normalizeLocale, type FileJetLocale } from '~~/shared/utils/locale'
const { locale, setLocale } = useI18n()
const options = [
    { value: 'en' as const, label: 'English' },
    { value: 'tr' as const, label: 'Türkçe' },
    { value: 'de' as const, label: 'Deutsch' }
]
const selectedLocale = computed<FileJetLocale>({
    get: () => normalizeLocale(locale.value),
    set: value => { void setLocale(normalizeLocale(value)) }
})
</script>

<template>
    <FormSelect v-model="selectedLocale" :options="options" :label="$msg('Language')" class="language-selector max-w-full shrink-0">
        <template #selection="{ label }">
            <span class="flex items-center gap-1.5">
                <Icon name="solar:global-linear" size="17" aria-hidden="true" />
                <span class="text-sm font-medium">{{ label }}</span>
            </span>
        </template>
        <template #option="{ option, selected }">
            <span class="flex w-full items-center justify-between gap-6">
                <span :lang="option.value">{{ option.label }}</span>
                <Icon v-if="selected" name="solar:check-circle-linear" size="16" class="text-accent" aria-hidden="true" />
            </span>
        </template>
    </FormSelect>
</template>

<style scoped>
.language-selector :deep([role='combobox']) {
    width: 13rem;
    max-width: 100%;
    height: 2.75rem;
    min-height: 2.75rem;
    padding: 0 .65rem;
    gap: .5rem;
    border-color: var(--color-divider);
    border-radius: 10px;
    background: var(--color-control);
    color: var(--color-secondary);
}
.language-selector :deep([role='combobox']:hover) { background: var(--color-control); color: var(--color-foreground); }
.language-selector :deep([role='combobox']:focus) { outline: none; }
.language-selector :deep([role='combobox']:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 3px; }
.language-selector :deep(.form-select-menu) { padding: .375rem; border-radius: .875rem; background: var(--color-surface); }
.language-selector :deep([role='option'][aria-selected='true']) { background: color-mix(in srgb, var(--color-accent) 10%, transparent); color: var(--color-accent); }
</style>
