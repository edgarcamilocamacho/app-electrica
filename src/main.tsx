import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardApp } from './app/board/BoardApp';
import { createBoardStore } from './app/board/store';
import { installBoardE2EHooks } from './app/board/testHooks';
import { CloudController, type ExampleKey } from './app/cloud/controller';
import { boardRegistry } from './core/board/catalog';
import { createMemoryCloud } from './core/cloud/memoryApi';
import { createRandomIdGen } from './core/model/ids';
import { catalogBoard, selectorBoard, starterBoard, timerBoard } from './examples/board';
import { t } from './app/i18n/t';
import { createHttpCloudApi } from './platform/cloudApi';
import { downloadText } from './platform/files';
import { browserStorage, memoryStorage } from './platform/storage';
import { VersionChecker } from './platform/version';
import './app/styles.css';

const params = new URLSearchParams(window.location.search);
const e2e = params.has('e2e');

const ids = createRandomIdGen();
const store = createBoardStore({ ids, registry: boardRegistry });

const EXAMPLES = { arranque: starterBoard, temporizador: timerBoard, selector: selectorBoard, catalogo: catalogBoard } as const;

// En E2E, salvo `?backend=server`, cada página tiene su propio backend en memoria con las mismas
// reglas que el servidor (PLAN §24.1): las pruebas no se pisan entre sí.
const realBackend = !e2e || params.get('backend') === 'server';
const cloud = new CloudController({
  api: realBackend ? createHttpCloudApi() : createMemoryCloud().api,
  board: store,
  storage: realBackend ? browserStorage : memoryStorage(),
  example: (key) => EXAMPLES[key]({ ids: createRandomIdGen(), registry: boardRegistry }),
  names: { untitled: t('cloud.untitled'), copyOf: (name) => t('cloud.copyOf', { name }) },
  initialExample: (params.has('catalogo') ? 'catalogo' : 'arranque') satisfies ExampleKey,
  download: downloadText,
});
cloud.attachToWindow(window);
void cloud.start();

if (e2e) installBoardE2EHooks(store, cloud);

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
    <BoardApp store={store} cloud={cloud} autoAdvance={!e2e} />
  </StrictMode>,
);
