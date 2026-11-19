// Runs before the page paints, so the raw Sysacad page and the wrong theme never flash.
// contenido.js undoes this on the browser check page, whose title is not known yet here.
(() => {
  'use strict';
  if (location.pathname.startsWith('/__cap')) return;

  const raiz = document.documentElement;
  raiz.classList.add('sl-activo');

  const AJUSTES = {
    tema: null,
    plantilla: null,
    letra: null,
    vision: null,
    contraste: false,
    movimiento: false,
    fondo: true,
    color: null,
    marca: null,
  };

  const COLOR = /^#[0-9a-f]{6}$/i;

  // Relative luminance from WCAG, for channels between 0 and 255.
  const luminancia = (canales) => {
    const [r, g, b] = canales.map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // The band, buttons and links all derive from this color and carry white text, so a
  // pale choice is darkened until white reads on it at 7:1.
  const legible = (color) => {
    let canales = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    while (1.05 / (luminancia(canales) + 0.05) < 7) canales = canales.map((c) => c * 0.94);
    return `#${canales.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  };

  const marcar = (clave, valor) => {
    if (valor) raiz.dataset[clave] = valor;
    else delete raiz.dataset[clave];
  };

  const aplicar = (a) => {
    // contenido.js may have backed out already, on the browser check page.
    if (!raiz.classList.contains('sl-activo')) return;
    const sistema = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    raiz.dataset.slTema = a.tema === 'oscuro' || a.tema === 'claro' ? a.tema : sistema;
    marcar('slPlantilla', a.plantilla);
    marcar('slLetra', a.letra);
    marcar('slVision', a.vision);
    marcar('slContraste', a.contraste ? 'si' : null);
    marcar('slMovimiento', a.movimiento ? 'bajo' : null);
    marcar('slFondo', a.fondo ? null : 'no');
    if (COLOR.test(a.color ?? '')) raiz.style.setProperty('--sl-base', legible(a.color));
    else raiz.style.removeProperty('--sl-base');
    if (COLOR.test(a.marca ?? '')) raiz.style.setProperty('--sl-marca', a.marca);
    else raiz.style.removeProperty('--sl-marca');
  };

  // Applied synchronously on a change, because contenido.js reads the theme back from
  // the page in its own listener, which runs right after this one.
  const actuales = { ...AJUSTES };

  aplicar(actuales);
  chrome.storage.local.get(AJUSTES).then((guardados) => {
    Object.assign(actuales, guardados);
    aplicar(actuales);
  });
  chrome.storage.onChanged.addListener((cambios) => {
    const propios = Object.keys(cambios).filter((clave) => clave in AJUSTES);
    if (!propios.length) return;
    for (const clave of propios) actuales[clave] = cambios[clave].newValue ?? AJUSTES[clave];
    aplicar(actuales);
  });
})();
