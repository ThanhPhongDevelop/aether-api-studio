export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Aether API Studio';
export const APP_VERSION = __APP_VERSION__;

/** Base URL for API calls. "/api" in development goes through the Vite proxy. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

/** Offer the seeded demo accounts on the sign-in screen (turn off for real deployments). */
export const SHOW_DEMO_ACCOUNTS = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

export const DEMO_ACCOUNTS = [
  { label: 'Demo member', email: 'demo@aether.dev', password: 'Demo@123456' },
  { label: 'Administrator', email: 'admin@aether.dev', password: 'Admin@123456' },
] as const;

export const pageTitle = (title: string) => `${title} — ${APP_NAME}`;
