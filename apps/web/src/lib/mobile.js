// Mobile build (Vite's "mobile" mode) — the standalone Expo app.
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). Every persist()
// therefore also lands in a JSON file in the app's private data directory, and boot()
// restores from it. The workout reminder uses native local notifications scheduled per
// planned weekday — no server involved, unlike Web Push in the self-hosted version.
//
// The Expo host owns the native APIs. The small request/response bridge below keeps this
// module browser-safe, so the same source continues to build for the self-hosted website.
import { t } from './i18n.js'

export const MOBILE = import.meta.env.MODE === 'mobile' || import.meta.env.VITE_MOBILE === '1'

const BRIDGE_TIMEOUT = 15_000
let requestNo = 0
const pending = new Map()

function receiveNativeResponse(message) {
  const entry = pending.get(message?.id)
  if (!entry) return
  pending.delete(message.id)
  clearTimeout(entry.timeout)
  if (message.ok === false) {
    const error = new Error(message.error || 'The native operation failed')
    if (message.name) error.name = message.name
    entry.reject(error)
  } else entry.resolve(message.result)
}

function ensureNativeResponseHandler() {
  if (typeof window === 'undefined') return
  if (!window.__openGymExpoBridgeResponse) window.__openGymExpoBridgeResponse = receiveNativeResponse
}

function requestNative(type, payload = {}) {
  ensureNativeResponseHandler()
  const postMessage = typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage
  if (typeof postMessage !== 'function') return Promise.reject(new Error('Expo native bridge unavailable'))

  return new Promise((resolve, reject) => {
    const id = `opengym-${Date.now().toString(36)}-${++requestNo}`
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Expo bridge timeout: ${type}`))
    }, BRIDGE_TIMEOUT)
    pending.set(id, { resolve, reject, timeout })
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, payload }))
    } catch (e) {
      clearTimeout(timeout)
      pending.delete(id)
      reject(e)
    }
  })
}

export async function nativeLoad() {
  try { return (await requestNative('load_state'))?.state || null }
  catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

export async function nativeSave(state) {
  try { await requestNative('save_state', { state }) }
  catch (e) { /* keep the localStorage copy */ }
}

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
export async function syncReminder(S, interactive = false) {
  try {
    const r = S.reminder
    const [hour, minute] = (r.time || '08:00').split(':').map(Number)
    const notifications = Object.entries(S.week || {})
      .filter(([, rid]) => rid && (S.routines || []).some(x => x.id === rid))
      .map(([day, rid]) => ({
        weekday: Number(day) + 1,
        hour,
        minute,
        title: t('Workout day'),
        body: t('{0} is on the plan today — let’s go!', S.routines.find(x => x.id === rid).name),
      }))
    const result = await requestNative('sync_reminders', {
      enabled: !!r?.on,
      interactive,
      notifications,
    })
    return result?.granted !== false
  } catch (e) { return false }
}

// The WebView cannot reliably download blob URLs, so the backup goes out through the Expo
// host's OS share sheet (Files, AirDrop, mail, …) from a temporary file instead.
export async function shareExport(json, filename) {
  await requestNative('share_export', { json, filename })
}
