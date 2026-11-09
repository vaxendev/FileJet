import { t, ready, languageTag } from './i18n.js'
import * as store from './store.js'
const $ = id => document.getElementById(id)
await ready
let owner = null, selected = null, dirty = false, timer, busy = false, saving = Promise.resolve(), pendingSync
let latestStatus = ''
const status = message => { latestStatus = message; $('status').textContent = message }
const report = error => status(t(error.message || '') || t("Could not access device storage."))
function fill(record) {
    selected = record.id; $('title').value = record.title; $('content').value = record.content
    $('editor').hidden = false; $('empty').hidden = true; dirty = false
    noteStatus(record)
}
function noteStatus(record) {
    $('save-state').textContent = record.pending ? t("Saved on this device · waiting to sync") : t("Saved on this device and server")
    $('note-error').textContent = t(record.error || '')
    $('copy').hidden = !record.conflict; $('server').hidden = !record.conflict || record.isNew
}
async function render() {
    const records = owner ? await store.listNotes(owner) : []
    $('notes').replaceChildren()
    for (const record of records) {
        const li = document.createElement('li'), button = document.createElement('button'), label = document.createElement('span'), detail = document.createElement('small')
        button.type = 'button'; button.setAttribute('aria-current', String(record.id === selected)); label.textContent = record.title || t("Untitled note")
        detail.textContent = record.conflict ? t("Conflict · draft preserved") : record.error ? t("Needs attention") : record.pending ? t("Waiting to sync") : t("Available offline")
        button.append(label,detail); button.onclick = () => select(record.id).catch(report); li.append(button); $('notes').append(li)
    }
    $('new').disabled = !owner; $('sync').disabled = !owner || busy
    if (!records.length && !selected) { $('editor').hidden = true; $('empty').hidden = false }
    if (selected && !dirty) { const record = records.find(row => row.id === selected); if (record) noteStatus(record) }
}
async function persist() {
    clearTimeout(timer)
    if (!dirty || !owner || !selected) return saving
    const id = selected, title = $('title').value, content = $('content').value
    dirty = false
    saving = saving.catch(() => {}).then(async () => {
        try { await store.saveDraft(owner,id,title,content); if (selected === id && !dirty) $('save-state').textContent = t("Saved on this device · waiting to sync"); await render() }
        catch (error) { if (selected === id) dirty = true; $('save-state').textContent = t("Could not save on this device. Download your draft before leaving."); throw error }
    })
    return saving
}
async function select(id) { await persist(); const record = await store.getNote(owner,id); if (record) { fill(record); await render() } }
function edited() {
    dirty = true; $('save-state').textContent = t("Saving on this device…"); clearTimeout(timer)
    timer = setTimeout(() => { persist().then(() => { if (navigator.onLine) scheduleSync() }).catch(report) }, 250)
}
function scheduleSync() { clearTimeout(pendingSync); pendingSync = setTimeout(() => sync().catch(report), 900) }
async function sync() {
    if (busy || !owner) return
    await persist(); busy = true; await render(); status(t("Syncing notes…"))
    let completed = false
    try {
        await store.syncNotes(owner)
        completed = true
        const pending = (await store.listNotes(owner)).filter(record => record.pending)
        status(pending.length ? t("{p0} note(s) need attention. Your drafts are preserved on this device.", { p0: pending.length }) : t("All notes synced. Offline editing is ready."))
    } finally {
        busy = false; await render()
        if (completed && navigator.onLine && (await store.listNotes(owner)).some(record => record.pending && !record.conflict && !record.error)) scheduleSync()
    }
}
$('title').addEventListener('input',edited); $('content').addEventListener('input',edited)
$('new').onclick = async () => { try { await persist(); const id = crypto.randomUUID(); await store.saveDraft(owner,id,t('Note {p0}', { p0: new Date().toLocaleTimeString(languageTag()) }), ''); await select(id); $('title').focus() } catch(error) { report(error) } }
$('sync').onclick = () => sync().catch(report)
$('copy').onclick = async () => {
    try { await persist(); const original = await store.getNote(owner,selected), id = crypto.randomUUID(); await store.saveDraft(owner,id,(original.title.slice(0,24) + t(' (copy)')).slice(0,32),original.content); await select(id); status(t("New draft created. Rename if needed, then sync.")) } catch(error) { report(error) }
}
$('server').onclick = async () => {
    if (!confirm(t("Replace this device draft with the server version? Download the draft first if you need it."))) return
    try {
        const user = await fetch('/api/users/@me',{cache:'no-store'}).then(response => response.ok ? response.json() : null)
        if (user?.id !== owner) throw Error(t("Sign in to the original account first."))
        const response = await fetch(`/api/notes/${selected}`,{cache:'no-store'})
        if (!response.ok) throw Error(t("Server version unavailable. Your draft was kept."))
        const server = await response.json(); await persist(); await store.removeNote(owner,selected); await store.cacheNote(owner,server); await select(server.id)
    } catch(error) { report(error) }
}
$('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([$('content').value],{type:'text/markdown;charset=utf-8'})), link = document.createElement('a')
    link.href = url; link.download = ($('title').value.replace(/[\\/:*?"<>|]/g,'_') || 'note') + '.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000)
}
$('remove').onclick = async () => {
    if (!confirm(t("Remove this device copy? Unsynced changes will be lost. The server note is kept."))) return
    try { await persist(); await store.removeNote(owner,selected); selected = null; $('editor').hidden = true; await render() } catch(error) { report(error) }
}
addEventListener('online', () => sync().catch(report))
addEventListener('offline', () => status(t("Offline. Changes are saved on this device.")))
addEventListener('pagehide', () => { void persist().catch(report) })
addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = '' } })
addEventListener('storage', () => render().catch(report))
try {
    owner = await store.getOwner()
    try {
        const response = await fetch('/api/users/@me',{cache:'no-store',signal:AbortSignal.timeout(5000)})
        if (response.ok) { const user = await response.json(); owner = user.id; await store.setOwner(owner) }
        else if (response.status === 401) owner = null
    } catch { /* Last active account can use its device copies while offline. */ }
    await render()
    const id = new URLSearchParams(location.search).get('note') || /^\/notes\/([0-9a-f-]{36})/.exec(location.pathname)?.[1]
    const first = owner && (id ? await store.getNote(owner,id) : (await store.listNotes(owner))[0])
    if (first) await select(first.id)
    status(owner ? navigator.onLine ? t("Device copies ready. Connecting to sync…") : t("Offline. Changes are saved on this device.") : t("Sign in to FileJet to enable offline notes."))
    store.registerOffline().catch(report)
    if (owner && navigator.onLine) sync().catch(report)
} catch(error) { report(error) }

addEventListener('filejet-language-change', () => { render().catch(report); if (latestStatus) $('status').textContent = t(latestStatus) })
