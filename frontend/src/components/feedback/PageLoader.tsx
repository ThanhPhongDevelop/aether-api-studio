import { Logo } from '@/components/brand/Logo';

/** Shown while the first route chunk loads. */
export function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <div className="flex flex-col items-center gap-4">
        <Logo markOnly className="animate-pulse [&_svg]:size-12" />
        <span className="text-sm text-ink-muted">Loading Aether</span>
      </div>
    </div>
  );
}
