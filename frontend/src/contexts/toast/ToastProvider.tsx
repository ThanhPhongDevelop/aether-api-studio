import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toaster } from '@/components/feedback/Toaster';
import { ToastContext, type ToastApi, type ToastItem, type ToastOptions } from './toast-context';

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = { success: 3_500, info: 4_500, warning: 6_000, error: 7_000 } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const tone = options.tone ?? 'info';
    const toast: ToastItem = {
      id: `toast-${counter.current}`,
      title: options.title,
      description: options.description,
      tone,
      duration: options.duration ?? DEFAULT_DURATION[tone],
      action: options.action,
    };
    // The same message twice in a row replaces the earlier copy instead of stacking.
    setToasts((current) =>
      [...current.filter((item) => item.title !== toast.title || item.description !== toast.description), toast].slice(
        -MAX_VISIBLE,
      ),
    );
    return toast.id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'error' }),
      info: (title, description) => show({ title, description, tone: 'info' }),
      warning: (title, description) => show({ title, description, tone: 'warning' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}
