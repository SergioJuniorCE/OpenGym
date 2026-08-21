import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AppState, DEFAULT_STATE, Routine, Workout, WorkoutEntry, normalizeState, todayISO, uid, workoutVolume } from './core'
import { loadNativeState, saveNativeState, shareBackup, syncNativeReminders } from './services'

type StateUpdater = (state: AppState) => void

type NativeStore = {
  state: AppState
  ready: boolean
  selectedRoutineId: string | null
  setSelectedRoutine: (id: string | null) => void
  update: (updater: StateUpdater) => void
  setRoutines: (routines: Routine[]) => void
  saveWorkout: (routine: Routine, entries: WorkoutEntry[], startedAt: number) => void
  share: () => Promise<void>
  syncReminders: (interactive?: boolean, stateOverride?: AppState) => Promise<boolean>
}

const StoreContext = createContext<NativeStore | null>(null)

export function NativeProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [ready, setReady] = useState(false)
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    loadNativeState().then(saved => {
      if (!mounted) return
      const next = normalizeState(saved)
      setState(next)
      setSelectedRoutineId(next.routines[0]?.id || null)
      setReady(true)
      if (next.reminder.on) void syncNativeReminders(next)
    })
    return () => { mounted = false }
  }, [])

  const commit = (next: AppState): void => {
    const stamped = { ...next, _ts: Date.now() }
    setState(stamped)
    void saveNativeState(stamped)
  }

  const update = (updater: StateUpdater): void => {
    const next = normalizeState(JSON.parse(JSON.stringify(state)))
    updater(next)
    commit(next)
    const scheduleChanged = JSON.stringify(state.week) !== JSON.stringify(next.week) || JSON.stringify(state.cyclePlan) !== JSON.stringify(next.cyclePlan) || state.cycleStart !== next.cycleStart || JSON.stringify(state.routines) !== JSON.stringify(next.routines)
    if (scheduleChanged) void syncNativeReminders(next).catch(() => undefined)
  }

  const setRoutines = (routines: Routine[]): void => {
    const next = normalizeState(state)
    next.routines = routines
    next.week = Object.fromEntries(routines.slice(0, 3).map((routine, index) => [String([1, 3, 5][index]), routine.id]))
    commit(next)
    void syncNativeReminders(next).catch(() => undefined)
    setSelectedRoutineId(routines[0]?.id || null)
  }

  const saveWorkout = (routine: Routine, entries: WorkoutEntry[], startedAt: number): void => {
    const workout: Workout = {
      id: uid(), d: todayISO(), start: startedAt, end: Date.now(), routineId: routine.id,
      name: routine.name, entries, vol: 0,
    }
    workout.vol = workoutVolume(workout)
    const next = normalizeState(state)
    next.workouts = [workout, ...next.workouts]
    commit(next)
  }

  const store = useMemo<NativeStore>(() => ({
    state, ready, selectedRoutineId,
    setSelectedRoutine: setSelectedRoutineId,
    update,
    setRoutines,
    saveWorkout,
    share: () => shareBackup(state),
    syncReminders: (interactive = false, stateOverride) => syncNativeReminders(stateOverride || state, interactive),
  }), [state, ready, selectedRoutineId])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useNativeStore(): NativeStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useNativeStore must be used inside NativeProvider')
  return store
}
