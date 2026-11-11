<script setup lang="ts">
import type { NuxtError } from '#app'
import NuxtErrorPage from '#app/components/nuxt-error-page.vue'
import BrandMark from '~/components/ui/BrandMark.vue'

const props = defineProps<{ error: NuxtError }>()
const currentUser = useAuthUser()
const isNotFound = computed(() => props.error.statusCode === 404)
const heading = computed(() => localize('Page not found'))

useHead(() => isNotFound.value ? { title: `${heading.value} · FileJet` } : {})
</script>

<template>
    <main v-if="isNotFound" class="not-found" aria-labelledby="not-found-title">
        <section class="not-found-card">
            <div class="not-found-content">
                <div class="not-found-brand">
                    <BrandMark />
                    <span>FileJet</span>
                </div>

                <h1 id="not-found-title">{{ heading }}</h1>
                <p>{{ $msg('This address may have changed, or the page may have been removed.') }}</p>

                <NuxtLink
                    class="not-found-link"
                    :to="currentUser ? '/home' : '/login'"
                    external
                >
                    {{ currentUser ? $msg('Go to dashboard') : $msg('Go to login') }}
                    <Icon name="solar:arrow-right-linear" aria-hidden="true" />
                </NuxtLink>
            </div>

            <div class="not-found-art" aria-hidden="true">
                <div class="not-found-code">
                    <span>4</span>
                    <span class="not-found-zero">
                        <Icon name="solar:folder-with-files-linear" />
                    </span>
                    <span>4</span>
                </div>
            </div>
        </section>
    </main>
    <NuxtErrorPage v-else :error="error" />
</template>

<style scoped>
.not-found {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: clamp(1rem, 5vw, 4rem);
    background: var(--color-canvas);
    color: var(--color-foreground);
}

.not-found-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: min(100%, 59rem);
    overflow: hidden;
    border: 1px solid var(--color-control-border);
    border-radius: 1.5rem;
    background: var(--color-surface);
}

.not-found-content {
    padding: clamp(1.5rem, 5vw, 3.5rem);
}

.not-found-brand {
    display: flex;
    align-items: center;
    margin-bottom: clamp(1.25rem, 4vw, 3rem);
    font-size: 1.15rem;
    font-weight: 700;
}

.not-found-content h1 {
    font-size: clamp(2rem, 4vw, 3.25rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.05em;
    text-wrap: balance;
}

.not-found-content p {
    max-width: 32ch;
    margin-top: 1rem;
    color: var(--color-secondary);
    line-height: 1.65;
}

.not-found-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.75rem;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
}

.not-found-link:hover {
    background: color-mix(in srgb, var(--color-primary) 85%, black);
}

.not-found-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
}

.not-found-art {
    display: grid;
    min-height: 17rem;
    place-items: center;
    border-inline-start: 1px solid var(--color-control-border);
    background:
        radial-gradient(ellipse at center, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 70%),
        repeating-linear-gradient(0deg, transparent 0 31px, var(--color-divider) 31px 32px),
        repeating-linear-gradient(90deg, transparent 0 31px, var(--color-divider) 31px 32px),
        var(--color-canvas);
}

.not-found-code {
    display: flex;
    align-items: center;
    gap: 0.07em;
    color: var(--color-foreground);
    font-size: clamp(3.5rem, 10vw, 8rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.06em;
}

.not-found-zero {
    display: grid;
    width: 0.59em;
    height: 0.74em;
    place-items: center;
    border: 0.065em solid var(--color-accent);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-accent);
}

.not-found-zero .iconify {
    font-size: 0.33em;
}

@media (max-width: 680px) {
    .not-found-card {
        grid-template-columns: 1fr;
    }

    .not-found-art {
        grid-row: 1;
        min-height: 10rem;
        border-inline-start: 0;
        border-bottom: 1px solid var(--color-control-border);
    }
}
</style>
