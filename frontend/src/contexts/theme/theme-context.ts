import { createContext } from 'react';
import type { ThemeSetting } from '@/types/models';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export interface ThemeContextValue {
  /** What the person chose. */
  preference: ThemePreference;
  /** What is actually applied after resolving "system". */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Account settings store the theme in upper case. */
export const THEME_TO_SETTING: Record<ThemePreference, ThemeSetting> = {
  dark: 'DARK',
  light: 'LIGHT',
  system: 'SYSTEM',
};
export const SETTING_TO_THEME: Record<ThemeSetting, ThemePreference> = {
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system',
};
