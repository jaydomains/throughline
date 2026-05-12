import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.THROUGHLINE_BACKEND_URL ?? 'http://127.0.0.1:47823';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/events': { target: BACKEND, changeOrigin: false, ws: false },
      '/health': { target: BACKEND, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
