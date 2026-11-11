import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CorePulse } from '@/components/three/types';
import { TONE_HEX, toneForStatus, type HttpMethod } from '@/lib/http';
import { sendProbe } from '@/services/http-probe';
import { systemKeys } from './useSystem';

/**
 * Sends a real request to the API on demand and turns each answer into a
 * coloured pulse for the 3D core (green 2xx, amber 4xx, rose 5xx / no response).
 */
export function useApiProbe(method: HttpMethod, path: string) {
  const queryClient = useQueryClient();
  const [pulse, setPulse] = useState<CorePulse | null>(null);

  const mutation = useMutation({
    mutationFn: () => sendProbe(method, path),
    onSuccess: (result) => {
      setPulse((previous) => ({ id: (previous?.id ?? 0) + 1, color: TONE_HEX[toneForStatus(result.status)] }));
      void queryClient.invalidateQueries({ queryKey: systemKeys.health });
    },
  });

  const send = () => {
    if (!mutation.isPending) mutation.mutate();
  };

  return { method, path, send, result: mutation.data ?? null, isPending: mutation.isPending, pulse };
}
