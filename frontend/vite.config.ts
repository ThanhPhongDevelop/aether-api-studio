/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => {
  // Load every variable (not only VITE_*) so DEV_PROXY_TARGET stays out of the client bundle.
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  const proxy = {
    '/api': { target: env.DEV_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      // three.js is loaded lazily in its own chunk; it is large by nature.
      chunkSizeWarningLimit: 1000,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
