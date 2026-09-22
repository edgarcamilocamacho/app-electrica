import type { ReactElement } from 'react';

/** Íconos de la barra (24×24, trazo). Sin dependencias externas: todo inline (CSP estricta). */
const I = (d: string, extra?: ReactElement): ReactElement => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
    {extra}
  </svg>
);

/** «T» del texto libre: la usan la barra y la biblioteca. */
export const TEXT_ICON_PATH = 'M7 8V6h10v2M12 6v12M9.5 18h5';

export const Icons = {
  select: I('M5 3l12 8-5 1.5 3 6-2.2 1-3-6L6 17z'),
  wire: I('M4 18h6V6h10', <g><circle cx="4" cy="18" r="1.6" fill="currentColor" /><circle cx="20" cy="6" r="1.6" fill="currentColor" /></g>),
  move: I('M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3'),
  erase: I('M16 4l4 4-9 9H7l-3-3zM11 17h9'),
  text: I(TEXT_ICON_PATH),
  undo: I('M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3'),
  redo: I('M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3'),
  zoomIn: I('M11 4a7 7 0 110 14 7 7 0 010-14zM20 20l-4-4M11 8v6M8 11h6'),
  zoomOut: I('M11 4a7 7 0 110 14 7 7 0 010-14zM20 20l-4-4M8 11h6'),
  fit: I('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  play: I('M7 4l13 8-13 8z'),
  stop: I('M6 6h12v12H6z'),
  back: I('M10 5l-7 7 7 7M3 12h18'),
  file: I('M6 3h8l5 5v13H6zM14 3v5h5'),
  examples: I('M4 5h16v14H4zM4 9h16M9 9v10'),
  export: I('M12 3v12M7 10l5 5 5-5M5 21h14'),
  chevron: I('M6 9l6 6 6-6'),
} as const;
