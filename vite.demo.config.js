// Single-file demo build: one chunk, ready to inline into a standalone page.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'client/demo.html'),
      output: { inlineDynamicImports: true, manualChunks: undefined }
    }
  }
});
