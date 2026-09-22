import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { BoardPreview } from './app/board/BoardPreview';
import { createAppServices } from './app/services';
import { installE2EHooks } from './app/testHooks';
import { ManualClock, realClock } from './platform/clock';
import { browserStorage, memoryStorage } from './platform/storage';
import './app/styles.css';

const params = new URLSearchParams(window.location.search);
const e2e = params.has('e2e');
const manualClock = e2e ? new ManualClock() : undefined;

if (e2e) {
  // Los selectores nativos de File System Access no son automatizables: en E2E se prueba la ruta
  // universal (descarga + <input type=file>).
  // Viven en el prototipo de Window: se tapan con una propiedad propia indefinida.
  for (const name of ['showSaveFilePicker', 'showOpenFilePicker']) {
    Object.defineProperty(window, name, { value: undefined, configurable: true });
  }
}

const services = createAppServices({
  clock: manualClock ?? realClock,
  // En E2E cada prueba arranca limpia salvo que pida probar el autoguardado.
  storage: e2e && !params.has('autosave') ? memoryStorage() : browserStorage,
  confirm: e2e ? () => true : (message) => window.confirm(message),
  fetch: (url, init) => window.fetch(url, init),
  buildId: __BUILD_ID__,
  checkVersion: !params.has('noversion'),
});

if (manualClock) installE2EHooks(services.store, manualClock);
window.addEventListener('pagehide', () => services.flushAutosave());

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

// Refactor R5: la vista gráfica de tablero se mira con ?tablero=1 hasta que reemplace a la clásica.
createRoot(root).render(
  <StrictMode>
    {params.has('tablero') ? <BoardPreview /> : <App store={services.store} />}
  </StrictMode>,
);
