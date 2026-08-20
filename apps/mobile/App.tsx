import './src/global.css'

import { useEffect, useState } from 'react'
import { Pressable, StatusBar, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { Uniwind } from 'uniwind'
import { ACCENTS, cx, uiClasses } from '@opengym/ui'
import { NativeProvider, useNativeStore } from './src/store'
import { HomeScreen, HistoryScreen, LibraryScreen, PlanScreen, SettingsScreen, StatsScreen, WorkoutScreen, type ScreenName } from './src/screens'
import { colors, Icon, Loading } from './src/ui'
import { routineForDay } from './src/core'

const tabs: Array<{ id: ScreenName; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: 'house' },
  { id: 'plan', label: 'Plan', icon: 'calendar' },
  { id: 'stats', label: 'Stats', icon: 'chart' },
  { id: 'library', label: 'Exercises', icon: 'list' },
]

function TabBar({ current, navigate }: { current: ScreenName; navigate: (screen: ScreenName) => void }) {
  const { state, setSelectedRoutine } = useNativeStore()
  const active = !!state.active
  const goStart = () => {
    if (active) { navigate('workout'); return }
    const routine = routineForDay(state)
    if (routine) { setSelectedRoutine(routine.id); navigate('workout') } else navigate('plan')
  }
  const renderTab = (tab: { id: ScreenName; label: string; icon: string }) => {
    const selected = current === tab.id || (current === 'history' && tab.id === 'stats') || (current === 'settings' && tab.id === 'home')
    return <Pressable key={tab.id} onPress={() => navigate(tab.id)} className={uiClasses.tab} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      <Icon name={tab.icon} size={25} color={selected ? colors.accent : colors.text} />
      <Text className={uiClasses.tabLabel} style={selected ? { color: colors.accent, fontWeight: '600' } : undefined}>{tab.label}</Text>
    </Pressable>
  }
  return <View className={uiClasses.tabBar}>
    {renderTab(tabs[0])}
    {renderTab(tabs[1])}
    <Pressable onPress={goStart} className={uiClasses.tabCenter} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View className={uiClasses.tabCircle} style={active ? { backgroundColor: colors.orange, shadowColor: colors.orange } : undefined}><Icon name={active ? 'play' : 'dumbbell'} size={26} color={active ? '#000000' : colors.onAccent} /></View>
      <Text className={uiClasses.tabLabel} style={{ color: active ? colors.orange : colors.accent, fontWeight: '600' }}>{active ? 'Resume' : 'Start'}</Text>
    </Pressable>
    {renderTab(tabs[2])}
    {renderTab(tabs[3])}
  </View>
}

function NativeApp() {
  const { ready, state } = useNativeStore()
  const [screen, setScreen] = useState<ScreenName>('home')
  useEffect(() => {
    Uniwind.setTheme(state.theme === 'light' ? 'light' : 'dark')
    const accent = ACCENTS[state.accent as keyof typeof ACCENTS] || ACCENTS.lime
    Uniwind.updateCSSVariables('dark', { '--color-og-acc': accent })
    Uniwind.updateCSSVariables('light', { '--color-og-acc': accent })
  }, [state.theme, state.accent])
  if (!ready) return <Loading />

  const navigate = (next: ScreenName) => setScreen(next)
  let content
  if (screen === 'home') content = <HomeScreen navigate={navigate} />
  else if (screen === 'plan') content = <PlanScreen navigate={navigate} />
  else if (screen === 'workout') content = <WorkoutScreen navigate={navigate} />
  else if (screen === 'history') content = <HistoryScreen navigate={navigate} />
  else if (screen === 'library') content = <LibraryScreen navigate={navigate} />
  else if (screen === 'stats') content = <StatsScreen navigate={navigate} />
  else content = <SettingsScreen navigate={navigate} />

  return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
    <View className={cx(uiClasses.root, 'flex-1')}>{content}</View>
    <TabBar current={screen} navigate={navigate} />
  </SafeAreaView>
}

export default function App() {
  return <SafeAreaProvider><NativeProvider><NativeApp /></NativeProvider></SafeAreaProvider>
}
