import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion } from 'framer-motion';
import { RouterProvider } from 'react-router/dom';
import { CustomCursor } from '@/components/effects/CustomCursor';
import { IntroLoader } from '@/components/feedback/IntroLoader';
import { Preferences } from '@/components/feedback/Preferences';
import { AuthProvider } from '@/contexts/auth/AuthProvider';
import { ConfirmProvider } from '@/contexts/confirm/ConfirmProvider';
import { ThemeProvider } from '@/contexts/theme/ThemeProvider';
import { ToastProvider } from '@/contexts/toast/ToastProvider';
import { router } from '@/router';
import { ApiError } from '@/services/api-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      // Retry network hiccups once; client errors (4xx) will not fix themselves.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
      refetchOnWindowFocus: (query) => query.state.status !== 'error',
    },
  },
});

// Animation features are fetched after first paint; `strict` forbids the heavy `motion.*` components.
const loadMotionFeatures = () => import('@/lib/motion-features').then((module) => module.default);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LazyMotion features={loadMotionFeatures} strict>
          <ToastProvider>
            <AuthProvider>
              <ConfirmProvider>
                <Preferences>
                  <RouterProvider router={router} />
                  <CustomCursor />
                  <IntroLoader />
                </Preferences>
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </LazyMotion>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
