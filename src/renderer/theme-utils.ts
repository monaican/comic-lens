export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'comic-lens-theme'

export function normalizeTheme(value: string | null | undefined): ThemeMode {
  return value === 'dark' ? 'dark' : 'light'
}
