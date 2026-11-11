import { use } from 'react';
import { ThemeContext } from '@/contexts/theme/theme-context';

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}
