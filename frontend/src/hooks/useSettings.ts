import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/lib/form-errors';
import { settingsService, type SettingsInput } from '@/services/account.service';
import type { UserSettings } from '@/types/models';
import { useAuth } from './useAuth';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useToast } from './useToast';

export const settingsKeys = { all: ['settings'] as const };

export function useSettings() {
  const { status } = useAuth();
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: ({ signal }) => settingsService.get(signal),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

/** Saves immediately and updates the cache first, so toggles feel instant; rolls back on failure. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: SettingsInput) => settingsService.update(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.all });
      const previous = queryClient.getQueryData<UserSettings>(settingsKeys.all);
      if (previous) queryClient.setQueryData<UserSettings>(settingsKeys.all, { ...previous, ...input });
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKeys.all, context.previous);
      toast.error('Settings were not saved', errorMessage(error));
    },
    onSuccess: (settings) => queryClient.setQueryData(settingsKeys.all, settings),
  });
}

/**
 * Whether to animate and whether to render WebGL, combining the operating
 * system's reduced-motion setting with the account's own preferences.
 */
export function useEffectsPreference() {
  const systemReduced = usePrefersReducedMotion();
  const { data } = useSettings();
  return {
    reducedMotion: systemReduced || Boolean(data?.reducedMotion),
    effects3d: data?.enable3dEffects ?? true,
  };
}
