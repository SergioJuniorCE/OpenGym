import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, View } from 'react-native'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import * as Sharing from 'expo-sharing'
import { WebView } from 'react-native-webview'

const STATE_FILE = 'opengym-state.json'
const STATE_URI = `${FileSystem.documentDirectory}${STATE_FILE}`
const CHANNEL_ID = 'opengym-workout-reminders'
const BUNDLE = require('./assets/opengym.html')

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

const utf8 = FileSystem.EncodingType?.UTF8 || 'utf8'

async function loadState() {
  try {
    const data = await FileSystem.readAsStringAsync(STATE_URI, { encoding: utf8 })
    return { state: JSON.parse(data) }
  } catch (error) {
    return { state: null }
  }
}

async function saveState(state) {
  await FileSystem.writeAsStringAsync(STATE_URI, JSON.stringify(state), { encoding: utf8 })
  return { saved: true }
}

async function cancelWorkoutReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const ours = scheduled.filter(item => item.content?.data?.opengym === 'workout-reminder')
  await Promise.all(ours.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)))
}

const permissionGranted = response => response?.granted === true || response?.status === 'granted'

async function syncReminders({ enabled, interactive, notifications = [] }) {
  await cancelWorkoutReminders()
  if (!enabled) return { granted: true }

  let permission = await Notifications.getPermissionsAsync()
  if (!permissionGranted(permission) && interactive) {
    permission = await Notifications.requestPermissionsAsync()
  }
  if (!permissionGranted(permission)) return { granted: false }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const weekly = Notifications.SchedulableTriggerInputTypes?.WEEKLY || 'weekly'
  for (const item of notifications) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        data: { opengym: 'workout-reminder' },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: weekly,
        weekday: Number(item.weekday),
        hour: Number(item.hour),
        minute: Number(item.minute),
      },
    })
  }
  return { granted: true }
}

async function shareExport({ json, filename }) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device')
  const safeName = String(filename || 'opengym-backup.json').replace(/[^a-zA-Z0-9._-]/g, '_')
  const uri = `${FileSystem.cacheDirectory}${safeName}`
  await FileSystem.writeAsStringAsync(uri, json, { encoding: utf8 })
  await Sharing.shareAsync(uri, {
    dialogTitle: filename,
    mimeType: 'application/json',
    UTI: 'public.json',
  })
  return { shared: true }
}

async function readWebBundle() {
  const asset = Asset.fromModule(BUNDLE)
  await asset.downloadAsync()
  const uri = asset.localUri || asset.uri
  if (!uri) throw new Error('The bundled mobile web app could not be located')
  return FileSystem.readAsStringAsync(uri, { encoding: utf8 })
}

function responseScript(message) {
  return `(function(){window.__openGymExpoBridgeResponse(${JSON.stringify(message)});})();true;`
}

export default function App() {
  const webView = useRef(null)
  const [html, setHtml] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    readWebBundle().then(value => {
      if (mounted) setHtml(value)
    }).catch(value => {
      if (mounted) setError(value)
    })
    return () => { mounted = false }
  }, [])

  const respond = (id, message) => {
    webView.current?.injectJavaScript(responseScript({ id, ...message }))
  }

  const onMessage = async event => {
    let message
    try { message = JSON.parse(event.nativeEvent.data) } catch { return }
    if (!message?.id || !message.type) return
    try {
      let result
      if (message.type === 'load_state') result = await loadState()
      else if (message.type === 'save_state') result = await saveState(message.payload?.state)
      else if (message.type === 'sync_reminders') result = await syncReminders(message.payload || {})
      else if (message.type === 'share_export') result = await shareExport(message.payload || {})
      else throw new Error(`Unknown Expo bridge operation: ${message.type}`)
      respond(message.id, { ok: true, result })
    } catch (value) {
      respond(message.id, { ok: false, error: value?.message || String(value) })
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
