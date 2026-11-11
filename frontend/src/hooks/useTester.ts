import { useSyncExternalStore } from 'react';
import { isDirty, testerStore } from '@/lib/tester-store';

/** The API Tester's draft request and last response (shared across screens). */
export function useTester() {
  const state = useSyncExternalStore(testerStore.subscribe, testerStore.get);
  return { ...state, dirty: isDirty(state) };
}
