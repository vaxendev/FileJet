import { messageCatalog } from '../generated/messageCatalog.ts'
import type { MessageDescriptor } from './locale.ts'
const { en, tr, de } = messageCatalog as { en: Record<string, string>; tr: Record<string, string>; de: Record<string, string> }

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const dictionaries = [en, tr, de] as Record<string, string>[]
const patterns = dictionaries.flatMap(dictionary => Object.entries(dictionary).map(([key, text]) => {
    const names = [...text.matchAll(/\{(p\d+|count)\}/g)].map(match => match[1]!)
    const parts = text.split(/\{(?:p\d+|count)\}/g)
    return { key, text, names, pattern: names.length ? new RegExp(`^${parts.map(escape).join('([\\s\\S]*?)')}$`) : null }
}))
const exact = new Map(patterns.map(item => [item.text, item.key]))

export const describeMessage = (value: string): MessageDescriptor | undefined => {
    const exactKey = exact.get(value)
    if (exactKey) return { key: exactKey, params: {} }
    if (Object.hasOwn(en, value)) return { key: value, params: {} }
    for (const item of patterns) {
        const match = item.pattern?.exec(value)
        if (match) return { key: item.key, params: Object.fromEntries(item.names.map((name, index) => [name, match[index + 1]!])) }
    }
}

export const normalizeMessageDescriptor = (value: unknown): MessageDescriptor | undefined => {
    if (!value || typeof value !== 'object') return
    const item = value as Partial<MessageDescriptor>
    if (typeof item.key !== 'string' || !Object.hasOwn(en, item.key) || !item.params || typeof item.params !== 'object' || Array.isArray(item.params)) return
    const params = Object.entries(item.params)
    if (params.length > 20 || params.some(([key, entry]) => !/^(p\d+|count)$/.test(key) || !['string', 'number'].includes(typeof entry))) return
    return { key: item.key, params: Object.fromEntries(params) }
}
