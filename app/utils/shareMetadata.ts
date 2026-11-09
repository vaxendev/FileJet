import { localize, localizeItemType } from './messages.ts'
export interface SocialShareItem {
    type: 'file' | 'folder' | 'note'
    isPasswordProtected: boolean
    item: {
        name?: string
        original_name?: string | null
        title?: string
        mime_type?: string | null
        size?: string | null
    }
}

const supportedImages = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type ImageMime = typeof supportedImages[number]
const isSupportedImage = (mime: string): mime is ImageMime => supportedImages.some(value => value === mime)
const cleanName = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim().slice(0, 240) || ''

const readableSize = (value: string | null | undefined) => {
    const bytes = Number(value)
    if (!value || !Number.isFinite(bytes) || bytes < 0) return ''
    const unit = Math.min(3, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)))
    const amount = bytes / 1024 ** unit
    return `${Number(amount.toFixed(unit ? 1 : 0))} ${['B', 'KB', 'MB', 'GB'][unit]}`
}

export function createShareMetadata(input: {
    origin: string
    token: string
    share: SocialShareItem | null | undefined
    passwordRequired?: boolean
    protectedName?: string | null
    protectedType?: 'file' | 'folder' | 'note'
    unavailable?: boolean
}) {
    const url = new URL(`/shared/${encodeURIComponent(input.token)}`, input.origin).href
    const base = {
        url,
        get title() { return localize("Shared with FileJet") },
        get description() { return localize("Open this link to view a file, folder, or note shared with FileJet.") },
        image: undefined as string | undefined,
        imageType: undefined as ImageMime | undefined,
        imageAlt: undefined as string | undefined,
        card: 'summary' as 'summary' | 'summary_large_image'
    }

    if (input.unavailable) {
        return { ...base, get title() { return localize("Share unavailable · FileJet") }, get description() { return localize("This share link is invalid, expired, or no longer available.") } }
    }
    // Item names are public; protected image pixels and note contents stay behind the password.
    if (input.passwordRequired || input.share?.isPasswordProtected) {
        const share = input.share
        const name = cleanName(input.protectedName) || cleanName(share?.type === 'note'
            ? share.item.title : share?.item.original_name || share?.item.name)
        const kind = input.protectedType || share?.type || 'item'
        return {
            ...base,
            title: name || localize("Password-protected share · FileJet"),
            get description() { return localize("🔒 Password-protected {p0}. Enter the link password to access it.", { p0: localizeItemType(kind) }) }
        }
    }
    if (!input.share) return base

    const { type, item } = input.share
    const name = cleanName(type === 'note' ? item.title : item.original_name || item.name)
    const mime = item.mime_type?.toLowerCase() ?? ''
    const kind = type === 'folder' ? 'Folder' : type === 'note' ? 'Note'
        : isSupportedImage(mime) ? 'Image' : mime.startsWith('video/') ? 'Video'
        : mime === 'application/pdf' ? 'PDF' : 'File'
    const size = type === 'folder' ? '' : readableSize(item.size)
    const metadata = {
        ...base,
        title: name || localize("Shared {p0} · FileJet", { p0: localizeItemType(type) }),
        description: [localize(kind), size, localize("Shared with FileJet")].filter(Boolean).join(' · ')
    }

    if (type === 'file' && isSupportedImage(mime)) {
        metadata.image = new URL(`/api/shared/${encodeURIComponent(input.token)}/preview`, input.origin).href
        metadata.imageType = mime
        metadata.imageAlt = name || localize("Shared image")
        metadata.card = 'summary_large_image'
    }
    return metadata
}
