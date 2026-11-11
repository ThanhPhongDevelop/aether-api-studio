import { MoreHorizontal, Pencil, Plus, Trash2, UserRoundCheck, UserRoundX, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { UserDialog } from '@/components/users/UserDialog';
import { Avatar } from '@/components/ui/Avatar';
import { ToneBadge } from '@/components/ui/Badges';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Menu } from '@/components/ui/Menu';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { pageTitle } from '@/config/app';
import { useAuth } from '@/hooks/useAuth';
import { useUserMutations, useUsers } from '@/hooks/useCatalog';
import { useConfirm } from '@/hooks/useConfirm';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/hooks/useToast';
import { useUrlState } from '@/hooks/useUrlState';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/form-errors';
import { formatDate, formatRelative } from '@/lib/format';
import type { PublicUser, Role } from '@/types/models';

const DEFAULTS = { search: '', role: '', status: '', sort: '-createdAt', page: '1' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [editing, setEditing] = useState<PublicUser | 'new' | null>(null);
  const { update, remove } = useUserMutations();

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const users = useUsers({
    page: Number(filters.page) || 1,
    limit: 10,
    search: filters.search || undefined,
    role: (filters.role || undefined) as Role | undefined,
    isActive: filters.status === '' ? undefined : filters.status === 'active',
    sort: filters.sort,
  });

  const setActive = async (user: PublicUser, isActive: boolean) => {
    if (!isActive) {
      const confirmed = await confirm({
        title: `Deactivate ${user.name}?`,
        description: 'They are signed out everywhere and cannot sign in until reactivated. Their data is kept.',
        confirmLabel: 'Deactivate account',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    try {
      await update.mutateAsync({ id: user.id, input: { isActive } });
      toast.success(isActive ? 'Account reactivated' : 'Account deactivated', user.name);
    } catch (error) {
      toast.error('Account not changed', errorMessage(error));
    }
  };

  const destroy = async (user: PublicUser) => {
    const confirmed = await confirm({
      title: `Delete ${user.name}?`,
      description:
        'Their collections, environments, history and notifications are deleted with the account. Products they created are kept.',
      confirmLabel: 'Delete user',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(user.id);
      toast.success('User deleted', user.name);
    } catch (error) {
      toast.error('User not deleted', errorMessage(error));
    }
  };

  const items = users.data?.items ?? [];
  const filtered = Boolean(filters.search || filters.role || filters.status);

  return (
    <>
      <title>{pageTitle('Users')}</title>
      <PageHeader
        title="Users"
        description="Everyone with an account. Administrators can change roles, deactivate accounts and reset passwords."
        actions={
          <Button icon={<Plus />} onClick={() => setEditing('new')}>
            New user
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name or email"
          label="Search users"
          shortcut
          className="w-full sm:w-72"
        />
        <Select
          aria-label="Role"
          value={filters.role}
          onChange={(event) => setFilters({ role: event.target.value })}
          className="w-40"
        >
          <option value="">All roles</option>
          <option value="ADMIN">Administrators</option>
          <option value="USER">Members</option>
        </Select>
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(event) => setFilters({ status: event.target.value })}
          className="w-36"
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </Select>
        <Select
          aria-label="Sort by"
          value={filters.sort}
          onChange={(event) => setFilters({ sort: event.target.value })}
          className="ml-auto w-48"
        >
          <option value="-createdAt">Newest first</option>
          <option value="createdAt">Oldest first</option>
          <option value="name">Name, A to Z</option>
          <option value="email">Email, A to Z</option>
          <option value="-lastLoginAt">Recently signed in</option>
        </Select>
      </div>

      {users.isError && !users.data ? (
        <ErrorState message={errorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : (
        <div
          className={cn(
            'glass overflow-hidden rounded-[1.25rem] transition-opacity',
            users.isPlaceholderData && 'opacity-60',
          )}
        >
          {users.isPending ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filtered ? 'No user matches these filters' : 'No users'}
              description={filtered ? 'Clear the search or a filter.' : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] table-fixed text-sm">
                <caption className="sr-only">Users</caption>
                <colgroup>
                  <col />
                  <col className="w-36" />
                  <col className="w-32" />
                  <col className="w-36" />
                  <col className="w-32" />
                  <col className="w-20" />
                </colgroup>
                <thead className="border-b border-line text-left text-xs text-ink-faint">
                  <tr>
                    <th className="px-5 py-3 font-normal">Person</th>
                    <th className="px-3 py-3 font-normal">Role</th>
                    <th className="px-3 py-3 font-normal">Status</th>
                    <th className="px-3 py-3 font-normal">Last sign-in</th>
                    <th className="px-3 py-3 font-normal">Joined</th>
                    <th className="px-5 py-3 font-normal">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((user) => {
                    const isSelf = user.id === me?.id;
                    return (
                      <tr key={user.id} className="transition-colors hover:bg-line/40">
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={user.name} src={user.avatarUrl} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {user.name}
                                {isSelf ? (
                                  <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-ink-faint">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ToneBadge tone={user.role === 'ADMIN' ? 'redirect' : 'neutral'}>
                            {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
                          </ToneBadge>
                        </td>
                        <td className="px-3 py-3">
                          <ToneBadge tone={user.isActive ? 'ok' : 'fail'}>
                            {user.isActive ? 'Active' : 'Deactivated'}
                          </ToneBadge>
                        </td>
                        <td className="px-3 py-3 text-ink-muted">
                          {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
                        </td>
                        <td className="px-3 py-3 text-ink-muted">{formatDate(user.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <Menu
                            trigger={(props) => (
                              <Button
                                {...props}
                                variant="ghost"
                                size="sm"
                                className="size-8 px-0"
                                aria-label={`Actions for ${user.name}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            )}
                            items={[
                              { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing(user) },
                              user.isActive
                                ? {
                                    label: 'Deactivate',
                                    icon: <UserRoundX />,
                                    disabled: isSelf,
                                    onSelect: () => void setActive(user, false),
                                  }
                                : {
                                    label: 'Reactivate',
                                    icon: <UserRoundCheck />,
                                    onSelect: () => void setActive(user, true),
                                  },
                              'separator',
                              {
                                label: 'Delete',
                                icon: <Trash2 />,
                                tone: 'danger',
                                disabled: isSelf,
                                onSelect: () => void destroy(user),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {users.data && users.data.meta.total > 0 ? (
            <Pagination
              meta={users.data.meta}
              onPageChange={(page) => setFilters({ page: String(page) })}
              noun="users"
              className="border-t border-line px-5 py-3"
            />
          ) : null}
        </div>
      )}

      <UserDialog open={editing !== null} user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
