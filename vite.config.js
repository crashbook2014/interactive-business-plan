import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'client/index.html'),
        demo: path.resolve(import.meta.dirname, 'client/demo.html')
      }
    }
  },
  server: { proxy: { '/api': 'http://localhost:8787' } }
});
