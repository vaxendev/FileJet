import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'
import { createI18n } from 'vue-i18n'
import { normalizeLocale, messageKey, localeTag } from '../shared/utils/locale.ts'
import { describeMessage, normalizeMessageDescriptor } from '../shared/utils/messageDescriptor.ts'
import { throwError } from '../server/utils/error.ts'
import { loginSchema } from '../shared/schemas/auth.ts'
import { localize, localizeCount, resolveApiError, localizedDescriptor } from '../app/utils/messages.ts'
import { formatFileSize } from '../app/utils/file.ts'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const catalogs = Object.fromEntries(['en','tr','de'].map(code => [code, JSON.parse(read(`i18n/locales/${code}.json`))]))
const params = text => [...text.matchAll(/\{(p\d+|count)\}/g)].map(match => match[1]).sort()

test('every literal UI, validation and offline translation call has a catalog entry', () => {
    const root = fileURLToPath(new URL('../', import.meta.url))
    const files = directory => readdirSync(directory, {withFileTypes:true}).flatMap(file => file.isDirectory() ? files(path.join(directory,file.name)) : [path.join(directory,file.name)])
    const scan = (source, file) => {
        const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
        const visit = node => {
            if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
                const name = node.expression.getText(ast), source = node.arguments[0].text
                if (['localize','$msg','t','messageKey'].includes(name)) assert.ok(catalogs.en[messageKey(source)], `${file}: ${source}`)
                if (['localizeCount','$countMsg'].includes(name)) assert.ok(catalogs.en[`c_${source}`], `${file}: count ${source}`)
            }
            ts.forEachChild(node, visit)
        }
        visit(ast)
    }
    for (const file of [...files(path.join(root,'app')), ...files(path.join(root,'shared/schemas')), path.join(root,'public/filejet-offline/editor.js')].filter(file=>/\.(vue|ts|js)$/.test(file))) {
        const source = readFileSync(file, 'utf8')
        if (!file.endsWith('.vue')) { scan(source,file); continue }
        const {descriptor} = parseSfc(source)
        for (const script of [descriptor.script,descriptor.scriptSetup].filter(Boolean)) scan(script.content,file)
        const visit = node => {
            if (node.type === 5) scan(node.content.content,file)
            for (const prop of node.props ?? []) if (prop.type === 7 && prop.exp && prop.name !== 'for') scan(prop.exp.content,file)
            for (const child of node.children ?? []) visit(child)
        }
        if (descriptor.template) visit(parseTemplate(descriptor.template.content))
    }
})

test('all languages have identical keys and placeholders; generated offline assets match', () => {
    for (const code of ['en','tr','de']) {
        assert.deepEqual(Object.keys(catalogs[code]).sort(), Object.keys(catalogs.en).sort())
        for (const [key, source] of Object.entries(catalogs.en)) assert.deepEqual(params(catalogs[code][key]), params(source), `${code}: ${source}`)
        assert.deepEqual(JSON.parse(read(`public/filejet-offline/locales/${code}.json`)), catalogs[code])
    }
})

test('missing, malformed and unsupported locale preferences always use English', () => {
    for (const value of [undefined, null, '', 'fr', 'tr-TR', '../../tr', {locale:'tr'}]) assert.equal(normalizeLocale(value), 'en')
    for (const value of ['en','tr','de']) assert.equal(normalizeLocale(value), value)
    assert.equal(localeTag('de'), 'de-DE')
})

test('all catalogs compile; live changes translate labels, plural counts and errors without changing content', () => {
    const errors = []
    const instance = createI18n({ legacy:false, locale:'en', fallbackLocale:'en', messages:catalogs, onError:error=>errors.push(error) })
    globalThis.tryUseNuxtApp = () => ({ $i18n: instance.global })
    try {
        for (const code of ['en','tr','de']) {
            instance.global.locale.value = code
            for (const key of Object.keys(catalogs[code])) instance.global.t(key, { p0:'sample',p1:'sample',p2:'sample',p3:'sample',p4:'sample',count:2 })
            assert.equal(localize('Save'), catalogs[code][messageKey('Save')])
            assert.equal(localize('my report Türkçe.md'), 'my report Türkçe.md')
            assert.equal(localizeCount('filesSelected', 2).includes('2'), true)
            assert.notEqual(localizeCount('filesSelected', 1), localizeCount('filesSelected', 2))
            assert.equal(localizedDescriptor(describeMessage('Preferences saved.'), 'legacy'), catalogs[code][messageKey('Preferences saved.')])
        }
        instance.global.locale.value = 'de'
        assert.equal(formatFileSize(1536), '1,5 KB')
        instance.global.locale.value = 'en'
        assert.equal(formatFileSize(1536), '1.5 KB')
        assert.deepEqual(errors, [])
    } finally { delete globalThis.tryUseNuxtApp }
})

test('API errors preserve status, source message and existing data while exposing reusable translation metadata', () => {
    let result
    try { throwError(409, 'A file with this name already exists.', { data:{ reason:'duplicate' } }) } catch(error) { result = error }
    assert.equal(result.statusCode, 409)
    assert.equal(result.message, 'A file with this name already exists.')
    assert.equal(result.data.reason, 'duplicate')
    assert.equal(result.data.i18n.key, messageKey(result.message))
    assert.equal(resolveApiError({ data: { data: result.data } }), result.message)
    const invalid = loginSchema.safeParse({ username:'x', password:'x' })
    assert.equal(invalid.success, false)
    const validationKey = invalid.error.issues[0].message
    assert.equal(validationKey, messageKey('Username must contain at least 3 characters.'))
    try { throwError(400, validationKey) } catch(error) { assert.equal(error.message, 'Username must contain at least 3 characters.') }
    assert.equal(normalizeMessageDescriptor({key:'unknown',params:{}}), undefined)
    assert.equal(normalizeMessageDescriptor({key:validationKey,params:{p0:{}}}), undefined)
})
