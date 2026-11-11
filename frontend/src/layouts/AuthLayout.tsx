import { useCallback, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/navigation/ThemeToggle';
import { CoreStage } from '@/components/three/CoreStage';
import type { CorePulse } from '@/components/three/types';
import { useEffectsPreference } from '@/hooks/useSettings';
import { TONE_HEX, toneForStatus } from '@/lib/http';
import type { AuthOutletContext } from './auth-outlet';

/** Sign-in and sign-up: the form on one side, the signal core reacting to each attempt on the other. */
export function AuthLayout() {
  const [pulse, setPulse] = useState<CorePulse | null>(null);
  const { effects3d } = useEffectsPreference();

  const signal = useCallback((status: number) => {
    setPulse((previous) => ({ id: (previous?.id ?? 0) + 1, color: TONE_HEX[toneForStatus(status)] }));
  }, []);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="rounded-lg" aria-label="Aether API Studio, home">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet context={{ signal } satisfies AuthOutletContext} />
          </div>
        </main>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-faint">
          <Link to="/docs" className="hover:text-ink">
            API docs
          </Link>
          <Link to="/products" className="hover:text-ink">
            Products
          </Link>
          <Link to="/status" className="hover:text-ink">
            System status
          </Link>
        </footer>
      </div>

      <aside className="relative hidden flex-col items-center justify-center gap-6 overflow-hidden border-l border-line bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)] px-10 lg:flex">
        {effects3d ? <CoreStage pulse={pulse} className="aspect-square w-full max-w-[32rem]" /> : null}
        <p className="mx-auto max-w-sm text-center text-[0.8125rem] text-ink-muted">
          Every answer from the API lights the core: green for success, amber for a client error, rose when nothing
          comes back.
        </p>
      </aside>
    </div>
  );
}
