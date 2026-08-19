import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, View } from 'react-native'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import * as Sharing from 'expo-sharing'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

type BridgePayload = Record<string, unknown>

type BridgeRequest = {
  id: string
  type: string
  payload: BridgePayload
}

type BridgeResponseBody =
  | { ok: true; result: unknown }
  | { ok: false; error: string }

type WorkoutReminder = {
  title: string
  body: string
  weekday: number
  hour: number
  minute: number
}

const STATE_FILE = 'opengym-state.json'
const CHANNEL_ID = 'opengym-workout-reminders'
const BUNDLE = require('./assets/opengym.html') as number
const utf8 = FileSystem.EncodingType.UTF8

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

function directoryFile(directory: string | null, filename: string): string {
  if (!directory) throw new Error('The app storage directory is unavailable')
  return `${directory}${filename}`
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBridgeRequest(data: string): BridgeRequest | null {
  try {
    const value: unknown = JSON.parse(data)
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') return null
    return {
      id: value.id,
      type: value.type,
      payload: isRecord(value.payload) ? value.payload : {},
    }
  } catch {
    return null
  }
}

function parseReminder(value: unknown): WorkoutReminder | null {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.body !== 'string') return null
  const weekday = Number(value.weekday)
  const hour = Number(value.hour)
  const minute = Number(value.minute)
  if (![weekday, hour, minute].every(Number.isFinite)) return null
  return { title: value.title, body: value.body, weekday, hour, minute }
}

async function loadState(): Promise<{ state: unknown | null }> {
  try {
    const uri = directoryFile(FileSystem.documentDirectory, STATE_FILE)
    const data = await FileSystem.readAsStringAsync(uri, { encoding: utf8 })
    return { state: JSON.parse(data) as unknown }
  } catch {
    return { state: null }
  }
}

async function saveState(state: unknown): Promise<{ saved: true }> {
  const data = JSON.stringify(state)
  if (data === undefined) throw new Error('The app state could not be serialized')
  const uri = directoryFile(FileSystem.documentDirectory, STATE_FILE)
  await FileSystem.writeAsStringAsync(uri, data, { encoding: utf8 })
  return { saved: true }
}

async function cancelWorkoutReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const ours = scheduled.filter(item => item.content.data?.opengym === 'workout-reminder')
  await Promise.all(ours.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)))
}

type PermissionResponse = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>

function permissionGranted(response: PermissionResponse): boolean {
  return response.granted === true || response.status === 'granted'
}

async function syncReminders(payload: BridgePayload): Promise<{ granted: boolean }> {
  await cancelWorkoutReminders()
  if (payload.enabled !== true) return { granted: true }

  let permission = await Notifications.getPermissionsAsync()
  if (!permissionGranted(permission) && payload.interactive === true) {
    permission = await Notifications.requestPermissionsAsync()
  }
  if (!permissionGranted(permission)) return { granted: false }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const reminders = Array.isArray(payload.notifications)
    ? payload.notifications.map(parseReminder).filter((item): item is WorkoutReminder => item !== null)
    : []

  for (const item of reminders) {
    const trigger: Notifications.WeeklyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: item.weekday,
      hour: item.hour,
      minute: item.minute,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: { opengym: 'workout-reminder' },
        sound: 'default',
      },
      trigger,
    })
  }
  return { granted: true }
}

async function shareExport(payload: BridgePayload): Promise<{ shared: true }> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device')
  if (typeof payload.json !== 'string') throw new Error('The exported backup is invalid')

  const filename = typeof payload.filename === 'string' ? payload.filename : 'opengym-backup.json'
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uri = directoryFile(FileSystem.cacheDirectory, safeName)
  await FileSystem.writeAsStringAsync(uri, payload.json, { encoding: utf8 })
  await Sharing.shareAsync(uri, {
    dialogTitle: filename,
    mimeType: 'application/json',
    UTI: 'public.json',
  })
  return { shared: true }
}

async function readWebBundle(): Promise<string> {
  const asset = Asset.fromModule(BUNDLE)
  await asset.downloadAsync()
  const uri = asset.localUri || asset.uri
  if (!uri) throw new Error('The bundled mobile web app could not be located')
  return FileSystem.readAsStringAsync(uri, { encoding: utf8 })
}

function responseScript(message: { id: string } & BridgeResponseBody): string {
  return `(function(){window.__openGymExpoBridgeResponse(${JSON.stringify(message)});})();true;`
}

export default function App() {
  const webView = useRef<WebView>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true
    readWebBundle().then(value => {
      if (mounted) setHtml(value)
    }).catch(value => {
      if (mounted) setError(value instanceof Error ? value : new Error(String(value)))
    })
    return () => { mounted = false }
  }, [])

  const respond = (id: string, message: BridgeResponseBody): void => {
    webView.current?.injectJavaScript(responseScript({ id, ...message }))
  }

  const onMessage = async (event: WebViewMessageEvent): Promise<void> => {
    const message = parseBridgeRequest(event.nativeEvent.data)
    if (!message) return

    try {
      let result: unknown
      if (message.type === 'load_state') result = await loadState()
      else if (message.type === 'save_state') result = await saveState(message.payload.state)
      else if (message.type === 'sync_reminders') result = await syncReminders(message.payload)
      else if (message.type === 'share_export') result = await shareExport(message.payload)
      else throw new Error(`Unknown Expo bridge operation: ${message.type}`)
      respond(message.id, { ok: true, result })
    } catch (value) {
      respond(message.id, { ok: false, error: errorMessage(value) })
    }
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.error}>Unable to load openGym: {error.message}</Text></View>
  }
  if (!html) {
    return <View style={styles.center}><ActivityIndicator color="#30d158" size="large" /></View>
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0c0e12" />
      <WebView
        ref={webView}
        source={{ html, baseUrl: 'https://opengym.local/' }}
        style={styles.webView}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={onMessage}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0e12' },
  webView: { flex: 1, backgroundColor: '#0c0e12' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0e12', padding: 24 },
  error: { color: '#f2f2f7', textAlign: 'center' },
})
