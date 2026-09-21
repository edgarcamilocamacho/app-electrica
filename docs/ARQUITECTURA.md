# Arquitectura

Referencia completa y justificación de cada decisión: [PLAN.md](../PLAN.md). Este documento describe
**lo que existe hoy en el código** y se completa en cada hito.

## Capas

```
src/app/        React: lienzo SVG, paneles, herramientas, i18n, store (zustand)
   │  despacha operaciones, lee estado derivado
   ▼
src/core/       TypeScript puro, sin DOM ni React ni textos de UI
src/platform/   reloj, archivos, autoguardado, verificación de versión (inyectables)
```

Garantías automáticas:
- `tsconfig.core.json` compila `src/core` sin `lib: DOM` → usar `window` o `document` es un error de tipos.
- ESLint prohíbe en `src/core` importar React, zustand, `app/` o `platform/`, y usar globals de navegador.
- ESLint prohíbe texto de UI literal en JSX (`local/no-literal-ui-text`).

## Build y versión

- `vite.config.ts` inyecta `__BUILD_ID__` (variable de entorno `BUILD_ID`) y emite `dist/version.json`.
- En desarrollo, `/version.json` lo sirve un middleware de Vite.

## Contenedor

- `Dockerfile`: etapa de compilación (Node 24 + pnpm) y etapa de runtime (nginx sin privilegios, puerto 8080).
- `deploy/nginx.conf`: `no-store` para `/`, `index.html`, `version.json` y `/healthz`; `immutable` para
  `/assets/`; 404 real para assets inexistentes.
- `deploy/security-headers.conf`: CSP `default-src 'self'` y demás cabeceras, incluidas en cada location.
- `scripts/docker-smoke.mjs`: construye, levanta y verifica la imagen real.
