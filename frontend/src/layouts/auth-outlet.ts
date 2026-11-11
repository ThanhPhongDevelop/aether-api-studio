import { useOutletContext } from 'react-router';

export interface AuthOutletContext {
  /** Light the core in the colour of an HTTP status (green 2xx, amber 4xx, rose 5xx / no answer). */
  signal: (status: number) => void;
}

export function useAuthSignal() {
  return useOutletContext<AuthOutletContext>().signal;
}
