# Estado de implementación

> Documento vivo exigido por la Fase 7 del [AGENT_PROMPT.md](AGENT_PROMPT.md). Se actualiza al cerrar cada hito.

## Completado

- **M0 · Andamiaje, i18n y documentación base** — Vite 8 + React 19 + TypeScript 6 (strict), TypeScript
  por capas (el núcleo compila sin DOM), ESLint con frontera de capas y prohibición de texto literal,
  Vitest (unit + integración), Playwright (Chromium + Firefox), `version.json` + `__BUILD_ID__`,
  i18n tipada, contenedor (Dockerfile multi-etapa + nginx sin privilegios + compose) con prueba de humo.

## En curso

- M1 · Modelo y canonicalización.

## Tests fallando

Ninguno.

## Limitaciones conocidas

- Ninguna todavía.

## Decisiones abiertas

- Proveedor de despliegue (Q3.9): no afecta el código; la imagen corre en cualquier host de contenedores.

## Desviaciones técnicas respecto del plan

| Plan | Implementación | Motivo |
|---|---|---|
| Node 20 LTS | Node 24 LTS en el contenedor; local ≥ 22 | Node 20 terminó su soporte en abril de 2026 |
| React 18 | React 19 | Versión estable vigente |
| TypeScript (última) | TypeScript 6.0 | typescript-eslint todavía no soporta TypeScript 7 |
| Nombres de tipos y props en español en ejemplos del plan (`bobina`, `estadoInicial`) | En inglés en el código (`coil`, `initialState`) | Convención: código en inglés, UI en español (docs/CONVENCIONES.md) |
| Ejemplos servidos en `/examples/*.json` | Ejemplos empaquetados en el bundle | Sin ruta extra que cachear; se versionan con el resto de los assets |
