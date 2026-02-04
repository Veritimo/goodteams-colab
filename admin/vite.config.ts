import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src/platform/ui/admin'),
      '@platform-admin': path.resolve(__dirname, '../src/platform/ui/platform-admin'),
      '@onboarding': path.resolve(__dirname, '../src/platform/ui/onboarding'),
      '@platform': path.resolve(__dirname, '../src/platform'),
    },
  },
  server: {
    port: 3100,  // Will auto-increment if taken
    proxy: {
      '/api': {
        target: 'http://localhost:19100',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/admin',
    emptyOutDir: true,
  },
});
