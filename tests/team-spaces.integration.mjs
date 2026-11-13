import 'dotenv/config'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import pg from 'pg'

const base = process.env.FILEJET_TEST_URL || 'http://127.0.0.1:3022'
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
const [owner, viewer, uploader, editor, outsider] = Array.from({ length: 5 }, randomUUID)
const users = [owner, viewer, uploader, editor, outsider]
const username = id => 'qa_teams_' + id
const bytes = Buffer.from('FileJet team integration fixture')
const storage = resolve('storage')

function cookie(userId) {
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 3600000 })).toString('base64url')
    const signature = createHmac('sha256', process.env.AUTH_SECRET).update(payload).digest('base64url')
    return 'filejet_session=' + payload + '.' + signature
}

async function api(path, { auth = owner, method = 'GET', status = 200, body, headers = {} } = {}) {
    const multipart = body instanceof FormData
    const response = await fetch(base + path, {
        method,
        headers: {
            ...(auth ? { Cookie: cookie(auth) } : {}),
            ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        body: multipart ? body : body && JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
    })
    const data = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, status, method + ' ' + path + ': ' + data.toString().slice(0, 350))
    return { data, headers: response.headers, json: () => JSON.parse(data) }
}

function fileForm(name, content = bytes) {
    const form = new FormData()
    form.append('files', new Blob([content], { type: 'text/plain' }), name)
    return form
}

await db.connect()
try {
    for (const id of users) {
        await db.query(
            'INSERT INTO users(id,username,password_hash,storage_limit,storage_used) VALUES($1,$2,$3,1048576,0)',
            [id, username(id), 'unused-fixture-password'],
        )
    }
    const privateFolder = randomUUID()
    await db.query('INSERT INTO folders(id,user_id,name) VALUES($1,$2,$3)', [privateFolder, owner, 'Personal folder'])
    const teams = '/api/teams'
    const teamBody = { name: 'Shared project', description: 'Team permission fixture' }
    await api(teams, { auth: null, status: 401 })
    await api(teams, { method: 'POST', auth: null, body: teamBody, status: 401 })
    await api(teams, { method: 'POST', body: teamBody, headers: { Origin: 'https://foreign.example' }, status: 403 })
    const { id } = (await api(teams, { method: 'POST', body: teamBody, status: 201 })).json()
    const team = teams + '/' + id
    const chat = team + '/messages'
    const root = (await api(team)).json().folderId
    const publicName = 'Joinable project ' + id
    const otherTeam = (await api(teams, { method: 'POST', body: { name: publicName, isPublic: true }, status: 201 })).json()
    const other = teams + '/' + otherTeam.id
    const otherRoot = (await api(other)).json().folderId
    await api(team, { auth: outsider, status: 404 })
    await api(chat, { auth: null, status: 401 })
    await api(chat, { auth: outsider, status: 404 })
    assert.deepEqual((await api(teams, { auth: outsider })).json().teams, [])
    const directory = teams + '/public?q=' + encodeURIComponent(publicName)
    const publicJoin = teams + '/join/' + otherTeam.id
    const privateJoin = teams + '/join/'
    const initialPrivate = (await api(team)).json()
    assert.equal(initialPrivate.isPublic, false)
    assert.equal(initialPrivate.hasJoinPassword, false)
    assert.equal(initialPrivate.inviteToken, null)
    await api(team + '/invite', { method: 'PUT', status: 400 })
    await api(privateJoin + id, { auth: outsider, status: 404 })
    await api(directory, { auth: null, status: 401 })
    const discovery = (await api(directory, { auth: outsider })).json()
    assert.deepEqual(discovery.teams.map(entry => [entry.id, entry.isMember]), [[otherTeam.id, false]])
    assert.equal(discovery.totalPages, 1)
    assert.deepEqual((await api(teams + '/public?q=' + encodeURIComponent(teamBody.name), { auth: outsider })).json().teams, [])
    assert.deepEqual((await api(teams + '/public?q=%25', { auth: outsider })).json().teams, [])
    await api(other, { auth: outsider, status: 404 })
    await api(publicJoin, { auth: null, status: 401 })
    assert.deepEqual((await api(publicJoin, { auth: outsider })).json(), {
        teamId: null, name: publicName, requiresPassword: false
    })
    await api(publicJoin, {
        auth: outsider, method: 'POST', status: 403, body: {}, headers: { Origin: 'https://foreign.example' }
    })
    const publicToken = (await api(other + '/invite', { method: 'PUT' })).json().inviteToken
    const publicInvitation = privateJoin + publicToken
    await api(other + '/members', { method: 'POST', body: { username: username(outsider), role: 'EDITOR' } })
    assert.equal((await api(teams, { auth: outsider })).json().invitations[0].role, 'EDITOR')
    assert.equal((await api(publicInvitation, { auth: outsider })).json().requiresPassword, false)
    const joined = await Promise.all([publicJoin, publicInvitation].map(path => api(path, {
        auth: outsider, method: 'POST', body: { role: 'EDITOR' }
    })))
    assert.ok(joined.every(response => response.json().teamId === otherTeam.id))
    const outsiderDetails = (await api(other, { auth: outsider })).json()
    assert.equal(outsiderDetails.role, 'VIEWER')
    assert.equal('inviteToken' in outsiderDetails, false)
    assert.equal('invitations' in outsiderDetails, false)
    assert.deepEqual((await api(teams, { auth: outsider })).json().invitations, [])
    assert.equal('join_password_hash' in outsiderDetails, false)
    await api(other + '/invite', { auth: outsider, method: 'PUT', status: 403 })
    await api(other + '/invite', { auth: outsider, method: 'DELETE', status: 403 })
    assert.equal((await api(directory, { auth: outsider })).json().teams[0].isMember, true)

    const password = 'Private space passphrase'
    const changedPassword = 'Private space replacement'
    const makePrivate = { name: publicName, isPublic: false, password }
    await api(other, { method: 'PATCH', body: { ...makePrivate, password: 'short' }, status: 400 })
    await api(other, { method: 'PATCH', body: { ...makePrivate, isPublic: 'false' }, status: 400 })
    await api(other, { method: 'PATCH', body: makePrivate })
    await api(publicInvitation, { auth: viewer, status: 404 })
    await api(publicJoin, { auth: viewer, status: 404 })
    assert.deepEqual((await api(directory, { auth: outsider })).json().teams, [])
    assert.equal((await api(other, { auth: outsider })).json().role, 'VIEWER')
    const row = (await db.query('SELECT join_password_hash FROM team_spaces WHERE id=$1', [otherTeam.id])).rows[0]
    assert.match(row.join_password_hash, /^\$argon2id\$/)
    const first = (await api(other + '/invite', { method: 'PUT' })).json().inviteToken
    assert.match(first, /^[A-Za-z0-9_-]{43}$/)
    assert.equal((await api(other)).json().inviteToken, first)
    assert.deepEqual((await api(privateJoin + first, { auth: viewer })).json(), {
        teamId: null, name: null, requiresPassword: true
    })
    await api(privateJoin + first, { auth: viewer, method: 'POST', body: {}, status: 400 })
    await api(privateJoin + first, { auth: viewer, method: 'POST', body: { password: 'wrong' }, status: 403 })
    await api(other, { auth: viewer, status: 404 })
    assert.equal((await api(privateJoin + first, { auth: viewer, method: 'POST', body: { password } })).json().teamId, otherTeam.id)
    assert.equal((await api(other, { auth: viewer })).json().role, 'VIEWER')
    await api(other + '/members/' + viewer, { method: 'DELETE' })
    await api(other, { method: 'PATCH', body: { ...makePrivate, password: changedPassword } })
    await api(privateJoin + first, { auth: viewer, method: 'POST', body: { password }, status: 403 })
    const second = (await api(other + '/invite', { method: 'PUT' })).json().inviteToken
    assert.notEqual(second, first)
    await api(privateJoin + first, { auth: viewer, method: 'POST', body: { password: changedPassword }, status: 404 })
    await api(privateJoin + second, { auth: viewer, method: 'POST', body: { password: changedPassword } })
    await api(other + '/invite', { method: 'DELETE' })
    await api(privateJoin + second, { auth: uploader, status: 404 })
    assert.equal((await api(other, { auth: viewer })).json().role, 'VIEWER')
    await api(other + '/members/' + viewer, { method: 'DELETE' })

    const invitations = teams + '/invitations/'
    const outsiderInvite = { username: username(outsider), role: 'VIEWER' }
    await api(team + '/members', { method: 'POST', body: outsiderInvite })
    const revokedId = (await api(teams, { auth: outsider })).json().invitations[0].id
    await api(invitations + revokedId, { method: 'DELETE', auth: viewer, status: 404 })
    await api(invitations + revokedId, { method: 'DELETE' })
    await api(team + '/members', { method: 'POST', body: outsiderInvite })
    const declinedId = (await api(teams, { auth: outsider })).json().invitations[0].id
    assert.notEqual(declinedId, revokedId)
    await api(invitations + revokedId, { method: 'POST', auth: outsider, status: 404 })
    await api(invitations + declinedId, { method: 'DELETE', auth: outsider })
    const afterDecline = (await api(teams, { auth: outsider })).json()
    assert.deepEqual(afterDecline.invitations, [])
    assert.ok(afterDecline.teams.every(entry => entry.id !== id))
    await api(team, { auth: outsider, status: 404 })

    for (const [auth, role] of [[viewer, 'VIEWER'], [uploader, 'UPLOADER'], [editor, 'EDITOR']]) {
        await api(team + '/members', { method: 'POST', body: { username: username(auth), role } })
        await api(team + '/members', { method: 'POST', body: { username: username(auth), role: 'EDITOR' }, status: 409 })
        await api(team, { auth, status: 404 })
        await api(chat, { auth, status: 404 })
        const pending = (await api(teams, { auth })).json()
        assert.deepEqual(pending.teams, [])
        const [invite] = pending.invitations
        assert.deepEqual(pending.invitations, [{ id: invite.id, role, teamName: teamBody.name, ownerName: username(owner) }])
        if (auth === viewer) {
            const page = (await api('/teams', { auth })).data.toString()
            assert.match(page, /<h2[^>]*>Team invitations<\/h2>/)
            assert.ok(!page.includes('href="/teams/' + id + '"'))
        }
        const ownerView = (await api(team)).json()
        assert.ok(!ownerView.members.some(member => member.id === auth))
        assert.deepEqual(ownerView.invitations, [{ id: invite.id, username: username(auth), role }])
        assert.deepEqual((await api(teams, { auth: outsider })).json().invitations, [])
        await api(invitations + invite.id, { method: 'POST', auth: outsider, status: 404 })
        await api(invitations + invite.id, { method: 'POST', status: 404 })
        await api(invitations + invite.id, { method: 'POST', auth, status: 403, headers: { Origin: 'https://foreign.example' } })
        assert.equal((await api(invitations + invite.id, { method: 'POST', auth, body: { role: 'OWNER' } })).json().teamId, id)
        assert.equal((await api(team, { auth })).json().role, role)
        const joinedTeamList = (await api(teams, { auth })).json()
        assert.equal(joinedTeamList.teams[0].id, id)
        assert.deepEqual(joinedTeamList.invitations, [])
        if (auth === viewer) {
            const page = (await api('/teams', { auth })).data.toString()
            assert.doesNotMatch(page, /<h2[^>]*>Team invitations<\/h2>/)
            assert.ok(page.includes('href="/teams/' + id + '"'))
        }
    }
    await api(team + '/members', { method: 'POST', body: { username: username(owner), role: 'EDITOR' }, status: 409 })
    await api(team + '/members/' + owner, { method: 'PATCH', body: { role: 'VIEWER' }, status: 400 })

    assert.deepEqual((await api(chat, { auth: viewer })).json(), { messages: [], hasMore: false, pinned: [], unreadCount: 0 })
    const firstMessage = { requestId: randomUUID(), message: '  Discuss <b>the plan</b>\nnext week.  ' }
    await api(chat, { auth: outsider, method: 'POST', body: firstMessage, status: 404 })
    await api(chat, { auth: viewer, method: 'POST', body: firstMessage, status: 403, headers: { Origin: 'https://foreign.example' } })
    for (const invalidMessage of ['', '   ', 'a'.repeat(2001), 'null\0byte']) {
        await api(chat, { auth: viewer, method: 'POST', body: { ...firstMessage, message: invalidMessage }, status: 400 })
    }
    await api(chat, { auth: viewer, method: 'POST', body: { ...firstMessage, requestId: [firstMessage.requestId] }, status: 400 })
    const sent = await Promise.all([1, 2].map(() => api(chat, {
        auth: viewer, method: 'POST', body: { ...firstMessage, authorId: owner }
    })))
    const firstSaved = sent[0].json().message
    assert.deepEqual(sent[1].json().message, firstSaved)
    assert.equal(firstSaved.authorId, viewer)
    assert.equal(firstSaved.authorName, username(viewer))
    assert.equal(firstSaved.body, firstMessage.message.trim())
    await api(chat, { auth: editor, method: 'POST', body: firstMessage, status: 409 })
    await api(chat, { auth: viewer, method: 'POST', body: { ...firstMessage, message: 'Changed retry' }, status: 409 })
    assert.deepEqual((await api(chat, { auth: editor })).json().messages, [firstSaved])
    assert.deepEqual((await api(other + '/messages')).json().messages, [])
    for (const query of ['before=0', 'after=9223372036854775808', 'before=1&after=2', 'after=1&after=2']) {
        await api(chat + '?' + query, { status: 400 })
    }
    await db.query(
        "INSERT INTO team_messages(team_id,author_id,request_id,body) SELECT $1,$2,gen_random_uuid(),'Message ' || n FROM generate_series(1,52) AS n",
        [id, owner]
    )
    const latestMessages = (await api(chat)).json()
    assert.equal(latestMessages.messages.length, 50)
    assert.equal(latestMessages.messages[0].body, 'Message 3')
    assert.equal(latestMessages.messages.at(-1).body, 'Message 52')
    assert.equal(latestMessages.hasMore, true)
    const olderMessages = (await api(chat + '?before=' + latestMessages.messages[0].id)).json()
    assert.deepEqual(olderMessages.messages.map(message => message.body), [firstSaved.body, 'Message 1', 'Message 2'])
    assert.equal(olderMessages.hasMore, false)
    const newerMessages = (await api(chat + '?after=' + olderMessages.messages.at(-1).id)).json()
    assert.deepEqual(newerMessages.messages, latestMessages.messages)
    assert.equal(newerMessages.hasMore, false)
    assert.equal(latestMessages.unreadCount, 1)
    assert.equal((await api(teams)).json().teams.find(entry => entry.id === id).unreadCount, 1)
    await api(chat + '/read', { method: 'PUT', body: { through: latestMessages.messages.at(-1).id } })
    await api(chat + '/read', { method: 'PUT', body: { through: firstSaved.id } })
    assert.equal((await api(chat)).json().unreadCount, 0)
    assert.equal((await api(chat, { auth: viewer })).json().unreadCount, 52)

    const folders = team + '/folders'
    await api(folders, { auth: viewer, method: 'POST', body: { name: 'Forbidden' }, status: 403 })
    await api(team + '/files', { auth: viewer, method: 'POST', body: fileForm('forbidden.txt'), status: 403 })
    const sharedFolder = (await api(folders, { auth: uploader, method: 'POST', body: { name: 'Shared folder' }, status: 201 })).json().id
    const nested = (await api(folders, {
        auth: uploader, method: 'POST', body: { name: 'Nested', folderId: sharedFolder }, status: 201,
    })).json().id
    await api(folders, { auth: uploader, method: 'POST', body: { name: 'shared FOLDER' }, status: 409 })
    for (const folderId of [privateFolder, otherRoot]) {
        await api(team + '?folderId=' + folderId, { auth: viewer, status: 404 })
        await api(folders, { auth: uploader, method: 'POST', body: { name: 'Cross-boundary', folderId }, status: 404 })
        await api(team + '/files?folderId=' + folderId, {
            auth: uploader, method: 'POST', body: fileForm('forbidden.txt'), status: 404,
        })
    }
    assert.deepEqual((await api(team + '?folderId=' + nested, { auth: viewer })).json().breadcrumbs.map(row => row.id), [root, sharedFolder, nested])
    const personal = (await api('/api/folders')).json().folders
    assert.ok(personal.some(folder => folder.id === privateFolder))
    assert.ok(personal.every(folder => ![root, otherRoot].includes(folder.id)))
    const tree = (await api('/api/folders/tree')).json().folders
    assert.ok(tree.every(folder => ![root, otherRoot, nested, sharedFolder].includes(folder.id)))
    await api('/api/items/move', {
        method: 'POST', body: { items: [{ id: root, type: 'folder' }], destinationId: privateFolder }, status: 400,
    })

    const uploadUrl = team + '/files?folderId=' + nested
    const uploadedFile = (await api(uploadUrl, { auth: uploader, method: 'POST', body: fileForm('plan.txt'), status: 201 })).json()
    assert.equal(uploadedFile.uploaded, 1)
    assert.equal(uploadedFile.files[0].name, 'plan.txt')
    assert.equal('storage_key' in uploadedFile.files[0], false)
    await api(uploadUrl, { auth: uploader, method: 'POST', body: fileForm('PLAN.TXT'), status: 409 })
    const { items } = (await api(team + '?folderId=' + nested, { auth: viewer })).json()
    assert.equal(items.length, 1)
    assert.equal(items[0].name, 'plan.txt')
    assert.equal('storage_key' in items[0], false)
    const fileId = items[0].id
    assert.equal(uploadedFile.files[0].id, fileId)
    const delivery = team + '/files/' + fileId
    const download = await api(delivery + '/download', { auth: viewer })
    assert.deepEqual(download.data, bytes)
    assert.match(download.headers.get('cache-control'), /no-store/)
    assert.match(download.headers.get('content-disposition'), /attachment/)
    assert.equal((await api(delivery + '/download', { auth: viewer, method: 'HEAD' })).data.length, 0)
    assert.deepEqual((await api(delivery + '/preview', { auth: viewer })).data, bytes)
    await api(delivery + '/preview?revision=2', { auth: viewer, status: 409 })
    assert.deepEqual((await api(delivery + '/preview?revision=1', { auth: viewer })).data, bytes)
    await api(delivery + '/download', { auth: outsider, status: 404 })
    await api(delivery + '/preview', { auth: outsider, status: 404 })
    await api('/api/files/' + fileId + '/download', { auth: uploader, status: 404 })
    const quota = await db.query('SELECT id,storage_used FROM users WHERE id=ANY($1::uuid[])', [[owner, uploader]])
    assert.equal(Number(quota.rows.find(row => row.id === owner).storage_used), bytes.length)
    assert.equal(Number(quota.rows.find(row => row.id === uploader).storage_used), 0)

    await db.query('UPDATE users SET storage_limit=$1 WHERE id=$2', [bytes.length, owner])
    await api(uploadUrl, { auth: uploader, method: 'POST', body: fileForm('over-quota.txt'), status: 400 })
    assert.equal((await api(team + '?folderId=' + nested, { auth: viewer })).json().items.length, 1)

    const item = team + '/items/' + fileId + '?type=file'
    const outsideMessage = (await api(other + '/messages', {
        method: 'POST', body: { requestId: randomUUID(), message: 'Separate team message' }
    })).json().message
    await api(chat, { method: 'POST', status: 404, body: { requestId: randomUUID(), message: 'Outside', replyTo: outsideMessage.id } })
    await api(chat + '/read', { method: 'PUT', status: 404, body: { through: outsideMessage.id } })
    const fileMessage = {
        requestId: randomUUID(), message: `@${username(viewer)}. @${username(outsider)} qa@${username(uploader)}.example`,
        fileId, replyTo: firstSaved.id
    }
    const sharedFile = (await api(chat, { method: 'POST', body: fileMessage })).json().message
    assert.deepEqual((await api(chat, { method: 'POST', body: fileMessage })).json().message, sharedFile)
    assert.equal(sharedFile.file.name, 'plan.txt')
    assert.equal(sharedFile.reply.id, firstSaved.id)
    assert.equal(sharedFile.reply.excerpt, firstSaved.body)
    await api(other + '/messages', { method: 'POST', status: 404, body: { ...fileMessage, replyTo: undefined } })
    const mentions = teams + '/mentions'
    assert.deepEqual((await api(mentions, { auth: viewer })).json().mentions, [{
        id: sharedFile.id, teamId: id, teamName: teamBody.name, authorName: username(owner)
    }])
    for (const auth of [uploader, outsider]) assert.deepEqual((await api(mentions, { auth })).json().mentions, [])
    const pin = chat + '/' + sharedFile.id + '/pin'
    await api(pin, { method: 'PUT', auth: viewer, status: 403, body: { pinned: true } })
    await api(pin, { method: 'PUT', auth: editor, body: { pinned: true } })
    assert.equal((await api(chat, { auth: viewer })).json().pinned[0].id, sharedFile.id)
    assert.equal((await api(chat + '?at=' + firstSaved.id)).json().messages.at(-1).id, firstSaved.id)
    await api(pin, { method: 'PUT', auth: editor, body: { pinned: false } })
    assert.deepEqual((await api(chat)).json().pinned, [])
    const tasks = team + '/tasks'
    const taskInput = { messageId: sharedFile.id, title: 'Check the plan', assigneeId: viewer, dueOn: '2027-01-04' }
    await api(tasks, { method: 'POST', body: { ...taskInput, assigneeId: outsider }, status: 400 })
    await api(tasks, { method: 'POST', body: { ...taskInput, dueOn: '2027-02-30' }, status: 400 })
    await api(tasks, { method: 'POST', body: { ...taskInput, messageId: outsideMessage.id }, status: 404 })
    const task = (await api(tasks, { method: 'POST', body: taskInput })).json().task
    assert.equal((await api(tasks, { method: 'POST', body: taskInput })).json().task.id, task.id)
    assert.equal(task.dueOn, taskInput.dueOn)
    assert.equal((await api(tasks, { auth: viewer })).json().items[0].canUpdate, true)
    await api(tasks + '/' + task.id, { method: 'PATCH', auth: uploader, body: { completed: true }, status: 403 })
    assert.equal((await api(tasks + '/' + task.id, { method: 'PATCH', auth: viewer, body: { completed: true } })).json().task.completed, true)
    assert.equal((await api(tasks + '/' + task.id, { method: 'PATCH', body: { completed: false } })).json().task.completed, false)
    const reviews = team + '/reviews'
    const reviewInput = { fileId, reviewerId: viewer, note: 'Please check the plan.' }
    await api(reviews, { method: 'POST', body: { ...reviewInput, reviewerId: outsider }, status: 400 })
    const review = (await api(reviews, { method: 'POST', body: reviewInput })).json().review
    assert.equal((await api(reviews, { method: 'POST', body: reviewInput })).json().review.id, review.id)
    assert.equal((await api(reviews, { auth: viewer })).json().items[0].canRespond, true)
    const reviewUrl = reviews + '/' + review.id
    await api(reviewUrl, { method: 'PATCH', body: { status: 'APPROVED' }, status: 403 })
    const changes = { status: 'CHANGES_REQUESTED', note: 'Clarify the scope.' }
    assert.equal((await api(reviewUrl, { method: 'PATCH', auth: viewer, body: changes })).json().review.responseNote, changes.note)
    const secondReview = (await api(reviews, { method: 'POST', body: reviewInput })).json().review
    assert.equal((await api(reviews + '/' + secondReview.id, { method: 'PATCH', auth: viewer, body: { status: 'APPROVED' } })).json().review.status, 'APPROVED')
    const staleReview = (await api(reviews, { auth: uploader, method: 'POST', body: { ...reviewInput, reviewerId: editor } })).json().review
    await db.query('UPDATE files SET revision=2 WHERE id=$1', [fileId])
    await api(reviews + '/' + staleReview.id, { method: 'PATCH', auth: editor, body: { status: 'APPROVED' }, status: 409 })
    assert.equal((await api(reviews, { auth: editor })).json().items.find(entry => entry.id === staleReview.id).stale, true)
    await api(item, { auth: uploader, method: 'PATCH', body: { name: 'forbidden.txt' }, status: 403 })
    await api(item, { auth: uploader, method: 'DELETE', status: 403 })
    await api(item, { auth: editor, method: 'PATCH', body: { name: 'revised.txt' } })
    assert.equal((await api(team + '?folderId=' + nested, { auth: viewer })).json().items[0].name, 'revised.txt')
    await api(team, { auth: editor, method: 'PATCH', body: teamBody, status: 403 })
    await api(team + '/members/' + viewer, { auth: editor, method: 'DELETE', status: 403 })
    await api(team + '/members/' + uploader, { method: 'PATCH', body: { role: 'VIEWER' } })
    await api(folders, { auth: uploader, method: 'POST', body: { name: 'No longer allowed' }, status: 403 })
    await api(team + '/members/' + viewer, { auth: viewer, method: 'DELETE' })
    await api(delivery + '/download', { auth: viewer, status: 404 })
    await api(chat, { auth: viewer, status: 404 })
    await api(tasks, { auth: viewer, status: 404 })
    await api(reviews, { auth: viewer, status: 404 })
    assert.deepEqual((await api(mentions, { auth: viewer })).json().mentions, [])
    await api(chat, { auth: viewer, method: 'POST', body: firstMessage, status: 404 })
    await api(team + '/members/' + uploader, { method: 'DELETE' })
    await api(team, { auth: uploader, status: 404 })
    await api(item, { auth: editor, method: 'DELETE' })
    await api(delivery + '/download', { auth: editor, status: 404 })

    await api(team, { method: 'PATCH', body: { name: 'Updated project', description: '' } })
    await api(team, { auth: editor, method: 'DELETE', status: 403 })
    await api(team + '/members', { method: 'POST', body: outsiderInvite })
    await api(team, { method: 'DELETE' })
    await api(team, { auth: editor, status: 404 })
    const deletedMessages = await db.query('SELECT 1 FROM team_messages WHERE team_id=$1', [id])
    assert.equal(deletedMessages.rowCount, 0)
    assert.deepEqual((await api(teams, { auth: outsider })).json().invitations, [])
    await api(teams + '/' + otherTeam.id)
    const trash = await db.query('SELECT item_id, name FROM trash WHERE user_id=$1', [owner])
    assert.ok(trash.rows.some(row => row.item_id === root && row.name === 'Updated project'))
    assert.ok(trash.rows.some(row => row.item_id === fileId))
    assert.ok(trash.rows.some(row => row.item_id === nested))
    console.log('Team integration passed: invitations, chat, unread counts, mentions, replies, pins, files, tasks, reviews, roles and Trash.')
} finally {
    try {
        await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users])
        const target = resolve(storage, owner)
        assert.equal(target, storage + sep + owner)
        await rm(target, { recursive: true, force: true })
    } finally {
        await db.end()
    }
}
