import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/cn';
import { SceneBoundary } from './SceneBoundary';
import type { CorePulse } from './types';
import { supportsWebGL } from './webgl';

const SignalCore = lazy(() => import('./SignalCore'));

interface CoreStageProps {
  pulse: CorePulse | null;
  onCoreClick?: () => void;
  className?: string;
}

function StaticCore({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="size-40 rotate-45 rounded-[2rem] border border-line-strong bg-gradient-to-br from-[#5be7ff]/25 via-[#7b8cff]/20 to-[#ff8ad8]/20 shadow-[0_0_80px_-10px_rgb(91_231_255/0.45)]" />
      {message ? <p className="absolute bottom-4 max-w-xs px-4 text-center text-xs text-ink-faint">{message}</p> : null}
    </div>
  );
}

/**
 * Lazy-loads the WebGL scene with sensible fallbacks, and manages when the
 * scene may capture the wheel / touch gestures so the page always stays scrollable.
 */
export function CoreStage({ pulse, onCoreClick, className }: CoreStageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  const [engaged, setEngaged] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  // Tapping or clicking anywhere else releases the scene.
  useEffect(() => {
    if (!engaged) return;
    const release = (event: PointerEvent) => {
      if (!stage.current?.contains(event.target as Node)) setEngaged(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setEngaged(false);
    document.addEventListener('pointerdown', release);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', release);
      document.removeEventListener('keydown', onKey);
    };
  }, [engaged]);

  let hint: string;
  if (coarsePointer)
    hint = engaged ? 'Pinch to zoom, drag to rotate. Tap outside to release.' : 'Tap to interact with the core.';
  else hint = engaged ? 'Scroll to zoom, drag to rotate.' : 'Drag to rotate. Click the core to send a request.';

  return (
    <div
      ref={stage}
      className={cn('relative isolate', className)}
      onPointerDown={() => setEngaged(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setEngaged(false)}
    >
      <div
        className="pointer-events-none absolute inset-[12%] -z-10 rounded-full bg-[radial-gradient(circle,rgb(91_231_255/0.22),rgb(182_156_255/0.12)_45%,transparent_70%)] blur-2xl"
        aria-hidden
      />
      {supportsWebGL ? (
        // The radial mask lets orbits and pulses fade into the page instead of being cut at the canvas edge.
        <div className="absolute inset-0 [mask-image:radial-gradient(closest-side,#000_72%,transparent)]">
          <SceneBoundary fallback={<StaticCore message="The 3D scene could not start on this device." />}>
            <Suspense fallback={<StaticCore />}>
              <SignalCore
                pulse={pulse}
                reducedMotion={reducedMotion}
                zoomEnabled={engaged}
                controlsEnabled={!coarsePointer || engaged}
                onCoreClick={onCoreClick}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : (
        <StaticCore message="WebGL is unavailable in this browser, so the 3D view is replaced by a still image." />
      )}
      {supportsWebGL ? (
        <p
          className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-ink-faint"
          aria-live="polite"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
