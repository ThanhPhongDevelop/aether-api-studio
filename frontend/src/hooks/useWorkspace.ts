import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { testerStore } from '@/lib/tester-store';
import {
  collectionService,
  environmentService,
  historyService,
  savedRequestService,
  type HistoryQuery,
} from '@/services/workspace.service';
import type { EnvironmentInput, SavedRequestInput } from '@/types/models';
import { useAuth } from './useAuth';

export const workspaceKeys = {
  collections: ['collections'] as const,
  environments: ['environments'] as const,
  history: ['history'] as const,
  historyList: (query: HistoryQuery) => ['history', 'list', query] as const,
  historyEntry: (id: string) => ['history', 'entry', id] as const,
  dashboard: ['dashboard'] as const,
};

function useSignedIn() {
  return useAuth().status === 'authenticated';
}

// ─── Collections & saved requests ─────────────────────────────────────────────

export function useCollections() {
  return useQuery({
    queryKey: workspaceKeys.collections,
    queryFn: ({ signal }) => collectionService.list(signal),
    enabled: useSignedIn(),
    staleTime: 30_000,
  });
}

export function useCollectionMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKeys.collections });

  return {
    create: useMutation({ mutationFn: collectionService.create, onSuccess: refresh }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => collectionService.update(id, { name }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: collectionService.remove, onSuccess: refresh }),
  };
}

export function useSavedRequestMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKeys.collections });

  return {
    create: useMutation({ mutationFn: savedRequestService.create, onSuccess: refresh }),
    replace: useMutation({
      mutationFn: ({ id, input }: { id: string; input: SavedRequestInput }) => savedRequestService.replace(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: savedRequestService.remove,
      onSuccess: (_result, id) => {
        testerStore.detach(id);
        return refresh();
      },
    }),
  };
}

// ─── Environments ─────────────────────────────────────────────────────────────

export function useEnvironments() {
  return useQuery({
    queryKey: workspaceKeys.environments,
    queryFn: ({ signal }) => environmentService.list(signal),
    enabled: useSignedIn(),
    staleTime: 30_000,
  });
}

/** The active environment and its enabled variables, ready for `{{name}}` substitution. */
export function useActiveEnvironment() {
  const { data: environments, isPending } = useEnvironments();
  return useMemo(() => {
    const environment = environments?.find((candidate) => candidate.isActive) ?? null;
    const variables = new Map<string, string>(
      environment?.variables.filter((variable) => variable.enabled).map((variable) => [variable.key, variable.value]) ??
        [],
    );
    return { environment, environments: environments ?? [], variables, isPending };
  }, [environments, isPending]);
}

export function useEnvironmentMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: workspaceKeys.environments });

  return {
    create: useMutation({ mutationFn: environmentService.create, onSuccess: refresh }),
    replace: useMutation({
      mutationFn: ({ id, input }: { id: string; input: EnvironmentInput }) => environmentService.replace(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: environmentService.remove, onSuccess: refresh }),
    activate: useMutation({
      mutationFn: async (id: string | null): Promise<void> => {
        if (id) await environmentService.activate(id);
        else await environmentService.deactivate();
      },
      onSuccess: refresh,
    }),
  };
}

// ─── History ──────────────────────────────────────────────────────────────────

export function useHistory(query: HistoryQuery) {
  return useQuery({
    queryKey: workspaceKeys.historyList(query),
    queryFn: ({ signal }) => historyService.list(query, signal),
    enabled: useSignedIn(),
    placeholderData: keepPreviousData,
  });
}

export function useHistoryMutations() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.history }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
    ]);

  return {
    remove: useMutation({ mutationFn: historyService.remove, onSuccess: refresh }),
    clear: useMutation({ mutationFn: historyService.clear, onSuccess: refresh }),
  };
}
