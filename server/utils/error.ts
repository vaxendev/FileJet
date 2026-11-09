import { createError, type H3Error } from 'h3'
import { describeMessage } from '../../shared/utils/messageDescriptor.ts'
import { messageCatalog } from '../../shared/generated/messageCatalog.ts'

export function throwError(
    code: number,
    message: string,
    options: Pick<H3Error, 'data' | 'statusMessage'> = {}
): never {
    const descriptor = describeMessage(message)
    const source = descriptor && messageCatalog.en?.[descriptor.key]
    const englishMessage = source ? source.replace(/\{(p\d+|count)\}/g, (match, key) => String(descriptor!.params[key] ?? match)) : message
    throw createError({
        statusCode: code,
        message: englishMessage,
        ...options,
        data: { ...(options.data && typeof options.data === 'object' ? options.data : {}), i18n: descriptor }
    })
}
