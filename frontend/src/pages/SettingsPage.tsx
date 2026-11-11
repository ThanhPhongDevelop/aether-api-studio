import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { pageTitle } from '@/config/app';
import { SETTING_TO_THEME } from '@/contexts/theme/theme-context';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { errorMessage } from '@/lib/form-errors';
import type { ThemeSetting, UserSettings } from '@/types/models';

function TimeoutSetting({ settings }: { settings: UserSettings }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const [seconds, setSeconds] = useState(String(settings.requestTimeoutMs / 1000));
  const value = Number(seconds);
  const valid = Number.isFinite(value) && value >= 1 && value <= 120;
  const changed = valid && value * 1000 !== settings.requestTimeoutMs;

  return (
    <form
      className="flex flex-wrap items-end justify-between gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!changed) return;
        update.mutate(
          { requestTimeoutMs: Math.round(value * 1000) },
          { onSuccess: () => toast.success('Timeout saved', `Requests now give up after ${value} seconds.`) },
        );
      }}
    >
      <div className="min-w-0">
        <label htmlFor="timeout" className="text-sm font-medium text-ink">
          Request timeout
        </label>
        <p id="timeout-hint" className="mt-0.5 text-[0.8125rem] text-ink-muted">
          How long the API Tester waits for an answer, from 1 to 120 seconds.
        </p>
        {!valid ? (
          <p className="mt-1 text-xs text-fail" role="alert">
            Enter a number of seconds between 1 and 120.
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id="timeout"
          aria-describedby="timeout-hint"
          aria-invalid={!valid || undefined}
          inputMode="numeric"
          value={seconds}
          onChange={(event) => setSeconds(event.target.value.replace(/[^\d.]/g, ''))}
          className="w-20 text-right"
        />
        <span className="text-[0.8125rem] text-ink-muted">seconds</span>
        <Button type="submit" variant="secondary" size="sm" disabled={!changed} loading={update.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const { setPreference } = useTheme();
  const systemReducedMotion = usePrefersReducedMotion();

  const setTheme = (theme: ThemeSetting) => {
    setPreference(SETTING_TO_THEME[theme]);
    update.mutate({ theme });
  };

  return (
    <>
      <title>{pageTitle('Settings')}</title>
      <PageHeader
        title="Settings"
        description="Saved to your account, so they follow you to every browser you sign in from."
      />

      {settings.isPending ? (
        <div className="max-w-3xl space-y-5">
          <Skeleton className="h-36 rounded-[1.25rem]" />
          <Skeleton className="h-48 rounded-[1.25rem]" />
        </div>
      ) : settings.isError ? (
        <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="max-w-3xl space-y-5">
          <Panel aria-labelledby="appearance-title">
            <PanelHeader id="appearance-title" title="Appearance" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Theme</p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
                  “System” follows your operating system's light or dark mode.
                </p>
              </div>
              <SegmentedControl
                label="Theme"
                value={settings.data.theme}
                onChange={setTheme}
                options={[
                  { value: 'DARK', label: 'Dark' },
                  { value: 'LIGHT', label: 'Light' },
                  { value: 'SYSTEM', label: 'System' },
                ]}
              />
            </div>
          </Panel>

          <Panel aria-labelledby="motion-title" className="space-y-5">
            <PanelHeader id="motion-title" title="Effects and motion" />
            <Switch
              checked={settings.data.enable3dEffects}
              onChange={(enable3dEffects) => update.mutate({ enable3dEffects })}
              label="3D scenes and particles"
              description="The interactive signal core, the particle background and the cursor ring. Turn off on slower devices or to save battery."
            />
            <Switch
              checked={settings.data.reducedMotion || systemReducedMotion}
              disabled={systemReducedMotion}
              onChange={(reducedMotion) => update.mutate({ reducedMotion })}
              label="Reduce motion"
              description={
                systemReducedMotion
                  ? 'On because your operating system asks for reduced motion.'
                  : 'Stops animations, transitions and smooth scrolling across the app.'
              }
            />
          </Panel>

          <Panel aria-labelledby="requests-title">
            <PanelHeader id="requests-title" title="API Tester" />
            <TimeoutSetting key={settings.data.requestTimeoutMs} settings={settings.data} />
          </Panel>

          <Panel aria-labelledby="notifications-title">
            <PanelHeader id="notifications-title" title="Notifications" />
            <Switch
              checked={settings.data.notificationsEnabled}
              onChange={(notificationsEnabled) => update.mutate({ notificationsEnabled })}
              label="Informational notifications"
              description="Welcome messages and confirmations in the bell. Security warnings, such as a locked account or a changed password, always arrive."
            />
          </Panel>
        </div>
      )}
    </>
  );
}
