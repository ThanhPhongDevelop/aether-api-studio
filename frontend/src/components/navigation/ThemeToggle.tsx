import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { THEME_TO_SETTING } from '@/contexts/theme/theme-context';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';

/** Flips light/dark; for signed-in people the choice is saved to their account too. */
export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const { status } = useAuth();
  const updateSettings = useUpdateSettings();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = `Switch to ${next} theme`;

  const toggle = () => {
    setPreference(next);
    if (status === 'authenticated') updateSettings.mutate({ theme: THEME_TO_SETTING[next] });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label={label} title={label} className="size-8 px-0">
      {resolved === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
