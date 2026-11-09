import { localize } from './messages.ts'
export const accentColors = [
    { value: 'indigo', get label() { return localize("Indigo") }, primary: '#3c47be', accent: '#8b7cff', highlight: '#5a5aff' },
    { value: 'blue', get label() { return localize("Blue") }, primary: '#1d4ed8', accent: '#78afff', highlight: '#2563eb' },
    { value: 'violet', get label() { return localize("Violet") }, primary: '#6d28d9', accent: '#bd9aff', highlight: '#7c3aed' },
    { value: 'emerald', get label() { return localize("Emerald") }, primary: '#047857', accent: '#6cdbb0', highlight: '#047857' },
    { value: 'rose', get label() { return localize("Rose") }, primary: '#be123c', accent: '#ff93ae', highlight: '#e11d48' },
    { value: 'amber', get label() { return localize("Amber") }, primary: '#92400e', accent: '#f8c76a', highlight: '#b45309' }
] as const

export type AccentColor = typeof accentColors[number]['value']

export const getAccentColor = (value: AccentColor) => accentColors.find(color => color.value === value) ?? accentColors[0]
