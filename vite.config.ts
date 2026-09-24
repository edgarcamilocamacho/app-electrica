import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudApiPlugin } from './server/devPlugin.ts';

/**
 * Identificador único de build. En el contenedor llega como argumento `BUILD_ID`
 * (hash de commit); en local se genera uno por arranque.
 */
const buildId = process.env.BUILD_ID ?? `local-${Date.now().toString(36)}`;

/** Versión de la app (semver), la de package.json. Se muestra en la barra de estado. */
export const appVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string })
  .version;

/**
 * Emite `version.json` junto al build y lo sirve en desarrollo.
 * El cliente lo consulta para detectar una versión nueva (PLAN §16.2).
 */
function versionManifest(): Plugin {
  const body = () => JSON.stringify({ buildId, version: appVersion }, null, 2);
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
  plugins: [react(), versionManifest(), cloudApiPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(appVersion),
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
