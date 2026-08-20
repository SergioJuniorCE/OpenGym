export const ACCENTS = {
  lime: '#30d158',
  sky: '#0a84ff',
  orange: '#ff9f0a',
  violet: '#bf5af2',
  pink: '#ff375f',
  red: '#ff453a',
  teal: '#40c8e0',
  gold: '#ffd60a',
} as const

export type AccentName = keyof typeof ACCENTS
export type ThemeName = 'dark' | 'light'

export const PALETTE = {
  dark: {
    bg: '#000000',
    bgElevated: '#0e0e10',
    surface: '#1c1c1e',
    surface2: '#2c2c2e',
    surface3: '#3a3a3c',
    label: '#ffffff',
    label2: 'rgba(235,235,245,.60)',
    label3: 'rgba(235,235,245,.32)',
    label4: 'rgba(235,235,245,.18)',
    separator: 'rgba(84,84,88,.60)',
    separatorOpaque: 'rgba(84,84,88,.34)',
    blue: '#0a84ff',
    green: '#30d158',
    red: '#ff453a',
    orange: '#ff9f0a',
    yellow: '#ffd60a',
    teal: '#40c8e0',
    indigo: '#5e5ce6',
    pink: '#ff375f',
    purple: '#bf5af2',
    mint: '#63e6e2',
    brown: '#ac8e68',
    grey: '#8e8e93',
  },
  light: {
    bg: '#f2f2f7',
    bgElevated: '#f7f7fa',
    surface: '#ffffff',
    surface2: '#ececef',
    surface3: '#e3e3e8',
    label: '#000000',
    label2: 'rgba(60,60,67,.60)',
    label3: 'rgba(60,60,67,.30)',
    label4: 'rgba(60,60,67,.16)',
    separator: 'rgba(60,60,67,.29)',
    separatorOpaque: 'rgba(60,60,67,.20)',
    blue: '#007aff',
    green: '#34c759',
    red: '#ff3b30',
    orange: '#ff9500',
    yellow: '#ffcc00',
    teal: '#30b0c7',
    indigo: '#5856d6',
    pink: '#ff2d55',
    purple: '#af52de',
    mint: '#00c7be',
    brown: '#a2845e',
    grey: '#8e8e93',
  },
} as const

export const UI_GEOMETRY = {
  screenMaxWidth: 560,
  pagePadding: 16,
  tabBarBottomPadding: 6,
  cardRadius: 14,
  controlRadius: 12,
  smallRadius: 8,
  chipRadius: 99,
} as const

export const ACCENT_ON_CONTENT: Record<AccentName, '#000000' | '#ffffff'> = {
  lime: '#000000',
  sky: '#ffffff',
  orange: '#000000',
  violet: '#ffffff',
  pink: '#ffffff',
  red: '#ffffff',
  teal: '#000000',
  gold: '#000000',
}

export function isAccentName(value: string): value is AccentName {
  return value in ACCENTS
}

export function accentColor(value: string | undefined): string {
  return isAccentName(value || '') ? ACCENTS[value as AccentName] : ACCENTS.lime
}
