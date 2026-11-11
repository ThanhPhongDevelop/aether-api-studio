import {
  Activity,
  Bell,
  BookOpen,
  LayoutDashboard,
  Package,
  Send,
  Settings,
  UserRound,
  Users,
  Variable,
  type LucideIcon,
} from 'lucide-react';
import type { PublicUser } from '@/types/models';

/** Who may open a screen: anyone, any signed-in account, or administrators. */
export type Access = 'public' | 'user' | 'admin';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  access: Access;
  /** Two-key shortcut, e.g. "g t" (press g, then t). */
  shortcut?: string;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        access: 'user',
        shortcut: 'g d',
        keywords: 'stats charts usage',
      },
      {
        to: '/tester',
        label: 'API Tester',
        icon: Send,
        access: 'user',
        shortcut: 'g t',
        keywords: 'request send postman',
      },
      {
        to: '/environments',
        label: 'Environments',
        icon: Variable,
        access: 'user',
        shortcut: 'g e',
        keywords: 'variables baseUrl token',
      },
    ],
  },
  {
    label: 'Explore',
    items: [
      {
        to: '/docs',
        label: 'API docs',
        icon: BookOpen,
        access: 'public',
        shortcut: 'g o',
        keywords: 'openapi endpoints reference',
      },
      {
        to: '/products',
        label: 'Products',
        icon: Package,
        access: 'public',
        shortcut: 'g p',
        keywords: 'catalog catalogue',
      },
      {
        to: '/status',
        label: 'System status',
        icon: Activity,
        access: 'public',
        shortcut: 'g h',
        keywords: 'health uptime database',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, access: 'admin', shortcut: 'g u', keywords: 'accounts roles' },
    ],
  },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: UserRound, access: 'user', keywords: 'account password avatar' },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    access: 'user',
    shortcut: 'g s',
    keywords: 'theme preferences 3d motion',
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: Bell,
    access: 'user',
    shortcut: 'g n',
    keywords: 'alerts inbox',
  },
];

export function canAccess(access: Access, user: PublicUser | null): boolean {
  if (access === 'public') return true;
  if (access === 'user') return user !== null;
  return user?.role === 'ADMIN';
}

/** Every routed screen with a shortcut, for the shortcuts dialog and the global key handler. */
export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), ...ACCOUNT_ITEMS];
