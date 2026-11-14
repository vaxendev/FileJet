import 'dotenv/config'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { unzipSync } from 'fflate'
import pg from 'pg'

const base = process.env.FILEJET_TEST_URL || 'http://127.0.0.1:55322'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
const [owner, other, parent, child, file, nestedFile, note, nestedNote] = Array.from({ length: 8 }, randomUUID)
const storage = resolve('storage')
const fixture = resolve(storage, owner)
assert.equal(fixture, storage + sep + owner)
const bytes = Buffer.from('Hidden file fixture')
const sessionCookies = new Map()
const hiddenCookies = new Map()
const cookie = userId => {
    if (sessionCookies.has(userId)) return sessionCookies.get(userId)
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 3600000 })).toString('base64url')
    const value = 'filejet_session=' + payload + '.' + createHmac('sha256', process.env.AUTH_SECRET).update(payload).digest('base64url')
    sessionCookies.set(userId, value)
    return value
}
async function api(path, { auth = owner, method = 'GET', body, status = 200, origin } = {}) {
    const response = await fetch(base + path, {
        method, signal: AbortSignal.timeout(20000),
        headers: { ...(auth ? { Cookie: [cookie(auth), hiddenCookies.get(auth)].filter(Boolean).join('; ') } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) },
        body: body && JSON.stringify(body)
    })
    const buffer = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, status, method + ' ' + path + ': ' + buffer.toString().slice(0, 400))
    const grant = response.headers.getSetCookie().find(value => value.startsWith('filejet_hidden='))
    if (grant) hiddenCookies.set(auth, grant.split(';')[0])
    return {
        buffer, cache: response.headers.get('cache-control'),
        json: () => JSON.parse(buffer.toString())
    }
}
const hidden = (type, id, value, options = {}) =>
    api(`/api/items/${type}/${id}/hidden`, { method: 'PATCH', body: { hidden: value }, ...options })
const list = async path => (await api(path)).json()

await db.connect()
try {
    for (const id of [owner, other])
        await db.query('INSERT INTO users(id, username, password_hash, storage_used) VALUES ($1, $2, $3, 1000)',
            [id, 'qa_hidden_' + id, 'unused-fixture-password'])
    for (const [id, name, parentId] of [[parent, 'Project', null], [child, 'Private subfolder', parent]])
        await db.query('INSERT INTO folders(id, user_id, name, parent_folder_id) VALUES ($1,$2,$3,$4)', [id, owner, name, parentId])
    await mkdir(fixture, { recursive: true })
    for (const [id, name, folderId] of [[file, 'root.txt', null], [nestedFile, 'child.txt', child]]) {
        await writeFile(resolve(fixture, id), bytes)
        await db.query('INSERT INTO files(id,user_id,folder_id,name,original_name,mime_type,size,storage_key) VALUES($1,$2,$3,$4,$4,$5,$6,$7)',
            [id, owner, folderId, name, 'text/plain', bytes.length, owner + '/' + id])
    }
    for (const [id, title, folderId] of [[note, 'Root note', null], [nestedNote, 'Nested note', child]])
        await db.query('INSERT INTO notes(id,user_id,folder_id,title,content,size) VALUES($1,$2,$3,$4,$5,$6)',
            [id, owner, folderId, title, 'note text', 9])
    await db.query('INSERT INTO favorites(user_id,file_id) VALUES($1,$2)', [owner, file])
    await db.query('INSERT INTO favorites(user_id,note_id) VALUES($1,$2)', [owner, nestedNote])
    const links = {}
    for (const [type, id] of [['file', file], ['folder', parent], ['folder', child], ['note', nestedNote]]) {
        const token = randomUUID()
        await db.query('INSERT INTO shared_items(user_id,item_id,item_type,token) VALUES($1,$2,$3,$4)', [owner, id, type, token])
        links[id] = '/api/shared/' + token
    }

    await api('/api/items/hidden', { auth: null, status: 401 })
    await hidden('file', file, true, { auth: other, status: 404 })
    await hidden('file', file, true, { origin: 'https://foreign.example', status: 403 })
    await hidden('file', file, 'true', { status: 400 })
    assert.equal((await list('/api/notes')).notes.length, 2)
    assert.equal((await list('/api/favorites')).favorites.length, 2)
    const beforeZip = await api(links[parent] + '/download', { auth: null })
    assert.ok(Object.keys(unzipSync(beforeZip.buffer)).some(name => name.endsWith('/child.txt')))

    await hidden('file', file, true)
    await hidden('note', note, true)
    await hidden('folder', child, true)
    await api('/api/items/hidden', { status: 423 })
    await api('/api/files/' + file, { status: 423 })
    await api('/api/files/' + file + '/download', { method: 'HEAD', status: 423 })
    await api('/api/notes/' + nestedNote + '/download', { status: 423 })
    await api('/api/folders/' + child, { status: 423 })
    await api('/api/items/download', { method: 'POST', body: { items: [{ type: 'note', id: nestedNote }] }, status: 423 })
    await hidden('file', file, false, { status: 423 })
    const access = '/api/items/hidden/access'
    const password = 'hidden-fixture-password'
    assert.deepEqual(await list(access), { configured: false, expiresAt: null })
    await api(access, { method: 'POST', body: { setup: true, password, confirmPassword: 'mismatch' }, status: 400 })
    await api(access, { method: 'POST', body: { setup: true, password, confirmPassword: password } })
    assert.ok((await list(access)).expiresAt > Date.now())
    const sameAccountGrant = hiddenCookies.get(owner)
    sessionCookies.delete(owner)
    await api('/api/items/hidden', { status: 423 })
    assert.equal(hiddenCookies.get(owner), sameAccountGrant)
    await api(access, { method: 'POST', body: { password } })
    await hidden('folder', child, true)
    const hiddenList = await api('/api/items/hidden')
    assert.match(hiddenList.cache, /no-store/)
    assert.deepEqual(new Set(hiddenList.json().items.map(item => item.id)), new Set([file, note, child]))
    await api('/api/items/hidden', { auth: other, status: 423 })
    assert.deepEqual((await list('/api/files')).files, [])
    assert.deepEqual((await list('/api/notes')).notes, [])
    assert.deepEqual((await list('/api/favorites')).favorites, [])
    assert.ok(!(await list('/api/folders/tree')).folders.some(folder => folder.id === child))
    assert.deepEqual((await list('/api/folders/' + parent)).items, [])
    assert.ok((await list('/api/folders/' + child)).items.some(item => item.id === nestedFile))
    assert.ok((await list('/api/files/' + file)).hidden)
    assert.ok((await list('/api/shared/list')).every(item => item.itemId === parent))
    for (const id of [file, child, nestedNote]) await api(links[id], { auth: null, status: 404 })
    await api(links[file] + '/preview', { auth: null, status: 404 })
    await api(links[file] + '/download', { auth: null, method: 'HEAD', status: 404 })
    await api(links[parent] + '/contents?itemType=folder&itemId=' + child, { auth: null, status: 404 })
    await api(links[parent] + '/preview?itemType=file&itemId=' + nestedFile, { auth: null, status: 404 })
    await api('/api/shared', { method: 'POST', body: { itemId: nestedNote, itemType: 'note' }, status: 404 })
    const zip = await api(links[parent] + '/download', { auth: null })
    assert.deepEqual(Object.keys(unzipSync(zip.buffer)), ['Project/'])

    const trashed = (await api('/api/files/' + file, { method: 'DELETE' })).json()
    await api('/api/trash/' + trashed.trashIds[0], { method: 'PATCH' })
    assert.ok((await list('/api/files/' + file)).hidden)
    await hidden('file', file, false)
    await hidden('note', note, false)
    await hidden('folder', child, false)
    assert.deepEqual((await list('/api/items/hidden')).items, [])
    assert.equal((await list('/api/files')).files[0].id, file)
    assert.equal((await list('/api/notes')).notes.length, 2)
    assert.ok((await list('/api/favorites')).favorites.some(item => item.note_id === nestedNote))
    assert.deepEqual((await api(links[file] + '/download', { auth: null })).buffer, bytes)
    await api(links[nestedNote], { auth: null })
    assert.equal((await list('/api/folders/' + parent)).items[0].id, child)
    const grantBeforeChange = hiddenCookies.get(owner)
    await api(access, { method: 'DELETE' })
    await api('/api/items/hidden', { status: 423 })
    const newPassword = 'new-hidden-fixture-password'
    const passwordChange = { currentPassword: password, password: newPassword, confirmPassword: newPassword }
    await api(access, { method: 'PATCH', auth: null, status: 401, body: passwordChange })
    await api(access, { method: 'PATCH', origin: 'https://foreign.example', status: 403, body: passwordChange })
    await api(access, { method: 'PATCH', body: { ...passwordChange, currentPassword: 'incorrect-password' }, status: 401 })
    assert.deepEqual((await api(access, { method: 'PATCH', body: passwordChange })).json(), { configured: true, expiresAt: null })
    hiddenCookies.set(owner, grantBeforeChange)
    await api('/api/items/hidden', { status: 423 })
    await api(access, { method: 'POST', body: { password: newPassword } })
    assert.ok((await list(access)).expiresAt > Date.now())
    console.log('Hidden items integration passed: ownership, lists, nested shares, ZIP, safe restore and original location.')
} finally {
    try {
        await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[owner, other]])
        await rm(fixture, { recursive: true, force: true })
    } finally {
        await db.end()
    }
}
