import { Bell, Keyboard, LogOut, Settings, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Menu } from '@/components/ui/Menu';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

export function UserMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  if (!user) return null;

  const signOut = async () => {
    await logout();
    toast.success('Signed out');
    void navigate('/login', { replace: true });
  };

  return (
    <Menu
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Account menu for ${user.name}`}
          className="rounded-full transition-shadow hover:shadow-[0_0_0_3px_var(--line-strong)]"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        </button>
      )}
      header={
        <div className="mb-1.5 border-b border-line px-2.5 pt-1 pb-2.5">
          <p className="truncate text-[0.8125rem] font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-faint">{user.email}</p>
        </div>
      }
      items={[
        { label: 'Profile', icon: <UserRound />, onSelect: () => void navigate('/profile') },
        { label: 'Settings', icon: <Settings />, onSelect: () => void navigate('/settings') },
        { label: 'Notifications', icon: <Bell />, onSelect: () => void navigate('/notifications') },
        'separator',
        { label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: onOpenShortcuts },
        { label: 'Sign out', icon: <LogOut />, tone: 'danger', onSelect: () => void signOut() },
      ]}
    />
  );
}
