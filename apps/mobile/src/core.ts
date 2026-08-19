import { EXDB as DATASET } from '../../web/src/lib/exercises-data.js'

export type Exercise = {
  id: string
  n: string
  bp: string
  eq: string
  tg: string
  sm?: string[]
  st?: string[]
  img?: string
  gif?: string
}

export type RoutineExercise = {
  id: string
  sets: number
  reps?: number
  sec?: number
  weight?: number
  prog?: string
  bw?: boolean
}

export type Routine = {
  id: string
  name: string
  emoji?: string
  ex: RoutineExercise[]
  prog?: string
}

export type WorkoutSet = {
  w?: number
  r?: number
  sec?: number
  done?: boolean
}

export type WorkoutEntry = {
  id: string
  sets: WorkoutSet[]
  target?: RoutineExercise
}

export type Workout = {
  id: string
  d: string
  start: number
  end?: number
  routineId?: string
  name?: string
  entries: WorkoutEntry[]
  vol: number
}

export type Reminder = {
  on: boolean
  time: string
  tz: string | null
}

export type AppState = {
  _ts?: number
  unit: 'kg' | 'lb'
  restSec: number
  sound: boolean
  keepAwake: boolean
  lang: string
  theme: 'dark' | 'light'
  accent: string
  body: 'male' | 'female'
  targetW: number | null
  bodyweight: Array<{ d: string; w: number }>
  routines: Routine[]
  week: Record<string, string>
  dayPlan: Record<string, unknown>
  exWeights: Record<string, number>
  workouts: Workout[]
  active: unknown | null
  customEx: Exercise[]
  gifSize: string
  reminder: Reminder
  effort: 'none' | 'rir' | 'rpe' | null
}

export const EXDB = DATASET as unknown as Exercise[]
export const EXIDX = Object.fromEntries(EXDB.map(exercise => [exercise.id, exercise])) as Record<string, Exercise>

export const ACCENTS: Record<string, string> = {
  lime: '#30d158', sky: '#0a84ff', orange: '#ff9f0a', violet: '#bf5af2',
  pink: '#ff375f', red: '#ff453a', teal: '#40c8e0', gold: '#ffd60a',
}

export const DEFAULT_STATE: AppState = {
  unit: 'kg', restSec: 90, sound: true, keepAwake: true, lang: 'en',
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {}, exWeights: {}, workouts: [],
  active: null, customEx: [], gifSize: 'full', reminder: { on: false, time: '08:00', tz: null }, effort: null,
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function normalizeState(value: unknown): AppState {
  const saved = value && typeof value === 'object' ? value as Partial<AppState> : {}
  return {
    ...clone(DEFAULT_STATE),
    ...saved,
    routines: Array.isArray(saved.routines) ? saved.routines : [],
    workouts: Array.isArray(saved.workouts) ? saved.workouts : [],
    customEx: Array.isArray(saved.customEx) ? saved.customEx : [],
    bodyweight: Array.isArray(saved.bodyweight) ? saved.bodyweight : [],
    week: saved.week && typeof saved.week === 'object' ? saved.week : {},
    reminder: { ...DEFAULT_STATE.reminder, ...(saved.reminder || {}) },
  }
}

export const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const todayISO = (): string => {
  const date = new Date()
  return isoOf(date)
}

export const isoOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const exerciseOf = (id: string): Exercise =>
  EXIDX[id] || { id, n: 'Unknown exercise', bp: '', eq: '', tg: '' }

export const starterRoutines = (): Routine[] => [
  {
    id: uid(), name: 'Push Day', emoji: 'P', ex: [
      { id: '0025', sets: 4, reps: 8, weight: 0 }, { id: '0047', sets: 3, reps: 10, weight: 0 },
      { id: '0426', sets: 3, reps: 10, weight: 0 }, { id: '0334', sets: 3, reps: 12, weight: 0 },
      { id: '0241', sets: 3, reps: 12, weight: 0 }, { id: '0251', sets: 3, reps: 10, weight: 0 },
    ],
  },
  {
    id: uid(), name: 'Pull Day', emoji: 'B', ex: [
      { id: '2330', sets: 4, reps: 10, weight: 0 }, { id: '0027', sets: 4, reps: 8, weight: 0 },
      { id: '1323', sets: 3, reps: 10, weight: 0 }, { id: '0031', sets: 3, reps: 10, weight: 0 },
      { id: '0313', sets: 3, reps: 12, weight: 0 },
    ],
  },
  {
    id: uid(), name: 'Leg Day', emoji: 'L', ex: [
      { id: '0043', sets: 4, reps: 8, weight: 0 }, { id: '0085', sets: 3, reps: 10, weight: 0 },
      { id: '0739', sets: 3, reps: 12, weight: 0 }, { id: '0585', sets: 3, reps: 12, weight: 0 },
      { id: '0586', sets: 3, reps: 12, weight: 0 }, { id: '0605', sets: 4, reps: 15, weight: 0 },
    ],
  },
]

export function routineForDay(state: AppState, day = new Date().getDay()): Routine | null {
  const routineId = state.week[String(day)]
  return state.routines.find(routine => routine.id === routineId) || state.routines[0] || null
}

export function routineVolume(routine: Routine): number {
  return routine.ex.reduce((total, item) => total + (item.weight || 0) * (item.reps || 0) * item.sets, 0)
}

export function workoutVolume(workout: Workout): number {
  return workout.entries.reduce((total, entry) => total + entry.sets.reduce((sum, set) =>
    sum + (set.done ? (set.w || 0) * (set.r || 0) : 0), 0), 0)
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`
}

export function formatNumber(value: number, unit?: string): string {
  const number = Math.round(value * 10) / 10
  return `${number.toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`
}
