export const supportedLocales = ['en', 'tr', 'de'] as const
export type FileJetLocale = typeof supportedLocales[number]
export type MessageParams = Record<string, string | number>
export interface MessageDescriptor { key: string; params: MessageParams }
export const LOCALE_COOKIE = 'filejet-locale'
export const normalizeLocale = (value: unknown): FileJetLocale =>
    supportedLocales.includes(value as FileJetLocale) ? value as FileJetLocale : 'en'
export const messageKey = (source: string) => {
    let hash = 2166136261
    for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619)
    return `m${(hash >>> 0).toString(16)}`
}
export const localeTag = (value: unknown) => ({ en: 'en-US', tr: 'tr-TR', de: 'de-DE' })[normalizeLocale(value)]
