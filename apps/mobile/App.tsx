import { useState } from 'react'
import { Pressable, StatusBar, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NativeProvider, useNativeStore } from './src/store'
import { HomeScreen, HistoryScreen, LibraryScreen, PlanScreen, SettingsScreen, StatsScreen, WorkoutScreen, type ScreenName } from './src/screens'
import { colors, Loading, styles } from './src/ui'

const tabs: Array<{ id: ScreenName; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'plan', label: 'Plan' },
  { id: 'workout', label: 'Train' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'More' },
]

function TabBar({ current, navigate }: { current: ScreenName; navigate: (screen: ScreenName) => void }) {
  return <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 8, flexDirection: 'row' }}>
    {tabs.map(tab => <Pressable key={tab.id} onPress={() => navigate(tab.id)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 7, opacity: pressed ? 0.65 : 1 })}>
      <Text style={{ color: current === tab.id ? '#30d158' : colors.muted, fontSize: 12, fontWeight: current === tab.id ? '800' : '600' }}>{tab.label}</Text>
    </Pressable>)}
  </View>
}

function NativeApp() {
  const { ready } = useNativeStore()
  const [screen, setScreen] = useState<ScreenName>('home')
  if (!ready) return <Loading />

  const navigate = (next: ScreenName) => setScreen(next)
  let content
  if (screen === 'home') content = <HomeScreen navigate={navigate} />
  else if (screen === 'plan') content = <PlanScreen navigate={navigate} />
  else if (screen === 'workout') content = <WorkoutScreen navigate={navigate} />
  else if (screen === 'history') content = <HistoryScreen navigate={navigate} />
  else if (screen === 'library') content = <LibraryScreen />
  else if (screen === 'stats') content = <StatsScreen />
  else content = <SettingsScreen />

  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
    <View style={{ flex: 1 }}>{content}</View>
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flex: 1 }}><TabBar current={screen} navigate={navigate} /></View>
      <Pressable onPress={() => navigate('library')} style={{ justifyContent: 'center', paddingHorizontal: 16, borderLeftWidth: 1, borderLeftColor: colors.border }}><Text style={{ color: screen === 'library' ? '#30d158' : colors.muted, fontSize: 12, fontWeight: '800' }}>Library</Text></Pressable>
      <Pressable onPress={() => navigate('stats')} style={{ justifyContent: 'center', paddingHorizontal: 13, borderLeftWidth: 1, borderLeftColor: colors.border }}><Text style={{ color: screen === 'stats' ? '#30d158' : colors.muted, fontSize: 12, fontWeight: '800' }}>Stats</Text></Pressable>
    </View>
  </SafeAreaView>
}

export default function App() {
  return <SafeAreaProvider><NativeProvider><NativeApp /></NativeProvider></SafeAreaProvider>
}
