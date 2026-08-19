import { PropsWithChildren, ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { ACCENTS } from './core'

export const colors = {
  bg: '#0c0e12', surface: '#15181e', raised: '#20242c', border: '#2b3039',
  text: '#f2f2f7', muted: '#9b9da5', dim: '#686b74', danger: '#ff453a', white: '#ffffff',
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 108 },
  header: { marginBottom: 20 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  buttonText: { fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  input: { backgroundColor: colors.raised, borderRadius: 12, color: colors.text, minHeight: 46, paddingHorizontal: 13, fontSize: 16 },
})

export function Screen({ children, title, subtitle, scroll = true }: PropsWithChildren<{ title: string; subtitle?: string; scroll?: boolean }>) {
  const content = <View style={scroll ? styles.scroll : { flex: 1, padding: 18 }}><View style={styles.header}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{children}</View>
  return scroll ? <ScrollView style={styles.root} contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView> : <View style={styles.root}>{content}</View>
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) { return <View style={[styles.card, style]}>{children}</View> }

export function Button({ children, onPress, tone = 'accent', disabled = false, compact = false }: PropsWithChildren<{ onPress?: () => void; tone?: 'accent' | 'muted' | 'danger'; disabled?: boolean; compact?: boolean }>) {
  const backgroundColor = tone === 'accent' ? ACCENTS.lime : tone === 'danger' ? '#3d1b21' : colors.raised
  const color = tone === 'accent' ? '#07100a' : tone === 'danger' ? '#ff8c86' : colors.text
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, compact && { minHeight: 38, borderRadius: 11, paddingHorizontal: 12 }, { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.72 : 1 }]}><Text style={[styles.buttonText, { color }]}>{children}</Text></Pressable>
}

export function Section({ title, children, action }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return <View style={{ marginBottom: 20 }}><View style={[styles.between, { marginBottom: 10 }]}><Text style={styles.label}>{title}</Text>{action}</View>{children}</View>
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7, marginBottom: 13 }}>{label ? <Text style={styles.label}>{label}</Text> : null}<TextInput {...props} placeholderTextColor={colors.dim} style={[styles.input, style]} /></View>
}

export function Stat({ label, value, accent = ACCENTS.lime }: { label: string; value: string; accent?: string }) {
  return <View style={{ flex: 1 }}><Text style={[styles.label, { marginBottom: 4 }]}>{label}</Text><Text style={{ color: accent, fontSize: 24, fontWeight: '800' }}>{value}</Text></View>
}

export function Loading() { return <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={ACCENTS.lime} size="large" /></View> }

export function Empty({ children }: PropsWithChildren) { return <Card><Text style={[styles.body, { textAlign: 'center' }]}>{children}</Text></Card> }
