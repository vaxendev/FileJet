const mentionPattern = /(^|[^\p{L}\p{N}_.@+-])@(?:\[((?:\\[\\\]]|[^\\\]\r\n]){1,50})\]|([\p{L}\p{N}_](?:[\p{L}\p{N}_.-]{0,48}[\p{L}\p{N}_])?))(?![\p{L}\p{N}_@]|[.-][\p{L}\p{N}_])/gu

export function teamMentionNames(body: string) {
    return new Set(Array.from(body.matchAll(mentionPattern), match => (match[2] ?? match[3] ?? '')
        .replace(/\\([\\\]])/g, '$1').toLowerCase()))
}

export function teamMentionText(username: string) {
    return /^[\p{L}\p{N}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_])?$/u.test(username)
        ? `@${username}`
        : `@[${username.replace(/[\\\]]/g, '\\$&')}]`
}
