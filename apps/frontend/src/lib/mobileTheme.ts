import type { CSSProperties } from 'react'

export type MobileThemeKey =
  | 'gms_default'
  | 'black_red'
  | 'black_gold'
  | 'orange_purple'
  | 'green_black'

export type MobileThemePreset = {
  key: MobileThemeKey
  label: string
  description: string
  header: string
  primary: string
  primaryDark: string
  primarySoft: string
  accent: string
  contrast: string
  shadow: string
}

export const MOBILE_THEME_PRESETS: MobileThemePreset[] = [
  {
    key: 'gms_default',
    label: 'Predeterminado GMS',
    description: 'Negro, fucsia y blanco.',
    header: '#090912',
    primary: '#c026d3',
    primaryDark: '#a21caf',
    primarySoft: '#fdf4ff',
    accent: '#f0abfc',
    contrast: '#ffffff',
    shadow: 'rgba(192, 38, 211, 0.28)',
  },
  {
    key: 'black_red',
    label: 'Negro / Rojo',
    description: 'Energia fuerte con alto contraste.',
    header: '#070707',
    primary: '#dc2626',
    primaryDark: '#991b1b',
    primarySoft: '#fef2f2',
    accent: '#fecaca',
    contrast: '#ffffff',
    shadow: 'rgba(220, 38, 38, 0.26)',
  },
  {
    key: 'black_gold',
    label: 'Negro / Dorado',
    description: 'Elegante, sobrio y premium.',
    header: '#080706',
    primary: '#d97706',
    primaryDark: '#92400e',
    primarySoft: '#fffbeb',
    accent: '#fde68a',
    contrast: '#ffffff',
    shadow: 'rgba(217, 119, 6, 0.26)',
  },
  {
    key: 'orange_purple',
    label: 'Naranjo / Morado',
    description: 'Vibrante, moderno y creativo.',
    header: '#2e1065',
    primary: '#f97316',
    primaryDark: '#c2410c',
    primarySoft: '#fff7ed',
    accent: '#d8b4fe',
    contrast: '#ffffff',
    shadow: 'rgba(249, 115, 22, 0.28)',
  },
  {
    key: 'green_black',
    label: 'Verde / Negro',
    description: 'Activo, limpio y deportivo.',
    header: '#052e16',
    primary: '#16a34a',
    primaryDark: '#166534',
    primarySoft: '#f0fdf4',
    accent: '#bbf7d0',
    contrast: '#ffffff',
    shadow: 'rgba(22, 163, 74, 0.26)',
  },
]

export const getMobileTheme = (key?: string | null) =>
  MOBILE_THEME_PRESETS.find((theme) => theme.key === key) || MOBILE_THEME_PRESETS[0]

export const mobileThemeStyle = (key?: string | null) => {
  const theme = getMobileTheme(key)
  return {
    '--mobile-header': theme.header,
    '--mobile-primary': theme.primary,
    '--mobile-primary-dark': theme.primaryDark,
    '--mobile-primary-soft': theme.primarySoft,
    '--mobile-accent': theme.accent,
    '--mobile-contrast': theme.contrast,
    '--mobile-primary-shadow': theme.shadow,
  } as CSSProperties
}
