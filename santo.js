// El Santo Resumen (lutastudios.com/utn) paints in its map of subjects what the student passed and has as regular in
// Sysacad. Only if the student linked it in Sysacad Lindo (contenido.js keeps the names and states from Estado
// académico). This hands them to the page in this same browser: nothing is sent anywhere.
(() => {
  'use strict';
  const enviar = async () => {
    const { santoVinculado, santoMaterias } = await chrome.storage.local.get({ santoVinculado: false, santoMaterias: null });
    if (!santoVinculado || !santoMaterias || !Array.isArray(santoMaterias.materias)) return;
    window.postMessage({ fuente: 'sysacad-lindo', fecha: santoMaterias.fecha, materias: santoMaterias.materias }, location.origin);
  };
  // The page asks when it is ready; this also answers on its own, in case the page was first.
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.fuente === 'santo-resumen' && e.data.pide === 'sysacad') enviar();
  });
  enviar();
})();
