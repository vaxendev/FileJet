import { LOCALE_COOKIE, normalizeLocale, type FileJetLocale } from '~~/shared/utils/locale'
import { localize, localizeCount } from '~/utils/messages'

export default defineNuxtPlugin({
    name: 'filejet-locale',
    dependsOn: ['i18n:plugin'],
    async setup(app) {
        const preference = useCookie<FileJetLocale>(LOCALE_COOKIE, {
            default: () => 'en', path: '/', maxAge: 365 * 86400, sameSite: 'lax'
        })
        const locale = app.$i18n.locale
        const initial = normalizeLocale(preference.value)
        useHead(() => ({ htmlAttrs: { lang: locale.value } }))
        watch(locale, value => { preference.value = normalizeLocale(value) })
        await app.$i18n.setLocale(initial)
        return { provide: { msg: localize, countMsg: localizeCount } }
    }
})
