import { useNavigation } from 'react-router';

/** Thin bar under the header while a lazily loaded screen is on its way. */
export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
      role="progressbar"
      aria-label="Loading screen"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] rounded-full bg-accent" />
    </div>
  );
}
