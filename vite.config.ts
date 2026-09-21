import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Identificador único de build. En el contenedor llega como argumento `BUILD_ID`
 * (hash de commit); en local se genera uno por arranque.
 */
const buildId = process.env.BUILD_ID ?? `local-${Date.now().toString(36)}`;

/**
 * Emite `version.json` junto al build y lo sirve en desarrollo.
 * El cliente lo consulta para detectar una versión nueva (PLAN §16.2).
 */
function versionManifest(): Plugin {
  const body = () => JSON.stringify({ buildId }, null, 2);
  return {
    name: 'version-manifest',
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(body());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body() });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionManifest()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/integration/setup.ts'],
        },
      },
    ],
  },
});
