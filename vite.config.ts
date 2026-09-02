import react from '@vitejs/plugin-react';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const staticWorker = () => ({
  name: 'na-trave-static-worker',
  apply: 'build' as const,
  closeBundle() {
    mkdirSync('dist/server', { recursive: true });
    copyFileSync('server/index.js', 'dist/server/index.js');
  },
});

export default defineConfig({
  plugins: [react(), sites(), staticWorker()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
