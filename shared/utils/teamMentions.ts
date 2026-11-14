const mentionPattern = /(^|[^\p{L}\p{N}_.@+-])@(?:\[((?:\\[\\\]]|[^\\\]\r\n]){1,50})\]|([\p{L}\p{N}_](?:[\p{L}\p{N}_.-]{0,48}[\p{L}\p{N}_])?))(?![\p{L}\p{N}_@]|[.-][\p{L}\p{N}_])/gu

export function teamMentionNames(body: string) {
    return new Set(teamMentionTokens(body).map(token => token.name.toLowerCase()))
}

export function teamMentionTokens(body: string) {
    return Array.from(body.matchAll(mentionPattern), match => ({
        start: match.index + match[1]!.length,
        end: match.index + match[0].length,
        name: (match[2] ?? match[3] ?? '').replace(/\\([\\\]])/g, '$1')
    }))
}

export function sameTeamMentions(previous: string, next: string) {
    const mentions = (text: string) => teamMentionTokens(text).map(token => text.slice(token.start, token.end))
    const initial = mentions(previous)
    const updated = mentions(next)
    return initial.length === updated.length && initial.every((mention, index) => mention === updated[index])
}

export function teamMentionQuery(body: string, caret: number) {
    const match = /(^|\s)@([\p{L}\p{M}\p{N}_.-]*)$/u.exec(body.slice(0, caret))
    if (!match || /^[\p{L}\p{M}\p{N}_@.-]/u.test(body.slice(caret))) return null
    return { start: caret - match[2]!.length - 1, query: match[2]! }
}

export function teamMentionText(username: string) {
    return /^[\p{L}\p{N}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_])?$/u.test(username)
        ? `@${username}`
        : `@[${username.replace(/[\\\]]/g, '\\$&')}]`
}
