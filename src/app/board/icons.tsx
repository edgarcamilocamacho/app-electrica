/** Íconos de la barra: trazos simples de 20×20, sin dependencias. */
import type { ReactElement } from 'react';

const wrap = (children: ReactElement): ReactElement => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconSelect = (): ReactElement => wrap(<path d="M5 3l11 7-4.6 1.2L9.6 16z" />);
export const IconWire = (): ReactElement => wrap(<><path d="M3 5h6v10h8" /><circle cx="3" cy="5" r="1.6" /><circle cx="17" cy="15" r="1.6" /></>);
export const IconErase = (): ReactElement => wrap(<><path d="M8 16h8" /><path d="M4.5 12.5l5-5 5 5-3 3h-4z" /></>);
export const IconText = (): ReactElement => wrap(<><path d="M4 5h12" /><path d="M10 5v11" /><path d="M7 16h6" /></>);
export const IconUndo = (): ReactElement => wrap(<><path d="M7 7L3.5 10.5 7 14" /><path d="M3.5 10.5H12a4.5 4.5 0 0 1 0 9h-2" /></>);
export const IconRedo = (): ReactElement => wrap(<><path d="M13 7l3.5 3.5L13 14" /><path d="M16.5 10.5H8a4.5 4.5 0 0 0 0 9h2" /></>);
export const IconFit = (): ReactElement => wrap(<><path d="M3 7V3h4" /><path d="M17 7V3h-4" /><path d="M3 13v4h4" /><path d="M17 13v4h-4" /></>);
export const IconFile = (): ReactElement => wrap(<><path d="M5 2.5h6l4 4v11H5z" /><path d="M11 2.5v4h4" /></>);
export const IconPlay = (): ReactElement => wrap(<path d="M6 3.5l10 6.5-10 6.5z" />);
export const IconStop = (): ReactElement => wrap(<rect x="5" y="5" width="10" height="10" rx="1.5" />);
export const IconChevron = (): ReactElement => wrap(<path d="M6 8l4 4 4-4" />);
export const IconRotate = (): ReactElement =>
  wrap(
    <>
      <path d="M16 6.5A7 7 0 1 0 17 10" />
      <path d="M16 2.5v4h-4" />
    </>,
  );
export const IconWarning = (): ReactElement => wrap(<><path d="M10 3.5l7 12.5H3z" /><path d="M10 8v4" /><path d="M10 14.2v.1" /></>);
export const IconPlus = (): ReactElement => wrap(<><path d="M10 4v12" /><path d="M4 10h12" /></>);
export const IconMore = (): ReactElement => wrap(<><circle cx="5" cy="10" r="0.9" /><circle cx="10" cy="10" r="0.9" /><circle cx="15" cy="10" r="0.9" /></>);
export const IconSidebar = (): ReactElement => wrap(<><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M8 4v12" /></>);
export const IconLock = (): ReactElement => wrap(<><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></>);
