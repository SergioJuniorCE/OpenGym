import { PropsWithChildren, ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleProp, Text, TextInput, View, ViewStyle, type TextInputProps } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { ACCENT_ON_CONTENT, ACCENTS, PALETTE, cx, uiClasses } from '@opengym/ui'

// JS-only colors are the adapter for SVG strokes and computed values. Static
// component geometry and theme-aware surfaces live in the shared UniWind CSS.
export const colors = {
  bg: PALETTE.dark.bg, surface: PALETTE.dark.surface, raised: PALETTE.dark.surface2, control: PALETTE.dark.surface3,
  border: PALETTE.dark.separator, text: PALETTE.dark.label, muted: PALETTE.dark.label2,
  dim: PALETTE.dark.label3, danger: PALETTE.dark.red, orange: PALETTE.dark.orange, yellow: PALETTE.dark.yellow,
  blue: PALETTE.dark.blue, purple: PALETTE.dark.purple, pink: PALETTE.dark.pink, accent: ACCENTS.lime, onAccent: ACCENT_ON_CONTENT.lime,
  accentSoft: 'rgba(48, 209, 88, 0.16)',
}

// Kept as a compatibility alias for screen code while the implementation is
// now a class contract, not a React Native StyleSheet object.
export const styles = uiClasses

type IconName = string

export function Icon({ name, size = 24, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  const common = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const }
  let content: ReactNode = null
  switch (name) {
    case 'house': content = <Path {...common} d="M3.5 10.7 12 3.8l8.5 6.9M5.9 9.4V19a1.4 1.4 0 0 0 1.4 1.4h9.4A1.4 1.4 0 0 0 18.1 19V9.4" />; break
    case 'calendar': content = <><Rect {...common} x="3.4" y="5.2" width="17.2" height="15.4" rx="3.2" /><Path {...common} d="M8.2 3.4v3.4M15.8 3.4v3.4M3.4 10.2h17.2" /></>; break
    case 'chart': content = <Path {...common} d="M4.5 20.2V13M9.5 20.2V6.4M14.5 20.2v-5.1M19.5 20.2V9.6" />; break
    case 'magnifier': content = <><Circle {...common} cx="11" cy="11" r="7" /><Path {...common} d="m20.5 20.5-4.4-4.4" /></>; break
    case 'gear': content = <><Path {...common} d="M20.48 10.59 20.48 13.41 18.58 13.72 17.87 15.43 19 17 17 19 15.43 17.87 13.72 18.58 13.41 20.48 10.59 20.48 10.28 18.58 8.57 17.87 7 19 5 17 6.13 15.43 5.42 13.72 3.52 13.41 3.52 10.59 5.42 10.28 6.13 8.57 5 7 7 5 8.57 6.13 10.28 5.42 10.59 3.52 13.41 3.52 13.72 5.42 15.43 6.13 17 5 19 7 17.87 8.57 18.58 10.28Z" /><Circle {...common} cx="12" cy="12" r="3.1" /></>; break
    case 'dumbbell': content = <><Rect {...common} x="5.9" y="7.9" width="3.2" height="8.2" rx="1.3" /><Rect {...common} x="14.9" y="7.9" width="3.2" height="8.2" rx="1.3" /><Path {...common} d="M9.1 12h5.8M3.6 9.9v4.2M20.4 9.9v4.2" /></>; break
    case 'list': content = <Path {...common} d="M8.4 6.6h11.2M8.4 12h11.2M8.4 17.4h11.2M4.6 6.6h.01M4.6 12h.01M4.6 17.4h.01" />; break
    case 'history': content = <><Path {...common} d="M4.5 12.2a7.6 7.6 0 1 0 2.5-5.6" /><Path {...common} d="M4.1 4.4v4.3h4.3M12 8.3v4.2l3.1 1.9" /></>; break
    case 'scale': content = <><Rect {...common} x="3.4" y="4.4" width="17.2" height="16.2" rx="3.4" /><Path {...common} d="M8.3 9.2a3.9 3.9 0 0 1 7.4 0M12 9.2v2.5M8.9 16.2h6.2" /></>; break
    case 'flame': content = <Path {...common} d="M12 20.4c3.2 0 5.4-2.1 5.4-5.1 0-3.9-3.4-5.6-2.6-9.8-2.5.8-4 2.9-4 5.1 0 1-.5 1.6-1.2 1.6-.8 0-1.2-.7-1.2-1.8-1.1 1.2-1.8 2.9-1.8 4.9 0 3 2.2 5.1 5.4 5.1Z" />; break
    case 'timer': content = <><Circle {...common} cx="12" cy="13.4" r="7.2" /><Path {...common} d="M12 9.6v3.8h2.8M9.6 3.4h4.8" /></>; break
    case 'target': content = <><Circle {...common} cx="12" cy="12" r="8.2" /><Circle {...common} cx="12" cy="12" r="4.6" /><Circle cx="12" cy="12" r="1.1" fill={color} /></>; break
    case 'plus': content = <Path {...common} d="M12 5.2v13.6M5.2 12h13.6" />; break
    case 'minus': content = <Path {...common} d="M5.2 12h13.6" />; break
    case 'check': content = <Path {...common} d="m4.8 12.6 4.8 4.8L19.2 6.8" />; break
    case 'play': content = <Path {...common} d="M8.4 5.6 18 12l-9.6 6.4Z" />; break
    case 'pause': content = <Path {...common} d="M9.4 5.8v12.4M14.6 5.8v12.4" />; break
    case 'upload': content = <Path {...common} d="M12 15.6V4.2M7.6 8.2 12 3.8l4.4 4.4M4.6 19.4h14.8" />; break
    case 'download': content = <Path {...common} d="M12 3.8v11.4M7.6 11.2 12 15.6l4.4-4.4M4.6 19.4h14.8" />; break
    case 'sparkles': content = <><Path {...common} d="m8.4 3.8 1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L4.4 7.8l2.9-1.1Z" /><Path {...common} d="m16.2 12.4.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8Z" /></>; break
    case 'clipboard': content = <><Rect {...common} x="5.4" y="4.8" width="13.2" height="15.8" rx="2.6" /><Path {...common} d="M9 4.8a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 4.8v1.4H9Z" /><Path {...common} d="M9.2 11.6h5.6M9.2 15.2h4" /></>; break
    case 'chevronRight': content = <Path {...common} d="m9.6 5.6 6.6 6.4-6.6 6.4" />; break
    case 'chevronLeft': content = <Path {...common} d="m14.4 5.6-6.6 6.4 6.6 6.4" />; break
    case 'chevronDown': content = <Path {...common} d="m5.6 9.4 6.4 6.2 6.4-6.2" />; break
    case 'info': content = <><Circle {...common} cx="12" cy="12" r="8.2" /><Path {...common} d="M12 11v5.4" /><Circle cx="12" cy="7.9" r=".9" fill={color} /></>; break
    case 'bell': content = <><Path {...common} d="M6.6 10.4a5.4 5.4 0 0 1 10.8 0c0 4 1.4 5.6 1.4 5.6H5.2s1.4-1.6 1.4-5.6Z" /><Path {...common} d="M10.1 19.2a2.1 2.1 0 0 0 3.8 0" /></>; break
    case 'moon': content = <Path {...common} d="M19.4 14.2A7.8 7.8 0 0 1 9.8 4.6a8.2 8.2 0 1 0 9.6 9.6Z" />; break
    case 'sun': content = <><Circle {...common} cx="12" cy="12" r="4.4" /><Path {...common} d="M12 3.6v2M12 18.4v2M20.4 12h-2M5.6 12h-2M17.94 6.06l-1.42 1.42M7.48 16.52l-1.42 1.42M17.94 17.94l-1.42-1.42M7.48 7.48 6.06 6.06" /></>; break
    case 'person': content = <><Circle {...common} cx="12" cy="8" r="3.8" /><Path {...common} d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" /></>; break
    case 'trash': content = <><Path {...common} d="M4.8 6.6h14.4M9.4 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.8" /><Path {...common} d="M6.6 6.6 7.4 19a1.6 1.6 0 0 0 1.6 1.4h6a1.6 1.6 0 0 0 1.6-1.4l.8-12.4M10.4 10.2v6.4M13.6 10.2v6.4" /></>; break
    case 'flag': content = <><Path {...common} d="M6 20.4V4.2" /><Path {...common} d="M6.4 5.2h13v9.2h-13" /><Path {...common} d="M12.9 5.2v9.2M6.4 9.8h13" /></>; break
    case 'shuffle': content = <><Path {...common} d="M4.5 7.2h2.2c3.1 0 4.3 9.6 7.6 9.6h5.2" /><Path {...common} d="m16.8 13.9 2.7 2.9-2.7 2.9M4.5 16.8h2.2c1 0 1.7-.6 2.3-1.4M14.1 7.2h5.4" /><Path {...common} d="m16.8 4.3 2.7 2.9-2.7 2.9" /></>; break
    case 'xmark': content = <Path {...common} d="m6.5 6.5 11 11M17.5 6.5l-11 11" />; break
    default: content = <Circle {...common} cx="12" cy="12" r="8" />
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={undefined}>{content}</Svg>
}

export function Screen({ children, title, subtitle, action, leading, compactHeader = false, scroll = true }: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode; leading?: ReactNode; compactHeader?: boolean; scroll?: boolean }>) {
  const content = <View className={scroll ? styles.screen : styles.screenStatic}>
    <View className={cx(styles.header, compactHeader && styles.headerCompact)}>
      <View className={cx(styles.headerRow, compactHeader && styles.headerRowCompact)}>
        {leading}
        <View className={cx(styles.listMain, compactHeader && 'items-center')}>
          <Text className={compactHeader ? styles.compactTitle : styles.title}>{title}</Text>
          {subtitle ? <Text className={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
    </View>
    {children}
  </View>
  return scroll ? <ScrollView className={styles.root} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>{content}</ScrollView> : <View className={styles.root}>{content}</View>
}

export function Card({ children, style, className }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; className?: string }>) { return <View className={cx(styles.card, className)} style={style}>{children}</View> }

export function Button({ children, onPress, tone = 'accent', disabled = false, compact = false, icon, trailingIcon }: PropsWithChildren<{ onPress?: () => void; tone?: 'accent' | 'muted' | 'tinted' | 'danger'; disabled?: boolean; compact?: boolean; icon?: string; trailingIcon?: string }>) {
  const backgroundColor = tone === 'accent' ? colors.accent : tone === 'tinted' ? colors.accentSoft : tone === 'danger' ? 'rgba(255,69,58,.15)' : colors.raised
  const color = tone === 'accent' ? colors.onAccent : tone === 'tinted' ? colors.accent : tone === 'danger' ? '#ff8c86' : colors.text
  return <Pressable disabled={disabled} onPress={onPress} className={cx(styles.button, compact && styles.buttonCompact)} style={({ pressed }) => ({ backgroundColor, opacity: disabled ? 0.32 : pressed ? 0.7 : 1 })}>
    {icon ? <Icon name={icon} size={compact ? 16 : 19} color={color} /> : null}<Text className={cx(styles.buttonText, compact && styles.buttonTextCompact)} style={{ color }}>{children}</Text>{trailingIcon ? <Icon name={trailingIcon} size={compact ? 16 : 19} color={color} /> : null}
  </Pressable>
}

export function IconButton({ name, onPress, label, size = 36 }: { name: string; onPress?: () => void; label: string; size?: number }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} className={styles.iconButton} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.65 : 1 })}><Icon name={name} size={size >= 36 ? 19 : 16} /></Pressable>
}

export function Section({ title, children, action }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  return <View className={styles.section}><View className={styles.sectionHeader}><Text className={styles.label}>{title}</Text>{action}</View>{children}</View>
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  return <View className={styles.fieldGroup}>{label ? <Text className={styles.label}>{label}</Text> : null}<TextInput {...props} placeholderTextColor={colors.dim} className={styles.input} style={style} /></View>
}

export function Stat({ label, value, accent = colors.accent }: { label: string; value: string; accent?: string }) {
  return <View className={styles.stat}><Text className={styles.small}>{label}</Text><Text className={styles.statValue} style={{ color: accent }}>{value}</Text></View>
}

export function Chip({ children, selected = false, onPress }: PropsWithChildren<{ selected?: boolean; onPress?: () => void }>) {
  return <Pressable onPress={onPress} className={styles.chip} style={({ pressed }) => ({ backgroundColor: selected ? colors.accent : colors.surface, opacity: pressed ? 0.7 : 1 })}><Text className={styles.chipText} style={selected ? { color: colors.onAccent, fontWeight: '500' } : undefined}>{children}</Text></Pressable>
}

export function Toggle({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} className={cx(styles.toggle, value && styles.toggleOn)} style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.75 : 1 })}>
    <View className={styles.toggleKnob} style={{ transform: [{ translateX: value ? 20 : 0 }] }} />
  </Pressable>
}

export function Segmented({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return <View className={styles.segmented}>
    {options.map(option => { const selected = option.value === value; return <Pressable key={option.value} onPress={() => onChange(option.value)} className={cx(styles.segmentedOption, selected && styles.segmentedSelected)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}><Text className={cx(styles.segmentedText, selected && styles.segmentedTextSelected)}>{option.label}</Text></Pressable> })}
  </View>
}

export function ListRow({ children, icon, iconColor = colors.accent, title, subtitle, value, accessory = false, onPress, danger = false }: PropsWithChildren<{ icon?: string; iconColor?: string; title: string; subtitle?: string; value?: ReactNode; accessory?: boolean; onPress?: () => void; danger?: boolean }>) {
  const content = <View className={styles.listRow}>{icon ? <View className={styles.listIcon} style={{ backgroundColor: iconColor }}><Icon name={icon} size={18} color="#ffffff" /></View> : null}<View className={styles.listMain}><Text className={styles.listTitle} style={danger ? { color: colors.danger } : undefined}>{title}</Text>{subtitle ? <Text className={styles.listSubtitle}>{subtitle}</Text> : null}</View>{children}{value !== undefined ? <Text className={styles.body} numberOfLines={1}>{value}</Text> : null}{accessory ? <Icon name="chevronRight" size={16} /> : null}</View>
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>{content}</Pressable> : content
}

export function Loading() { return <View className={cx(styles.root, 'items-center', 'justify-center')}><ActivityIndicator color={colors.accent} size="large" /></View> }

export function Empty({ children }: PropsWithChildren) { return <View className={styles.empty}><Icon name="clipboard" size={34} color={colors.muted} /><Text className={cx(styles.body, 'text-center', 'mt-3')}>{children}</Text></View> }
