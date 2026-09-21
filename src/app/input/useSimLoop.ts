import { useEffect } from 'react';
import { useEditor } from '../store/context';
import type { EditorStore } from '../store/editorStore';

/**
 * Bucle de animación durante la simulación: solo empuja el tiempo de simulación según el reloj
 * de pared y la velocidad elegida. El motor sigue siendo determinista (AGENT_PROMPT Fase 4).
 */
export function useSimLoop(store: EditorStore): void {
  const simulating = useEditor((s) => s.mode === 'simulating');
  useEffect(() => {
    if (!simulating) return;
    let frame = 0;
    const loop = () => {
      store.getState().simTick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [simulating, store]);
}
