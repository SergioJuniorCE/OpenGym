import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native'
import { EXDB, Exercise, Routine, RoutineExercise, WorkoutEntry, exerciseOf, formatDuration, formatNumber, routineForDay, routineVolume, starterRoutines, todayISO } from './core'
import { useNativeStore } from './store'
import { Button, Card, Empty, Field, Screen, Section, Stat, colors, styles } from './ui'

export type ScreenName = 'home' | 'plan' | 'workout' | 'history' | 'library' | 'stats' | 'settings'

type Navigate = (screen: ScreenName) => void

function RoutineCard({ routine, selected, onSelect, onStart }: { routine: Routine; selected: boolean; onSelect: () => void; onStart: () => void }) {
  return <Card style={selected ? { borderColor: '#30d158', borderWidth: 2 } : undefined}>
    <View style={styles.between}>
      <Pressable onPress={onSelect} style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{routine.name}</Text>
        <Text style={[styles.body, { marginTop: 4 }]}>{routine.ex.length} exercises · {routineVolume(routine).toLocaleString('en-US')} planned volume</Text>
      </Pressable>
      <Button compact onPress={onStart}>Start</Button>
    </View>
    {selected ? <View style={{ marginTop: 14, gap: 8 }}>{routine.ex.map((item, index) => <View key={`${item.id}-${index}`} style={styles.between}><Text style={styles.body}>{index + 1}. {exerciseOf(item.id).n}</Text><Text style={styles.body}>{item.sets} × {item.reps || item.sec || 0}</Text></View>)}</View> : null}
  </Card>
}

export function HomeScreen({ navigate }: { navigate: Navigate }) {
  const { state, selectedRoutineId, setSelectedRoutine } = useNativeStore()
  const routine = routineForDay(state)
  const recent = state.workouts[0]
  const totalVolume = state.workouts.reduce((sum, workout) => sum + (workout.vol || 0), 0)

  return <Screen title="openGym" subtitle="A quiet place to get stronger.">
    <Card style={{ backgroundColor: '#17251b', borderColor: '#285b35' }}>
      <Text style={styles.label}>Today · {todayISO()}</Text>
      <Text style={[styles.cardTitle, { fontSize: 23, marginBottom: 7 }]}>{routine ? routine.name : 'Build your first plan'}</Text>
      <Text style={[styles.body, { marginBottom: 16 }]}>{routine ? `${routine.ex.length} exercises ready when you are.` : 'Start with a simple Push / Pull / Legs plan.'}</Text>
      <Button onPress={() => { if (routine) { setSelectedRoutine(routine.id); navigate('workout') } else navigate('plan') }}>{routine ? 'Start workout' : 'Set up plan'}</Button>
    </Card>

    <Section title="At a glance">
      <Card><View style={styles.row}><Stat label="Workouts" value={String(state.workouts.length)} /><Stat label="Volume" value={formatNumber(totalVolume, state.unit)} /><Stat label="Routines" value={String(state.routines.length)} /></View></Card>
    </Section>

    <Section title="Your plan" action={<Pressable onPress={() => navigate('plan')}><Text style={{ color: '#30d158', fontWeight: '700' }}>Edit</Text></Pressable>}>
      {state.routines.length ? state.routines.slice(0, 3).map(item => <RoutineCard key={item.id} routine={item} selected={selectedRoutineId === item.id} onSelect={() => setSelectedRoutine(item.id)} onStart={() => { setSelectedRoutine(item.id); navigate('workout') }} />) : <Empty>Nothing planned yet. Load the starter plan to get moving.</Empty>}
    </Section>

    <Section title="Latest session">
      {recent ? <Card><View style={styles.between}><View><Text style={styles.cardTitle}>{recent.name || 'Workout'}</Text><Text style={styles.body}>{recent.d} · {formatDuration((recent.end || recent.start) - recent.start)}</Text></View><Text style={{ color: '#30d158', fontWeight: '800' }}>{formatNumber(recent.vol, state.unit)}</Text></View></Card> : <Empty>Your completed workouts will appear here.</Empty>}
    </Section>
  </Screen>
}

export function PlanScreen({ navigate }: { navigate: Navigate }) {
  const { state, selectedRoutineId, setSelectedRoutine, setRoutines, update } = useNativeStore()
  return <Screen title="Plan" subtitle="Choose what you want to train next.">
    {!state.routines.length ? <Card><Text style={styles.cardTitle}>Start with a proven plan</Text><Text style={[styles.body, { marginVertical: 10 }]}>The starter plan gives you Push, Pull, and Leg days with sensible defaults. You can change it after loading.</Text><Button onPress={() => setRoutines(starterRoutines())}>Load starter plan</Button></Card> : null}
    <Section title="Weekly schedule">
      <Card>{[1, 2, 3, 4, 5, 6, 0].map(index => {
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]
        const routine = state.routines.find(item => item.id === state.week[String(index)])
        return <View key={day} style={[styles.between, { paddingVertical: 9 }]}><Text style={{ color: colors.text, fontWeight: '700', width: 45 }}>{day}</Text><View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{state.routines.map(item => <Pressable key={item.id} onPress={() => update(s => { s.week[String(index)] = item.id })} style={{ backgroundColor: routine?.id === item.id ? '#245c35' : colors.raised, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: routine?.id === item.id ? '#b8ffca' : colors.muted, fontSize: 12, fontWeight: '700' }}>{item.name.replace(' Day', '')}</Text></Pressable>)}</View></View>
      })}</Card>
    </Section>
    <Section title="Routines">
      {state.routines.map(routine => <RoutineCard key={routine.id} routine={routine} selected={selectedRoutineId === routine.id} onSelect={() => setSelectedRoutine(routine.id)} onStart={() => { setSelectedRoutine(routine.id); navigate('workout') }} />)}
    </Section>
  </Screen>
}

function draftFor(routine: Routine): WorkoutEntry[] {
  return routine.ex.map(item => ({
    id: item.id,
    target: item,
    sets: Array.from({ length: item.sets }, () => ({ w: item.weight || 0, r: item.reps || 0, sec: item.sec || 0, done: false })),
  }))
}

export function WorkoutScreen({ navigate }: { navigate: Navigate }) {
  const { state, selectedRoutineId, saveWorkout } = useNativeStore()
  const routine = state.routines.find(item => item.id === selectedRoutineId) || routineForDay(state)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const [entries, setEntries] = useState<WorkoutEntry[]>(() => routine ? draftFor(routine) : [])

  useEffect(() => {
    setStartedAt(Date.now())
    setEntries(routine ? draftFor(routine) : [])
  }, [routine?.id])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])

  if (!routine) return <Screen title="Workout"><Empty>Choose a routine in Plan before starting a workout.</Empty><Button onPress={() => navigate('plan')}>Open plan</Button></Screen>

  const toggleSet = (entryIndex: number, setIndex: number) => setEntries(current => current.map((entry, index) => index !== entryIndex ? entry : { ...entry, sets: entry.sets.map((set, inner) => inner === setIndex ? { ...set, done: !set.done } : set) }))
  const updateWeight = (entryIndex: number, value: string) => {
    const weight = Number(value) || 0
    setEntries(current => current.map((entry, index) => index !== entryIndex ? entry : { ...entry, sets: entry.sets.map(set => ({ ...set, w: weight })) }))
  }
  const finish = () => {
    if (!entries.some(entry => entry.sets.some(set => set.done))) { Alert.alert('Nothing logged yet', 'Complete at least one set before finishing.'); return }
    saveWorkout(routine, entries, startedAt)
    Alert.alert('Workout saved', 'Nice work. Your session is in History.', [{ text: 'Done', onPress: () => navigate('home') }])
  }

  return <Screen title={routine.name} subtitle={`${formatDuration(now - startedAt)} · ${entries.reduce((sum, entry) => sum + entry.sets.filter(set => set.done).length, 0)} sets complete`}>
    <View style={{ gap: 12 }}>{entries.map((entry, entryIndex) => {
      const target = entry.target as RoutineExercise
      const exercise = exerciseOf(entry.id)
      return <Card key={`${entry.id}-${entryIndex}`}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{exercise.n}</Text><Text style={styles.body}>{target.sets} sets · {target.reps || target.sec || 0} {target.sec ? 'seconds' : 'reps'}</Text></View><Text style={{ color: '#30d158', fontWeight: '800' }}>{entry.sets.filter(set => set.done).length}/{entry.sets.length}</Text></View><View style={[styles.divider, { marginVertical: 12 }]} /><View style={{ gap: 7 }}>{entry.sets.map((set, setIndex) => <View key={setIndex} style={styles.between}><Text style={styles.body}>Set {setIndex + 1}</Text><View style={[styles.row, { gap: 7 }]}><View style={{ width: 76 }}><Field label="" value={String(set.w || 0)} onChangeText={value => updateWeight(entryIndex, value)} keyboardType="decimal-pad" /></View><Pressable onPress={() => toggleSet(entryIndex, setIndex)} style={{ backgroundColor: set.done ? '#245c35' : colors.raised, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}><Text style={{ color: set.done ? '#b8ffca' : colors.muted, fontWeight: '800' }}>{set.done ? 'Done' : 'Complete'}</Text></Pressable></View></View>)}</View></Card>
    })}</View>
    <View style={{ gap: 9, marginTop: 8 }}><Button onPress={finish}>Finish workout</Button><Button tone="muted" onPress={() => navigate('home')}>Pause and leave</Button></View>
  </Screen>
}

export function HistoryScreen({ navigate }: { navigate: Navigate }) {
  const { state } = useNativeStore()
  return <Screen title="History" subtitle="Your work, recorded honestly.">
    {!state.workouts.length ? <Empty>No workouts yet. Start a session and it will show up here.</Empty> : state.workouts.map(workout => <Card key={workout.id}><View style={styles.between}><View><Text style={styles.cardTitle}>{workout.name || 'Workout'}</Text><Text style={styles.body}>{workout.d} · {workout.entries.length} exercises · {formatDuration((workout.end || workout.start) - workout.start)}</Text></View><Text style={{ color: '#30d158', fontWeight: '800' }}>{formatNumber(workout.vol, state.unit)}</Text></View></Card>)}
    <Button tone="muted" onPress={() => navigate('stats')}>View stats</Button>
  </Screen>
}

export function LibraryScreen() {
  const { state } = useNativeStore()
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState('all')
  const custom = state.customEx
  const all = [...custom, ...EXDB] as Exercise[]
  const bodyParts = ['all', ...Array.from(new Set(all.map(item => item.bp))).slice(0, 8)]
  const results = all.filter(item => (!query || item.n.toLowerCase().includes(query.toLowerCase())) && (bodyPart === 'all' || item.bp === bodyPart)).slice(0, 60)
  return <Screen title="Library" subtitle={`${all.length.toLocaleString('en-US')} exercises at your fingertips.`}>
    <Field label="Search" value={query} onChangeText={setQuery} placeholder="Bench press, squat..." autoCapitalize="none" />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>{bodyParts.map(part => <Pressable key={part} onPress={() => setBodyPart(part)} style={{ backgroundColor: bodyPart === part ? '#245c35' : colors.raised, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}><Text style={{ color: bodyPart === part ? '#b8ffca' : colors.muted, fontSize: 12, fontWeight: '700' }}>{part}</Text></Pressable>)}</View>
    <View style={{ gap: 8 }}>{results.map(item => <Card key={item.id} style={{ paddingVertical: 12 }}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.n}</Text><Text style={styles.body}>{item.bp} · {item.eq}</Text></View><Text style={{ color: '#30d158', fontSize: 12, fontWeight: '800' }}>{item.id}</Text></View></Card>)}</View>
  </Screen>
}

export function StatsScreen() {
  const { state } = useNativeStore()
  const sets = state.workouts.reduce((sum, workout) => sum + workout.entries.reduce((inner, entry) => inner + entry.sets.filter(item => item.done).length, 0), 0)
  const volume = state.workouts.reduce((sum, workout) => sum + workout.vol, 0)
  const best = state.workouts.reduce((max, workout) => Math.max(max, workout.vol), 0)
  const recent = state.workouts.slice(0, 7).reverse()
  return <Screen title="Stats" subtitle="The trend matters more than one session.">
    <Card><View style={styles.row}><Stat label="Sessions" value={String(state.workouts.length)} /><Stat label="Sets" value={String(sets)} /><Stat label="Volume" value={formatNumber(volume, state.unit)} /></View></Card>
    <Section title="Session volume">
      <Card>{recent.length ? <View style={{ height: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>{recent.map(workout => <View key={workout.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}><View style={{ width: '70%', minHeight: 4, height: best ? Math.max(5, workout.vol / best * 120) : 5, backgroundColor: '#30d158', borderRadius: 6 }} /><Text style={{ color: colors.dim, fontSize: 10 }}>{workout.d.slice(5)}</Text></View>)}</View> : <Text style={styles.body}>Complete a few workouts to see a trend.</Text>}</Card>
    </Section>
    <Section title="Personal best">
      <Card><Text style={styles.cardTitle}>{best ? `${formatNumber(best, state.unit)} in one session` : 'No numbers yet'}</Text><Text style={[styles.body, { marginTop: 5 }]}>Keep logging consistently and the signal will emerge.</Text></Card>
    </Section>
  </Screen>
}

export function SettingsScreen() {
  const { state, update, setRoutines, share, syncReminders } = useNativeStore()
  const [sharing, setSharing] = useState(false)
  const setReminder = async (on: boolean) => {
    const next = { ...state, reminder: { ...state.reminder, on } }
    update(s => { s.reminder.on = on })
    const granted = await syncReminders(true, next)
    if (on && !granted) Alert.alert('Notifications are off', 'Allow notifications in system settings to receive workout reminders.')
  }
  return <Screen title="Settings" subtitle="Private by default. Your data stays on this device.">
    <Section title="Profile">
      <Card><View style={styles.between}><View><Text style={styles.cardTitle}>Units</Text><Text style={styles.body}>Weights and volume</Text></View><View style={[styles.row, { gap: 7 }]}>{(['kg', 'lb'] as const).map(unit => <Pressable key={unit} onPress={() => update(s => { s.unit = unit })} style={{ backgroundColor: state.unit === unit ? '#245c35' : colors.raised, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: state.unit === unit ? '#b8ffca' : colors.muted, fontWeight: '800' }}>{unit}</Text></Pressable>)}</View></View></Card>
    </Section>
    <Section title="Reminders">
      <Card><View style={styles.between}><View><Text style={styles.cardTitle}>Workout reminders</Text><Text style={styles.body}>Native notifications for planned days</Text></View><Switch value={state.reminder.on} onValueChange={setReminder} trackColor={{ false: colors.raised, true: '#245c35' }} thumbColor={state.reminder.on ? '#30d158' : colors.muted} /></View><View style={styles.divider} /><Field label="Reminder time" value={state.reminder.time} onChangeText={time => update(s => { s.reminder.time = time })} onEndEditing={({ nativeEvent }) => void syncReminders(false, { ...state, reminder: { ...state.reminder, time: nativeEvent.text } })} placeholder="08:00" keyboardType="numbers-and-punctuation" /></Card>
    </Section>
    <Section title="Backup">
      <Card><Text style={styles.body}>Export a JSON copy of your workouts, plans, and settings. You can keep it in Files or send it to another device.</Text><View style={{ marginTop: 12 }}>{sharing ? <ActivityLabel /> : <Button onPress={async () => { setSharing(true); try { await share() } catch (error) { Alert.alert('Could not share backup', error instanceof Error ? error.message : String(error)) } finally { setSharing(false) } }}>Export backup</Button>}</View></Card>
    </Section>
    <Section title="Plans">
      <Card><Text style={styles.body}>{state.routines.length ? 'Replace your current routines with the built-in Push / Pull / Legs starter plan.' : 'Load a simple Push / Pull / Legs starter plan.'}</Text><View style={{ marginTop: 12 }}><Button tone="muted" onPress={() => Alert.alert('Load starter plan?', 'Your current routines will be replaced.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Load', onPress: () => setRoutines(starterRoutines()) }])}>Load starter plan</Button></View></Card>
    </Section>
    <Text style={[styles.body, { textAlign: 'center', marginTop: 4 }]}>openGym · native offline edition</Text>
  </Screen>
}

function ActivityLabel() { return <View style={[styles.button, { backgroundColor: colors.raised }]}><Text style={styles.buttonText}>Preparing backup…</Text></View> }
