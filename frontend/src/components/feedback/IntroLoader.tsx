import { AnimatePresence, m } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const MINIMUM_MS = 550;

/**
 * Shown once per page load while the session is restored: the prism mark draws
 * itself, then the overlay lifts. Never holds the app back longer than needed.
 */
export function IntroLoader() {
  const { status } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), reducedMotion ? 0 : MINIMUM_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const visible = status === 'loading' || !minimumElapsed;

  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="intro"
          role="status"
          aria-label="Loading Aether"
          exit={{ opacity: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
          className="fixed inset-0 z-[150] grid place-items-center bg-canvas"
        >
          <div className="flex flex-col items-center gap-6">
            <svg viewBox="0 0 32 32" className="size-16" aria-hidden>
              <defs>
                <linearGradient id="intro-spectrum" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#5BE7FF" />
                  <stop offset="0.45" stopColor="#7B8CFF" />
                  <stop offset="0.75" stopColor="#B69CFF" />
                  <stop offset="1" stopColor="#FF8AD8" />
                </linearGradient>
              </defs>
              <path
                d="M16 4.75 25.75 10.4v11.2L16 27.25 6.25 21.6V10.4Z"
                fill="none"
                stroke="url(#intro-spectrum)"
                strokeWidth="1.6"
                strokeLinejoin="round"
                pathLength={1}
                className="intro-draw"
              />
              <path d="M16 10.5 21.5 20h-11Z" fill="url(#intro-spectrum)" className="intro-core" />
            </svg>
            <div className="h-px w-28 overflow-hidden rounded-full bg-line">
              <div className="intro-bar h-full w-1/2 rounded-full bg-accent" />
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
