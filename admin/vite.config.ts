import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => `/api/v1${path}`,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => `/api/v1${path}`,
      },
      '/moderation': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => `/api/v1${path}`,
      },
    },
  },
});
