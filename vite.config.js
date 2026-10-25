import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve('index.html'), admin: resolve('admin.html') } },
  },
});
