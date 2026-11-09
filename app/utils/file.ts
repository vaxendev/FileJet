import { currentLocaleTag } from './messages.ts'
export const canCopyFile = (mimeType: string | null | undefined, fileName = '') => {
    if (fileName.trim().toLowerCase().endsWith('.exe')) return false

    return /^(text|image)\//.test(mimeType?.toLowerCase() ?? '')
}

export const getFileIcon = (mimeType: string | null, fileName: string = '') => {
    const name = fileName.toLowerCase()

    if (name.endsWith('.exe')) {
        return 'solar:file-bold'
    }

    if (name.endsWith('.txt')) {
        return 'solar:document-text-bold'
    }

    if (name.endsWith('.md')) {
        return 'solar:code-file-bold'
    }

    if (!mimeType) return 'solar:file-bold'

    if (mimeType === 'application/pdf') {
        return 'solar:file-text-bold'
    }

    if (mimeType.startsWith('image/')) {
        return 'solar:gallery-bold'
    }

    if (mimeType.startsWith('video/')) {
        return 'solar:video-frame-bold'
    }

    if (mimeType.startsWith('audio/')) {
        return 'solar:music-note-bold'
    }

    if (mimeType === 'text/html') {
        return 'solar:code-file-bold'
    }

    if (mimeType === 'application/zip' || mimeType === 'application/x-rar-compressed') {
        return 'solar:archive-bold'
    }

    return 'solar:file-bold'
}

export const getFileType = (fileName: string) => {
    const extension = fileName.split('.').pop()

    return extension?.toUpperCase() ?? 'FILE'
}

export const getFileCategory = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()

    if (!extension) {
        return 'All'
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
        return 'Images'
    }

    if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
        return 'Documents'
    }

    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
        return 'Videos'
    }

    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'Compressed'
    }

    return 'Others'
}

export const formatFileSize = (bytes: number | string) => {
    const size = Number(bytes)
    const unit = size < 1024 ? 0 : size < 1024 ** 2 ? 1 : size < 1024 ** 3 ? 2 : 3
    const amount = (size / 1024 ** unit).toLocaleString(currentLocaleTag(), {
        minimumFractionDigits: unit ? 1 : 0,
        maximumFractionDigits: unit ? 1 : 0
    })
    return `${amount} ${['B', 'KB', 'MB', 'GB'][unit]}`
}

export const formatFileTime = (date: string | null) => {
    if (!date) return ''

    return new Date(date).toLocaleDateString(currentLocaleTag())
}
