// Aplica el tema elegido antes del primer pintado, para que no parpadee (R4 §5). Es un script
// clásico y aparte porque la CSP no permite scripts en línea. La clave es THEME_KEY de
// src/app/themeMode.ts; sin elección guardada, el CSS sigue al sistema.
try {
  var theme = window.localStorage.getItem('simulador-control:theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  /* sin almacenamiento: sigue al sistema */
}
