import { defineConfig } from 'vite';

/**
 * Empaqueta la API (`server/main.ts`) en un solo archivo, con zod y el núcleo adentro: la imagen
 * de la API no lleva `node_modules` (PLAN §24.1).
 */
export default defineConfig({
  publicDir: false,
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
