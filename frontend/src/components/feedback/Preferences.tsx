import { MotionConfig } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { SETTING_TO_THEME } from '@/contexts/theme/theme-context';
import { useEffectsPreference, useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';

/**
 * Applies account settings to the whole interface: the saved theme, and
 * reduced motion for both CSS transitions and framer-motion animations.
 */
export function Preferences({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const { setPreference } = useTheme();
  const { reducedMotion } = useEffectsPreference();
  const savedTheme = settings?.theme;

  useEffect(() => {
    if (savedTheme) setPreference(SETTING_TO_THEME[savedTheme]);
  }, [savedTheme, setPreference]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  return <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>{children}</MotionConfig>;
}
