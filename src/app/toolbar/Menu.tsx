import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icons } from './icons';

export interface MenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly testId?: string;
}

/** Menú desplegable accesible por teclado; se cierra al elegir, con Esc o al hacer clic afuera. */
export function Menu({ label, icon, items, testId, disabled }: { label: string; icon: ReactNode; items: readonly MenuItem[]; testId?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="tb-button tb-menu"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        {...(testId ? { 'data-testid': testId } : {})}
      >
        {icon}
        <span>{label}</span>
        {Icons.chevron}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              {...(item.testId ? { 'data-testid': item.testId } : {})}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
