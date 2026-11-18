import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Multi-page build: the entry, the console, About and the design system. Pages render client-side from the API.
const pages = ['index.html', 'console/index.html', 'about/index.html', 'system/index.html'];

// Vite root is web/; the repo root stays the workspace (shared/, node_modules/, tests/).
const web = resolve(__dirname, 'web');

export default defineConfig({
  root: web,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        pages.filter((p) => existsSync(resolve(web, p))).map((p) => [p.replace(/\/?index\.html$/, '') || 'home', resolve(web, p)]),
      ),
    },
  },
  server: { proxy: { '/api': 'http://localhost:8787' }, fs: { allow: [__dirname] } },
  preview: { proxy: { '/api': 'http://localhost:8787' } },
  test: { root: __dirname, include: ['tests/**/*.test.ts'] },
});
