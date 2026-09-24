import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Empaqueta la API (`server/main.ts`) en un solo archivo, con zod y el núcleo adentro: la imagen
 * de la API no lleva `node_modules` (PLAN §24.1).
 */
export default defineConfig({
  publicDir: false,
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    sourcemap: false,
    rollupOptions: { output: { entryFileNames: 'server.js', format: 'esm' } },
  },
  ssr: { noExternal: true, target: 'node' },
});
