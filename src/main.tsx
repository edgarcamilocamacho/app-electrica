import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardApp } from './app/board/BoardApp';
import { createBoardStore } from './app/board/store';
import { installBoardE2EHooks } from './app/board/testHooks';
import { boardRegistry } from './core/board/catalog';
import { createRandomIdGen } from './core/model/ids';
import { catalogBoard, starterBoard } from './examples/board';
import { t } from './app/i18n/t';
import { VersionChecker } from './platform/version';
import './app/styles.css';

const params = new URLSearchParams(window.location.search);
const e2e = params.has('e2e');

if (e2e) {
  // Los selectores nativos de File System Access no son automatizables: en E2E se prueba la ruta
  // universal (descarga + <input type=file>).
  // Viven en el prototipo de Window: se tapan con una propiedad propia indefinida.
  for (const name of ['showSaveFilePicker', 'showOpenFilePicker']) {
    Object.defineProperty(window, name, { value: undefined, configurable: true });
  }
}

const ids = createRandomIdGen();
const store = createBoardStore(
  { ids, registry: boardRegistry },
  params.has('catalogo')
    ? catalogBoard({ ids, registry: boardRegistry })
    : starterBoard({ ids, registry: boardRegistry }),
);

if (e2e) installBoardE2EHooks(store);

// Versión nueva disponible: se avisa una vez y el usuario decide recargar (PLAN §16.2).
if (!params.has('noversion')) {
  new VersionChecker({
    currentBuildId: __BUILD_ID__,
    fetch: (url, init) => window.fetch(url, init),
    onNewVersion: () => {
      if (window.confirm(`${t('toasts.newVersion')} ${t('toasts.reload')}?`)) window.location.reload();
    },
  }).start();
}

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

createRoot(root).render(
  <StrictMode>
    <BoardApp store={store} autoAdvance={!e2e} />
  </StrictMode>,
);
