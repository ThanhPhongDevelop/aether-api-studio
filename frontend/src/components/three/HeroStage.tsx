import type { MotionValue } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { SceneBoundary } from './SceneBoundary';
import type { CorePulse } from './types';
import { supportsWebGL } from './webgl';

const HeroScene = lazy(() => import('./HeroScene'));

interface HeroStageProps {
  pulse: CorePulse | null;
  scroll: MotionValue<number>;
  reducedMotion: boolean;
  onCoreClick?: () => void;
}

/** A soft static glow where the core would be: shown while loading and wherever WebGL is unavailable. */
function StaticBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute top-[12%] right-[8%] size-[min(38rem,70vw)] rounded-full bg-[radial-gradient(circle,rgb(91_231_255/0.22),rgb(182_156_255/0.12)_45%,transparent_70%)] blur-2xl" />
    </div>
  );
}

/** The full-bleed scene behind the landing page (fixed, so sections scroll over it). */
export function HeroStage({ pulse, scroll, reducedMotion, onCoreClick }: HeroStageProps) {
  const { resolved } = useTheme();
  return (
    <div className="fixed inset-0 -z-10" aria-hidden>
      {supportsWebGL ? (
        <SceneBoundary fallback={<StaticBackdrop />}>
          <Suspense fallback={<StaticBackdrop />}>
            <HeroScene
              pulse={pulse}
              scroll={scroll}
              theme={resolved}
              reducedMotion={reducedMotion}
              onCoreClick={onCoreClick}
            />
          </Suspense>
        </SceneBoundary>
      ) : (
        <StaticBackdrop />
      )}
    </div>
  );
}
