import { isRunningInExpoGo } from 'expo'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { isoOf, routineForDate, type AppState } from './core'

const STATE_URI = `${FileSystem.documentDirectory || ''}opengym-state.json`
const CHANNEL_ID = 'opengym-workout-reminders'
const utf8 = FileSystem.EncodingType.UTF8
type NotificationsApi = typeof import('expo-notifications')
let notificationsApiPromise: Promise<NotificationsApi | null> | null = null

export async function loadNativeState(): Promise<unknown | null> {
  try {
    const value = await FileSystem.readAsStringAsync(STATE_URI, { encoding: utf8 })
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export async function saveNativeState(state: AppState): Promise<void> {
  await FileSystem.writeAsStringAsync(STATE_URI, JSON.stringify(state), { encoding: utf8 })
}

function permissionGranted(permission: { granted: boolean; status: string }): boolean {
  return permission.granted || permission.status === 'granted'
}

async function getNotificationsApi(): Promise<NotificationsApi | null> {
  // Android Expo Go evaluates expo-notifications' push-token listener while
  // importing the module, and that API is intentionally unavailable there.
  // Avoid the import entirely in that runtime; a caught lazy import also
  // protects other runtimes with a partial notifications implementation.
  if (Platform.OS === 'android' && isRunningInExpoGo()) return null
  notificationsApiPromise ??= import('expo-notifications').catch(() => null)
  return notificationsApiPromise
}

export async function syncNativeReminders(state: AppState, interactive = false): Promise<boolean> {
  const Notifications = await getNotificationsApi()
  if (!Notifications) return !state.reminder.on
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(scheduled
      .filter(item => item.content.data?.opengym === 'workout-reminder')
      .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)))

    if (!state.reminder.on) return true
    let permission = await Notifications.getPermissionsAsync()
    if (!permissionGranted(permission) && interactive) permission = await Notifications.requestPermissionsAsync()
    if (!permissionGranted(permission)) return false

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Workout reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const [hour, minute] = (state.reminder.time || '08:00').split(':').map(Number)
    const contentFor = (routine: NonNullable<ReturnType<typeof routineForDate>>) => ({
      title: 'Workout day',
      body: `${routine.name} is on the plan today - let us go!`,
      data: { opengym: 'workout-reminder' },
      sound: 'default' as const,
    })
    const androidTrigger = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}
    const jobs: Array<Promise<string>> = []

    if (Object.keys(state.cyclePlan).length) {
      // A four-week cycle can override the recurring week one weekday at a time.
      // Use concrete date triggers for the next five weeks so a cycle date is
      // reminded exactly once, even when the weekly fallback has the same weekday.
      const now = new Date()
      const end = new Date(now)
      end.setDate(end.getDate() + 35)
      for (const cursor = new Date(now); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const iso = isoOf(cursor)
        const routine = routineForDate(state, cursor)
        if (!routine) continue
        const date = new Date(cursor)
        date.setHours(hour, minute, 0, 0)
        if (date <= now) continue
        jobs.push(Notifications.scheduleNotificationAsync({
          content: contentFor(routine),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...androidTrigger },
        }))
      }
    } else {
      const routineById = new Map(state.routines.map(routine => [routine.id, routine]))
      for (const [day, routineId] of Object.entries(state.week)) {
        const routine = routineById.get(routineId)
        if (!routine) continue
        jobs.push(Notifications.scheduleNotificationAsync({
          content: contentFor(routine),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: Number(day) + 1,
            hour,
            minute,
            ...androidTrigger,
          },
        }))
      }
    }
    await Promise.all(jobs)
    return true
  } catch {
    return false
  }
}

export async function shareBackup(state: AppState): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device')
  const uri = `${FileSystem.cacheDirectory || ''}opengym-backup.json`
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(state, null, 2), { encoding: utf8 })
  await Sharing.shareAsync(uri, {
    dialogTitle: 'openGym backup',
    mimeType: 'application/json',
    UTI: 'public.json',
  })
}
