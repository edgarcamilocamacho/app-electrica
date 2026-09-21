# Convenciones

## Idioma

- **Interfaz: español.** Todo texto visible sale de `src/app/i18n/es.ts` vía `t('clave')`. El lint
  (`local/no-literal-ui-text`) rechaza texto literal en JSX y en `aria-label`, `title`, `placeholder`
  y `alt`.
- **Código: inglés.** Identificadores, tipos de componente (`coil`, `timer-ton`), nombres de propiedades
  (`initialState`, `presetMs`) y mensajes de commit. Los documentos de producto y de arquitectura, en
  español.
- **Núcleo sin textos.** `src/core` devuelve códigos y parámetros (`{ code: 'REF_BROKEN', ref: 'K3' }`);
  la UI los traduce.

## Capas

- `src/core` no importa React, zustand, `app/` ni `platform/`, y no usa `window`, `document`,
  `localStorage`, `navigator`, `fetch` ni `performance`. Lo garantizan dos cosas: el lint y
  `tsconfig.core.json`, que compila el núcleo **sin** los tipos del DOM.
- Toda mutación del documento pasa por el historial (`commit`). Nunca se modifica el documento del
  store directamente.
- Las operaciones del núcleo son **funciones puras** `(documento, args, ctx) → documento`. Los ids
  nuevos salen de `ctx.ids`, así los tests son deterministas.

## Coordenadas

- El documento guarda coordenadas en **unidades de grid enteras**. La UI dibuja el mundo en unidades de
  grid y escala por `GRID_PX × zoom`.
- `y` crece hacia abajo. Rotación en sentido horario, en pasos de 90°.

## Pruebas

- `tests/unit`: núcleo, entorno Node, sin DOM, sin mocks: entra un documento, sale un estado.
- `tests/integration`: store y máquina de interacción con jsdom.
- `tests/e2e`: Playwright en Chromium y Firefox. Sin `sleep`: el reloj de simulación se avanza con el
  gancho de pruebas. La acción bajo prueba siempre se hace por la UI real.
- Cada hito se cierra con sus pruebas de los tres niveles.

## Commits

- Un commit por hito como mínimo, con el prefijo del hito: `M3: operaciones topológicas…`.
- `pnpm check` en verde antes de commitear.
