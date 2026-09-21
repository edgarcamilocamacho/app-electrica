import { Canvas } from './canvas/Canvas';
import { useKeyboard } from './input/useKeyboard';
import { useSimLoop } from './input/useSimLoop';
import { Diagnostics } from './panels/Diagnostics';
import { ErrorPanel } from './panels/ErrorPanel';
import { Library } from './panels/Library';
import { Properties } from './panels/Properties';
import { StatusBar } from './panels/StatusBar';
import { Toasts } from './panels/Toasts';
import { EditorProvider, useEditor, useEditorStore } from './store/context';
import type { EditorStore } from './store/editorStore';
import { Toolbar } from './toolbar/Toolbar';

export function App({ store }: { store: EditorStore }) {
  return (
    <EditorProvider store={store}>
      <Shell />
    </EditorProvider>
  );
}

function Shell() {
  const store = useEditorStore();
  const mode = useEditor((s) => s.mode);
  useKeyboard(store);
  useSimLoop(store);
  return (
    <div className={`app app--${mode}`}>
      <Toolbar />
      <Library />
      <main className="stage">
        <Canvas />
        <ErrorPanel />
      </main>
      <aside className="sidebar">
        <Properties />
        <Diagnostics />
      </aside>
      <StatusBar />
      <Toasts />
    </div>
  );
}
