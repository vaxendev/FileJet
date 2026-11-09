<script setup lang="ts">
import { normalizeLocale } from '~~/shared/utils/locale'
const { locale, setLocale } = useI18n()
const change = (event: Event) => setLocale(normalizeLocale((event.target as HTMLSelectElement).value))
</script>

<template>
    <select :value="locale" :aria-label="$msg('Language')" class="language-selector h-9 min-w-0 max-w-28 cursor-pointer rounded-lg border border-control-border bg-control px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent" @change="change">
        <option value="en" lang="en">English</option>
        <option value="tr" lang="tr">Türkçe</option>
        <option value="de" lang="de">Deutsch</option>
    </select>
</template>
