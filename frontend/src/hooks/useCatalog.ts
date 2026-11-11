import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  productService,
  userService,
  type ProductInput,
  type ProductQuery,
  type UpdateUserInput,
  type UserQuery,
} from '@/services/catalog.service';
import { useAuth } from './useAuth';

export const catalogKeys = {
  products: ['products'] as const,
  productList: (query: ProductQuery, viewer: string) => ['products', 'list', viewer, query] as const,
  categories: ['products', 'categories'] as const,
  users: ['users'] as const,
  userList: (query: UserQuery) => ['users', 'list', query] as const,
};

export function useProducts(query: ProductQuery) {
  const { user } = useAuth();
  return useQuery({
    // Admins see inactive products too, so the cache is kept per kind of viewer.
    queryKey: catalogKeys.productList(query, user?.role ?? 'guest'),
    queryFn: ({ signal }) => productService.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: ({ signal }) => productService.categories(signal),
    staleTime: 60_000,
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.products });

  return {
    create: useMutation({ mutationFn: productService.create, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: number; input: Partial<ProductInput> }) => productService.update(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: productService.remove, onSuccess: refresh }),
  };
}

export function useUsers(query: UserQuery) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: catalogKeys.userList(query),
    queryFn: ({ signal }) => userService.list(query, signal),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.users });

  return {
    create: useMutation({ mutationFn: userService.create, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) => userService.update(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: userService.remove, onSuccess: refresh }),
  };
}
