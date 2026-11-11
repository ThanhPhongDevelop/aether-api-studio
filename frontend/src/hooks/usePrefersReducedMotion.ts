import { useMediaQuery } from './useMediaQuery';

/** Live value of the operating system's "reduce motion" setting. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
