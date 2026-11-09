import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    devtools: {
        enabled: true
    },

    modules: ['@nuxt/icon', '@nuxtjs/i18n'],

    i18n: {
        defaultLocale: 'en',
        strategy: 'no_prefix',
        detectBrowserLanguage: false,
        locales: [
            { code: 'en', language: 'en-US', file: 'en.json' },
            { code: 'tr', language: 'tr-TR', file: 'tr.json' },
            { code: 'de', language: 'de-DE', file: 'de.json' }
        ]
    },

    css: [
        '~/assets/css/layers.css',
        '~/assets/css/tailwind.css',
        '~/assets/css/inbox.css'
    ],

    app: {
        head: {
            viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
            style: [{ key: 'css-layer-order', innerHTML: '@layer theme, base, components, utilities;' }]
        }
    },

    vite: {
        plugins: [tailwindcss()],
        esbuild: {
            target: 'es2020'
        }
    },

    nitro: {
        // Keep Prisma's import.meta.url bound to the Node entrypoint on Windows too.
        inlineDynamicImports: true,
        rollupConfig: {
            plugins: [{
                name: 'filejet-native-entry-url',
                renderChunk: {
                    order: 'post',
                    handler(code, chunk) {
                        // I18n's raw dictionary marker makes Nitro use a POSIX-only URL stub
                        // when all chunks are inlined. Prisma requires the real Node file URL.
                        const stub = 'globalThis._importMeta_={url:"file:///_entry.js"'
                        if (!chunk.isEntry || !code.includes(stub)) return null
                        return { code: code.replace(stub, 'globalThis._importMeta_={url:import.meta.url'), map: null }
                    }
                }
            }]
        },
        esbuild: {
            options: {
                target: 'es2020'
            }
        }
    },

    imports: {
        dirs: [
            'composables',
            'composables/**',
            'utils',
            'utils/**',
            'shared/schemas',
            'shared/schemas/**'
        ]
    },

    components: [
        {
            path: '~/components',
            pathPrefix: false
        }
    ]
})

