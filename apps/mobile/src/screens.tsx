import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Svg, { Circle as SvgCircle, Line as SvgLine, Path as SvgPath } from 'react-native-svg'
import { EXDB, Exercise, Routine, RoutineExercise, Workout, WorkoutEntry, exerciseOf, formatDuration, formatNumber, isoOf, routineForDay, starterRoutines, todayISO } from './core'
import { useNativeStore } from './store'
import { Button, Card, Chip, Empty, Field, Icon, IconButton, ListRow, Screen, Section, Segmented, Stat, Toggle, colors, styles } from './ui'
import { cx, uiClasses } from '@opengym/ui'

export type ScreenName = 'home' | 'plan' | 'workout' | 'history' | 'library' | 'stats' | 'settings'
type Navigate = (screen: ScreenName) => void

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/'
const GIF_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/'

const screenStyles = uiClasses

function plannedRoutineForDate(state: ReturnType<typeof useNativeStore>['state'], date: Date): Routine | null {
  const iso = isoOf(date)
  const override = state.dayPlan[iso]
  const id = typeof override === 'string' ? override : state.week[String(date.getDay())]
  return state.routines.find(routine => routine.id === id) || null
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Tag({ children, accent = false, icon }: { children: ReactNode; accent?: boolean; icon?: string }) {
  return <View className={cx(screenStyles.tag, accent && screenStyles.accentTag)}>{icon ? <Icon name={icon} size={13} color={accent ? colors.accent : colors.muted} /> : null}<Text className={cx(screenStyles.tagText, accent && screenStyles.accentTagText)}>{children}</Text></View>
}

function RoutineRow({ routine, onPress }: { routine: Routine; onPress?: () => void }) {
  const content = <View className={styles.itemRow}>
    <View className={styles.listIcon}><Text className="text-white text-base font-semibold">{routine.emoji || '·'}</Text></View>
    <View className={styles.listMain}><Text className={styles.itemTitle}>{routine.name}</Text><Text className={styles.listSubtitle}>{routine.ex.length} {routine.ex.length === 1 ? 'exercise' : 'exercises'}</Text></View>
    <Icon name="chevronRight" size={15} />
  </View>
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>{content}</Pressable> : content
}

function WorkoutListRow({ workout, unit, onPress }: { workout: Workout; unit: string; onPress?: () => void }) {
  const done = workout.entries.reduce((sum, entry) => sum + entry.sets.filter(set => set.done).length, 0)
  const content = <View className={styles.itemRow}>
    <View className={styles.listIcon}><Icon name="dumbbell" size={18} color="#ffffff" /></View>
    <View className={styles.listMain}><Text className={styles.itemTitle}>{workout.name || 'Workout'}</Text><Text className={styles.listSubtitle}>{dateLabel(workout.d)} · {formatDuration((workout.end || workout.start) - workout.start)} · {done} sets · {formatNumber(workout.vol, unit)}</Text></View>
    <Icon name="chevronRight" size={15} />
  </View>
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>{content}</Pressable> : content
}

function MiniVolumeChart({ values, color = colors.accent }: { values: Array<{ id: string; value: number }>; color?: string }) {
  const low = Math.min(...values.map(point => point.value))
  const high = Math.max(...values.map(point => point.value))
  const spread = Math.max(1, high - low)
  const points = values.map((point, index) => ({ x: values.length === 1 ? 160 : 6 + index / (values.length - 1) * 308, y: 98 - (point.value - low) / spread * 82, id: point.id }))
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  return <View className={screenStyles.miniChart}><Svg width="100%" height="110" viewBox="0 0 320 110" preserveAspectRatio="none"><SvgLine x1="6" y1="98" x2="314" y2="98" stroke={colors.border} strokeWidth="1" /><SvgLine x1="6" y1="57" x2="314" y2="57" stroke={colors.border} strokeWidth="1" opacity="0.45" /><SvgPath d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{points.map(point => <SvgCircle key={point.id} cx={point.x} cy={point.y} r="3" fill={color} />)}</Svg></View>
}

function activityColor(level: number): string {
  return level === 4 ? colors.accent : level === 3 ? 'rgba(48,209,88,.78)' : level === 2 ? 'rgba(48,209,88,.55)' : level === 1 ? 'rgba(48,209,88,.30)' : colors.raised
}

function ActivityHeatmap({ workouts }: { workouts: Workout[] }) {
  const scrollRef = useRef<ScrollView>(null)
  const columns = useMemo(() => {
    const minutesByDay = new Map<string, number>()
    workouts.forEach(workout => {
      const minutes = Math.max(0, Math.round(((workout.end || workout.start) - workout.start) / 60000))
      minutesByDay.set(workout.d, (minutesByDay.get(workout.d) || 0) + minutes)
    })
    const minutes = [...minutesByDay.values()].filter(value => value > 0).sort((a, b) => a - b)
    const quantile = (percentile: number) => minutes.length ? minutes[Math.min(minutes.length - 1, Math.floor(percentile * minutes.length))] : 0
    const thresholds = [quantile(0.25), quantile(0.5), quantile(0.75)]
    const levelFor = (date: string) => {
      const value = minutesByDay.get(date)
      if (!value) return 0
      if (value >= thresholds[2]) return 4
      if (value >= thresholds[1]) return 3
      if (value >= thresholds[0]) return 2
      return 1
    }
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const end = new Date(today)
    end.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const start = new Date(end)
    start.setDate(end.getDate() - 52 * 7)
    return Array.from({ length: 53 }, (_, week) => {
      const columnStart = new Date(start)
      columnStart.setDate(start.getDate() + week * 7)
      const startIso = isoOf(columnStart)
      const showMonth = columnStart.getDate() <= 7 && week < 51
      return {
        id: startIso,
        month: showMonth ? columnStart.toLocaleDateString('en-US', { month: 'short' }) : '',
        cells: Array.from({ length: 7 }, (_, day) => {
          const date = new Date(columnStart)
          date.setDate(columnStart.getDate() + day)
          const id = isoOf(date)
          return { id, level: levelFor(id), future: date > today, today: id === todayISO() }
        }),
      }
    })
  }, [workouts])
  return <>
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
      <View>
        <View className={screenStyles.heatmapMonths}>{columns.map(column => <Text key={column.id} className={screenStyles.heatmapMonth}>{column.month}</Text>)}</View>
        <View className={screenStyles.heatmapBody}>
          <View className={screenStyles.heatmapDays}><Text className={screenStyles.heatmapDay}>Mon</Text><View style={{ height: 11 }} /><Text className={screenStyles.heatmapDay}>Wed</Text><View style={{ height: 11 }} /><Text className={screenStyles.heatmapDay}>Fri</Text><View style={{ height: 11 }} /></View>
          <View className={screenStyles.heatmapGrid}>{columns.map(column => <View key={column.id} className={screenStyles.heatmapColumn}>{column.cells.map(cell => <View key={cell.id} className={screenStyles.heatmapCell} style={{ backgroundColor: activityColor(cell.level), opacity: cell.future ? 0.3 : 1, ...(cell.today ? { borderWidth: 1.5, borderColor: colors.accent } : {}) }} />)}</View>)}</View>
        </View>
      </View>
    </ScrollView>
    <View className={screenStyles.heatmapLegend}><Text className={screenStyles.heatmapLegendText}>Less time</Text>{[0, 1, 2, 3, 4].map(level => <View key={level} className={screenStyles.heatmapCell} style={{ backgroundColor: activityColor(level) }} />)}<Text className={screenStyles.heatmapLegendText}>More time</Text></View>
  </>
}

export function HomeScreen({ navigate }: { navigate: Navigate }) {
  const { state, setSelectedRoutine, setRoutines } = useNativeStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date()
  const todayRoutine = plannedRoutineForDate(state, today)
  const lastWeight = state.bodyweight[state.bodyweight.length - 1]
  const previousWeight = state.bodyweight[state.bodyweight.length - 2]
  const weightDelta = lastWeight && previousWeight ? lastWeight.w - previousWeight.w : null
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const weekLabel = weekOffset === 0 ? 'This week' : `${monday.getDate()} ${monday.toLocaleDateString('en-US', { month: 'short' })} - ${sunday.getDate()} ${sunday.toLocaleDateString('en-US', { month: 'short' })}`
  const weekValues = state.bodyweight.slice(-12).map(item => ({ id: item.d, value: item.w }))
  const weekWorkouts = state.workouts.filter(workout => workout.d >= isoOf(monday) && workout.d <= isoOf(sunday)).length
  const plannedDays = Object.values(state.week).filter(Boolean).length

  const openToday = () => {
    if (todayRoutine) { setSelectedRoutine(todayRoutine.id); navigate('workout') } else navigate('plan')
  }

  return <Screen title="openGym" subtitle={today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} action={<IconButton name="gear" label="Settings" onPress={() => navigate('settings')} />}>
    <Card>
      <View className={styles.between}>
        <IconButton name="chevronLeft" label="Previous week" size={30} onPress={() => setWeekOffset(offset => offset - 1)} />
        <Text className={styles.small}>{weekLabel}</Text>
        <IconButton name="chevronRight" label="Next week" size={30} onPress={() => setWeekOffset(offset => offset + 1)} />
      </View>
      <View className={screenStyles.week}>{Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday)
        date.setDate(monday.getDate() + index)
        const routine = plannedRoutineForDate(state, date)
        const iso = isoOf(date)
        const todayCell = iso === todayISO()
        const done = state.workouts.some(workout => workout.d === iso)
        return <Pressable key={iso} onPress={openToday} className={screenStyles.weekDay} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
          <Text className={screenStyles.weekLabel}>{DAY_LABELS[date.getDay()]}</Text>
          <Text className={cx(screenStyles.weekNumber, todayCell && screenStyles.todayNumber)}>{date.getDate()}</Text>
          <View className={screenStyles.dot} style={{ backgroundColor: done ? colors.accent : routine ? colors.dim : 'transparent' }} />
        </Pressable>
      })}</View>
      <Pressable onPress={openToday} className={screenStyles.todayRow} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
        <View className={styles.row} style={{ flex: 1, minWidth: 0 }}>
          <View className={screenStyles.rowIcon} style={{ backgroundColor: todayRoutine ? colors.accent : colors.control }}><Icon name={todayRoutine ? 'dumbbell' : 'moon'} size={18} color={todayRoutine ? colors.onAccent : colors.muted} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.dim, fontSize: 11, lineHeight: 15, fontWeight: '500', textTransform: 'uppercase' }}>Today</Text><Text style={{ color: colors.text, fontSize: 17, lineHeight: 22, marginTop: 2 }} numberOfLines={1}>{todayRoutine ? todayRoutine.name : 'Rest day'}</Text></View>
        </View>
        {todayRoutine ? <Tag accent>Start</Tag> : <Icon name="plus" size={18} />}
      </Pressable>
    </Card>

    {!state.routines.length && <Card>
      <View className={styles.row} style={{ marginBottom: 7 }}><View className={styles.listIcon}><Icon name="sparkles" size={18} color="#ffffff" /></View><Text className={styles.cardTitle} style={{ fontSize: 22 }}>Welcome!</Text></View>
      <Text className={styles.small} style={{ marginBottom: 12 }}>Set up your weekly routine to get going - or load a ready-made Push / Pull / Legs plan.</Text>
      <Button icon="sparkles" onPress={() => setRoutines(starterRoutines())}>Load starter plan (PPL)</Button>
      <View style={{ height: 8 }} /><Button tone="muted" onPress={() => navigate('plan')}>Build my own plan</Button>
    </Card>}

    <Card>
      <View className={styles.between} style={{ marginBottom: 6 }}><Text className={styles.small}>Body weight</Text><View className={styles.row}><Button compact tone="tinted" icon="target">Goal</Button><Button compact tone="tinted" icon="plus">Log</Button></View></View>
      {lastWeight ? <><View className={styles.row} style={{ alignItems: 'baseline', gap: 8 }}><Text style={{ color: colors.text, fontSize: 30, lineHeight: 33, fontWeight: '600' }}>{formatNumber(lastWeight.w)} <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '400' }}>{state.unit}</Text></Text>{weightDelta ? <Text style={{ color: weightDelta > 0 ? colors.orange : colors.accent, fontSize: 13 }}>{weightDelta > 0 ? '↑' : '↓'} {formatNumber(Math.abs(weightDelta))}</Text> : null}<Text className={styles.small} style={{ marginLeft: 'auto' }}>{dateLabel(lastWeight.d)}</Text></View><MiniVolumeChart values={weekValues.length ? weekValues : [{ id: lastWeight.d, value: lastWeight.w }]} /></> : <Text className={styles.small}>No entries yet - log your weight to start the curve.</Text>}
    </Card>

    <Pressable onPress={() => navigate('stats')} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}><Card>
      <View className={styles.between}><View><View className={styles.row} style={{ gap: 7 }}><Icon name="flame" size={22} color={colors.orange} /><Text style={{ color: colors.text, fontSize: 22, lineHeight: 27, fontWeight: '600' }}>{state.workouts.length ? 1 : 0} week streak</Text></View><Text className={styles.small} style={{ marginTop: 2 }}>{weekWorkouts}{plannedDays ? ` / ${plannedDays}` : ''} this week · {state.workouts.length} workouts total</Text></View><Icon name="calendar" size={20} /></View>
    </Card></Pressable>

  </Screen>
}

export function PlanScreen({ navigate }: { navigate: Navigate }) {
  const { state, setRoutines, setSelectedRoutine, update } = useNativeStore()
  const assignDay = (day: number) => {
    const routines = state.routines
    const current = state.week[String(day)]
    const currentIndex = routines.findIndex(routine => routine.id === current)
    const next = routines.length ? routines[(currentIndex + 1) % (routines.length + 1)] : null
    update(next ? s => { s.week[String(day)] = next.id } : s => { delete s.week[String(day)] })
  }
  return <Screen title="Plan" subtitle="Your weekly routine" action={<IconButton name="upload" label="Share your plan" onPress={() => Alert.alert('Plan sharing', 'Plan sharing is available in the web app.')}/> }>
    <Section title="Week schedule">{[1, 2, 3, 4, 5, 6, 0].map(day => {
      const routine = state.routines.find(item => item.id === state.week[String(day)])
      return <Card key={day} className={screenStyles.itemCard}><Pressable onPress={() => assignDay(day)} className={styles.itemRow} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}><View className={styles.listMain}><Text className={styles.itemTitle}>{DAY_NAMES[day]}</Text></View>{routine ? <Tag accent icon="dumbbell">{routine.name}</Tag> : <Tag>Rest</Tag>}<Icon name="chevronRight" size={15} /></Pressable></Card>
    })}</Section>
    <Section title="Routines" action={<Button compact tone="tinted" icon="plus" onPress={() => Alert.alert('New routine', 'Create a routine from the web app, or load the starter plan here.')}>New</Button>}>
      {state.routines.length ? state.routines.map(routine => <Card key={routine.id} className={screenStyles.itemCard}><RoutineRow routine={routine} onPress={() => { setSelectedRoutine(routine.id); navigate('workout') }} /></Card>) : <><Empty>No routines yet. Create one or load the starter plan.</Empty><Button icon="sparkles" onPress={() => setRoutines(starterRoutines())}>Load starter plan (Push / Pull / Legs)</Button></>}
    </Section>
  </Screen>
}

function StartChooser({ navigate, onStart }: { navigate: Navigate; onStart: (routine: Routine) => void }) {
  const { state, selectedRoutineId, setSelectedRoutine } = useNativeStore()
  const todayRoutine = plannedRoutineForDate(state, new Date())
  const selected = state.routines.find(routine => routine.id === selectedRoutineId) || todayRoutine
  const others = state.routines.filter(routine => routine.id !== selected?.id)
  const start = (routine: Routine | null) => { if (!routine) { Alert.alert('No routine selected', 'Choose a routine in Plan first.'); return }; setSelectedRoutine(routine.id); onStart(routine) }
  return <Screen title="Start workout" subtitle={`${DAY_NAMES[new Date().getDay()]} — ${selected ? `today is ${selected.name}` : 'rest day'}`}>
    {selected ? <Card><Text style={{ color: colors.accent, fontSize: 13, marginBottom: 12 }}>Today's plan</Text><View className={styles.between} style={{ marginBottom: 12 }}><View><Text style={{ color: colors.text, fontSize: 22, lineHeight: 27, fontWeight: '600' }}>{selected.name}</Text><Text className={styles.small}>{selected.ex.length} exercises</Text></View><View className={styles.listIcon} style={{ width: 38, height: 38, borderRadius: 9 }}><Text style={{ color: '#ffffff', fontSize: 20 }}>{selected.emoji || '·'}</Text></View></View><Button icon="play" onPress={() => start(selected)}>Start {selected.name}</Button></Card> : null}
    {others.length ? <Section title="Other routines">{others.map(routine => <Card key={routine.id} className={screenStyles.itemCard}><Pressable onPress={() => start(routine)} className={styles.itemRow} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}><View className={styles.listIcon}><Text className="text-white text-base">{routine.emoji || '·'}</Text></View><View className={styles.listMain}><Text className={styles.itemTitle}>{routine.name}</Text><Text className={styles.listSubtitle}>{routine.ex.length} exercises</Text></View><Tag accent>Start</Tag></Pressable></Card>)}</Section> : null}
    <View style={{ height: 14 }} /><Button tone="muted" icon="shuffle" onPress={() => Alert.alert('Freestyle workout', 'Choose a routine in Plan to start a tracked workout.')}>Freestyle workout (pick as you go)</Button>
    {!state.routines.length ? <><View style={{ height: 10 }} /><Button onPress={() => navigate('plan')}>Build a plan first</Button></> : null}
  </Screen>
}

function draftFor(routine: Routine): WorkoutEntry[] {
  return routine.ex.map(item => ({ id: item.id, target: item, sets: Array.from({ length: item.sets }, () => ({ w: item.weight || 0, r: item.reps || 0, sec: item.sec || 0, done: false })) }))
}

function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  if (!exercise.gif) return null
  return <View className={screenStyles.workoutMedia}><Image source={{ uri: GIF_BASE + exercise.gif }} resizeMode="contain" className={screenStyles.workoutImage} /></View>
}

export function WorkoutScreen({ navigate }: { navigate: Navigate }) {
  const { state, selectedRoutineId, saveWorkout } = useNativeStore()
  const routine = state.routines.find(item => item.id === selectedRoutineId) || plannedRoutineForDate(state, new Date()) || routineForDay(state)
  const [started, setStarted] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())
  const [entries, setEntries] = useState<WorkoutEntry[]>([])
  useEffect(() => { setStarted(false); setEntries([]) }, [routine?.id])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  if (!started) return <StartChooser navigate={navigate} onStart={routineToStart => { const timestamp = Date.now(); setStartedAt(timestamp); setNow(timestamp); setEntries(draftFor(routineToStart)); setStarted(true) }} />
  if (!routine) return <Screen title="Workout"><Empty>Choose a routine in Plan before starting a workout.</Empty><Button onPress={() => navigate('plan')}>Open plan</Button></Screen>

  const doneCount = entries.reduce((sum, entry) => sum + entry.sets.filter(set => set.done).length, 0)
  const toggleSet = (entryIndex: number, setIndex: number) => setEntries(current => current.map((entry, index) => index !== entryIndex ? entry : { ...entry, sets: entry.sets.map((set, inner) => inner === setIndex ? { ...set, done: !set.done } : set) }))
  const updateWeight = (entryIndex: number, setIndex: number, value: string) => { const weight = Number(value) || 0; setEntries(current => current.map((entry, index) => index !== entryIndex ? entry : { ...entry, sets: entry.sets.map((set, inner) => inner === setIndex ? { ...set, w: weight } : set) })) }
  const finish = () => { if (!entries.some(entry => entry.sets.some(set => set.done))) { Alert.alert('Nothing logged yet', 'Complete at least one set before finishing.'); return }; saveWorkout(routine, entries, startedAt); Alert.alert('Workout saved', 'Nice work. Your session is in History.', [{ text: 'Done', onPress: () => navigate('home') }]) }
  const totalSets = entries.reduce((sum, entry) => sum + entry.sets.length, 0)
  return <Screen compactHeader title={routine.name} subtitle={`${formatDuration(now - startedAt)} · ${doneCount}/${totalSets} sets`} leading={<IconButton name="xmark" label="Discard workout" onPress={() => navigate('home')} />} action={<IconButton name="check" label="Finish workout" onPress={finish} />}>
    <View className={screenStyles.progressTrack}><View className={screenStyles.progressFill} style={{ width: totalSets ? `${doneCount / totalSets * 100}%` : '0%' }} /></View>
    {entries.map((entry, entryIndex) => {
      const target = entry.target as RoutineExercise
      const exercise = exerciseOf(entry.id)
      return <View key={`${entry.id}-${entryIndex}`} style={{ marginBottom: 12 }}><ExerciseMedia exercise={exercise} /><View className={styles.between} style={{ marginBottom: 6 }}><Text className={styles.cardTitle} style={{ flex: 1 }}>{exercise.n}</Text><IconButton name="info" label="Exercise details" size={30} /></View><View className={styles.row} style={{ flexWrap: 'wrap', marginBottom: 8, gap: 6 }}><Tag>{exercise.tg || exercise.bp}</Tag>{exercise.eq ? <Tag>{exercise.eq}</Tag> : null}<Tag accent>{target.sets} sets · {target.reps || target.sec || 0} {target.sec ? 'seconds' : 'reps'}</Tag></View><Card style={{ marginBottom: 0 }}><View className={screenStyles.setHeader}><Text style={{ width: 28 }} /><Text className={screenStyles.setHeaderText}>Weight ({state.unit})</Text><Text className={screenStyles.setHeaderText}>Reps</Text><Text style={{ width: 82 }} /></View>{entry.sets.map((set, setIndex) => <View key={setIndex} className={styles.row} style={{ marginBottom: setIndex === entry.sets.length - 1 ? 0 : 7 }}><Text style={{ color: colors.muted, width: 28, textAlign: 'center' }}>{setIndex + 1}</Text><TextInput value={String(set.w || 0)} onChangeText={value => updateWeight(entryIndex, setIndex, value)} keyboardType="decimal-pad" className={styles.input} style={{ flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: colors.raised, textAlign: 'center' }} /><Text className={styles.body} style={{ width: 45, textAlign: 'center' }}>{set.r || target.reps || target.sec || 0}</Text><Button compact tone={set.done ? 'tinted' : 'muted'} icon={set.done ? 'check' : undefined} onPress={() => toggleSet(entryIndex, setIndex)}>{set.done ? 'Done' : 'Complete'}</Button></View>)}</Card></View>
    })}
    <Button icon="flag" onPress={finish}>Finish workout</Button><View style={{ height: 8 }} /><Button tone="muted" onPress={() => navigate('home')}>Pause and leave</Button>
  </Screen>
}

export function HistoryScreen({ navigate }: { navigate: Navigate }) {
  const { state } = useNativeStore()
  return <Screen title="History" subtitle={`${state.workouts.length} workouts`} leading={<IconButton name="chevronLeft" label="Stats" onPress={() => navigate('stats')} />}>
    {state.workouts.length ? state.workouts.map(workout => <Card key={workout.id} className={screenStyles.itemCard}><WorkoutListRow workout={workout} unit={state.unit} /></Card>) : <Empty>No workouts yet.</Empty>}
  </Screen>
}

function imageFor(exercise: Exercise): string | null { return exercise.img ? IMAGE_BASE + exercise.img : null }

export function LibraryScreen({ navigate }: { navigate: Navigate }) {
  const { state } = useNativeStore()
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState('all')
  const [equipment, setEquipment] = useState('all')
  const [shown, setShown] = useState(40)
  const all = [...state.customEx, ...EXDB] as Exercise[]
  const bodyParts = ['all', ...Array.from(new Set(all.map(item => item.bp))).sort()]
  const base = all.filter(item => (!query || `${item.n} ${item.tg} ${item.eq}`.toLowerCase().includes(query.toLowerCase())) && (bodyPart === 'all' || item.bp === bodyPart))
  const equipmentValues = new Set<string>()
  base.forEach(item => { if (item.eq) equipmentValues.add(item.eq) })
  const equipmentOptions = ['all', ...Array.from(equipmentValues).sort()]
  const equipmentFilter = equipmentOptions.includes(equipment) ? equipment : 'all'
  const filtered = equipmentFilter === 'all' ? base : base.filter(item => item.eq === equipmentFilter)
  const results = filtered.slice(0, shown)
  const resetSearch = (value: string) => { setQuery(value); setShown(40) }
  const selectBodyPart = (value: string) => { setBodyPart(value); setEquipment('all'); setShown(40) }
  const selectEquipment = (value: string) => { setEquipment(value); setShown(40) }
  return <Screen title="Exercises" subtitle={`${EXDB.length.toLocaleString('en-US')} exercises with animations.`}>
    <View style={{ position: 'relative' }}><Field label="" value={query} onChangeText={resetSearch} placeholder="Search…" autoCapitalize="none" /><View style={{ position: 'absolute', left: 12, top: 12 }}><Icon name="magnifier" size={17} color={colors.dim} /></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 2, marginBottom: equipmentOptions.length > 1 ? 8 : 12 }}>{bodyParts.map(part => <Chip key={part} selected={bodyPart === part} onPress={() => selectBodyPart(part)}>{part === 'all' ? 'All' : part}</Chip>)}</ScrollView>
    {equipmentOptions.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 2, marginBottom: 12 }}><Chip selected={equipmentFilter === 'all'} onPress={() => selectEquipment('all')}>Any equipment</Chip>{equipmentOptions.slice(1).map(option => <Chip key={option} selected={equipmentFilter === option} onPress={() => selectEquipment(option)}>{option}</Chip>)}</ScrollView> : null}
    <View><Card className={screenStyles.itemCard}><Pressable onPress={() => Alert.alert('Create exercise', 'Custom exercise creation is available in the web app.')} className={styles.itemRow} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}><View className={screenStyles.exerciseThumb}><Icon name="sparkles" size={21} /></View><View className={styles.listMain}><Text className={styles.itemTitle}>Create your own exercise</Text><Text className={styles.listSubtitle}>name + body part, no animation</Text></View><Icon name="plus" size={17} /></Pressable></Card>{results.map(item => { const image = imageFor(item); return <Card key={item.id} className={screenStyles.itemCard}><Pressable onPress={() => Alert.alert(item.n, `${item.bp} · ${item.eq}`)} className={styles.itemRow} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}><View className={screenStyles.exerciseThumb}>{image ? <Image source={{ uri: image }} style={{ width: 50, height: 50, borderRadius: 9 }} /> : <Icon name="dumbbell" size={21} color={colors.muted} />}</View><View className={styles.listMain}><Text className={styles.itemTitle} style={{ textTransform: 'capitalize' }} numberOfLines={1}>{item.n}</Text><Text className={styles.listSubtitle} style={{ textTransform: 'capitalize' }} numberOfLines={1}>{item.tg || item.bp} · {item.eq}</Text></View><Button compact tone="tinted" icon="plus" onPress={() => navigate('plan')}>Plan</Button></Pressable></Card>})}</View>
    {!results.length ? <Empty>No match</Empty> : null}
    {filtered.length > shown ? <Button tone="muted" onPress={() => setShown(value => value + 40)}>Show more</Button> : null}
  </Screen>
}

function StatTile({ icon, label, value, valueColor = colors.text }: { icon: string; label: string; value: string; valueColor?: string }) {
  return <Card className={screenStyles.tile}><View className={styles.row}><Icon name={icon} size={14} /><Text className={styles.small}>{label}</Text></View><Text className={styles.statValue} style={{ color: valueColor }}>{value}</Text></Card>
}

export function StatsScreen({ navigate }: { navigate: Navigate }) {
  const { state } = useNativeStore()
  const recent = state.workouts.slice(0, 6)
  const [weightRange, setWeightRange] = useState('3M')
  const rangeDays = weightRange === '1M' ? 30 : weightRange === '3M' ? 90 : weightRange === '1Y' ? 365 : 0
  const weightPoints = state.bodyweight.filter(item => !rangeDays || new Date(item.d).getTime() >= Date.now() - rangeDays * 86400000).slice(-30).map(item => ({ id: item.d, value: item.w }))
  const weight30 = state.bodyweight.filter(item => new Date(item.d).getTime() >= Date.now() - 30 * 86400000)
  const weightDelta30 = weight30.length > 1 ? weight30[weight30.length - 1].w - weight30[0].w : null
  return <Screen title="Stats" subtitle="Progress & history" action={<IconButton name="history" label="History" onPress={() => navigate('history')} />}>
    <View className={styles.row} style={{ alignItems: 'stretch', marginBottom: 10 }}><StatTile icon="dumbbell" label="Workouts" value={String(state.workouts.length)} /><StatTile icon="calendar" label="This month" value={String(state.workouts.filter(workout => workout.d.slice(0, 7) === todayISO().slice(0, 7)).length)} /></View>
    <View className={styles.row} style={{ alignItems: 'stretch', marginBottom: 12 }}><StatTile icon="flame" label="Week streak" value={state.workouts.length ? '1' : '0'} /><StatTile icon="scale" label="Weight 30d" value={weightDelta30 === null ? '—' : `${weightDelta30 > 0 ? '+' : ''}${formatNumber(weightDelta30, state.unit)}`} valueColor={weightDelta30 === null ? colors.text : weightDelta30 > 0 ? colors.orange : colors.accent} /></View>
    <Card><Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>Activity — last 12 months <Text style={{ color: colors.dim }}>· by time trained</Text></Text><ActivityHeatmap workouts={state.workouts} /></Card>
    <Card><View className={styles.between} style={{ marginBottom: 8 }}><Text className={styles.small}>Body weight</Text><View className={styles.row}><Button compact tone="tinted" icon="target">Goal</Button><Button compact tone="tinted" icon="plus">Log</Button></View></View><Segmented options={[{ value: '1M', label: '1M' }, { value: '3M', label: '3M' }, { value: '1Y', label: '1Y' }, { value: 'All', label: 'All' }]} value={weightRange} onChange={setWeightRange} />{weightPoints.length ? <MiniVolumeChart values={weightPoints} /> : <Text className={styles.small}>No data yet</Text>}</Card>
    <Card><Text className={styles.small} style={{ marginBottom: 12 }}>Exercise progress</Text>{state.routines[0]?.ex[0] ? <><Text className={styles.cardTitle}>{exerciseOf(state.routines[0].ex[0].id).n}</Text><Text className={styles.small} style={{ marginTop: 4 }}>Top set progress from your logged sessions.</Text><MiniVolumeChart values={recent.length ? recent.map(workout => ({ id: workout.id, value: workout.vol })) : [{ id: 'empty', value: 0 }]} /></> : <Text className={styles.small}>Finish your first workout to see progress curves here.</Text>}</Card>
    {recent.length ? <><View className={styles.between} style={{ marginBottom: 7, paddingHorizontal: 4 }}><Text className={styles.label}>Recent workouts</Text><Button compact tone="tinted" trailingIcon="chevronRight" onPress={() => navigate('history')}>All {state.workouts.length}</Button></View>{recent.map(workout => <Card key={workout.id} className={screenStyles.itemCard}><WorkoutListRow workout={workout} unit={state.unit} /></Card>)}</> : null}
  </Screen>
}

export function SettingsScreen({ navigate }: { navigate: Navigate }) {
  const { state, update, setRoutines, share, syncReminders } = useNativeStore()
  const [sharing, setSharing] = useState(false)
  const setReminder = async (on: boolean) => { const next = { ...state, reminder: { ...state.reminder, on } }; update(s => { s.reminder.on = on }); const granted = await syncReminders(true, next); if (on && !granted) Alert.alert('Reminders need a development build', 'Android Expo Go cannot load expo-notifications. Run the app as a native development build to receive workout reminders.') }
  return <Screen title="Settings" leading={<IconButton name="chevronLeft" label="Home" onPress={() => navigate('home')} />}>
    <Section title="General"><Card className={screenStyles.listCard}><ListRow icon="scale" iconColor="#40c8e0" title="Weight unit"><Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={state.unit} onChange={value => update(s => { s.unit = value as 'kg' | 'lb' })} /></ListRow><View className={screenStyles.rowSeparator} /><ListRow icon="bell" iconColor={colors.pink} title="Workout reminders" subtitle="Native notifications for planned days"><Toggle value={state.reminder.on} onChange={setReminder} /></ListRow>{state.reminder.on ? <><View className={screenStyles.rowSeparator} /><ListRow icon="timer" iconColor={colors.purple} title="Reminder time"><TextInput value={state.reminder.time} onChangeText={time => update(s => { s.reminder.time = time })} onEndEditing={({ nativeEvent }) => { void syncReminders(false, { ...state, reminder: { ...state.reminder, time: nativeEvent.text } }).catch(() => undefined) }} placeholder="08:00" placeholderTextColor={colors.dim} keyboardType="numbers-and-punctuation" style={{ width: 82, backgroundColor: colors.raised, color: colors.text, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, textAlign: 'center' }} /></ListRow></> : null}</Card></Section>
    <Section title="During a workout"><Card className={screenStyles.listCard}><ListRow icon="sun" iconColor={colors.yellow} title="Keep screen awake"><Toggle value={state.keepAwake} onChange={value => update(s => { s.keepAwake = value })} /></ListRow><View className={screenStyles.rowSeparator} /><ListRow icon="bell" iconColor={colors.pink} title="Sounds"><Toggle value={state.sound} onChange={value => update(s => { s.sound = value })} /></ListRow><View className={screenStyles.rowSeparator} /><ListRow icon="timer" iconColor={colors.orange} title="Rest timer" value={`${state.restSec}s`} /></Card></Section>
    <Section title="Appearance"><Card className={screenStyles.listCard}><ListRow icon="moon" iconColor="#5e5ce6" title="Theme"><Segmented options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} value={state.theme} onChange={value => update(s => { s.theme = value as 'dark' | 'light' })} /></ListRow><View className={screenStyles.rowSeparator} /><ListRow icon="person" iconColor="#40c8e0" title="Body diagram"><Segmented options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={state.body} onChange={value => update(s => { s.body = value as 'male' | 'female' })} /></ListRow><View className={screenStyles.rowSeparator} /><View style={{ padding: 14 }}><Text className={styles.listTitle}>Accent color</Text><View className={styles.row} style={{ marginTop: 12, flexWrap: 'wrap' }}>{Object.entries({ lime: '#30d158', sky: '#0a84ff', orange: '#ff9f0a', violet: '#bf5af2', pink: '#ff375f', red: '#ff453a', teal: '#40c8e0', gold: '#ffd60a' }).map(([key, color]) => <Pressable key={key} onPress={() => update(s => { s.accent = key })} accessibilityLabel={key} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, borderWidth: state.accent === key ? 2 : 0, borderColor: colors.text }} />)}</View></View></Card></Section>
    <Section title="Data"><Card className={screenStyles.listCard}><ListRow icon="sparkles" iconColor={colors.accent} title="Load starter plan (PPL)" accessory onPress={() => setRoutines(starterRoutines())} /><View className={screenStyles.rowSeparator} /><ListRow icon="download" iconColor={colors.blue} title="Export backup (JSON)" accessory onPress={async () => { setSharing(true); try { await share() } catch (error) { Alert.alert('Could not share backup', error instanceof Error ? error.message : String(error)) } finally { setSharing(false) } }} /></Card></Section>
    {sharing ? <ActivityLabel /> : null}
    <Text className={styles.small} style={{ textAlign: 'center', marginTop: 4, marginBottom: 8 }}>openGym · free & open source (AGPL v3)</Text>
  </Screen>
}

function ActivityLabel() { return <View className={styles.button} style={{ backgroundColor: colors.raised, marginBottom: 12 }}><Text className={styles.buttonText}>Preparing backup…</Text></View> }
