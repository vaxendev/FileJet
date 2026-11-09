import { localeTag, messageKey, normalizeLocale, type MessageParams, type MessageDescriptor } from '#shared/utils/locale.ts'
import { describeMessage } from '#shared/utils/messageDescriptor.ts'
import { messageCatalog } from '#shared/generated/messageCatalog.ts'

const activeApp = () => typeof tryUseNuxtApp === 'function' ? tryUseNuxtApp() : undefined
export const currentMessageLocale = () => normalizeLocale(activeApp()?.$i18n?.locale.value)
export const currentLocaleTag = () => localeTag(currentMessageLocale())
export const localizeItemType = (kind: string) => localize(({ file: 'File', folder: 'Folder', note: 'Note', inbox: 'Inbox', batch: 'Batch', item: 'Item' } as Record<string, string>)[kind] ?? kind)
export const localizeCount = (name: string, count: number) => {
    const i18n = activeApp()?.$i18n
    if (i18n) return i18n.t(`c_${name}`, { count: count.toLocaleString(currentLocaleTag()) }, count)
    const variants = messageCatalog.en?.[`c_${name}`]?.split(' | ')
    return (variants?.[count === 0 ? 0 : count === 1 ? 1 : 2] ?? String(count)).replaceAll('{count}', String(count))
}

// Source copy stays readable at call sites; stable keys are shared by Nuxt, errors and offline notes.
export const localize = (source: string | null | undefined, params: MessageParams = {}): string => {
    source = source ?? ''
    const i18n = activeApp()?.$i18n
    if (!i18n) {
        const descriptor = describeMessage(source)
        const text = descriptor ? messageCatalog.en?.[descriptor.key] ?? source : source
        return text.replace(/\{(p\d+|count)\}/g, (match, key) => String(params[key] ?? descriptor?.params[key] ?? match))
    }
    const key = messageKey(source)
    if (i18n.te(key, 'en')) return i18n.t(key, params)
    const descriptor = describeMessage(source)
    return descriptor ? i18n.t(descriptor.key, { ...descriptor.params, ...params }) : source
}

export const localizedDescriptor = (descriptor: MessageDescriptor | undefined, fallback: string) => {
    const i18n = activeApp()?.$i18n
    return descriptor ? i18n ? i18n.t(descriptor.key, descriptor.params) : localize(descriptor.key, descriptor.params) : fallback
}

export const resolveApiError = (error: any, fallback = 'The action could not be completed.') => {
    const descriptor = error?.data?.data?.i18n ?? error?.data?.i18n
    return localizedDescriptor(descriptor, localize(error?.data?.message || error?.message || fallback))
}
