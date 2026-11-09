const languages = ['en', 'tr', 'de']
const normalize = value => languages.includes(value) ? value : 'en'
export let language = normalize(document.cookie.split('; ').find(value => value.startsWith('filejet-locale='))?.split('=')[1])
let dictionaries = {}
export const languageTag = () => ({ en: 'en-US', tr: 'tr-TR', de: 'de-DE' })[language]
export const messageKey = source => {
    let hash = 2166136261
    for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619)
    return 'm' + (hash >>> 0).toString(16)
}
const interpolate = (source, params) => source.replace(/\{(p\d+|count)\}/g, (match, name) => String(params[name] ?? match))
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const t = (source, params = {}) => {
    const dictionary = dictionaries[language] || dictionaries.en || {}
    const key = messageKey(source)
    if (dictionary[key]) return interpolate(dictionary[key], params)
    if (dictionary[source]) return interpolate(dictionary[source], params)
    // Stored synchronization errors keep their original source copy and are translated when displayed.
    for (const [key, text] of Object.values(dictionaries).flatMap(value => Object.entries(value))) {
        if (source === text) return dictionary[key] || source
        const names = [...text.matchAll(/\{(p\d+|count)\}/g)].map(match => match[1])
        if (!names.length) continue
        const match = new RegExp('^' + text.split(/\{(?:p\d+|count)\}/g).map(escape).join('([\\s\\S]*?)') + '$').exec(source)
        if (match) return interpolate(dictionary[key] || text, Object.fromEntries(names.map((name, i) => [name, match[i + 1]])))
    }
    return interpolate(source, params)
}
export function translatePage() {
    document.documentElement.lang = language
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n)
    for (const element of document.querySelectorAll('[data-i18n-aria-label]')) element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel))
    const selector = document.getElementById('language')
    if (selector) selector.value = language
}
export function setLanguage(value) {
    language = normalize(value)
    document.cookie = `filejet-locale=${language}; Path=/; Max-Age=31536000; SameSite=Lax`
    translatePage()
    window.dispatchEvent(new Event('filejet-language-change'))
}
export const ready = Promise.all(languages.map(async code => {
    try {
        const response = await fetch(`/filejet-offline/locales/${code}.json`)
        if (!response.ok) throw Error('Locale unavailable')
        dictionaries[code] = await response.json()
    } catch { /* The original English copy is usable if cached dictionaries are unavailable. */ }
})).then(() => {
    translatePage()
    document.getElementById('language')?.addEventListener('change', event => setLanguage(event.target.value))
})
