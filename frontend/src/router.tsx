import { createBrowserRouter } from 'react-router';
import { GuestOnly, RequireAdmin, RequireAuth } from '@/components/auth/RouteGuards';
import { PageLoader } from '@/components/feedback/PageLoader';
import { RouteError } from '@/components/feedback/RouteError';

type PageModule = { default: React.ComponentType };

/** Every screen is its own chunk (code splitting), fetched on first visit. */
const page = (load: () => Promise<PageModule>) => () => load().then((module) => ({ Component: module.default }));

export const router = createBrowserRouter([
  {
    path: '/',
    ErrorBoundary: RouteError,
    HydrateFallback: PageLoader,
    children: [
      { index: true, lazy: page(() => import('@/pages/LandingPage')) },

      {
        Component: GuestOnly,
        children: [
          {
            lazy: () => import('@/layouts/AuthLayout').then((module) => ({ Component: module.AuthLayout })),
            children: [
              { path: 'login', lazy: page(() => import('@/pages/LoginPage')) },
              { path: 'register', lazy: page(() => import('@/pages/RegisterPage')) },
            ],
          },
        ],
      },

      {
        lazy: () => import('@/layouts/AppLayout').then((module) => ({ Component: module.AppLayout })),
        children: [
          // Open to everyone.
          { path: 'docs', lazy: page(() => import('@/pages/DocsPage')) },
          { path: 'products', lazy: page(() => import('@/pages/ProductsPage')) },
          { path: 'status', lazy: page(() => import('@/pages/SystemStatusPage')) },

          // Signed-in accounts.
          {
            Component: RequireAuth,
            children: [
              { path: 'dashboard', lazy: page(() => import('@/pages/DashboardPage')) },
              { path: 'tester', lazy: page(() => import('@/pages/TesterPage')) },
              { path: 'environments', lazy: page(() => import('@/pages/EnvironmentsPage')) },
              { path: 'profile', lazy: page(() => import('@/pages/ProfilePage')) },
              { path: 'settings', lazy: page(() => import('@/pages/SettingsPage')) },
              { path: 'notifications', lazy: page(() => import('@/pages/NotificationsPage')) },
            ],
          },

          // Administrators.
          {
            Component: RequireAdmin,
            children: [{ path: 'admin/users', lazy: page(() => import('@/pages/UsersPage')) }],
          },

          { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
        ],
      },
    ],
  },
]);
