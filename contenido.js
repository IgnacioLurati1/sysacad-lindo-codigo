// Sysacad Lindo content script.
//
// Hard rule: every action here starts from a real click by the student. This
// file has no timers, no network calls, and never submits or fills a form.
// pruebas/e2e.mjs fails if any of that changes.
(() => {
  'use strict';

  const raiz = document.documentElement;

  const esVerificacion =
    document.title.includes('Verificando tu navegador') || location.pathname.startsWith('/__cap');
  if (esVerificacion) {
    raiz.classList.remove('sl-activo');
    for (const clave of Object.keys(raiz.dataset)) {
      if (clave.startsWith('sl')) delete raiz.dataset[clave];
    }
    raiz.style.removeProperty('--sl-base');
    raiz.style.removeProperty('--sl-marca');
    for (const atributo of ['class', 'style']) {
      if (!raiz.getAttribute(atributo)) raiz.removeAttribute(atributo);
    }
    return;
  }

  const VACIO = { materias: [], soloMias: false, plegado: false };
  const nuevoId = () => crypto.randomUUID();
  const esPrincipal = window === window.top && document.body?.tagName === 'BODY';

  const normalizar = (texto) =>
    (texto ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const contiene = (texto, buscado) => ` ${texto} `.includes(` ${buscado} `);

  function h(etiqueta, props = {}, ...hijos) {
    const el = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(props)) {
      if (clave.startsWith('on')) el.addEventListener(clave.slice(2), valor);
      else if (clave === 'clase') el.className = valor;
      else if (clave === 'texto') el.textContent = valor;
      else if (valor === true) el.setAttribute(clave, '');
      else if (valor !== false && valor != null) el.setAttribute(clave, valor);
    }
    el.append(...hijos.filter((x) => x !== null && x !== undefined && x !== false && x !== ''));
    return el;
  }

  // Ignores synthetic clicks, so a page script or macro cannot press these controls.
  const soloClicReal = (accion) => (evento) => {
    if (evento.isTrusted) accion(evento);
  };

  const leer = () => chrome.storage.local.get(VACIO);
  const guardar = (cambios) => chrome.storage.local.set(cambios);

  // El Santo Resumen (lutastudios.com/utn), the study site, can paint in its map of subjects what the student passed and
  // has as regular. Only if the student links it here: then each visit to Estado académico keeps those names and
  // states in this browser, and santo.js hands them to that page. Nothing goes anywhere else.
  const SANTO_MAPA = 'https://lutastudios.com/utn/materias.html';
  const guardarParaSanto = (materias) =>
    guardar({
      santoMaterias: {
        fecha: Date.now(),
        materias: materias.filter((m) => m.tipo === 'aprobada' || m.tipo === 'regular').map((m) => ({ nombre: m.nombre, tipo: m.tipo })),
      },
    });

  // Super CVG (supercvg.lutastudios.com), the unofficial campus panel, shows the final grade of each passed subject in
  // its grades. Same deal: only if linked, here or from its own page, and only the name and the grade of the subjects
  // passed with a number. No equivalences without a grade, no record numbers, no hours. supercvg.js hands them over.
  const SUPERCVG = 'https://supercvg.lutastudios.com/';
  const guardarParaSuperCvg = (materias) =>
    guardar({
      supercvgFinales: {
        fecha: Date.now(),
        finales: materias
          .filter((m) => m.tipo === 'aprobada' && Number.isFinite(m.nota) && m.nota >= 1 && m.nota <= 10)
          .slice(0, 80)
          .map((m) => ({ nombre: m.nombre.slice(0, 120), nota: m.nota })),
      },
    });
  const leerVinculos = () =>
    chrome.storage.local.get({ santoVinculado: false, santoPreguntado: false, supercvgVinculado: false, supercvgPreguntado: false, supercvgFinales: null, supercvgDesdeSuPagina: false });

  const parsear = (marcado) => {
    const plantilla = document.createElement('template');
    plantilla.innerHTML = marcado;
    return plantilla.content.firstElementChild;
  };

  const icono = (trazos, tam = 20) => `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazos}</svg>`;
  const ICONOS_MENU = {
    'Mi carrera': icono('<path d="M2 9l10-5 10 5-10 5-10-5Z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>'),
    Correlativas: icono('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V14a4 4 0 0 0 4 4h5.5"/>'),
    Trámites: icono('<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>'),
    'Mi cuenta': icono('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  };
  const ICONOS_TARJETA = {
    'inscripcion a cursado': icono('<path d="M12 6c-2-1.5-5-2-8-2v15c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2ZM12 6v15"/>', 26),
    'inscripcion a examen': icono('<path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>', 26),
  };

  const ICONOS = {
    ajustes: icono('<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>'),
    luna: '<svg class="sl-icono-luna" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M20.5 14.6A9 9 0 0 1 9.4 3.5a9 9 0 1 0 11.1 11.1Z"/></svg>',
    sol: '<svg class="sl-icono-sol" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
    girar: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M20 12a8 8 0 1 1-2.5-5.8L20 8.5M20 3.5v5h-5"/></svg>',
  };

  const esOscuro = () => raiz.dataset.slTema === 'oscuro';

  const botonTema = (clase) => {
    const boton = h('button', {
      clase,
      type: 'button',
      'aria-label': 'Modo oscuro',
      'aria-pressed': String(esOscuro()),
      onclick: soloClicReal(() => guardar({ tema: esOscuro() ? 'claro' : 'oscuro' })),
    }, parsear(ICONOS.luna), parsear(ICONOS.sol));
    return boton;
  };

  const pagina = location.pathname.toLowerCase();

  // Super CVG can also show a text copy of the Sysacad tabs the student opened (docs/CONTRATO-SUPERCVG.md). Only these
  // tabs, only once linked and with its switch on, and only what Sysacad itself shows: titles, paragraphs and tables,
  // read before anything here changes the page. Never fields or their values, images, the page's header or footer.
  const PESTANAS = [
    ['estado', '/estadoacademico.asp'],
    ['parciales', '/notasparciales.asp'],
    ['examenes', '/examenes.asp'],
    ['plan', '/materiasplan.asp'],
    ['correlativas-cursar', '/correlatividadcursado.asp'],
    ['correlativas-rendir', '/correlatividadexamen.asp'],
    ['certificados', '/menucertificados.asp'],
  ];
  const TOPES = { bloques: 60, texto: 2000, titulo: 200, columnas: 30, filas: 500, celda: 300, alumno: 120 };
  // Lines broken with <br> or blocks inside one cell or paragraph stay apart with this.
  const SEPARADOR = ' · ';
  const limpiarTexto = (texto, tope) =>
    texto.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, tope).trimEnd();
  const FUERA_DE_LA_COPIA = 'script, style, noscript, template, link, meta, img, picture, svg, canvas, iframe, frame, object, embed, video, audio, map, input, select, option, textarea, button, .header, .footer, #sysacad-lindo, #sl-ajustes, [hidden], [aria-hidden="true"]';
  const EN_LINEA = new Set(['A', 'ABBR', 'B', 'BIG', 'CITE', 'CODE', 'EM', 'FONT', 'I', 'LABEL', 'MARK', 'NOBR', 'Q', 'S', 'SMALL', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TIME', 'TT', 'U']);
  const RESALTA = /^(H[1-6]|B|STRONG|TH)$/;
  const esVolver = (texto) => normalizar(texto) === 'volver a menu principal';

  const fueraDeLaCopia = (el) =>
    el.matches(FUERA_DE_LA_COPIA) ||
    /^sl-/.test(el.id) ||
    [...el.classList].some((c) => c.startsWith('sl-')) ||
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test(el.getAttribute('style') ?? '') ||
    (el.tagName === 'FORM' && Boolean(el.querySelector('input, select, textarea')));

  // Gathers the words under a node. Each <br> or block inside starts a new line. `fuerte` stays true while every word
  // is bold, a heading or Sysacad's title style.
  function juntarTexto(nodo, salida = { lineas: [''], fuerte: true }, resaltado = false) {
    for (const hijo of nodo.childNodes) {
      if (hijo.nodeType === Node.TEXT_NODE) {
        salida.lineas[salida.lineas.length - 1] += hijo.data;
        if (hijo.data.trim() && !resaltado) salida.fuerte = false;
        continue;
      }
      if (hijo.nodeType !== Node.ELEMENT_NODE || fueraDeLaCopia(hijo)) continue;
      if (hijo.tagName === 'BR') {
        salida.lineas.push('');
        continue;
      }
      const bloque = !EN_LINEA.has(hijo.tagName);
      if (bloque) salida.lineas.push('');
      juntarTexto(hijo, salida, resaltado || RESALTA.test(hijo.tagName) || hijo.classList.contains('tituloTabla'));
      if (bloque) salida.lineas.push('');
    }
    return salida;
  }
  const textoJunto = ({ lineas }, tope) => limpiarTexto(lineas.map((l) => limpiarTexto(l, Infinity)).filter(Boolean).join(SEPARADOR), tope);

  const esCabeceraDeTabla = (celdas) =>
    celdas.length >= 2 &&
    celdas.some((c) => textoJunto(juntarTexto(c), TOPES.celda)) &&
    celdas.every((c) => {
      const t = juntarTexto(c, undefined, c.tagName === 'TH' || c.classList.contains('tituloTabla'));
      return !textoJunto(t, TOPES.celda) || t.fuerte;
    });

  // A data table holds no other table and has at least one row with two cells; the rest only lay the page out.
  const esTablaDeDatos = (tabla) => !tabla.querySelector('table') && filasDe(tabla).some((f) => f.cells.length >= 2);

  function tablaDeLaCopia(tabla) {
    let filas = filasDe(tabla).map((f) => [...f.cells].filter((c) => !fueraDeLaCopia(c)));
    // A first row with a single cell across the table is its title.
    let titulo = null;
    if (filas[0]?.length === 1) {
      titulo = textoJunto(juntarTexto(filas[0][0]), TOPES.titulo) || null;
      filas = filas.slice(1);
    }
    const cabecera = filas.length && esCabeceraDeTabla(filas[0]) ? filas.shift() : null;
    const columnas = (cabecera ?? []).slice(0, TOPES.columnas).map((c) => textoJunto(juntarTexto(c), TOPES.celda));
    const ancho = columnas.length || TOPES.columnas;
    const cuerpo = filas
      .map((celdas) => celdas.slice(0, ancho).map((c) => textoJunto(juntarTexto(c), TOPES.celda)))
      .filter((fila) => fila.some(Boolean) && !(fila.filter(Boolean).length === 1 && esVolver(fila.find(Boolean))))
      .slice(0, TOPES.filas);
    if (!columnas.length && !cuerpo.length) return null;
    return { t: 'tabla', titulo, columnas, filas: cuerpo };
  }

  // The text copy of this tab, as blocks, or null when this is not one of those tabs or nothing is left.
  function copiaDeLaPestana() {
    const pestana = PESTANAS.find(([, ruta]) => ruta === pagina);
    if (!esPrincipal || !pestana) return null;
    const bloques = [];
    let linea = { lineas: [''], fuerte: true };
    const agregar = (bloque) => {
      if (bloque && bloques.length < TOPES.bloques) bloques.push(bloque);
    };
    // A heading is a title even when long. Loose bold words only when they fit one.
    const cerrarLinea = (encabezado = false) => {
      const largo = textoJunto(linea, TOPES.texto);
      if (largo && !esVolver(largo)) {
        agregar(linea.encabezado || (linea.fuerte && largo.length <= TOPES.titulo)
          ? { t: 'titulo', texto: textoJunto(linea, TOPES.titulo) }
          : { t: 'texto', texto: largo });
      }
      linea = { lineas: [''], fuerte: true, encabezado };
    };
    // Walks blocks in order: each paragraph or loose run of words is one block, and each data table is one block.
    const recorrer = (nodo, resaltado) => {
      for (const hijo of nodo.childNodes) {
        if (hijo.nodeType === Node.TEXT_NODE) {
          linea.lineas[linea.lineas.length - 1] += hijo.data;
          if (hijo.data.trim() && !resaltado) linea.fuerte = false;
          continue;
        }
        if (hijo.nodeType !== Node.ELEMENT_NODE || fueraDeLaCopia(hijo)) continue;
        if (hijo.tagName === 'BR') {
          linea.lineas.push('');
          continue;
        }
        const resalta = resaltado || RESALTA.test(hijo.tagName) || hijo.classList.contains('tituloTabla');
        // Inline wrappers (Sysacad wraps whole tables in <font>) are walked the same way, without breaking the line.
        if (EN_LINEA.has(hijo.tagName)) {
          recorrer(hijo, resalta);
          continue;
        }
        cerrarLinea(/^H[1-6]$/.test(hijo.tagName));
        if (hijo.tagName === 'TABLE' && esTablaDeDatos(hijo)) agregar(tablaDeLaCopia(hijo));
        else recorrer(hijo, resalta);
        cerrarLinea();
      }
    };
    recorrer(document.querySelector('.wrapper') ?? document.body, false);
    cerrarLinea();
    return bloques.length ? { clave: pestana[0], bloques } : null;
  }

  // Linked and with the switch on, the copy replaces the one kept for this tab.
  async function guardarPestana(copia) {
    const s = await chrome.storage.local.get({ supercvgVinculado: false, supercvgGuardaPestanas: true, supercvgPestanas: {} });
    if (s.supercvgVinculado !== true || s.supercvgGuardaPestanas !== true) return;
    const pestanas = s.supercvgPestanas && typeof s.supercvgPestanas === 'object' ? s.supercvgPestanas : {};
    await guardar({ supercvgPestanas: { ...pestanas, [copia.clave]: { fecha: Date.now(), bloques: copia.bloques } } });
  }

  // The name on the menu lets Super CVG check the copies belong to the campus account. Another name means another
  // student in this browser: the copies of the previous one go away.
  // Since 2.5.0 the name is kept whenever Super CVG is linked, also with the copies off: the exams use it too. The
  // exams the student enrolled in belong to one student as well, so another name on the menu drops them.
  async function guardarAlumno(nombre) {
    const alumno = limpiarTexto(nombre, TOPES.alumno);
    if (!alumno) return;
    const s = await chrome.storage.local.get({ supercvgVinculado: false, supercvgAlumno: null, alumnoMenu: null });
    if (s.alumnoMenu !== alumno) {
      if (s.alumnoMenu) await chrome.storage.local.remove('examenesInscriptos');
      await guardar({ alumnoMenu: alumno });
    }
    if (s.supercvgVinculado !== true || s.supercvgAlumno === alumno) return;
    if (s.supercvgAlumno) await chrome.storage.local.remove('supercvgPestanas');
    await guardar({ supercvgAlumno: alumno });
  }

  // Dates for the menu's "Próximas fechas". Sysacad writes an exam day with no year ("jueves 10 de diciembre"): the year is
  // the one among last, this and next where that day falls on that weekday, and there is never more than one.
  // MESES and DIAS are further down, with the exam enrollment.
  const dos = (n) => String(n).padStart(2, '0');
  const isoDe = (fecha) => `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  const fechaDeIso = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  };
  const diaDelExamen = (texto) => {
    const partes = normalizar(texto).match(/^(domingo|lunes|martes|miercoles|jueves|viernes|sabado) (\d{1,2}) de ([a-z]+)$/);
    const mes = partes ? MESES.indexOf(partes[3]) : -1;
    if (mes === -1) return null;
    const hoy = new Date().getFullYear();
    const fechas = [hoy - 1, hoy, hoy + 1]
      .map((anio) => new Date(anio, mes, Number(partes[2])))
      .filter((f) => f.getMonth() === mes && normalizar(DIAS[f.getDay()]) === partes[1]);
    return fechas.length === 1 ? isoDe(fechas[0]) : null;
  };
  const hora = (texto) => {
    const partes = texto?.match(/^(\d{1,2})[:.](\d{2})$/);
    return partes && Number(partes[1]) < 24 && Number(partes[2]) < 60 ? `${dos(partes[1])}:${partes[2]}` : null;
  };
  const examenGuardado = (materia, datos) => {
    const dia = diaDelExamen(datos.dia);
    const nombre = limpiarTexto(materia ?? '', 120);
    if (!dia || !nombre) return null;
    return {
      materia: nombre,
      dia,
      turno: limpiarTexto(datos.turno ?? '', 20) || null,
      teorico: hora(datos.teorico),
      practico: hora(datos.practico),
      tribunal: limpiarTexto(datos.tribunal ?? '', 80) || null,
    };
  };
  // The certificate lists every enrollment and replaces what was kept; a receipt adds its own. Kept for the menu and,
  // once linked, for Super CVG's calendar (docs/CONTRATO-SUPERCVG.md). Never the security code nor the mail.
  async function guardarExamenes(nuevos, reemplazar) {
    const { examenesInscriptos } = await chrome.storage.local.get({ examenesInscriptos: null });
    const previos = !reemplazar && Array.isArray(examenesInscriptos?.examenes) ? examenesInscriptos.examenes : [];
    const juntos = [...nuevos, ...previos].filter((e, i, todos) => todos.findIndex((o) => o.materia === e.materia && o.dia === e.dia) === i);
    juntos.sort((a, b) => a.dia.localeCompare(b.dia));
    await guardar({ examenesInscriptos: { fecha: Date.now(), examenes: juntos.slice(-30) } });
  }

  // Rows and list items that hold content, skipping layout rows that wrap nested tables.
  function filasHoja() {
    return [...document.querySelectorAll('tr, li')].filter(
      (f) => !f.querySelector(f.tagName === 'TR' ? 'tr' : 'li') && !f.closest('#sysacad-lindo, .sl-reemplazada, .sl-faltan, .sl-frenos'),
    );
  }

  function resaltar(estado) {
    const coincidencias = new Map();
    const filas = filasHoja();
    for (const fila of filas) fila.classList.remove('sl-fuerte', 'sl-suave', 'sl-oculta');

    const buscadas = estado.materias
      .map((m) => ({ id: m.id, nombre: normalizar(m.nombre), comision: normalizar(m.comision) }))
      .filter((m) => m.nombre);

    const marcadas = new Set();
    for (const fila of filas) {
      // textContent glues adjacent cells together ("II2K1"), so join cells with a space.
      const texto = normalizar(fila.dataset.slClave ?? (fila.cells ? [...fila.cells].map((c) => c.textContent).join(' ') : fila.textContent));
      for (const m of buscadas) {
        if (!contiene(texto, m.nombre)) continue;
        const exacta = !m.comision || contiene(texto, m.comision);
        fila.classList.add(exacta ? 'sl-fuerte' : 'sl-suave');
        marcadas.add(fila);
        const previa = coincidencias.get(m.id);
        if (!previa) coincidencias.set(m.id, { primera: fila, exacta, total: 1 });
        else {
          previa.total += 1;
          if (exacta && !previa.exacta) Object.assign(previa, { primera: fila, exacta });
        }
      }
    }

    if (estado.soloMias) ocultarOtras(filas, marcadas);
    return coincidencias;
  }

  const conEleccion = (fila) =>
    Boolean(fila.querySelector(':checked')) ||
    [...fila.querySelectorAll('input:not([type="password"]), textarea')].some((campo) => campo.value !== campo.defaultValue);

  // Hides only rows shaped like the matched ones, so headers, footers and submit
  // rows stay visible. A row with a checked control stays visible too, because
  // hiding it would submit a choice the student cannot see.
  function ocultarOtras(filas, marcadas) {
    const contenedor = (f) => f.closest('table, ul, ol');
    const celdasPorContenedor = new Map();
    for (const f of marcadas) {
      const c = contenedor(f);
      if (c && !celdasPorContenedor.has(c)) celdasPorContenedor.set(c, f.cells?.length ?? 0);
    }
    for (const fila of filas) {
      const c = contenedor(fila);
      if (marcadas.has(fila) || !celdasPorContenedor.has(c)) continue;
      if ((fila.cells?.length ?? 0) !== celdasPorContenedor.get(c)) continue;
      if (fila.tagName === 'TR' && (fila.rowIndex === 0 || fila.querySelector('th'))) continue;
      if (conEleccion(fila)) continue;
      fila.classList.add('sl-oculta');
    }
  }

  const filasDe = (tabla) =>
    [...tabla.querySelectorAll('tr')].filter((f) => f.closest('table') === tabla && !f.querySelector('tr'));

  const declararRoles = (tabla, filas, cabecera) => {
    tabla.setAttribute('role', 'table');
    for (const fila of filas) {
      fila.setAttribute('role', 'row');
      for (const celda of fila.cells) celda.setAttribute('role', fila === cabecera ? 'columnheader' : 'cell');
    }
  };

  // Tables used for page layout must not look like data tables.
  function marcarTablas() {
    for (const tabla of document.querySelectorAll('table')) {
      const filas = filasDe(tabla);
      if (filas.filter((f) => f.cells.length >= 2).length < 2) continue;
      tabla.classList.add('sl-datos');
      // Two-column tables are label and value pairs, and read badly when stretched.
      if (Math.max(...filas.map((f) => f.cells.length)) <= 2) tabla.classList.add('sl-angosta');
      const cabecera = filas.find((f) => f.cells.length >= 2 && !f.querySelector('input, select, textarea, button'));
      cabecera?.classList.add('sl-cabecera');
      // On phones a table with fields scrolls as a block, which drops its implicit
      // roles. It stays where it is: moving it could detach its fields from the form
      // on misnested markup, so the roles are stated here instead.
      if (tabla.classList.contains('sl-angosta') || !tabla.querySelector('input, select, textarea')) continue;
      declararRoles(tabla, filas, cabecera);
    }
  }

  // Only restyles the page's own login button. The browser's password manager fills
  // the fields and the student clicks; this file never reads or writes them.
  function marcarLogin() {
    const form = document.querySelector('input[type="password"]')?.form;
    if (!form) return;
    raiz.classList.add('sl-pagina-login');
    form.classList.add('sl-login');
    form.querySelector('input[type="submit"], button[type="submit"], button:not([type])')?.classList.add('sl-ingresar');
    form.prepend(
      h('p', { clase: 'sl-login-marca', texto: 'Sysacad' }),
      h('p', { clase: 'sl-login-casa', texto: 'UTN, Facultad Regional Rosario' }),
    );
    if (esPrincipal) document.body.append(botonAjustes('sl-abrir-ajustes sl-login-ajustes'));
    for (const celda of form.querySelectorAll('td')) {
      if (!celda.textContent.trim() && !celda.children.length) celda.classList.add('sl-vacia');
    }
    const avisos = [...document.querySelectorAll('table')].filter((t) => t.querySelector('.tituloTablaImportante') && !form.contains(t) && !t.parentElement.closest('table'));
    if (!avisos.length) return;
    form.parentElement.classList.add('sl-login-con-avisos');
    for (const aviso of avisos) aviso.classList.add('sl-aviso-login');
    if (esPrincipal) guardarCronograma(avisos);
    // The menu saved the year of entry, so the schedule can point at the student's turn.
    chrome.storage.local.get({ anioIngreso: null }).then(({ anioIngreso }) => {
      if (!anioIngreso) return;
      for (const parrafo of document.querySelectorAll('.sl-aviso-login p')) {
        const turno = normalizar(parrafo.querySelector('strong')?.textContent).match(/^alumnos con ano de ingreso (\d{4})( y anteriores)?$/);
        if (!turno) continue;
        const anio = Number(turno[1]);
        if (Number(anioIngreso) === anio || (turno[2] && Number(anioIngreso) < anio)) parrafo.classList.add('sl-tu-turno');
      }
    });
  }

  // The login page shows Sysacad's enrollment schedule. The menu points at the student's own date, so it is kept.
  function guardarCronograma(avisos) {
    for (const aviso of avisos) {
      const titulo = aviso.querySelector('.tituloTablaImportante')?.textContent.trim() ?? '';
      if (!/^cronograma de /i.test(titulo)) continue;
      const fechas = [...aviso.querySelectorAll('p')].map((p) => {
        const quien = p.querySelector('strong')?.textContent.trim() ?? '';
        const cuando = p.textContent.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*\((\d{1,2})\s*hs?\))?/i);
        if (!quien || !cuando) return null;
        const fecha = new Date(Number(cuando[3]), Number(cuando[2]) - 1, Number(cuando[1]));
        if (fecha.getDate() !== Number(cuando[1])) return null;
        const turno = normalizar(quien).match(/^alumnos con ano de ingreso (\d{4})( y anteriores)?$/);
        return {
          dia: isoDe(fecha),
          hora: cuando[4] ? Number(cuando[4]) : null,
          ingreso: turno ? Number(turno[1]) : null,
          anteriores: Boolean(turno?.[2]),
          electivas: /electiva/i.test(quien),
        };
      }).filter(Boolean);
      if (fechas.length) guardar({ cronograma: { titulo: limpiarTexto(titulo.replace(/^cronograma de /i, ''), 80), fechas } });
      return;
    }
  }

  // "Próximas fechas" on the menu: the student's enrollment turn and the exams they enrolled in, from what the login page
  // and the enrollment pages showed. Counted from today when the menu opens, with no timer.
  const diasHasta = (iso) => Math.round((fechaDeIso(iso) - fechaDeIso(isoDe(new Date()))) / 86400000);
  const cuantoFalta = (dias) => (dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`);
  const diaLargo = (iso) => fechaDeIso(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  async function loQueViene() {
    const s = await chrome.storage.local.get({ cronograma: null, anioIngreso: null, examenesInscriptos: null });
    const items = [];
    const fechas = Array.isArray(s.cronograma?.fechas) ? s.cronograma.fechas : [];
    const titulo = mayuscula(s.cronograma?.titulo ?? '');
    const ingreso = Number(s.anioIngreso);
    const mia = ingreso ? fechas.find((f) => f.ingreso === ingreso || (f.anteriores && ingreso < f.ingreso)) : null;
    const desde = (f) => (f.hora === null ? null : `desde las ${f.hora}`);
    const con = (cual) => (titulo ? `${titulo}: ${cual}` : mayuscula(cual));
    if (mia) items.push({ dia: mia.dia, titulo: con('tu turno'), detalle: [desde(mia)] });
    for (const f of fechas.filter((f) => f.electivas)) items.push({ dia: f.dia, titulo: con('electivas'), detalle: [desde(f)] });
    for (const e of Array.isArray(s.examenesInscriptos?.examenes) ? s.examenesInscriptos.examenes : []) {
      const horas = [e.teorico, e.practico].filter(Boolean).sort();
      items.push({ dia: e.dia, titulo: `Examen de ${e.materia}`, detalle: [horas[0] ?? null, e.tribunal ? `tribunal ${e.tribunal}` : null] });
    }
    const proximos = items.filter((i) => diasHasta(i.dia) >= 0).sort((a, b) => a.dia.localeCompare(b.dia)).slice(0, 4);
    if (!proximos.length) return null;
    return h('section', { clase: 'sl-viene', 'aria-labelledby': 'sl-viene-titulo' },
      h('h2', { id: 'sl-viene-titulo', texto: 'Próximas fechas' }),
      h('ul', {}, ...proximos.map((i) => h('li', {},
        h('span', { clase: 'sl-viene-falta', texto: cuantoFalta(diasHasta(i.dia)) }),
        h('div', {},
          h('strong', { texto: i.titulo }),
          h('span', { texto: [mayuscula(diaLargo(i.dia)), ...i.detalle].filter(Boolean).join(' · ') }),
        ),
      ))),
      h('p', { clase: 'sl-viene-nota', texto: 'Según lo último que abriste en Sysacad: el cronograma del login y tu certificado de exámenes.' }),
    );
  }

  // Collapses the wrappers left empty after the original menu moves out.
  function quitarConVacios(elemento) {
    let actual = elemento.parentElement;
    elemento.remove();
    while (actual && actual !== document.body && !actual.textContent.trim() && !actual.querySelector('img, input, select, textarea, button, a')) {
      actual.classList.add('sl-oculta');
      actual = actual.parentElement;
    }
  }

  function datosDelAlumno(lista) {
    const candidatos = [...document.querySelectorAll('td, div, p, span, font')].filter(
      (el) => !el.contains(lista) && normalizar(el.textContent).includes('ano de ingreso'),
    );
    let bloque = candidatos.at(-1);
    if (!bloque) return null;
    while (bloque.parentElement !== document.body && !bloque.parentElement.contains(lista)) bloque = bloque.parentElement;
    const lineas = bloque.innerText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lineas.length < 2 || lineas.length > 5 || bloque.querySelector('a, input, select, textarea, button')) return null;
    return { bloque, lineas };
  }

  const GRUPOS_MENU = [
    { titulo: 'Mi carrera', enlaces: ['estado academico', 'cursado notas de parciales encuestas', 'examenes', 'materias del plan'] },
    { titulo: 'Correlativas', enlaces: ['correlatividad para cursar', 'correlatividad para rendir'] },
    { titulo: 'Trámites', enlaces: ['tramites academicos', 'certificado regularidad', 'calendario academico', 'avisos'] },
    { titulo: 'Mi cuenta', enlaces: ['cambio de contrasena', 'salir'] },
  ];

  // Rebuilds the main menu using the page's own links, so their targets and handlers
  // stay intact. A link this file does not recognize goes to "Otros" and is never lost.
  function mejorarMenu() {
    if (document.body?.tagName !== 'BODY') return;
    const lista = [...document.querySelectorAll('ul, ol')].find((l) => {
      const textos = [...l.querySelectorAll('a')].map((a) => normalizar(a.textContent));
      return textos.length >= 5 && textos.includes('inscripcion a cursado');
    });
    if (!lista) return;

    const alumno = datosDelAlumno(lista);
    const enlaces = [...lista.querySelectorAll('a')];
    const usados = new Set();
    const tomar = (nombre) => {
      const enlace = enlaces.find((a) => !usados.has(a) && normalizar(a.textContent) === nombre);
      if (enlace) usados.add(enlace);
      return enlace;
    };

    const nombre = alumno?.lineas[0] ?? '';
    const pila = nombre.includes(',') ? nombre.split(',').slice(1).join(',').trim() : nombre;
    const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const tema = botonTema('sl-tema');
    chrome.storage.onChanged.addListener(() => tema.setAttribute('aria-pressed', String(esOscuro())));

    // The career decides which plan requirements apply on the academic record page.
    if (esPrincipal && alumno?.lineas[1]) guardar({ carrera: alumno.lineas[1] });
    const anioIngreso = alumno?.lineas.join(' ').match(/ingreso:?\s*(\d{4})/i)?.[1];
    if (esPrincipal && anioIngreso) guardar({ anioIngreso });
    if (esPrincipal && alumno?.lineas[0]) guardarAlumno(alumno.lineas[0]);

    const menu = h('main', { clase: 'sl-menu' },
      h('header', { clase: 'sl-alumno' },
        h('p', { clase: 'sl-fecha', texto: fecha }),
        h('h1', { texto: pila ? `Hola, ${pila}` : 'Sysacad' }),
        ...(alumno?.lineas.slice(1) ?? []).map((l) => h('p', { texto: l })),
      ),
    );

    const principal = h('div', { clase: 'sl-grupo-principal' });
    for (const titulo of ['inscripcion a cursado', 'inscripcion a examen']) {
      const enlace = tomar(titulo);
      if (!enlace) continue;
      enlace.classList.add('sl-enlace');
      enlace.prepend(h('span', { clase: 'sl-icono-tarjeta' }, parsear(ICONOS_TARJETA[titulo])));
      principal.append(enlace);
    }
    const grupos = GRUPOS_MENU.map((g) => ({ ...g, enlaces: g.enlaces.map(tomar).filter(Boolean) }));
    const otros = enlaces.filter((a) => !usados.has(a));
    if (otros.length) grupos.push({ titulo: 'Otros', enlaces: otros });

    const secundarios = h('div', { clase: 'sl-grupos' });
    for (const grupo of grupos) {
      if (!grupo.enlaces.length) continue;
      for (const enlace of grupo.enlaces) enlace.classList.add('sl-enlace');
      secundarios.append(h('section', { clase: 'sl-grupo' }, h('h2', {}, ICONOS_MENU[grupo.titulo] ? parsear(ICONOS_MENU[grupo.titulo]) : null, grupo.titulo), ...grupo.enlaces));
    }
    menu.append(h('nav', { clase: 'sl-menu-enlaces', 'aria-label': 'Menú de Sysacad' }, principal, secundarios));

    document.body.prepend(
      h('div', { clase: 'sl-membrete' }, h('p', { texto: 'UTN Rosario' }), botonAjustes('sl-abrir-ajustes'), tema),
      menu,
    );
    raiz.classList.add('sl-pagina-menu');
    loQueViene().then((viene) => {
      if (viene) (menu.querySelector('.sl-grupo-principal') ?? menu.querySelector('.sl-alumno')).after(viene);
    });
    // Super CVG may be waiting for the grades: the card points at the menu's own link to Estado académico.
    const estado = enlaces.find((a) => normalizar(a.textContent) === 'estado academico');
    tarjetasDeVinculos({ estadoAcademico: estado?.origin === location.origin ? estado.href : null }).then(({ arriba }) => menu.append(...arriba));
    quitarConVacios(lista);
    if (alumno) quitarConVacios(alumno.bloque);
  }

  // Sysacad's own header is hidden, so each page gets a full-width title instead.
  function ponerHeroe() {
    if (!esPrincipal || document.querySelector('.sl-menu') || raiz.classList.contains('sl-pagina-login')) return;
    let titulo = document.title.trim();
    let fecha = null;
    for (const celda of document.querySelectorAll('td.tituloTabla')) {
      const textoCelda = celda.textContent.trim();
      const partes = textoCelda.match(/^(.+)\s+de\s+[^,]+,.*\bal\s+(\d{1,2}\/.+)$/);
      // The enrollment list puts the student's name after its title, with no date.
      const conNombre = /^Materias que puede inscribirse a \S+\s+[^,]+,[^,]+$/i.test(textoCelda);
      if ((!partes && !conNombre) || celda.closest('tr').querySelector('input, select, textarea, button')) continue;
      celda.closest('tr').classList.add('sl-reemplazada');
      if (!partes) continue;
      titulo ||= partes[1];
      fecha ??= partes[2];
    }
    const heroe = h('header', { clase: 'sl-heroe' },
      h('h1', { clase: 'sl-titulo', texto: titulo || 'Sysacad' }),
      fecha ? h('p', { clase: 'sl-bajada', texto: `Datos al ${fecha.trim()}` }) : null,
    );
    document.body.prepend(heroe);
  }

  function cambioDeEstado(texto) {
    const crudo = texto.trim();
    const n = normalizar(crudo);
    const tipo = !n ? 'pendiente'
      : /^(aprobad|promocion|equivalen)/.test(n) ? 'aprobada'
      : /^regular/.test(n) ? 'regular'
      : 'otro';
    const nota = crudo.match(/\bcon\s+(\d+(?:[.,]\d+)?)/i)?.[1];
    const cuando = crudo.match(/\ben\s+(\d{4})(\s*\([^)]+\))?/i);
    const horas = crudo.match(/\((\d+)\s*hs/i)?.[1];
    const tomo = crudo.match(/tomo:?\s*(\S+)/i)?.[1];
    const folio = crudo.match(/folio:?\s*(\S+)/i)?.[1];
    const registro = tomo ? (folio ? `Tomo ${tomo}, folio ${folio}` : `Tomo ${tomo}`) : '';
    return { tipo, cuando: cuando ? `${cuando[1]}${cuando[2] ?? ''}` : '', registro, horas: horas ? Number(horas) : 0, nota: nota ? Number(nota.replace(',', '.')) : null, crudo };
  }

  const HORAS_ELECTIVAS = 20;
  const NOMBRE_ESTADO = { aprobada: 'Aprobadas', regular: 'Regulares', pendiente: 'Sin cursar' };
  const decimal = (n) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cantidad = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;
  const anchoBarra = (parte, total) => `width: ${total ? (parte / total) * 100 : 0}%`;

  // "Descargar en Excel": a plain link the student presses, with the file written into its address. The browser saves
  // it and nothing is sent. Semicolons and a byte order mark, so Excel in Spanish opens it in columns and with accents.
  const ESTADO_EN_SINGULAR = { aprobada: 'Aprobada', regular: 'Regular', pendiente: 'Sin cursar' };
  const ICONO_DESCARGAR =icono('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>');
  const enlaceCsv = (nombre, filas, etiqueta) => {
    const celda = (valor) => {
      const crudo = typeof valor === 'number' ? String(valor).replace('.', ',') : String(valor ?? '');
      // A cell that starts like a formula stays text in Excel.
      const t = /^[=+@]/.test(crudo) ? `'${crudo}` : crudo;
      return /[";\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
    };
    const csv = `\ufeff${filas.map((f) => f.map(celda).join(';')).join('\r\n')}\r\n`;
    return h('a', {
      clase: 'sl-boton-secundario sl-descargar',
      href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      download: `${nombre}-${isoDe(new Date())}.csv`,
    }, parsear(ICONO_DESCARGAR), etiqueta);
  };

  // The academic record page: read-only, so it can be rebuilt from its table. The
  // original stays in the page, hidden, and is what gets parsed.
  const ELECTIVAS_CORTADAS = [
    ['analisis y diseno de datos e informacion', 'Análisis y Diseño de Datos e Información (Elec.)'],
    ['sistemas de informacion geografica', 'Sistemas de Información Geográfica (Elec.)'],
    ['introduccion a la practica profesional', 'Introducción a la Práctica Profesional (Elec.)'],
    ['metodologias agiles en el desarrollo de', 'Metodologías Ágiles en el Desarrollo de Software (Elec.)'],
    ['soporte a la gestion de datos con progra', 'Soporte a la Gestión de Datos con Programación Visual (Elec.)'],
    ['informatica en la administracion publica', 'Informática en la Administración Pública (Elec.)'],
    ['sistemas de informacion integrados para', 'Sistemas de Información Integrados para la Industria (Elec.)'],
    // Its full name does not show in any page seen so far.
    ['tecnologias de desarrollo de software id', null],
  ];
  const esElectiva = (nombre) => /\(elec/i.test(nombre) || ELECTIVAS_CORTADAS.some(([prefijo]) => normalizar(nombre).startsWith(prefijo));
  // Sysacad lists it without the mark, but it is an elective of the plan that adds no elective hours.
  const esSeminario = (nombre) => normalizar(nombre).startsWith('seminario integrador');

  // Gives back the full name of a subject cut by Sysacad when it is known. A cut inside
  // the elective mark leaves the whole name before it.
  const nombreEntero = (nombre) => {
    const conocida = ELECTIVAS_CORTADAS.find(([prefijo, completo]) => completo && completo.length > nombre.length && normalizar(nombre).startsWith(prefijo));
    if (conocida) return conocida[1];
    const marca = nombre.match(/^(.*\S)\s*\((E(l(e(c\.?)?)?)?)?$/i);
    return marca ? `${marca[1]} (Elec.)` : nombre;
  };

  // Search and filter tabs, shared by the academic record and the prerequisites page.
  function barraDeFiltros(filtro, aplicar, placeholder, grupos) {
    const grupoChips = ({ etiqueta, visible, clave, opciones }) => {
      const botones = opciones.map(({ valor, texto, cuenta }) => {
        const boton = h('button', {
          clase: 'sl-chip',
          type: 'button',
          'aria-pressed': String(valor === null),
          onclick: soloClicReal(() => {
            filtro[clave] = valor;
            for (const b of botones) b.setAttribute('aria-pressed', String(b === boton));
            aplicar();
          }),
        }, texto, cuenta === undefined ? null : h('small', { texto: String(cuenta) }));
        return boton;
      });
      return h('div', { clase: 'sl-chips', role: 'group', 'aria-label': etiqueta },
        h('span', { clase: 'sl-chips-titulo', 'aria-hidden': 'true', texto: visible }),
        ...botones,
      );
    };
    return h('div', { clase: 'sl-filtros' },
      h('input', {
        clase: 'sl-buscar',
        type: 'search',
        placeholder,
        'aria-label': placeholder,
        autocomplete: 'off',
        onkeydown: (e) => {
          if (e.key === 'Enter') e.preventDefault();
        },
        oninput: soloClicReal((e) => {
          filtro.texto = normalizar(e.target.value);
          aplicar();
        }),
      }),
      ...grupos.map(grupoChips),
    );
  }

  // El Santo Resumen and Super CVG get the same card, on the menu and on Estado académico: an invitation until the
  // student links it or says no, and once linked, where it stands.
  const VINCULOS = {
    santo: {
      clase: 'sl-santo',
      nombre: 'El Santo Resumen',
      destino: SANTO_MAPA,
      vinculado: 'santoVinculado',
      preguntado: 'santoPreguntado',
      invitacion: 'Vinculalo y tus aprobadas y regulares se pintan solas en su mapa de materias. Pasa solo en este navegador.',
      ajuste: 'Tus aprobadas y regulares se pintan en su mapa de materias. Pasa solo en este navegador.',
      aca: 'Tus aprobadas y regulares se pintan en su mapa de materias. Se actualizan cada vez que entrás acá.',
      desdeElMenu: 'Entrá a Estado académico y tus aprobadas y regulares se pintan en su mapa de materias.',
      guardarDatos: guardarParaSanto,
      datos: ['santoMaterias'],
    },
    supercvg: {
      clase: 'sl-supercvg',
      // Kept on one line, also in the titles of a phone.
      nombre: 'Super\u00a0CVG',
      destino: SUPERCVG,
      vinculado: 'supercvgVinculado',
      preguntado: 'supercvgPreguntado',
      invitacion: 'Vinculalo y la nota final de cada materia aprobada aparece en sus notas. Pasa solo en este navegador.',
      ajuste: 'La nota final de cada materia aprobada aparece en sus notas. Pasa solo en este navegador.',
      aca: 'La nota final de cada materia aprobada aparece en sus notas. Se actualiza cada vez que entrás acá.',
      desdeElMenu: 'Entrá a Estado académico y la nota final de cada materia aprobada aparece en sus notas.',
      espera: 'Abrí Estado académico y la nota final de cada materia aprobada pasa sola a Super\u00a0CVG.',
      guardarDatos: guardarParaSuperCvg,
      datos: ['supercvgFinales', 'supercvgDesdeSuPagina', 'supercvgPestanas', 'supercvgAlumno'],
    },
  };

  // `modo` is invitar, recien (just linked), vinculado, espera (linked, the grades not read yet) or traidos (just read).
  // With `materias` (on Estado académico) linking keeps them at once.
  function tarjetaVinculo(v, modo, { materias = null, estadoAcademico = null, volver = false } = {}) {
    const tarjeta = h('section', { clase: `sl-vinculo ${v.clase}`, 'aria-labelledby': `${v.clase}-titulo` });
    const enlace = (texto, href, otraPestana) => h('a', { clase: 'sl-vinculo-ir', href, target: otraPestana ? '_blank' : null, rel: otraPestana ? 'noopener' : null },
      texto, otraPestana ? h('span', { clase: 'sl-solo-lectores', texto: ', se abre en otra pestaña' }) : null);
    const abrir = (verbo = 'Abrir') => enlace(`${verbo} ${v.nombre}`, v.destino, true);
    const mostrar = (titulo, texto, ir) => {
      const encabezado = h('h2', { id: `${v.clase}-titulo`, tabindex: '-1', texto: titulo });
      tarjeta.replaceChildren(...[encabezado, h('p', { texto }), ir].filter(Boolean));
      return encabezado;
    };
    const MODOS = {
      recien: () => mostrar('Quedó vinculado', materias ? v.aca : v.desdeElMenu, abrir()),
      vinculado: () => mostrar(`Vinculado con ${v.nombre}`, v.aca, abrir()),
      espera: () => mostrar(`${v.nombre} espera tus finales`, v.espera, estadoAcademico ? enlace('Ir a Estado académico', estadoAcademico, false) : null),
      traidos: () => mostrar(`Tus finales ya están en ${v.nombre}`, v.aca, abrir(volver ? 'Volver a' : 'Abrir')),
    };
    if (modo !== 'invitar') {
      MODOS[modo]();
      return tarjeta;
    }
    tarjeta.append(
      h('h2', { id: `${v.clase}-titulo`, texto: `¿Usás ${v.nombre}?` }),
      h('p', { texto: v.invitacion }),
      h('div', { clase: 'sl-vinculo-botones' },
        h('button', {
          type: 'button',
          clase: 'sl-vinculo-si',
          texto: 'Vincular',
          onclick: soloClicReal(async () => {
            await guardar({ [v.vinculado]: true, [v.preguntado]: true });
            if (materias) await v.guardarDatos(materias);
            MODOS.recien().focus();
          }),
        }),
        h('button', {
          type: 'button',
          clase: 'sl-vinculo-no',
          texto: 'Ahora no',
          onclick: soloClicReal(async () => {
            await guardar({ [v.preguntado]: true });
            const despues = tarjeta.previousElementSibling ?? tarjeta.parentElement;
            tarjeta.remove();
            despues?.querySelector('a, button, h1, h2')?.focus();
          }),
        }),
      ),
      h('p', { clase: 'sl-vinculo-ayuda', texto: 'Después lo podés cambiar en Ajustes.' }),
    );
    return tarjeta;
  }

  // Which cards go where. On top, one at a time so they do not pile up: Super CVG waiting for the grades (or just
  // handed them), then the invitation of El Santo Resumen, then the one of Super CVG on a later visit. Below, only on
  // Estado académico, the links already made. With `materias` each linked one keeps its data first.
  async function tarjetasDeVinculos({ materias = null, estadoAcademico = null } = {}) {
    const s = await leerVinculos();
    const { santo, supercvg } = VINCULOS;
    const esperaFinales = s.supercvgVinculado && !s.supercvgFinales;
    if (materias && s.santoVinculado) await guardarParaSanto(materias);
    if (materias && s.supercvgVinculado) await guardarParaSuperCvg(materias);
    const tarjeta = (v, modo) => tarjetaVinculo(v, modo, { materias, estadoAcademico, volver: s.supercvgDesdeSuPagina });
    const arriba = [];
    if (esperaFinales) arriba.push(tarjeta(supercvg, materias ? 'traidos' : 'espera'));
    else if (!s.santoVinculado && !s.santoPreguntado) arriba.push(tarjeta(santo, 'invitar'));
    else if (!s.supercvgVinculado && !s.supercvgPreguntado) arriba.push(tarjeta(supercvg, 'invitar'));
    const abajo = materias ? [s.santoVinculado && tarjeta(santo, 'vinculado'), s.supercvgVinculado && !esperaFinales && tarjeta(supercvg, 'vinculado')].filter(Boolean) : [];
    return { arriba, abajo };
  }

  function mejorarEstadoAcademico() {
    const tabla = [...document.querySelectorAll('table.sl-datos')].find((t) => {
      const cabecera = t.querySelector('tr.sl-cabecera');
      if (!cabecera) return false;
      const nombres = [...cabecera.cells].map((c) => normalizar(c.textContent));
      return ['ano', 'materia', 'estado'].every((n) => nombres.includes(n));
    });
    if (!tabla || tabla.querySelector('input, select, textarea')) return;

    const cabecera = tabla.querySelector('tr.sl-cabecera');
    const nombres = [...cabecera.cells].map((c) => normalizar(c.textContent));
    const col = (n) => nombres.indexOf(n);
    const materias = filasDe(tabla)
      .filter((f) => f !== cabecera && f.cells.length === cabecera.cells.length)
      .map((f) => {
        const celda = (n) => f.cells[col(n)]?.textContent.trim() ?? '';
        const nombre = nombreEntero(celda('materia'));
        const estado = cambioDeEstado(celda('estado'));
        const seminario = esSeminario(nombre);
        const electiva = seminario || esElectiva(nombre);
        // A pending equivalence complement applies only to students who changed plans.
        const complemento = /^compl/i.test(nombre);
        const opcional = electiva || complemento;
        const enProgreso = !electiva && !(complemento && estado.tipo === 'pendiente');
        return { anio: celda('ano'), plan: celda('plan'), nombre, opcional, electiva, seminario, enProgreso, ...estado };
      })
      .filter((m) => m.nombre);
    if (!materias.length) return;

    const cuentan = materias.filter((m) => m.enProgreso);
    const aprobadas = cuentan.filter((m) => m.tipo === 'aprobada');
    const regulares = cuentan.filter((m) => m.tipo === 'regular');
    const sinCursar = cuentan.filter((m) => m.tipo === 'pendiente');
    const notas = materias.map((m) => m.nota).filter((n) => n !== null);
    const promedio = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
    const total = cuentan.length;

    const electivas = materias.filter((m) => m.electiva);
    const electivasAprobadas = electivas.filter((m) => m.tipo === 'aprobada');
    const horasElectivas = electivasAprobadas.filter((m) => !m.seminario).reduce((suma, m) => suma + m.horas, 0);
    const lineaElectivas = electivas.length
      ? h('p', {
          clase: 'sl-electivas',
          texto: `Las electivas van aparte y suman ${horasElectivas} hs. Tenés ${cantidad(electivasAprobadas.length, 'aprobada', 'aprobadas')} y ${cantidad(electivas.filter((m) => m.tipo === 'regular').length, 'regular', 'regulares')}.`,
        })
      : null;

    // Graduating takes 20 hours of electives in total (Ordinance 1877/2022 of UTN: 4 in
    // third level, 6 in fourth, 10 in fifth, equal to 480 clock hours). It applies only
    // to Ingeniería en Sistemas de Información, plan 2023.
    if (lineaElectivas && materias.some((m) => m.plan === '2023')) {
      chrome.storage.local.get({ carrera: '' }).then(({ carrera }) => {
        if (normalizar(carrera) === 'ingenieria en sistemas de informacion') {
          const faltan = HORAS_ELECTIVAS - horasElectivas;
          lineaElectivas.append(faltan > 0
            ? ` Para recibirte necesitás ${HORAS_ELECTIVAS} hs y te faltan ${faltan}.`
            : ` Ya tenés las ${HORAS_ELECTIVAS} hs que necesitás para recibirte.`);
          lineaElectivas.after(h('div', {
            clase: 'sl-barra',
            role: 'img',
            'aria-label': `${horasElectivas} de ${HORAS_ELECTIVAS} horas de electivas`,
          }, h('i', { clase: 'sl-b-aprobada', style: anchoBarra(Math.min(horasElectivas, HORAS_ELECTIVAS), HORAS_ELECTIVAS) })));
        }
      });
    }

    const tablero = h('section', { clase: 'sl-tablero', 'aria-label': 'Resumen' },
      promedio === null ? null : h('div', { clase: 'sl-promedio' },
        h('strong', { texto: decimal(promedio) }),
        h('span', { texto: `Promedio de ${cantidad(notas.length, 'nota', 'notas')}` }),
      ),
      h('div', { clase: 'sl-avance', style: promedio === null ? 'grid-column: 1 / -1' : null },
        total ? h('p', { clase: 'sl-avance-titulo', texto: `${aprobadas.length} de ${total} materias aprobadas` }) : null,
        total ? barra(aprobadas.length, regulares.length, total) : null,
        total ? h('p', { clase: 'sl-leyenda' },
          h('span', {}, h('b', { texto: String(regulares.length) }), regulares.length === 1 ? ' regular' : ' regulares'),
          h('span', {}, h('b', { texto: String(sinCursar.length) }), ' sin cursar'),
        ) : null,
      ),
      lineaElectivas ? h('div', { clase: 'sl-tarjeta-electivas' }, h('p', { clase: 'sl-tarjeta-titulo', texto: 'Electivas' }), lineaElectivas) : null,
    );

    function barra(apr, reg, tot) {
      return h('div', {
        clase: 'sl-barra',
        role: 'img',
        'aria-label': `${apr} aprobadas y ${reg} regulares de ${tot}`,
      },
        h('i', { clase: 'sl-b-aprobada', style: anchoBarra(apr, tot) }),
        h('i', { clase: 'sl-b-regular', style: anchoBarra(reg, tot) }),
      );
    }

    const anios = [...new Set(materias.map((m) => m.anio))];
    const nombreAnio = (a) => (Number(a) === 0 ? 'Ingreso' : `Año ${a}`);

    const secciones = anios.map((anio) => {
      // The subjects of the plan first, then the electives, each group in Sysacad's order.
      const propias = materias.filter((m) => m.anio === anio).sort((a, b) => a.electiva - b.electiva);
      const obligatorias = propias.filter((m) => m.enProgreso);
      const apr = obligatorias.filter((m) => m.tipo === 'aprobada').length;
      const reg = obligatorias.filter((m) => m.tipo === 'regular').length;
      const textoEstado = (m) => {
        if (m.tipo === 'aprobada') return m.cuando ? `Aprobada en ${m.cuando}` : 'Aprobada';
        if (m.tipo === 'regular') return m.cuando ? `Regular en ${m.cuando}` : 'Regular';
        if (m.tipo === 'otro') return m.crudo;
        return m.electiva ? 'Electiva, sin cursar' : m.opcional ? 'Complementaria, sin cursar' : 'Sin cursar';
      };
      const items = propias.map((m) => {
        const claseTipo = m.tipo === 'pendiente' && m.opcional ? 'opcional' : m.tipo;
        const fila = h('tr', { clase: `sl-materia sl-e-${claseTipo}` },
          h('td', { clase: 'sl-materia-nombre', texto: m.nombre }),
          h('td', { clase: 'sl-estado-texto sl-col-estado', texto: textoEstado(m) }),
          h('td', { clase: 'sl-dato sl-col-registro', texto: m.registro }),
          h('td', { clase: 'sl-dato sl-col-hs', texto: m.horas ? `${m.horas} hs` : '' }),
          h('td', { clase: 'sl-nota sl-col-nota', texto: m.nota === null ? '' : String(m.nota).replace('.', ',') }),
        );
        return { m, li: fila };
      });
      const columna = (texto, clase) => h('th', { scope: 'col', clase, texto });
      const seccion = h('section', { clase: 'sl-anio' },
        h('div', { clase: 'sl-anio-cabeza' },
          h('h2', { texto: nombreAnio(anio) }),
          h('span', { texto: `${apr} de ${obligatorias.length} aprobadas` }),
        ),
        h('table', { clase: 'sl-analitico' },
          h('thead', {}, h('tr', {},
            columna('Materia'),
            columna('Estado', 'sl-col-estado'),
            columna('Registro', 'sl-col-registro'),
            columna('Horas', 'sl-col-hs'),
            columna('Nota', 'sl-col-nota'),
          )),
          h('tbody', {}, ...items.map((i) => i.li)),
        ),
      );
      return { anio, seccion, items };
    });

    // Filters. All of them start from a real interaction and only toggle a class.
    // The state chips count like the summary: subjects of the career by state, and electives apart, as in their own
    // card. So the same word shows the same number, and each chip lists exactly what it counts.
    const filtro = { anio: null, tipo: null, texto: '' };
    const enEstado = {
      aprobada: (m) => m.enProgreso && m.tipo === 'aprobada',
      regular: (m) => m.enProgreso && m.tipo === 'regular',
      pendiente: (m) => m.enProgreso && m.tipo === 'pendiente',
      electiva: (m) => m.electiva,
    };
    const sinResultados = h('p', { clase: 'sl-sin-resultados sl-filtrada', texto: 'Ninguna materia coincide. Probá con otro filtro.' });
    const anuncio = h('p', { clase: 'sl-anuncio', role: 'status' });

    const aplicar = () => {
      let visibles = 0;
      for (const { anio, seccion, items } of secciones) {
        let enSeccion = 0;
        for (const { m, li } of items) {
          const ok =
            (filtro.anio === null || filtro.anio === anio) &&
            (filtro.tipo === null || enEstado[filtro.tipo](m)) &&
            (!filtro.texto || normalizar(m.nombre).includes(filtro.texto));
          li.classList.toggle('sl-filtrada', !ok);
          if (ok) enSeccion += 1;
        }
        seccion.classList.toggle('sl-filtrada', !enSeccion);
        visibles += enSeccion;
      }
      sinResultados.classList.toggle('sl-filtrada', visibles > 0);
      anuncio.textContent = visibles ? cantidad(visibles, 'materia', 'materias') : 'Sin resultados';
    };

    const filtros = barraDeFiltros(filtro, aplicar, 'Buscar materia', [
      { etiqueta: 'Filtrar por año', visible: 'Año', clave: 'anio', opciones: [{ valor: null, texto: 'Todos' }, ...anios.map((a) => ({ valor: a, texto: nombreAnio(a) }))] },
      { etiqueta: 'Filtrar por estado', visible: 'Estado', clave: 'tipo', opciones: [
        { valor: null, texto: 'Todas' },
        { valor: 'aprobada', texto: 'Aprobadas', cuenta: aprobadas.length },
        { valor: 'regular', texto: 'Regulares', cuenta: regulares.length },
        { valor: 'pendiente', texto: 'Sin cursar', cuenta: sinCursar.length },
        ...(electivas.length ? [{ valor: 'electiva', texto: 'Electivas', cuenta: electivas.length }] : []),
      ] },
    ]);

    const tipoDe = (m) => (m.electiva ? 'Electiva' : m.opcional ? 'Complementaria' : 'Obligatoria');
    const descarga = enlaceCsv('estado-academico', [
      ['Año', 'Materia', 'Tipo', 'Estado', 'Cuándo', 'Nota', 'Horas', 'Registro'],
      ...materias.map((m) => [m.anio, m.nombre, tipoDe(m), m.tipo === 'otro' ? m.crudo : ESTADO_EN_SINGULAR[m.tipo], m.cuando, m.nota, m.horas || '', m.registro]),
    ], 'Descargar en Excel');

    const vista = h('div', { clase: 'sl-estado' },
      h('div', { clase: 'sl-estado-lado' }, tablero, filtros),
      h('div', { clase: 'sl-estado-cuerpo' }, ...secciones.map((s) => s.seccion), sinResultados, anuncio, h('div', { clase: 'sl-descarga-pie' }, descarga)),
    );

    let exterior = tabla;
    while (exterior.parentElement?.closest('table')) exterior = exterior.parentElement.closest('table');
    exterior.before(vista);
    tabla.classList.add('sl-reemplazada');

    // Links already made say so below everything; one still to ask, or Super CVG with news, goes on top.
    tarjetasDeVinculos({ materias }).then(({ arriba, abajo }) => {
      vista.before(...arriba);
      vista.after(...abajo);
    });
  }

  // The certificates page is a table that repeats the student's name around a list of
  // links. The links become cards, and Sysacad's own warning about generating the
  // certificate sits next to them instead of only in the footer.
  const ICONO_CERTIFICADO = icono('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h4"/>', 26);

  function mejorarCertificados() {
    const titulo = [...document.querySelectorAll('ol')].find((o) => normalizar(o.textContent) === 'descarga de certificados');
    const celda = titulo?.closest('td');
    const enlaces = celda ? [...celda.querySelectorAll('ul a[href]')] : [];
    if (!enlaces.length || celda.closest('table').querySelector('input, select, textarea, form')) return;
    const avisa = normalizar(document.body.textContent).includes('al generar el certificado de cursado no se podran eliminar las inscripciones');
    for (const enlace of enlaces) {
      enlace.classList.add('sl-enlace');
      enlace.prepend(h('span', { clase: 'sl-icono-tarjeta' }, parsear(ICONO_CERTIFICADO)));
      enlace.append(h('span', { clase: 'sl-cert-accion', 'aria-hidden': 'true', texto: 'Generar' }));
    }
    const tabla = celda.closest('table');
    tabla.before(h('section', { clase: 'sl-certificados', 'aria-label': 'Certificados para descargar' },
      h('div', { clase: 'sl-grupo-principal' }, ...enlaces),
      avisa ? h('p', { clase: 'sl-aviso-cert' },
        h('strong', { texto: 'Antes de generarlo. ' }),
        'Sysacad avisa que al generar el certificado de cursado ya no se pueden eliminar las inscripciones.',
      ) : null,
    ));
    celda.closest('tr').classList.add('sl-reemplazada');
    // The header row only repeats the student's name.
    for (const fila of tabla.querySelectorAll('tr')) {
      if (fila.querySelector('th.tituloTabla') && !fila.querySelector('a, input, select, textarea, button')) fila.classList.add('sl-reemplazada');
    }
  }

  // Exam enrollment: the list of subjects, the dates of one subject, the enrollment made
  // and the certificate. Sysacad's links, radios and button stay the real ones; only
  // their frame changes, and nothing is sent until the student presses them.
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // Sysacad writes the examiners in capitals: «SOSA RIVAS» reads «Sosa Rivas».
  const nombrePropio = (t) => t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase());

  // Lines of a cell whose parts Sysacad splits with <br>.
  const lineasDe = (el) => {
    const copia = el.cloneNode(true);
    for (const br of copia.querySelectorAll('br')) br.replaceWith('\n');
    return copia.textContent.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  };

  // «Inscripto el día jueves 10 de diciembre - Tarde - FERREYRA - Mail Presidente: x», the schedule and the code.
  function datosDeInscripcion(lineas) {
    const texto = lineas.join('\n');
    const dia = texto.match(/^Inscripto el d[ií]a\s+(.+?)\s+-\s+(.+?)\s+-\s+(.+?)(?:\s+-\s+Mail Presidente:\s*(\S+))?$/im);
    const codigo = texto.match(/C[oó]digo de seguridad\s+(\S+)/i);
    if (!dia || !codigo) return null;
    const horario = texto.match(/Horario te[oó]rico\s+(\S+)\s+pr[aá]ctico\s+(\S+)/i);
    return {
      dia: mayuscula(dia[1]),
      turno: mayuscula(dia[2].toLowerCase()),
      tribunal: nombrePropio(dia[3]),
      mail: dia[4] ?? null,
      teorico: horario?.[1] ?? null,
      practico: horario?.[2] ?? null,
      codigo: codigo[1],
    };
  }

  const ICONO_LISTO = icono('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 28);
  const ICONO_IMPRIMIR = icono('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>');

  // The details of one enrollment, the same on the confirmation and on the certificate.
  function fichaDeInscripcion(datos) {
    const horario = !datos.teorico ? null
      : datos.teorico === datos.practico ? `${datos.teorico}, teórico y práctico`
      : `Teórico ${datos.teorico}, práctico ${datos.practico}`;
    const fila = (etiqueta, ...valor) => [h('dt', { texto: etiqueta }), h('dd', {}, ...valor)];
    return h('div', { clase: 'sl-ficha' },
      h('p', { clase: 'sl-ficha-dia' }, h('strong', { texto: datos.dia }), h('span', { texto: `Turno ${datos.turno.toLowerCase()}` })),
      h('dl', {},
        ...fila('Tribunal', datos.tribunal),
        ...(horario ? fila('Horario', horario) : []),
        ...(datos.mail ? fila('Presidente de mesa', h('a', { href: `mailto:${datos.mail}`, texto: datos.mail })) : []),
      ),
      h('p', { clase: 'sl-codigo' }, h('span', { texto: 'Código de seguridad' }), h('strong', { texto: datos.codigo })),
    );
  }

  const tablaExterior = (el) => {
    let tabla = el.closest('table');
    while (tabla?.parentElement?.closest('table')) tabla = tabla.parentElement.closest('table');
    return tabla;
  };

  const ponerAntetitulo = (texto) => {
    const titulo = document.querySelector('h1.sl-titulo');
    titulo?.before(h('p', { clase: 'sl-antetitulo', texto }));
    return titulo;
  };

  // The list: one card per year, the subjects of the career first and the electives apart,
  // each with Sysacad's own link to its dates.
  function mejorarListaDeExamenes() {
    if (pagina !== '/materiasexamen.asp') return;
    const tabla = [...document.querySelectorAll('table.sl-datos')].find((t) => {
      const nombres = [...(t.querySelector('tr.sl-cabecera')?.cells ?? [])].map((c) => normalizar(c.textContent));
      return ['ano', 'materia', 'inscripcion'].every((n) => nombres.includes(n));
    });
    if (!tabla || tabla.querySelector('input, select, textarea')) return;
    const cabecera = tabla.querySelector('tr.sl-cabecera');
    const nombres = [...cabecera.cells].map((c) => normalizar(c.textContent));
    const materias = filasDe(tabla)
      .filter((f) => f !== cabecera && f.cells.length === cabecera.cells.length)
      .map((f) => {
        const enlace = f.cells[nombres.indexOf('inscripcion')].querySelector('a[href]');
        const nombre = nombreEntero(f.cells[nombres.indexOf('materia')].textContent.trim());
        return { anio: f.cells[nombres.indexOf('ano')].textContent.trim(), nombre, electiva: esSeminario(nombre) || esElectiva(nombre), enlace };
      })
      .filter((m) => m.nombre && m.enlace?.origin === location.origin);
    if (!materias.length) return;

    const anios = [...new Set(materias.map((m) => m.anio))];
    const nombreAnio = (a) => (Number(a) === 0 ? 'Ingreso' : `Año ${a}`);
    const item = (m) => {
      const enlace = h('a', { clase: 'sl-ver-fechas', href: m.enlace.href, 'aria-label': `Inscribirse a ${m.nombre}`, texto: 'Inscribirse' });
      // The key keeps «Inscribirse» from gluing onto the name when matching «Mis materias».
      return { m, li: h('li', { clase: 'sl-materia', 'data-sl-clave': m.nombre }, h('span', { clase: 'sl-materia-nombre', texto: m.nombre }), enlace) };
    };
    const secciones = anios.map((anio) => {
      const items = materias.filter((m) => m.anio === anio).map(item);
      const obligatorias = items.filter((i) => !i.m.electiva);
      const electivas = items.filter((i) => i.m.electiva);
      const cuentaElectivas = h('span', { texto: cantidad(electivas.length, 'materia', 'materias') });
      const bloqueElectivas = electivas.length ? h('div', { clase: 'sl-examen-electivas' },
        h('h3', {}, 'Electivas', cuentaElectivas),
        h('ul', { clase: 'sl-examen-lista' }, ...electivas.map((i) => i.li)),
      ) : null;
      const seccion = h('section', { clase: 'sl-anio sl-examen-anio' },
        h('div', { clase: 'sl-anio-cabeza' }, h('h2', { texto: nombreAnio(anio) }), h('span', { texto: cantidad(items.length, 'materia', 'materias') })),
        obligatorias.length ? h('ul', { clase: 'sl-examen-lista' }, ...obligatorias.map((i) => i.li)) : null,
        bloqueElectivas,
      );
      return { anio, seccion, items, bloqueElectivas, cuentaElectivas };
    });

    const filtro = { anio: null, tipo: null, texto: '' };
    const sinResultados = h('p', { clase: 'sl-sin-resultados sl-filtrada', texto: 'Ninguna materia coincide. Probá con otro filtro.' });
    const anuncio = h('p', { clase: 'sl-anuncio', role: 'status' });
    const aplicar = () => {
      let visibles = 0;
      for (const { anio, seccion, items, bloqueElectivas, cuentaElectivas } of secciones) {
        let enSeccion = 0;
        let electivas = 0;
        for (const { m, li } of items) {
          const ok = (filtro.anio === null || filtro.anio === anio)
            && (filtro.tipo === null || (filtro.tipo === 'electiva') === m.electiva)
            && (!filtro.texto || normalizar(m.nombre).includes(filtro.texto));
          li.classList.toggle('sl-filtrada', !ok);
          if (ok) enSeccion += 1;
          if (ok && m.electiva) electivas += 1;
        }
        bloqueElectivas?.classList.toggle('sl-filtrada', !electivas);
        cuentaElectivas.textContent = cantidad(electivas, 'materia', 'materias');
        seccion.classList.toggle('sl-filtrada', !enSeccion);
        visibles += enSeccion;
      }
      sinResultados.classList.toggle('sl-filtrada', visibles > 0);
      anuncio.textContent = visibles ? cantidad(visibles, 'materia', 'materias') : 'Sin resultados';
    };
    const electivas = materias.filter((m) => m.electiva).length;
    const grupos = [];
    if (anios.length > 1) {
      grupos.push({ etiqueta: 'Filtrar por año', visible: 'Año', clave: 'anio', opciones: [
        { valor: null, texto: 'Todos' },
        ...anios.map((a) => ({ valor: a, texto: nombreAnio(a), cuenta: materias.filter((m) => m.anio === a).length })),
      ] });
    }
    if (electivas && electivas < materias.length) {
      grupos.push({ etiqueta: 'Filtrar por tipo', visible: 'Tipo', clave: 'tipo', opciones: [
        { valor: null, texto: 'Todas' },
        { valor: 'obligatoria', texto: 'De la carrera', cuenta: materias.length - electivas },
        { valor: 'electiva', texto: 'Electivas', cuenta: electivas },
      ] });
    }

    const exterior = tablaExterior(tabla);
    exterior.before(h('div', { clase: 'sl-examenes' },
      barraDeFiltros(filtro, aplicar, 'Buscar materia', grupos),
      ...secciones.map((s) => s.seccion),
      sinResultados,
      anuncio,
    ));
    exterior.classList.add('sl-reemplazada');
    document.querySelector('.sl-heroe')?.append(h('p', {
      clase: 'sl-bajada',
      texto: `Te podés anotar en ${cantidad(materias.length, 'materia', 'materias')}. Elegí una y después la fecha.`,
    }));
  }

  // The dates of one subject: grouped by day, each examiner a card that can be pressed
  // anywhere. Each radio stays in its form; if wrapping it would take it out, the page stays as it is.
  function mejorarFechasDeExamen() {
    if (pagina !== '/fechasexamen.asp') return;
    const radios = [...document.querySelectorAll('form input[type="radio"]')];
    const formulario = radios[0]?.form;
    const celda = radios[0]?.closest('td');
    // A field inside its form keeps it when moved within; misnested markup would lose it, so that page stays as it is.
    if (!formulario || !celda || radios.some((r) => r.form !== formulario || !formulario.contains(r) || r.closest('td') !== celda)) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = new Map();
    const opciones = [];
    for (const radio of radios) {
      // The text after each radio, up to its <br>.
      const partes = [];
      let nodo = radio.nextSibling;
      while (nodo && nodo.nodeName !== 'BR' && nodo.nodeName !== 'INPUT') {
        partes.push(nodo);
        nodo = nodo.nextSibling;
      }
      const texto = partes.map((p) => p.textContent).join(' ').replace(/\s+/g, ' ').trim();
      const datos = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+Tribunal\s+(.+?)(?:\s+turno\s+(.+))?$/i);
      // A date that does not exist (31/02) would show as another day: the page stays as it is.
      const fecha = datos && new Date(Number(datos[3]), Number(datos[2]) - 1, Number(datos[1]));
      if (!datos || fecha.getDate() !== Number(datos[1]) || fecha.getMonth() !== Number(datos[2]) - 1) return;
      opciones.push({ radio, partes, br: nodo?.nodeName === 'BR' ? nodo : null, datos });
    }

    const etiquetas = [];
    for (const { radio, partes, br, datos } of opciones) {
      const [, d, m, a, tribunal, turno] = datos;
      const fecha = new Date(Number(a), Number(m) - 1, Number(d));
      const clave = fecha.getTime();
      if (!dias.has(clave)) dias.set(clave, { fecha, etiquetas: [] });
      const etiqueta = h('label', { clase: 'sl-mesa' });
      radio.before(etiqueta);
      etiqueta.append(radio, h('span', { clase: 'sl-mesa-texto' },
        h('strong', { texto: `Tribunal ${nombrePropio(tribunal)}` }),
        turno ? h('span', { texto: `Turno ${turno.toLowerCase()}` }) : null,
      ));
      for (const p of partes) p.remove();
      br?.remove();
      dias.get(clave).etiquetas.push(etiqueta);
      etiquetas.push(etiqueta);
    }
    // In the page before the cards move into it, so no radio ever leaves the form.
    const grupo = h('div', { clase: 'sl-mesas' });
    etiquetas[0].before(grupo);
    for (const { fecha, etiquetas: suyas } of dias.values()) {
      const faltan = Math.round((fecha - hoy) / 86400000);
      const cuando = faltan === 0 ? 'Hoy' : faltan === 1 ? 'Mañana' : faltan > 1 ? `En ${faltan} días` : null;
      grupo.append(h('section', { clase: 'sl-mesa-dia' },
        h('h2', {},
          h('span', { texto: `${mayuscula(DIAS[fecha.getDay()])} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}` }),
          cuando ? h('small', { texto: cuando }) : null,
        ),
        ...suyas,
      ));
    }
    // Sysacad's own line break before the first radio.
    for (const br of celda.querySelectorAll(':scope > br')) br.remove();
    formulario.querySelector('input[type="submit"]')?.classList.add('sl-boton-principal');

    const titulo = celda.closest('table')?.parentElement?.closest('table')?.querySelector('td.tituloTabla')
      ?? tablaExterior(celda)?.querySelector('td.tituloTabla');
    const materia = titulo?.textContent.trim().match(/^Inscripci[oó]n a examen de (.+)$/i)?.[1];
    const h1 = materia ? ponerAntetitulo('Inscripción a examen') : null;
    if (h1) {
      h1.textContent = nombreEntero(materia);
      titulo.closest('tr').classList.add('sl-reemplazada');
    }
    tablaExterior(celda)?.classList.add('sl-examen-marco');
  }

  // The enrollment made: a receipt with the day, the examiner and the security code.
  function mejorarInscripcionHecha() {
    if (pagina !== '/inscripcionexamen.asp') return;
    const parrafo = [...document.querySelectorAll('p, td')].find((el) => /C[oó]digo de seguridad/i.test(el.textContent) && !el.querySelector('p, td'));
    const datos = parrafo && datosDeInscripcion(lineasDe(parrafo));
    if (!datos) return;
    // The page does not name the subject. The dates page it came from does, in its address.
    let materia = null;
    try {
      const previa = new URL(document.referrer);
      // Sysacad writes the name in Latin-1 (%ED for í), which the URL parser would read as UTF-8.
      const crudo = previa.origin === location.origin && previa.pathname.toLowerCase() === '/fechasexamen.asp' ? previa.search.match(/[?&]nombre=([^&]*)/i)?.[1] : null;
      const nombre = crudo?.replaceAll('+', ' ').replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      if (nombre) materia = nombreEntero(nombre.trim());
    } catch { /* no previous page */ }
    const examen = examenGuardado(materia, datos);
    if (examen) guardarExamenes([examen], false);
    const tabla = tablaExterior(parrafo);
    tabla.before(h('section', { clase: 'sl-comprobante sl-comprobante-listo' },
      h('div', { clase: 'sl-comprobante-cabeza' },
        h('span', { clase: 'sl-listo' }, parsear(ICONO_LISTO)),
        h('div', {},
          h('h2', { texto: 'Listo, te inscribiste' }),
          materia ? h('p', { texto: materia }) : null,
        ),
      ),
      fichaDeInscripcion(datos),
    ));
    tabla.classList.add('sl-reemplazada');
    const titulo = document.querySelector('h1.sl-titulo');
    if (titulo) titulo.textContent = 'Inscripción a examen';
    for (const a of document.querySelectorAll('a[href]')) {
      const destino = normalizar(a.textContent);
      if (destino === 'imprimir certificado y salir') a.classList.add('sl-boton-principal');
      if (destino === 'inscribirse a otra materia') a.classList.add('sl-boton-secundario');
    }
  }

  // The certificate: one receipt per enrollment, ready to print.
  function mejorarCertificadoDeExamenes() {
    if (pagina !== '/certificadoexamen.asp') return;
    const celdas = [...document.querySelectorAll('td')].filter((td) => /C[oó]digo de seguridad/i.test(td.textContent) && !td.querySelector('td'));
    const inscripciones = celdas.map((td) => ({ materia: td.querySelector('b')?.textContent.trim(), datos: datosDeInscripcion(lineasDe(td)) }));
    if (!inscripciones.length || inscripciones.some((i) => !i.materia || !i.datos)) return;
    guardarExamenes(inscripciones.map(({ materia, datos }) => examenGuardado(nombreEntero(materia), datos)).filter(Boolean), true);
    const tabla = tablaExterior(celdas[0]);
    tabla.before(h('section', { clase: 'sl-comprobantes', 'aria-label': 'Exámenes en los que estás inscripto' },
      ...inscripciones.map(({ materia, datos }) => h('article', { clase: 'sl-comprobante' },
        h('h2', { texto: nombreEntero(materia) }),
        fichaDeInscripcion(datos),
      )),
    ));
    tabla.classList.add('sl-reemplazada');
    for (const a of document.querySelectorAll('a[href]')) {
      const destino = normalizar(a.textContent);
      if (destino === 'imprimir') {
        a.classList.add('sl-boton-principal');
        a.prepend(parsear(ICONO_IMPRIMIR));
      }
      if (destino === 'volver a menu principal') a.classList.add('sl-boton-secundario');
    }
  }

  // The prerequisites pages are one long table whose cells hold whole paragraphs. They
  // become a view by year, with what is missing as a list, a summary of which subjects
  // hold back the most others, and a map of the prerequisites. Pressing a subject in the
  // summary or the map supposes it done and shows what that frees.
  const ACCIONES = { regularizo: 'Regularizar', curso: 'Cursar', 'aprobo ni esta inscripto a': 'Aprobar o inscribirte a' };

  function mejorarCorrelatividades() {
    const tabla = [...document.querySelectorAll('table.sl-datos')].find((t) => {
      const cabecera = t.querySelector('tr.sl-cabecera');
      const titulos = cabecera ? [...cabecera.cells].map((c) => normalizar(c.textContent)) : [];
      return titulos.includes('ano') && titulos.includes('materia') && titulos.includes('correlatividad') && !t.querySelector('input, select, textarea, form');
    });
    if (!tabla) return;

    const cabecera = tabla.querySelector('tr.sl-cabecera');
    const titulos = [...cabecera.cells].map((c) => normalizar(c.textContent));
    const columna = (titulo) => titulos.indexOf(titulo);
    const verbo = pagina.includes('examen') ? 'rendir' : 'cursar';

    const lineasDe = (celda) => {
      const lineas = [''];
      const recorrido = document.createTreeWalker(celda, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
        if (nodo.nodeName === 'BR') lineas.push('');
        else if (nodo.nodeType === Node.TEXT_NODE) lineas[lineas.length - 1] += nodo.textContent;
      }
      return lineas.map((l) => l.replace(/\(Ord\.\s*\d+\)/i, '').trim()).filter(Boolean);
    };

    let horas = null;
    const materias = filasDe(tabla).filter((f) => f !== cabecera && f.cells.length === cabecera.cells.length).map((fila) => {
      const anio = fila.cells[columna('ano')].textContent.trim();
      const original = fila.cells[columna('materia')].textContent.trim();
      let nombre = original;
      const crudas = lineasDe(fila.cells[columna('correlatividad')]);
      const puede = crudas.length > 0 && /^puede/i.test(crudas[0]);
      const faltan = [];
      const reqs = [];
      let propia = false;
      // Lines that supposing a subject done cannot solve, like the elective hours.
      let otros = 0;
      if (!puede) {
        for (const linea of crudas) {
          const electivas = linea.match(/faltan aprobar (\d+) de (\d+) horas/i);
          if (electivas) {
            horas = { faltan: Number(electivas[1]), total: Number(electivas[2]) };
            faltan.push(`Te faltan ${electivas[1]} de ${electivas[2]} hs de electivas`);
            otros += 1;
            continue;
          }
          // The cryptic list of elective codes after that line says nothing to a student.
          if (/^(c[oó]digo materia|\d+=)/i.test(linea)) continue;
          const requisito = linea.match(/^No (regulariz[oó]|curs[oó]|aprob[oó] ni est[aá] inscripto a)\s+(.+)$/i);
          if (!requisito) {
            faltan.push(linea);
            otros += 1;
            continue;
          }
          const accion = ACCIONES[normalizar(requisito[1])];
          const objeto = requisito[2];
          if (normalizar(objeto) === normalizar(original) || (original.length >= 39 && normalizar(objeto).startsWith(normalizar(original)))) {
            nombre = objeto;
            propia = true;
            faltan.push(`${accion} esta materia`);
            continue;
          }
          faltan.push(`${accion} ${objeto}`);
          reqs.push({ clave: normalizar(objeto), texto: objeto });
        }
      }
      return { fila, anio, nombre, puede, faltan, reqs, propia, otros, electiva: esElectiva(nombre) || esSeminario(nombre), original, cortado: nombre === original && original.length >= 39 };
    });
    if (!materias.length) return;

    const completos = materias.flatMap((m) => m.reqs.map((r) => r.texto));
    for (const m of materias) {
      if (!m.cortado) continue;
      const corto = normalizar(m.nombre);
      m.nombre = completos.find((n) => n.length > m.nombre.length && normalizar(n).startsWith(corto)) ?? nombreEntero(m.nombre);
    }
    for (const m of materias) m.clave = normalizar(m.nombre);

    // Each requirement points at its row when the subject is on the page, and each
    // subject counts once per row it holds back.
    const materiaDe = (clave) => materias.find((m) => m.clave === clave) ?? materias.find((m) => m.cortado && clave.startsWith(normalizar(m.original)));
    const frenos = new Map();
    for (const m of materias) {
      const contadas = new Set();
      for (const r of m.reqs) {
        r.materia = materiaDe(r.clave);
        if (r.materia) r.clave = r.materia.clave;
        if (contadas.has(r.clave)) continue;
        contadas.add(r.clave);
        const previo = frenos.get(r.clave) ?? { clave: r.clave, texto: r.materia?.nombre ?? r.texto, cuenta: 0 };
        previo.cuenta += 1;
        frenos.set(r.clave, previo);
      }
    }

    const situacion = (m) => {
      if (m.puede) return `Podés ${verbo}`;
      if (!m.faltan.length) return 'Sin datos';
      const lista = (items) => h('ul', { clase: 'sl-faltan' }, ...items.map((texto) => h('li', { texto })));
      if (m.faltan.length <= 4) return lista(m.faltan);
      return h('div', {},
        lista(m.faltan.slice(0, 3)),
        h('details', { clase: 'sl-faltan-mas' }, h('summary', { texto: `Ver ${m.faltan.length - 3} más` }), lista(m.faltan.slice(3))),
      );
    };

    const anios = [...new Set(materias.map((m) => m.anio))].sort((a, b) => Number(a) - Number(b));
    const nombreAnio = (a) => (Number(a) === 0 ? 'Ingreso' : `Año ${a}`);
    const pueden = (lista) => lista.filter((m) => m.puede).length;

    const secciones = anios.map((anio) => {
      // Same order as in Estado académico: the subjects of the plan first, then the electives.
      const propias = materias.filter((m) => m.anio === anio).sort((a, b) => a.electiva - b.electiva);
      const items = propias.map((m) => {
        const contenido = situacion(m);
        const celda = h('td', { clase: 'sl-estado-texto sl-col-falta' }, contenido);
        const li = h('tr', { clase: `sl-materia ${m.puede ? 'sl-e-aprobada' : 'sl-e-otro'}`, 'data-sl-clave': m.nombre === m.original ? m.nombre : `${m.original} ${m.nombre}` },
          h('td', { clase: 'sl-materia-nombre', texto: m.nombre }),
          celda,
        );
        m.li = li;
        return { m, li };
      });
      const seccion = h('section', { clase: 'sl-anio' },
        h('div', { clase: 'sl-anio-cabeza' },
          h('h2', { texto: nombreAnio(anio) }),
          h('span', { texto: `${pueden(propias)} de ${propias.length} para ${verbo}` }),
        ),
        h('table', { clase: 'sl-analitico' },
          h('thead', {}, h('tr', {},
            h('th', { scope: 'col', texto: 'Materia' }),
            h('th', { scope: 'col', clase: 'sl-col-falta', texto: 'Qué te falta' }),
          )),
          h('tbody', {}, ...items.map((i) => i.li)),
        ),
      );
      return { anio, seccion, items };
    });

    // A subject frees up when every subject it waits for is supposed done. Lines like the
    // elective hours keep it waiting.
    const supuestas = new Set();
    const seLibera = (m) => !m.puede && !m.otros && (m.reqs.length > 0 || m.propia) && m.reqs.every((r) => supuestas.has(r.clave)) && (!m.propia || supuestas.has(m.clave));
    const conY = (nombres) => {
      if (nombres.length < 2) return nombres.join('');
      const ultimo = nombres.at(-1);
      return `${nombres.slice(0, -1).join(', ')} ${/^h?i(?![aeiouáéíóú])/i.test(ultimo) ? 'e' : 'y'} ${ultimo}`;
    };
    const nombreDe = (clave) => frenos.get(clave)?.texto ?? materias.find((m) => m.clave === clave)?.nombre ?? clave;
    const resultado = h('p', { clase: 'sl-simulacion', 'aria-live': 'polite' });
    const botonesFreno = [];
    const alternar = (clave) => {
      if (supuestas.has(clave)) supuestas.delete(clave);
      else supuestas.add(clave);
      actualizar();
    };
    const reiniciar = h('button', {
      clase: 'sl-reiniciar sl-filtrada',
      type: 'button',
      texto: 'Empezar de nuevo',
      onclick: soloClicReal(() => {
        supuestas.clear();
        if (document.activeElement === reiniciar) (botonesFreno.find((b) => b.boton.offsetParent)?.boton ?? materias[0].nodo).focus();
        actualizar();
      }),
    });

    const SVG = 'http://www.w3.org/2000/svg';
    const lineas = document.createElementNS(SVG, 'svg');
    lineas.setAttribute('class', 'sl-mapa-lineas');
    lineas.setAttribute('aria-hidden', 'true');
    const aristas = [];
    let lienzo = null;

    // Pointing at a subject lights up everything behind it, and what it holds back.
    const soltarCadena = () => {
      lienzo.classList.remove('sl-enfocado');
      for (const m of materias) m.nodo.classList.remove('sl-en-cadena');
      for (const { camino } of aristas) camino.classList.remove('sl-en-cadena');
    };
    const marcarCadena = (m) => {
      const detras = new Set([m]);
      const pendientes = [m];
      while (pendientes.length) {
        for (const r of pendientes.pop().reqs) {
          if (r.materia && !detras.has(r.materia)) {
            detras.add(r.materia);
            pendientes.push(r.materia);
          }
        }
      }
      const adelante = new Set(materias.filter((o) => o.reqs.some((r) => r.clave === m.clave)));
      lienzo.classList.add('sl-enfocado');
      for (const o of materias) o.nodo.classList.toggle('sl-en-cadena', detras.has(o) || adelante.has(o));
      for (const { desde, hasta, camino } of aristas) {
        camino.classList.toggle('sl-en-cadena', (detras.has(desde) && detras.has(hasta)) || (desde === m && adelante.has(hasta)));
      }
    };

    for (const m of materias) {
      m.nodo = h('button', {
        clase: `sl-nodo ${m.puede ? 'sl-n-puede' : 'sl-n-falta'}`,
        type: 'button',
        'aria-pressed': 'false',
        onclick: soloClicReal(() => alternar(m.clave)),
        onpointerenter: () => marcarCadena(m),
        onfocus: () => {
          if (m.nodo.matches(':focus-visible')) marcarCadena(m);
        },
        onblur: soltarCadena,
      }, m.nombre, h('span', { clase: 'sl-solo-lector', texto: m.puede ? `, podés ${verbo}` : ', te falta algo' }));
    }
    const unidas = new Set();
    for (const m of materias) {
      for (const r of m.reqs) {
        const par = `${materias.indexOf(r.materia)}>${materias.indexOf(m)}`;
        if (!r.materia || r.materia === m || unidas.has(par)) continue;
        unidas.add(par);
        const camino = document.createElementNS(SVG, 'path');
        lineas.append(camino);
        aristas.push({ desde: r.materia, hasta: m, camino });
      }
    }

    lienzo = h('div', { clase: 'sl-mapa-lienzo', style: `--sl-columnas: ${anios.length}`, onpointerleave: soltarCadena },
      lineas,
      ...anios.map((anio) => h('div', { clase: 'sl-mapa-col' },
        h('h3', { texto: nombreAnio(anio) }),
        ...materias.filter((m) => m.anio === anio).map((m) => m.nodo),
      )),
    );

    // Lines run from the right edge of what is missing to the left edge of what it holds
    // back. They are redrawn whenever the map changes size, with no timer involved.
    const dibujar = () => {
      const ancho = lienzo.offsetWidth;
      if (!ancho) return;
      lineas.setAttribute('viewBox', `0 0 ${ancho} ${lienzo.offsetHeight}`);
      for (const { desde, hasta, camino } of aristas) {
        const a = desde.nodo;
        const b = hasta.nodo;
        const x1 = a.offsetLeft + a.offsetWidth;
        const y1 = a.offsetTop + a.offsetHeight / 2;
        const y2 = b.offsetTop + b.offsetHeight / 2;
        if (b.offsetLeft > x1) {
          const x2 = b.offsetLeft;
          const dx = Math.max(16, (x2 - x1) / 2);
          camino.setAttribute('d', `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`);
        } else {
          const x2 = b.offsetLeft + b.offsetWidth;
          const curva = Math.max(x1, x2) + 24;
          camino.setAttribute('d', `M${x1} ${y1}C${curva} ${y1} ${curva} ${y2} ${x2} ${y2}`);
        }
      }
    };
    new ResizeObserver(dibujar).observe(lienzo);
    document.fonts?.ready.then(dibujar);

    const mapa = h('section', { clase: 'sl-mapa sl-filtrada', 'aria-labelledby': 'sl-mapa-titulo' },
      h('h2', { id: 'sl-mapa-titulo', texto: 'Mapa de correlativas' }),
      h('p', { clase: 'sl-mapa-ayuda', texto: 'Cada línea va de lo que te falta a lo que traba. Tocá una materia para suponer que la sacás.' }),
      h('ul', { clase: 'sl-mapa-leyenda', 'aria-hidden': 'true' },
        h('li', { clase: 'sl-l-puede', texto: `Podés ${verbo}` }),
        h('li', { clase: 'sl-l-falta', texto: 'Te falta algo' }),
        h('li', { clase: 'sl-l-supuesta', texto: 'La suponés sacada' }),
        h('li', { clase: 'sl-l-libera', texto: 'Se libera' }),
      ),
      frenos.size ? null : h('div', { clase: 'sl-simulador sl-mapa-simulador' }, resultado, reiniciar),
      h('p', { clase: 'sl-mapa-deslizar', 'aria-hidden': 'true', texto: 'Deslizá de costado para ver todos los años.' }),
      h('div', { clase: 'sl-mapa-marco' }, lienzo),
    );

    const actualizar = () => {
      const liberadas = materias.filter(seLibera);
      for (const m of materias) {
        m.nodo.setAttribute('aria-pressed', String(supuestas.has(m.clave)));
        m.nodo.classList.toggle('sl-n-libera', liberadas.includes(m));
        m.li.classList.toggle('sl-libera', liberadas.includes(m));
      }
      for (const { clave, boton } of botonesFreno) boton.setAttribute('aria-pressed', String(supuestas.has(clave)));
      for (const { desde, camino } of aristas) camino.classList.toggle('sl-cumplida', supuestas.has(desde.clave));
      reiniciar.classList.toggle('sl-filtrada', !supuestas.size);
      if (!supuestas.size) {
        resultado.textContent = 'Tocá una para ver qué se te libera si la sacás.';
        return;
      }
      const sacadas = conY([...supuestas].map(nombreDe));
      resultado.textContent = liberadas.length
        ? `Si sacás ${sacadas}, ya podés ${verbo} ${conY(liberadas.map((m) => m.nombre))}.`
        : `Si sacás ${sacadas}, todavía no se te libera ninguna.`;
    };

    // Cursado por etapas, only to enroll: stage 1 is what the student can take now, and each next stage what frees up
    // once the previous one is regular. A requirement outside the page (a final still to pass) or the elective hours
    // count as one stage. The longest chain among the career's own subjects is the least that is left.
    let etapas = null;
    let resumenEtapas = null;
    let seccionesEtapa = [];
    if (verbo === 'cursar') {
      const etapaDe = new Map();
      const calcular = (m, camino) => {
        if (etapaDe.has(m)) return etapaDe.get(m);
        if (m.puede) {
          etapaDe.set(m, 1);
          return 1;
        }
        // A loop in the requirements would never end: it counts as one more stage.
        if (camino.has(m)) return 2;
        camino.add(m);
        const previas = m.reqs.filter((r) => r.materia && r.materia !== m).map((r) => calcular(r.materia, camino));
        camino.delete(m);
        etapaDe.set(m, 1 + Math.max(1, ...previas));
        return etapaDe.get(m);
      };
      for (const m of materias) m.etapa = calcular(m, new Set());

      const obligatorias = materias.filter((m) => !m.electiva);
      const cuantas = Math.max(0, ...obligatorias.map((m) => m.etapa));
      const cadena = [];
      for (let paso = obligatorias.find((m) => m.etapa === cuantas); paso;) {
        cadena.unshift(paso);
        const actual = paso;
        paso = actual.reqs.map((r) => r.materia).find((o) => o && o !== actual && o.etapa === actual.etapa - 1);
      }

      const numeros = [...new Set(materias.map((m) => m.etapa))].sort((a, b) => a - b);
      seccionesEtapa = numeros.map((n) => {
        const propias = materias.filter((m) => m.etapa === n).sort((a, b) => a.electiva - b.electiva || Number(a.anio) - Number(b.anio));
        for (const m of propias) {
          m.filaEtapa = h('tr', { clase: `sl-etapa-fila ${m.puede ? 'sl-e-aprobada' : 'sl-e-otro'}` },
            h('td', { clase: 'sl-materia-nombre', texto: m.nombre }),
            h('td', { clase: 'sl-dato sl-col-anio', texto: nombreAnio(m.anio) }),
            h('td', { clase: 'sl-estado-texto sl-col-falta', texto: m.puede
              ? (frenos.get(m.clave) ? `Frena ${cantidad(frenos.get(m.clave).cuenta, 'materia', 'materias')}` : '')
              : m.faltan.join(SEPARADOR) || 'Sin datos' }),
          );
        }
        const seccion = h('section', { clase: 'sl-anio' },
          h('div', { clase: 'sl-anio-cabeza' },
            h('h2', { texto: n === 1 ? 'Ya podés cursar' : `Etapa ${n}` }),
            h('span', { texto: cantidad(propias.length, 'materia', 'materias') }),
          ),
          h('table', { clase: 'sl-analitico' },
            h('thead', {}, h('tr', {},
              h('th', { scope: 'col', texto: 'Materia' }),
              h('th', { scope: 'col', clase: 'sl-col-anio', texto: 'Año' }),
              h('th', { scope: 'col', clase: 'sl-col-falta', texto: n === 1 ? 'Qué destraba' : 'Qué te falta' }),
            )),
            h('tbody', {}, ...propias.map((m) => m.filaEtapa)),
          ),
        );
        return { seccion, propias };
      });
      etapas = h('section', { clase: 'sl-etapas sl-filtrada', 'aria-labelledby': 'sl-etapas-titulo' },
        h('h2', { id: 'sl-etapas-titulo', texto: 'Cursado por etapas' }),
        h('p', { clase: 'sl-mapa-ayuda', texto: 'Cada etapa es lo que se libera al regularizar la anterior. Dura un cuatrimestre o un año, según la materia.' }),
        ...seccionesEtapa.map((e) => e.seccion),
      );
      if (cuantas) {
        resumenEtapas = h('div', { clase: 'sl-tarjeta-electivas sl-tarjeta-etapas' },
          h('p', { clase: 'sl-tarjeta-titulo', texto: 'Lo que te queda' }),
          h('p', { clase: 'sl-electivas', texto: cuantas === 1
            ? 'Podés cursar ya todo lo que te falta de la carrera.'
            : `Al menos ${cuantas} etapas de cursado. La cadena más larga: ${cadena.map((m) => m.nombre).join(' → ')}.` }),
        );
      }
    }

    const filtro = { vista: null, anio: null, puede: null, tipo: null, texto: '' };
    const sinResultados = h('p', { clase: 'sl-sin-resultados sl-filtrada', texto: 'Ninguna materia coincide. Probá con otro filtro.' });
    const anuncio = h('p', { clase: 'sl-anuncio', role: 'status' });
    const lista = h('div', { clase: 'sl-lista' }, ...secciones.map((s) => s.seccion));
    for (const m of materias) m.li.slNodo = m.nodo;
    const aplicar = () => {
      lista.classList.toggle('sl-filtrada', filtro.vista !== null);
      mapa.classList.toggle('sl-filtrada', filtro.vista !== 'mapa');
      etapas?.classList.toggle('sl-filtrada', filtro.vista !== 'etapas');
      let visibles = 0;
      for (const { anio, seccion, items } of secciones) {
        let enSeccion = 0;
        for (const { m, li } of items) {
          const ok =
            (filtro.anio === null || filtro.anio === anio) &&
            (filtro.puede === null || filtro.puede === m.puede) &&
            (filtro.tipo === null || filtro.tipo === m.electiva) &&
            (!filtro.texto || normalizar(m.nombre).includes(filtro.texto));
          li.classList.toggle('sl-filtrada', !ok);
          m.filaEtapa?.classList.toggle('sl-filtrada', !ok);
          m.nodo.classList.toggle('sl-atenuada', !ok);
          if (ok) enSeccion += 1;
        }
        seccion.classList.toggle('sl-filtrada', !enSeccion);
        visibles += enSeccion;
      }
      for (const { seccion, propias } of seccionesEtapa) seccion.classList.toggle('sl-filtrada', propias.every((m) => m.filaEtapa.classList.contains('sl-filtrada')));
      sinResultados.classList.toggle('sl-filtrada', visibles > 0);
      anuncio.textContent = visibles ? cantidad(visibles, 'materia', 'materias') : 'Sin resultados';
    };

    const filtros = barraDeFiltros(filtro, aplicar, 'Buscar materia', [
      { etiqueta: 'Cambiar vista', visible: 'Ver', clave: 'vista', opciones: [{ valor: null, texto: 'Lista' }, { valor: 'mapa', texto: 'Mapa' }, ...(etapas ? [{ valor: 'etapas', texto: 'Etapas' }] : [])] },
      { etiqueta: 'Filtrar por año', visible: 'Año', clave: 'anio', opciones: [{ valor: null, texto: 'Todos' }, ...anios.map((a) => ({ valor: a, texto: nombreAnio(a) }))] },
      { etiqueta: 'Filtrar por situación', visible: 'Situación', clave: 'puede', opciones: [
        { valor: null, texto: 'Todas' },
        { valor: true, texto: `Podés ${verbo}`, cuenta: pueden(materias) },
        { valor: false, texto: 'Te falta algo', cuenta: materias.length - pueden(materias) },
      ] },
      { etiqueta: 'Filtrar por tipo', visible: 'Tipo', clave: 'tipo', opciones: [
        { valor: null, texto: 'Todas' },
        { valor: false, texto: 'Obligatorias', cuenta: materias.filter((m) => !m.electiva).length },
        { valor: true, texto: 'Electivas', cuenta: materias.filter((m) => m.electiva).length },
      ] },
    ]);

    // Each subject counts the ones it holds back directly or, along the chain, also what those hold back in turn.
    const enCadenaDe = (clave) => {
      const trabadas = new Set();
      const pendientes = [clave];
      while (pendientes.length) {
        const actual = pendientes.pop();
        for (const m of materias) {
          if (m.clave === clave || trabadas.has(m) || !m.reqs.some((r) => r.clave === actual)) continue;
          trabadas.add(m);
          pendientes.push(m.clave);
        }
      }
      return trabadas.size;
    };
    const ordenFrenos = [...frenos.values()].sort((a, b) => b.cuenta - a.cuenta);
    const ordenCadena = ordenFrenos.map((f) => ({ ...f, cuenta: Math.max(f.cuenta, enCadenaDe(f.clave)) })).sort((a, b) => b.cuenta - a.cuenta);
    const itemFreno = ({ clave, texto, cuenta }) => {
      const boton = h('button', { clase: 'sl-freno', type: 'button', 'aria-pressed': 'false', onclick: soloClicReal(() => alternar(clave)) },
        h('span', { texto }),
        h('small', { texto: `frena ${cantidad(cuenta, 'materia', 'materias')}` }),
      );
      botonesFreno.push({ clave, boton });
      return h('li', {}, boton);
    };
    const listaFrenos = (orden, ayuda) => h('div', { clase: 'sl-frenos-vista' },
      ayuda ? h('p', { clase: 'sl-frenos-ayuda', texto: ayuda }) : null,
      h('ul', { clase: 'sl-frenos' }, ...orden.slice(0, 3).map(itemFreno)),
      orden.length > 3 ? h('details', { clase: 'sl-faltan-mas' },
        h('summary', { texto: `Ver ${orden.length - 3} más` }),
        h('ul', { clase: 'sl-frenos' }, ...orden.slice(3).map(itemFreno)),
      ) : null,
    );
    const vistasFreno = [
      listaFrenos(ordenFrenos, 'Las materias que dependen directo de cada una.'),
      listaFrenos(ordenCadena, 'Suma también lo que frenan, a su vez, esas materias.'),
    ];
    vistasFreno[1].classList.add('sl-filtrada');
    const botonesModo = ['Directas', 'En cadena'].map((texto, i) => h('button', {
      clase: 'sl-chip',
      type: 'button',
      'aria-pressed': String(i === 0),
      texto,
      onclick: soloClicReal(() => {
        botonesModo.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
        vistasFreno.forEach((v, j) => v.classList.toggle('sl-filtrada', i !== j));
      }),
    }));
    const modosFreno = h('div', { clase: 'sl-chips sl-frenos-modo', role: 'group', 'aria-label': 'Cómo contar lo que frena' },
      h('span', { clase: 'sl-chips-titulo', 'aria-hidden': 'true', texto: 'Contar' }),
      ...botonesModo,
    );

    const tablero = h('section', { clase: 'sl-tablero', 'aria-label': 'Resumen' },
      h('div', { clase: 'sl-promedio' },
        h('strong', { texto: String(pueden(materias)) }),
        h('span', { texto: `de ${materias.length} podés ${verbo}` }),
      ),
      resumenEtapas,
      ordenFrenos.length ? h('div', { clase: 'sl-avance sl-simulador' },
        h('p', { clase: 'sl-avance-titulo', texto: 'Lo que más te frena' }),
        modosFreno,
        ...vistasFreno,
        resultado,
        reiniciar,
      ) : null,
      horas ? h('div', { clase: 'sl-tarjeta-electivas' },
        h('p', { clase: 'sl-tarjeta-titulo', texto: 'Electivas' }),
        h('p', { clase: 'sl-electivas', texto: `Te faltan ${horas.faltan} de ${horas.total} hs para recibirte.` }),
        h('div', { clase: 'sl-barra', role: 'img', 'aria-label': `${horas.total - horas.faltan} de ${horas.total} horas de electivas` },
          h('i', { clase: 'sl-b-aprobada', style: anchoBarra(horas.total - horas.faltan, horas.total) })),
      ) : null,
    );

    const vista = h('div', { clase: 'sl-estado' },
      h('div', { clase: 'sl-estado-lado' }, tablero, filtros),
      h('div', { clase: 'sl-estado-cuerpo' }, mapa, etapas, lista, sinResultados, anuncio),
    );
    actualizar();
    let exterior = tabla;
    while (exterior.parentElement?.closest('table')) exterior = exterior.parentElement.closest('table');
    exterior.before(vista);
    tabla.classList.add('sl-reemplazada');
  }

  // "12/03/2024" sorts by date, "8" by number, anything else alphabetically.
  const NOTAS_EN_LETRAS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

  function valorOrden(texto) {
    const t = texto.trim();
    const enLetras = NOTAS_EN_LETRAS.indexOf(t.toLowerCase());
    if (enLetras !== -1) return enLetras;
    // An absence sits below every grade.
    if (/^ausen/i.test(t)) return -1;
    const fecha = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fecha) return Number(fecha[3]) * 10000 + Number(fecha[2]) * 100 + Number(fecha[1]);
    const numero = Number(t.replace(',', '.'));
    return t && Number.isFinite(numero) ? numero : t;
  }

  function comparar(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'number' || typeof b === 'number') return typeof a === 'number' ? -1 : 1;
    return String(a).localeCompare(String(b), 'es');
  }

  // Exámenes lists every final with its date, fails and absences included. Above the table goes what it tells: the
  // average over time, each year and exam period, how the grades spread and what took more than one try. The table
  // stays as it is, with its search and sorting.
  // A final passes with 6 since Ordinance 1549 of UTN, applied from 2017; before, with 4.
  const apruebaCon = (fecha) => (fecha.getFullYear() >= 2017 ? 6 : 4);
  const TURNOS = [['Febrero y marzo', [2, 3]], ['Julio y agosto', [7, 8]], ['Noviembre y diciembre', [11, 12]]];
  const turnoDe = (fecha) => TURNOS.find(([, meses]) => meses.includes(fecha.getMonth() + 1))?.[0] ?? 'Otras mesas';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const trazo = (etiqueta, atributos = {}, ...hijos) => {
    const el = document.createElementNS(SVG_NS, etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) el.setAttribute(clave, valor);
    el.append(...hijos);
    return el;
  };

  function mejorarExamenes() {
    if (pagina !== '/examenes.asp') return;
    const tabla = [...document.querySelectorAll('table.sl-datos')].find((t) => {
      const cabecera = t.querySelector('tr.sl-cabecera');
      const titulos = cabecera ? [...cabecera.cells].map((c) => normalizar(c.textContent)) : [];
      return ['fecha', 'materia', 'nota'].every((n) => titulos.includes(n)) && !t.querySelector('input, select, textarea');
    });
    if (!tabla) return;
    const cabecera = tabla.querySelector('tr.sl-cabecera');
    const titulos = [...cabecera.cells].map((c) => normalizar(c.textContent));
    const examenes = filasDe(tabla)
      .filter((f) => f !== cabecera && f.cells.length === cabecera.cells.length)
      .map((f) => {
        const celda = (n) => (titulos.includes(n) ? f.cells[titulos.indexOf(n)].textContent.trim() : '');
        const partes = celda('fecha').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!partes || !celda('materia')) return null;
        const fecha = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
        const crudo = celda('nota');
        const enLetras = NOTAS_EN_LETRAS.indexOf(normalizar(crudo));
        const numero = enLetras !== -1 ? enLetras : /^\d{1,2}([.,]\d+)?$/.test(crudo) ? Number(crudo.replace(',', '.')) : null;
        const nota = numero !== null && numero <= 10 ? numero : null;
        return {
          fila: f,
          fecha,
          crudo,
          nota,
          materia: nombreEntero(celda('materia')),
          clave: celda('codigo') ? `${celda('plan')} ${celda('codigo')}` : normalizar(celda('materia')),
          plan: celda('plan'),
          codigo: celda('codigo'),
          ausente: /^ausen/i.test(crudo),
          aprobado: nota !== null && nota >= apruebaCon(fecha),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.fecha - b.fecha);
    // Sysacad writes the grades in words ("ocho") and cuts absences ("Ausen."): the table shows numbers instead. The
    // copy for Super CVG was taken before, from the original.
    const columnaNota = titulos.indexOf('nota');
    for (const e of examenes) {
      const celda = e.fila.cells[columnaNota];
      if (e.nota !== null) celda.textContent = String(e.nota).replace('.', ',');
      else if (/^ausen/i.test(e.crudo)) celda.textContent = 'Ausente';
    }
    if (examenes.length < 2) return;

    const conNota = examenes.filter((e) => e.nota !== null);
    const aprobados = conNota.filter((e) => e.aprobado);
    const esAplazo = (e) => e.nota !== null && !e.aprobado;
    const aplazos = conNota.filter(esAplazo);
    const ausentes = examenes.filter((e) => e.ausente);
    const promedio = (lista) => (lista.length ? lista.reduce((s, e) => s + e.nota, 0) / lista.length : null);
    const conComa = (n) => String(n).replace('.', ',');
    const resultado = (e) => (e.ausente ? 'Ausente' : e.nota === null ? e.crudo : e.aprobado ? 'Aprobado' : 'Aplazo');
    const textoNota = (e) => (e.nota !== null ? conComa(e.nota) : e.ausente ? 'ausente' : e.crudo.toLowerCase());

    const tablero = h('section', { clase: 'sl-tablero', 'aria-label': 'Resumen' },
      aprobados.length ? h('div', { clase: 'sl-promedio' },
        h('strong', { texto: decimal(promedio(aprobados)) }),
        h('span', { texto: 'Promedio sin aplazos' }),
      ) : null,
      aplazos.length ? h('div', { clase: 'sl-promedio sl-promedio-suave' },
        h('strong', { texto: decimal(promedio(conNota)) }),
        h('span', { texto: 'Con aplazos' }),
      ) : null,
      h('div', { clase: 'sl-avance' },
        h('p', { clase: 'sl-avance-titulo', texto: `${aprobados.length} de ${cantidad(examenes.length, 'examen', 'exámenes')} aprobados` }),
        h('div', { clase: 'sl-barra', role: 'img', 'aria-label': `${aprobados.length} aprobados, ${aplazos.length} aplazos y ${ausentes.length} ausentes` },
          h('i', { clase: 'sl-b-aprobada', style: anchoBarra(aprobados.length, examenes.length) }),
          h('i', { clase: 'sl-b-regular', style: anchoBarra(aplazos.length, examenes.length) }),
        ),
        h('p', { clase: 'sl-leyenda' },
          h('span', {}, h('b', { texto: String(aplazos.length) }), aplazos.length === 1 ? ' aplazo' : ' aplazos'),
          h('span', {}, h('b', { texto: String(ausentes.length) }), ausentes.length === 1 ? ' ausente' : ' ausentes'),
        ),
      ),
    );

    const tarjeta = (titulo, bajada, ...cuerpo) => h('section', { clase: 'sl-anio' },
      h('div', { clase: 'sl-anio-cabeza' }, h('h2', { texto: titulo }), bajada ? h('span', { texto: bajada }) : null),
      ...cuerpo,
    );
    const tablaDe = (columnas, filas) => h('table', { clase: 'sl-analitico sl-numeros' },
      h('thead', {}, h('tr', {}, ...columnas.map((c) => h('th', { scope: 'col', texto: c })))),
      h('tbody', {}, ...filas),
    );
    const fila = (celdas, clase = null) => h('tr', { clase }, ...celdas.map((c, i) => h(i ? 'td' : 'th', i ? {} : { scope: 'row' }, String(c ?? ''))));

    // The average over time: each passed final is a dot, and the line is the average up to it.
    let grafico = null;
    if (aprobados.length >= 2) {
      let suma = 0;
      const puntos = aprobados.map((e, i) => {
        suma += e.nota;
        return { e, acumulado: suma / (i + 1) };
      });
      const svg = trazo('svg', { class: 'sl-grafico-lienzo', role: 'img', 'aria-label': `Tu promedio pasó de ${decimal(puntos[0].acumulado)} a ${decimal(puntos.at(-1).acumulado)} en ${cantidad(puntos.length, 'final aprobado', 'finales aprobados')}` });
      const marco = h('div', { clase: 'sl-grafico-marco' }, svg);
      const ALTO = 220;
      const margen = { izq: 30, der: 44, arr: 12, aba: 26 };
      const minimo = Math.min(4, Math.floor(Math.min(...aprobados.map((e) => e.nota))));
      const dibujar = () => {
        const ancho = marco.clientWidth;
        if (!ancho) return;
        svg.setAttribute('viewBox', `0 0 ${ancho} ${ALTO}`);
        svg.setAttribute('width', String(ancho));
        svg.setAttribute('height', String(ALTO));
        svg.replaceChildren();
        const t0 = puntos[0].e.fecha.getTime();
        const t1 = Math.max(puntos.at(-1).e.fecha.getTime(), t0 + 86400000);
        const x = (t) => margen.izq + ((t - t0) / (t1 - t0)) * (ancho - margen.izq - margen.der);
        const y = (v) => margen.arr + ((10 - v) / (10 - minimo)) * (ALTO - margen.arr - margen.aba);
        for (let v = 10; v >= minimo; v -= 2) {
          svg.append(
            trazo('line', { class: 'sl-g-grilla', x1: margen.izq, x2: ancho - margen.der, y1: y(v), y2: y(v) }),
            trazo('text', { class: 'sl-g-eje', x: margen.izq - 8, y: y(v) + 4, 'text-anchor': 'end' }, String(v)),
          );
        }
        const primero = puntos[0].e.fecha.getFullYear();
        const ultimo = puntos.at(-1).e.fecha.getFullYear();
        for (let anio = primero; anio <= ultimo; anio += 1) {
          const t = anio === primero ? t0 : new Date(anio, 0, 1).getTime();
          svg.append(trazo('text', { class: 'sl-g-eje', x: x(t), y: ALTO - 6, 'text-anchor': anio === primero ? 'start' : 'middle' }, String(anio)));
        }
        for (const { e } of puntos) {
          svg.append(trazo('circle', { class: 'sl-g-nota', cx: x(e.fecha.getTime()), cy: y(e.nota), r: 4 },
            trazo('title', {}, `${e.fecha.toLocaleDateString('es-AR')}: ${e.materia}, ${conComa(e.nota)}`)));
        }
        const camino = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p.e.fecha.getTime()).toFixed(1)} ${y(p.acumulado).toFixed(1)}`).join('');
        const fin = puntos.at(-1);
        svg.append(
          trazo('path', { class: 'sl-g-linea', d: camino }),
          trazo('circle', { class: 'sl-g-fin', cx: x(fin.e.fecha.getTime()), cy: y(fin.acumulado), r: 4.5 }),
          trazo('text', { class: 'sl-g-valor', x: x(fin.e.fecha.getTime()) + 8, y: y(fin.acumulado) + 4 }, decimal(fin.acumulado)),
        );
      };
      new ResizeObserver(dibujar).observe(marco);
      grafico = tarjeta('Tu promedio en el tiempo', null,
        h('ul', { clase: 'sl-g-leyenda', 'aria-hidden': 'true' },
          h('li', { clase: 'sl-g-l-linea', texto: 'Promedio hasta ese final' }),
          h('li', { clase: 'sl-g-l-nota', texto: 'Nota de cada final aprobado' }),
        ),
        marco,
        h('p', { clase: 'sl-mapa-ayuda', texto: 'Cada final, con su fecha y su nota, está en la tabla de abajo.' }),
      );
      grafico.classList.add('sl-grafico');
    }

    // Each year and each exam period, with the best year when there are at least two to compare.
    const resumen = (lista) => {
      const apr = lista.filter((e) => e.aprobado);
      return { total: lista.length, apr: apr.length, aplazos: lista.filter(esAplazo).length, ausentes: lista.filter((e) => e.ausente).length, promedio: promedio(apr) };
    };
    const anios = [...new Set(examenes.map((e) => e.fecha.getFullYear()))].map((anio) => ({ anio, ...resumen(examenes.filter((e) => e.fecha.getFullYear() === anio)) }));
    const comparables = anios.filter((a) => a.apr >= 2);
    const mejor = comparables.length >= 2 ? comparables.reduce((m, a) => (a.promedio > m.promedio ? a : m)) : null;
    const porAnio = tarjeta('Año por año', mejor ? `Tu mejor año: ${mejor.anio}, con ${decimal(mejor.promedio)}` : null,
      tablaDe(['Año', 'Exámenes', 'Aprobados', 'Aplazos', 'Ausentes', 'Promedio'],
        anios.map((a) => fila([a.anio, a.total, a.apr, a.aplazos, a.ausentes, a.promedio === null ? '' : decimal(a.promedio)], a === mejor ? 'sl-mejor' : null))),
    );

    const turnos = [...TURNOS.map(([nombre]) => nombre), 'Otras mesas']
      .map((nombre) => ({ nombre, ...resumen(examenes.filter((e) => turnoDe(e.fecha) === nombre)) }))
      .filter((t) => t.total);
    const medibles = turnos.filter((t) => t.total >= 3);
    const mejorTurno = medibles.length >= 2 ? medibles.reduce((m, t) => (t.apr / t.total > m.apr / m.total ? t : m)) : null;
    const porTurno = tarjeta('Por turno', mejorTurno ? `Donde más aprobás: ${mejorTurno.nombre.toLowerCase()}` : null,
      tablaDe(['Turno', 'Exámenes', 'Aprobados', 'Ausentes', 'Promedio'],
        turnos.map((t) => fila([t.nombre, t.total, t.apr, t.ausentes, t.promedio === null ? '' : decimal(t.promedio)], t === mejorTurno ? 'sl-mejor' : null))),
    );

    // How the grades spread, from the lowest one to 10.
    let reparto = null;
    if (conNota.length) {
      const enteras = conNota.map((e) => Math.round(e.nota));
      const soloAplazos = (nota) => conNota.filter((e) => Math.round(e.nota) === nota).every(esAplazo);
      const desde = Math.min(...enteras);
      const cuentas = Array.from({ length: 11 - desde }, (_, i) => 10 - i).map((nota) => ({ nota, cuenta: enteras.filter((n) => n === nota).length }));
      const tope = Math.max(...cuentas.map((c) => c.cuenta));
      reparto = tarjeta('Tus notas', `${cantidad(conNota.length, 'final con nota', 'finales con nota')}`,
        h('ul', { clase: 'sl-reparto' }, ...cuentas.map(({ nota, cuenta }) => h('li', { clase: cuenta && soloAplazos(nota) ? 'sl-reparto-aplazo' : null },
          h('span', { clase: 'sl-reparto-nota', texto: String(nota) }),
          h('span', { clase: 'sl-reparto-barra', 'aria-hidden': 'true' }, h('i', { style: anchoBarra(cuenta, tope) })),
          h('span', { clase: 'sl-reparto-cuenta', texto: cuenta === 1 ? '1 vez' : `${cuenta} veces` }),
        ))),
      );
    }

    // The subjects that took more than one try, with each try in order.
    const porMateria = new Map();
    for (const e of examenes) porMateria.set(e.clave, [...(porMateria.get(e.clave) ?? []), e]);
    const repetidas = [...porMateria.values()].filter((l) => l.length > 1).sort((a, b) => b.length - a.length || a[0].fecha - b[0].fecha);
    const itemIntento = (lista) => h('li', {},
      h('strong', { texto: lista.at(-1).materia }),
      h('span', { texto: `${lista.length} veces: ${lista.map(textoNota).join(', ')}` }),
    );
    const intentos = repetidas.length ? tarjeta('Las que más vueltas te dieron', null,
      h('ul', { clase: 'sl-intentos' }, ...repetidas.slice(0, 5).map(itemIntento)),
      repetidas.length > 5 ? h('details', { clase: 'sl-faltan-mas' },
        h('summary', { texto: `Ver ${repetidas.length - 5} más` }),
        h('ul', { clase: 'sl-intentos' }, ...repetidas.slice(5).map(itemIntento)),
      ) : null,
    ) : null;

    const descarga = enlaceCsv('examenes', [
      ['Fecha', 'Materia', 'Nota', 'Resultado', 'Plan', 'Código'],
      ...examenes.map((e) => [`${dos(e.fecha.getDate())}/${dos(e.fecha.getMonth() + 1)}/${e.fecha.getFullYear()}`, e.materia, e.nota ?? '', resultado(e), e.plan, e.codigo]),
    ], 'Descargar en Excel');

    const vista = h('div', { clase: 'sl-historial' },
      tablero,
      h('div', { clase: 'sl-historial-cuerpo' }, grafico, porAnio, porTurno, reparto, intentos),
      h('div', { clase: 'sl-historial-pie' }, h('h2', { texto: 'Todos tus exámenes' })),
    );
    tablaExterior(tabla).before(vista);
    tablaExterior(tabla).after(h('div', { clase: 'sl-descarga-pie' }, descarga));
  }

  // Any other long table gets search, filters for its repetitive columns and sortable
  // headers. Rows stay in place and a row with a checked control is never filtered
  // out, so forms keep sending exactly what the student sees.
  function mejorarTablas() {
    for (const tabla of document.querySelectorAll('table.sl-datos:not(.sl-reemplazada)')) {
      const cabecera = tabla.querySelector('tr.sl-cabecera');
      if (!cabecera) continue;
      const cuerpo = filasDe(tabla).filter((f) => f !== cabecera && f.cells.length === cabecera.cells.length && !f.querySelector('.tituloTabla'));
      if (cuerpo.length < 6) continue;

      const texto = (fila, i) => fila.cells[i].textContent.trim();
      const titulos = [...cabecera.cells].map((c) => c.textContent.trim());
      const candidatas = titulos
        .map((titulo, i) => ({ titulo, i, valores: [...new Set(cuerpo.map((f) => texto(f, i)).filter(Boolean))] }))
        .filter((c) => !/^(notas?|obs|inasistencias|horarios?|fecha|codigo|aula)$/.test(normalizar(c.titulo).replace(/\.$/, '')))
        .filter((c) => c.titulo && c.valores.length >= 2 && c.valores.length <= 8 && c.valores.length < cuerpo.length && c.valores.every((v) => v.length <= 28))
        .sort((a, b) => a.valores.length - b.valores.length)
        .slice(0, 2);

      const filtro = { texto: '', columnas: new Map() };
      const sinResultados = h('p', { clase: 'sl-sin-resultados sl-filtrada', texto: 'Ninguna fila coincide. Probá con otro filtro.' });
      const anuncio = h('p', { clase: 'sl-anuncio', role: 'status' });
      const aplicar = () => {
        let visibles = 0;
        for (const fila of cuerpo) {
          const ok =
            (!filtro.texto || normalizar(fila.textContent).includes(filtro.texto)) &&
            [...filtro.columnas].every(([i, valor]) => texto(fila, i) === valor);
          const mostrar = ok || conEleccion(fila);
          fila.classList.toggle('sl-filtrada', !mostrar);
          if (mostrar) visibles += 1;
        }
        sinResultados.classList.toggle('sl-filtrada', visibles > 0);
        anuncio.textContent = visibles ? cantidad(visibles, 'fila', 'filas') : 'Sin resultados';
      };

      const chips = candidatas.map(({ titulo, i, valores }) => {
        const botones = [null, ...[...valores].sort((a, b) => comparar(valorOrden(a), valorOrden(b)))].map((valor) => {
          const boton = h('button', {
            clase: 'sl-chip',
            type: 'button',
            'aria-pressed': String(valor === null),
            texto: valor ?? `${titulo}: todos`,
            onclick: soloClicReal(() => {
              if (valor === null) filtro.columnas.delete(i);
              else filtro.columnas.set(i, valor);
              for (const b of botones) b.setAttribute('aria-pressed', String(b === boton));
              aplicar();
            }),
          });
          return boton;
        });
        return h('div', { clase: 'sl-chips', role: 'group', 'aria-label': `Filtrar por ${titulo}` }, ...botones);
      });

      const barraFiltros = h('div', { clase: 'sl-filtros' },
        h('input', {
          clase: 'sl-buscar',
          type: 'search',
          placeholder: 'Buscar en esta tabla',
          'aria-label': 'Buscar en esta tabla',
          autocomplete: 'off',
          onkeydown: (e) => {
            if (e.key === 'Enter') e.preventDefault();
          },
          oninput: soloClicReal((e) => {
            filtro.texto = normalizar(e.target.value);
            aplicar();
          }),
        }),
        ...chips,
      );

      tabla.before(barraFiltros);
      tabla.after(sinResultados, anuncio);

      const padre = cuerpo[0].parentElement;
      const conFormulario = tabla.querySelector('input, select, textarea, form');
      if (conFormulario || cuerpo.some((f) => f.parentElement !== padre)) continue;

      const lugares = cuerpo.map((fila) => {
        const lugar = document.createComment('');
        fila.before(lugar);
        return lugar;
      });

      [...cabecera.cells].forEach((celda, i) => {
        const titulo = celda.textContent.trim();
        if (!titulo) return;
        celda.setAttribute('role', 'columnheader');
        const boton = h('button', {
          clase: 'sl-orden',
          type: 'button',
          texto: titulo,
          onclick: soloClicReal(() => {
            const asc = celda.getAttribute('aria-sort') !== 'ascending';
            for (const c of cabecera.cells) c.removeAttribute('aria-sort');
            celda.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
            const ordenadas = [...cuerpo].sort((a, b) => {
              const x = valorOrden(texto(a, i));
              const y = valorOrden(texto(b, i));
              return comparar(x, y) * (asc || typeof x !== typeof y ? 1 : -1);
            });
            ordenadas.forEach((fila, j) => lugares[j].after(fila));
          }),
        });
        celda.replaceChildren(boton);
      });
    }
  }

  // Colors and the font come from html.sl-activo in estilo.css. Custom properties
  // cross the shadow boundary, and "all: initial" does not reset them.
  const ESTILO_PANEL = `
    :host { all: initial; display: block; position: sticky; top: 0; z-index: 2147483000; margin: 0 calc(-1 * var(--sl-lado)); }
    * { box-sizing: border-box; }
    .cabecera { background: var(--sl-banda); color: var(--sl-sobre-banda); font: 400 .9375rem/1.3 var(--sl-fuente); }
    .cabecera-interior { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 56px; padding: 6px var(--sl-lado); }
    .marca { font: 600 1.0625rem/1.2 var(--sl-serif); margin-right: 12px; padding-left: 10px; border-left: 3px solid var(--sl-oro); }
    .espacio { flex: 1; }
    .ir-menu, .tema, .abrir-ajustes {
      min-height: 44px; border: 0; border-radius: var(--sl-radio-chico); background: none; color: inherit;
      transition: background-color .15s ease;
    }
    .ir-menu { display: inline-flex; align-items: center; padding: 4px 10px; text-decoration: none; }
    .abrir-ajustes { display: flex; align-items: center; gap: 8px; padding: 4px 10px; }
    .ir-menu:active, .tema:active, .abrir-ajustes:active { background: var(--sl-banda-2); }
    .tema { display: flex; align-items: center; justify-content: center; width: 44px; margin-right: -11px; padding: 0; }
    @media (hover: hover) and (pointer: fine) { .ir-menu:hover, .tema:hover, .abrir-ajustes:hover { background: var(--sl-banda-2); } }
    button, input { font: inherit; }
    a, button, label { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    button { cursor: pointer; user-select: none; }
    .aviso { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    .barra {
      position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px; width: max-content; max-width: calc(100vw - 24px); padding: 6px;
      background: var(--sl-banda); color: var(--sl-sobre-banda); border: 1px solid var(--sl-banda-2); border-radius: var(--sl-radio); box-shadow: var(--sl-sombra);
      font: 400 .875rem/1.3 var(--sl-fuente);
    }
    .reintentar {
      flex: none; display: flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 48px; padding: 6px 18px 6px 14px; border: 0; border-radius: var(--sl-radio-chico);
      background: var(--sl-oro); color: var(--sl-sobre-oro); font-size: 1rem; font-weight: 600;
      transition: background-color .15s ease;
    }
    @media (hover: hover) and (pointer: fine) { .reintentar:hover { background: var(--sl-oro-hover); } }
    .reintentar:active { background: var(--sl-oro-hover); }
    .reintentar:focus-visible { outline-offset: 3px; }
    .reintentar.girando svg { animation: girar .8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    ul { display: flex; gap: 4px; list-style: none; margin: 0; padding: 0; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
    li { flex: none; display: flex; align-items: stretch; min-height: 48px; border-radius: var(--sl-radio-chico); background: var(--sl-banda-2); }
    li.encontrada { background: var(--sl-mia-fila); color: var(--sl-sobre-mia-fila); }
    .materia {
      padding: 3px 2px 3px 10px; border: 0; background: none; color: inherit;
      font-weight: 600; line-height: 1.2; text-align: left; white-space: nowrap;
      max-width: min(70vw, 320px); overflow: hidden; text-overflow: ellipsis;
    }
    .materia[aria-disabled="true"] { cursor: default; font-weight: 400; }
    .detalle { display: block; font-size: .75rem; font-weight: 400; }
    .quitar { flex: none; width: 44px; border: 0; background: none; color: inherit; font-size: 1.125rem; }
    .accion {
      flex: none; display: flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 48px; padding: 4px 14px; border: 0; border-radius: var(--sl-radio-chico);
      background: var(--sl-banda-2); color: inherit; white-space: nowrap;
    }
    .accion:active, .opcion:active, .quitar:active { opacity: .75; }
    .accion[aria-expanded="true"] { background: var(--sl-sobre-banda); color: var(--sl-banda); }
    .ocultar { width: 44px; padding: 0; font-size: 1.125rem; }
    .opcion { flex: none; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 12px; border-radius: var(--sl-radio-chico); background: var(--sl-banda-2); white-space: nowrap; cursor: pointer; }
    .opcion input { width: 18px; height: 18px; margin: 0; accent-color: var(--sl-oro); }
    :host-context(html:not([data-sl-tema="oscuro"])) .sl-icono-sol,
    :host-context(html[data-sl-tema="oscuro"]) .sl-icono-luna { display: none; }
    .emergente {
      position: absolute; right: 0; bottom: calc(100% + 8px); width: min(420px, calc(100vw - 24px)); padding: 18px;
      background: var(--sl-superficie); color: var(--sl-texto); border-top: 3px solid var(--sl-oro); border-radius: var(--sl-radio); box-shadow: var(--sl-sombra);
    }
    .emergente.entrando { animation: entrar .14s ease-out; transform-origin: 90% 100%; }
    @keyframes entrar { from { opacity: 0; transform: translateY(4px); } }
    .emergente p { margin: 0 0 14px; color: var(--sl-texto-2); font: italic 400 .9375rem/1.4 var(--sl-serif); }
    .emergente :focus-visible { outline-color: var(--sl-acento); }
    form { display: grid; grid-template-columns: minmax(0, 1fr) 100px; gap: 10px; }
    label.campo { display: grid; gap: 4px; font-size: .8125rem; font-weight: 500; color: var(--sl-texto-2); }
    input[type="text"] {
      width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--sl-borde-campo); border-radius: var(--sl-radio-chico);
      background: var(--sl-superficie); color: var(--sl-texto); font-size: max(1rem, 16px);
    }
    .guardar {
      grid-column: 1 / -1; min-height: 44px; border: 0; border-radius: var(--sl-radio-chico);
      background: var(--sl-acento); color: var(--sl-sobre-acento); font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) { .guardar:hover { background: var(--sl-acento-fuerte); } }
    .guardar:active { background: var(--sl-acento-fuerte); }
    .pestana {
      position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%); min-height: 44px; padding: 6px 18px; border: 0; border-radius: var(--sl-radio-chico);
      background: var(--sl-banda); color: var(--sl-sobre-banda); box-shadow: var(--sl-sombra); font: 500 .875rem var(--sl-fuente);
    }
    @media (max-width: 760px) {
      .barra { width: calc(100vw - 24px); flex-wrap: wrap; }
      .reintentar, ul, .opcion { flex: 1 1 100%; }
      .accion:not(.ocultar) { flex: 1 1 auto; }
      .reintentar, li, .accion, .opcion { min-height: 46px; }
      .abrir-ajustes span { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .reintentar.girando svg, .emergente.entrando { animation: none; }
    }
    :host-context(html[data-sl-movimiento="bajo"]) * { animation: none !important; transition: none !important; }
  `;

  const ESTILO_AJUSTES = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    dialog {
      width: min(640px, calc(100vw - 24px)); max-height: calc(100dvh - 32px); padding: 0; overflow-y: auto; overscroll-behavior: contain;
      border: 0; border-top: 4px solid var(--sl-oro); border-radius: var(--sl-radio); box-shadow: var(--sl-sombra);
      background: var(--sl-superficie); color: var(--sl-texto); font: 400 1rem/1.4 var(--sl-fuente);
    }
    dialog::backdrop { background: rgb(0 0 0 / .5); }
    header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 12px 12px 24px; background: var(--sl-superficie); border-bottom: 1px solid var(--sl-linea); }
    h2 { margin: 0; font: 600 1.5rem/1.2 var(--sl-serif); }
    .cuerpo { display: grid; gap: 24px; padding: 20px 24px 24px; }
    fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
    fieldset:disabled { opacity: .5; }
    legend { padding: 0; margin-bottom: 8px; font-weight: 600; }
    .ayuda { margin: 8px 0 0; color: var(--sl-texto-2); font-size: .875rem; }
    button { font: inherit; cursor: pointer; touch-action: manipulation; }
    :focus-visible { outline: 2px solid var(--sl-acento); outline-offset: 2px; }
    .cerrar { width: 44px; height: 44px; border: 0; border-radius: var(--sl-radio-chico); background: none; color: inherit; font-size: 1.5rem; line-height: 1; }
    .cerrar:active { background: var(--sl-superficie-2); }
    @media (hover: hover) and (pointer: fine) { .cerrar:hover { background: var(--sl-superficie-2); } }

    .opciones { display: flex; flex-wrap: wrap; gap: 8px; }
    label.opcion { position: relative; cursor: pointer; }
    label.opcion input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
    label.opcion:has(input:focus-visible) { outline: 2px solid var(--sl-acento); outline-offset: 2px; }
    fieldset:disabled label.opcion, fieldset:disabled label.opcion input { cursor: default; }

    .texto { display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 6px 14px; border: 1px solid var(--sl-borde-campo); border-radius: var(--sl-radio-chico); }
    label.opcion:has(input:checked) .texto { background: var(--sl-acento); border-color: var(--sl-acento); color: var(--sl-sobre-acento); font-weight: 600; }

    .plantillas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .ficha { display: block; height: 100%; padding: 10px; border: 1px solid var(--sl-borde-campo); border-radius: var(--sl-radio); }
    label.opcion:has(input:checked) .ficha { border-color: var(--sl-acento); box-shadow: inset 0 0 0 2px var(--sl-acento); }
    .ficha b { display: block; margin-top: 8px; font: 600 1.0625rem/1.2 var(--sl-serif); }
    .ficha small { display: block; margin-top: 2px; color: var(--sl-texto-2); font-size: .8125rem; line-height: 1.3; }
    .mini { display: grid; gap: 3px; height: 72px; padding: 5px; overflow: hidden; border-radius: 4px; background: var(--sl-superficie-2); }
    .mini i { display: block; background: var(--sl-superficie); border-radius: 2px; }
    .mini .faja { height: 8px; background: var(--sl-banda); }
    .mini-claustro { grid-template-columns: 1fr 2fr; grid-template-rows: 8px 16px 1fr; }
    .mini-claustro .faja { grid-column: 1 / -1; }
    .mini-claustro .ancho { grid-column: 1 / -1; }
    .mini-analitico { background: var(--sl-superficie); grid-template-rows: 8px repeat(4, 1fr); }
    .mini-analitico i:not(.faja) { background: none; border-radius: 0; border-bottom: 1px solid var(--sl-regla); }
    .mini-tablero { grid-template-columns: 1fr 2.4fr; grid-template-rows: 8px 1fr 1fr; }
    .mini-tablero .faja { grid-column: 1 / -1; }
    .mini-tablero .lado { grid-row: span 2; }

    .muestra { display: block; width: 44px; height: 44px; border: 3px solid var(--sl-superficie); border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1px var(--sl-borde-campo); }
    label.opcion:has(input:checked) .muestra { box-shadow: 0 0 0 3px var(--sl-acento); }
    label.opcion:has(input:checked) .muestra::after { content: "✓" / ""; display: flex; align-items: center; justify-content: center; height: 100%; color: var(--t, #fff); font-weight: 700; }
    .otro { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px 0 4px; border: 1px solid var(--sl-borde-campo); border-radius: 999px; cursor: pointer; }
    .otro input { width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; }
    .otro input::-webkit-color-swatch-wrapper { padding: 0; }
    .otro input::-webkit-color-swatch { border: 1px solid var(--sl-borde-campo); border-radius: 50%; }

    label.interruptor { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--sl-linea); cursor: pointer; }
    label.interruptor input { flex: none; width: 22px; height: 22px; margin: 1px 0 0; accent-color: var(--sl-acento); }
    label.interruptor small { display: block; color: var(--sl-texto-2); font-size: .875rem; }
    label.interruptor.sub { padding-left: 34px; }
    label.interruptor[hidden] { display: none; }

    footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 0 24px 20px; }
    .restablecer, .listo { min-height: 44px; padding: 8px 18px; border-radius: var(--sl-radio-chico); }
    .restablecer { border: 1px solid var(--sl-borde-campo); background: none; color: inherit; }
    .listo { border: 0; background: var(--sl-acento); color: var(--sl-sobre-acento); font-weight: 600; }
    .restablecer:active { background: var(--sl-superficie-2); }
    .listo:active { background: var(--sl-acento-fuerte); }
    @media (hover: hover) and (pointer: fine) { .restablecer:hover { background: var(--sl-superficie-2); } .listo:hover { background: var(--sl-acento-fuerte); } }
    @media (max-width: 560px) {
      dialog { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }
      .cuerpo { padding-inline: 16px; }
      header { padding-left: 16px; }
      footer { padding-inline: 16px; }
      .plantillas { grid-template-columns: minmax(0, 1fr); }
      .mini { height: 56px; }
    }
  `;

  // The settings dialog. Every change is saved at once and inicio.js applies it, so the
  // page behind updates live. Nothing here touches Sysacad's own forms.
  const CLAVES_AJUSTES = ['tema', 'plantilla', 'letra', 'vision', 'contraste', 'movimiento', 'fondo', 'color', 'marca'];
  const COLORES = [
    ['Marino', '#1c3a5e'], ['Bordó', '#6d1f2f'], ['Verde', '#1f4d3a'],
    ['Petróleo', '#0f4c5c'], ['Ciruela', '#4a2a6b'], ['Grafito', '#2f3640'],
  ];
  const MARCAS = [['Dorado', '#d9b13b'], ['Celeste', '#5bb4dc'], ['Rosa', '#e58fb1'], ['Verde claro', '#6cc08b']];

  let anfitrionAjustes = null;

  function abrirAjustes() {
    if (anfitrionAjustes?.isConnected) anfitrionAjustes.remove();
    anfitrionAjustes = h('div', { id: 'sl-ajustes' });
    const sombra = anfitrionAjustes.attachShadow({ mode: 'open' });
    const dialogo = h('dialog', {
      'aria-labelledby': 'sl-ajustes-titulo',
      onclick: (e) => { if (e.target === dialogo && e.isTrusted) dialogo.close(); },
      onclose: () => {
        anfitrionAjustes.remove();
        const panel = document.querySelector('#sysacad-lindo')?.shadowRoot;
        (panel?.querySelector('.abrir-ajustes') ?? document.querySelector('.sl-abrir-ajustes'))?.focus();
      },
    });
    sombra.append(h('style', { texto: ESTILO_AJUSTES }), dialogo);
    document.body.append(anfitrionAjustes);

    const opcion = (nombre, valor, actual, contenido, extra = {}) => h('label', { clase: 'opcion' },
      h('input', {
        type: 'radio',
        name: nombre,
        value: valor,
        checked: valor === actual,
        onchange: soloClicReal(() => guardar({ [nombre]: valor })),
        ...extra,
      }),
      contenido,
    );
    const grupoTexto = (titulo, nombre, actual, opciones) => h('fieldset', {},
      h('legend', { texto: titulo }),
      h('div', { clase: 'opciones' }, ...opciones.map(([valor, texto]) => opcion(nombre, valor, actual, h('span', { clase: 'texto', texto })))),
    );
    const muestra = (color, texto) => {
      const el = h('span', { clase: 'muestra' });
      el.style.setProperty('--c', color);
      if (texto) el.style.setProperty('--t', texto);
      return el;
    };
    const ficha = (valor, titulo, descripcion, partes) => h('span', { clase: 'ficha' },
      h('span', { clase: `mini mini-${valor}` }, ...partes.map((clase) => h('i', { clase }))),
      h('b', { texto: titulo }),
      h('small', { texto: descripcion }),
    );
    const interruptor = (clave, marcado, titulo, ayuda, alCambiar) => h('label', { clase: 'interruptor' },
      h('input', {
        type: 'checkbox',
        checked: marcado,
        onchange: soloClicReal((e) => {
          guardar({ [clave]: e.target.checked });
          alCambiar?.(e.target.checked);
        }),
      }),
      h('span', {}, titulo, h('small', { texto: ayuda })),
    );

    const dibujar = async () => {
      const a = await chrome.storage.local.get({ tema: 'sistema', plantilla: 'claustro', letra: 'normal', vision: 'normal', contraste: false, movimiento: false, fondo: true, color: COLORES[0][1], marca: MARCAS[0][1], santoVinculado: false, supercvgVinculado: false, supercvgGuardaPestanas: true });
      const cerrar = h('button', { clase: 'cerrar', type: 'button', 'aria-label': 'Cerrar ajustes', texto: '×', onclick: soloClicReal(() => dialogo.close()) });
      const colores = h('fieldset', { disabled: a.contraste },
        h('legend', { texto: 'Color principal' }),
        h('div', { clase: 'opciones' },
          ...COLORES.map(([nombre, valor]) => opcion('color', valor, a.color, muestra(valor), { 'aria-label': nombre })),
          h('label', { clase: 'otro' },
            h('input', { type: 'color', value: a.color, onchange: soloClicReal((e) => {
              for (const radio of colores.querySelectorAll('input[type="radio"]')) radio.checked = false;
              guardar({ color: e.target.value });
            }) }),
            'Otro',
          ),
        ),
        h('p', { clase: 'ayuda', texto: 'Si elegís uno muy claro, lo oscurecemos para que se lea.' }),
      );
      const marcas = h('fieldset', { disabled: a.contraste },
        h('legend', { texto: 'Color de tus materias' }),
        h('div', { clase: 'opciones' }, ...MARCAS.map(([nombre, valor]) => opcion('marca', valor, a.marca, muestra(valor, '#1b2430'), { 'aria-label': nombre }))),
      );

      // The copies of the tabs for Super CVG, only while it is linked.
      const pestanas = interruptor('supercvgGuardaPestanas', a.supercvgGuardaPestanas, 'Guardar las pestañas que abrís', 'Así las ves en Super\u00a0CVG. Apagarlo borra lo guardado.', (activo) => {
        // The name stays: the exams for Super CVG's calendar use it too.
        if (!activo) chrome.storage.local.remove('supercvgPestanas');
      });
      pestanas.classList.add('sub');
      pestanas.hidden = !a.supercvgVinculado;

      dialogo.replaceChildren(
        h('header', {}, h('h2', { id: 'sl-ajustes-titulo', texto: 'Ajustes' }), cerrar),
        h('div', { clase: 'cuerpo' },
          h('fieldset', {},
            h('legend', { texto: 'Vista' }),
            h('div', { clase: 'plantillas' },
              opcion('plantilla', 'claustro', a.plantilla, ficha('claustro', 'Claustro', 'Tarjetas con aire. La más completa.', ['faja', 'ancho', '', ''])),
              opcion('plantilla', 'analitico', a.plantilla, ficha('analitico', 'Analítico', 'Como un certificado: filetes, sin tarjetas.', ['faja', '', '', '', ''])),
              opcion('plantilla', 'tablero', a.plantilla, ficha('tablero', 'Tablero', 'Dos columnas compactas. Entra más en pantalla.', ['faja', 'lado', '', ''])),
            ),
          ),
          grupoTexto('Tema', 'tema', a.tema, [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Como el sistema']]),
          grupoTexto('Tamaño de letra', 'letra', a.letra, [['chica', 'Chica'], ['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Muy grande']]),
          colores,
          marcas,
          grupoTexto('Modo daltónicos', 'vision', a.vision, [['normal', 'Apagado'], ['rojo-verde', 'Rojo y verde'], ['azul-amarillo', 'Azul y amarillo']]),
          h('div', {},
            interruptor('contraste', a.contraste, 'Alto contraste', 'Blanco y negro con bordes marcados. Usa sus propios colores.', (activo) => {
              colores.disabled = activo;
              marcas.disabled = activo;
            }),
            interruptor('movimiento', a.movimiento, 'Bajo movimiento', 'Saca el fondo animado y las transiciones.'),
            interruptor('fondo', a.fondo, 'Fondo con frases', 'Notas al margen que aparecen cada tanto, con alguna mala palabra.'),
          ),
          // Turned off, what was kept for that site goes away and nothing more is handed over.
          h('div', {},
            ...Object.values(VINCULOS).map((v) => interruptor(v.vinculado, a[v.vinculado], `Vincular con ${v.nombre}`, v.ajuste, (activo) => {
              guardar({ [v.preguntado]: true });
              if (!activo) chrome.storage.local.remove(v.datos);
              if (v === VINCULOS.supercvg) pestanas.hidden = !activo;
            })),
            pestanas,
          ),
        ),
        h('footer', {},
          h('button', {
            clase: 'restablecer',
            type: 'button',
            texto: 'Volver a lo original',
            onclick: soloClicReal(async () => {
              await chrome.storage.local.remove(CLAVES_AJUSTES);
              await dibujar();
              dialogo.querySelector('.cerrar').focus();
            }),
          }),
          h('button', { clase: 'listo', type: 'button', texto: 'Listo', onclick: soloClicReal(() => dialogo.close()) }),
        ),
      );
    };

    dibujar().then(() => dialogo.showModal());
  }

  const botonAjustes = (clase) => h('button', {
    clase,
    type: 'button',
    'aria-label': 'Ajustes',
    onclick: soloClicReal(abrirAjustes),
  }, parsear(ICONOS.ajustes), h('span', { texto: 'Ajustes' }));

  function montarPanel() {
    const anfitrion = h('div', { id: 'sysacad-lindo' });
    const sombra = anfitrion.attachShadow({ mode: 'open' });
    const estilo = h('style', { texto: ESTILO_PANEL });
    const contenido = h('div');
    // Lives outside the redrawn content, so screen readers hear each change.
    const aviso = h('p', { clase: 'aviso', role: 'status' });
    sombra.append(estilo, contenido, aviso);
    document.body.prepend(anfitrion);

    // Only the enrollment pages list subjects to pick, so only they can add one.
    const enInscripcion = pagina === '/materiascursado.asp';
    const conLista = enInscripcion || pagina === '/materiasexamen.asp';

    let formularioAbierto = false;
    let animarFormulario = false;
    let enfocarNombre = false;
    let volverAlBoton = false;

    async function dibujar() {
      const estado = await leer();
      const coincidencias = resaltar(estado);

      const irAlMenu = h('a', {
        clase: 'ir-menu',
        href: '/menuAlumno.asp',
        texto: 'Ir al menú',
        onclick: (e) => {
          if (!e.isTrusted) e.preventDefault();
          else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) irAlMenu.textContent = 'Abriendo…';
        },
      });
      const cabecera = h('header', { clase: 'cabecera' },
        h('div', { clase: 'cabecera-interior' },
          h('span', { clase: 'marca', texto: 'UTN Rosario' }),
          irAlMenu,
          h('span', { clase: 'espacio' }),
          botonAjustes('abrir-ajustes'),
          botonTema('tema'),
        ),
      );

      // Links carry an id that changes on every page, so a saved address goes stale.
      // That is why this button reloads the page and the header links to the menu, which
      // Sysacad links to without an id and which has the fresh enrollment link.
      const etiqueta = h('span', { texto: 'Probar de nuevo' });
      const boton = enInscripcion ? h('button', {
        clase: 'reintentar',
        onclick: soloClicReal(() => {
          etiqueta.textContent = 'Abriendo…';
          boton.classList.add('girando');
          location.reload();
        }),
      }, parsear(ICONOS.girar), etiqueta) : null;

      const visibles = conLista ? estado.materias : estado.materias.filter((m) => coincidencias.has(m.id));
      const casilla = h('input', {
        type: 'checkbox',
        'aria-label': 'Mostrar solo mis materias',
        onchange: soloClicReal((e) => guardar({ soloMias: e.target.checked })),
      });
      casilla.checked = estado.soloMias;

      const { formulario, nombre } = armarFormulario(estado);
      const previo = sombra.activeElement;
      const claveFoco = previo?.getAttribute('aria-label') ?? (previo?.classList.contains('accion') ? previo.textContent : null);
      const conBarra = conLista || visibles.length > 0;
      const pestana = h('button', { clase: 'pestana', texto: 'Mostrar panel', onclick: soloClicReal(() => guardar({ plegado: false })) });
      const barra = !conBarra ? null : estado.plegado ? pestana : h('section', { clase: 'barra', 'aria-label': 'Mi inscripción' },
        boton,
        visibles.length ? listaMaterias(estado, visibles, coincidencias) : null,
        visibles.length ? h('label', { clase: 'opcion' }, casilla, 'Solo mis materias') : null,
        conLista ? h('button', {
          clase: 'accion agregar',
          texto: 'Agregar materia',
          'aria-expanded': String(formularioAbierto),
          onclick: soloClicReal(() => {
            formularioAbierto = !formularioAbierto;
            animarFormulario = formularioAbierto;
            enfocarNombre = formularioAbierto;
            dibujar();
          }),
        }) : null,
        h('button', {
          clase: 'accion ocultar',
          texto: '×',
          'aria-label': 'Ocultar panel',
          onclick: soloClicReal(() => guardar({ plegado: true })),
        }),
        conLista && formularioAbierto ? formulario : null,
      );
      contenido.replaceChildren(...[cabecera, barra].filter(Boolean));
      if (enfocarNombre && formularioAbierto) nombre.focus();
      else if (volverAlBoton) contenido.querySelector('.agregar')?.focus();
      else if (previo?.classList.contains('pestana')) (contenido.querySelector('.pestana') ?? contenido.querySelector('.barra button, .barra input'))?.focus();
      else if (claveFoco) {
        const destino = contenido.querySelector(`[aria-label="${CSS.escape(claveFoco)}"]`);
        // The control may be gone, as after hiding the panel or removing a subject.
        (destino ?? ['.agregar', '.quitar', '.ocultar', '.pestana', '.ir-menu'].map((s) => contenido.querySelector(s)).find(Boolean))?.focus();
      }
      enfocarNombre = false;
      volverAlBoton = false;
      animarFormulario = false;
    }

    function listaMaterias(estado, visibles, coincidencias) {
      return h('ul', {}, ...visibles.map((m) => {
        const hallada = coincidencias.get(m.id);
        const detalle = [m.comision, hallada ? `${hallada.total} en esta página` : 'no está en esta página'].filter(Boolean).join(', ');
        return h('li', { clase: hallada ? 'encontrada' : '' },
          h('button', {
            clase: 'materia',
            title: m.nombre,
            'aria-disabled': hallada ? null : 'true',
            onclick: soloClicReal(() => {
              if (!hallada) return;
              const suave = matchMedia('(prefers-reduced-motion: reduce)').matches;
              const destino = [hallada.primera, hallada.primera.slNodo].find((el) => el?.getClientRects().length);
              destino?.scrollIntoView({ block: 'center', behavior: suave ? 'auto' : 'smooth' });
            }),
          }, m.nombre, h('span', { clase: 'detalle', texto: detalle })),
          h('button', {
            clase: 'quitar',
            texto: '×',
            'aria-label': `Quitar ${m.nombre}`,
            onclick: soloClicReal(() => {
              aviso.textContent = `Quitaste ${m.nombre}`;
              guardar({ materias: estado.materias.filter((x) => x.id !== m.id) });
            }),
          }),
        );
      }));
    }

    function armarFormulario(estado) {
      const nombre = h('input', { type: 'text', name: 'materia', required: true, pattern: '.*\\S.*', title: 'Escribí al menos una letra', maxlength: 120, autocomplete: 'off', spellcheck: 'false', oninput: () => nombre.setCustomValidity('') });
      const comision = h('input', { type: 'text', name: 'comision', maxlength: 20, autocomplete: 'off', spellcheck: 'false' });
      const formulario = h('div', {
        clase: `emergente${animarFormulario ? ' entrando' : ''}`,
        onkeydown: (e) => {
          if (e.key !== 'Escape' || !e.isTrusted) return;
          formularioAbierto = false;
          volverAlBoton = true;
          dibujar();
        },
        role: 'dialog',
        'aria-label': 'Agregar materia',
      },
        h('p', { texto: 'Escribí el nombre igual que aparece en Sysacad.' }),
        h('form', {
          onsubmit: (e) => {
            e.preventDefault();
            if (!e.isTrusted) return;
            const texto = nombre.value.trim();
            if (!texto) return;
            const clave = (x) => `${normalizar(x.nombre)}|${normalizar(x.comision)}`;
            const nueva = { id: nuevoId(), nombre: texto, comision: comision.value.trim() };
            if (estado.materias.some((x) => clave(x) === clave(nueva))) {
              nombre.setCustomValidity('Ya está en tu lista');
              nombre.reportValidity();
              return;
            }
            aviso.textContent = `Agregaste ${texto}`;
            // Stays open and ready, since students usually add several subjects in a row.
            enfocarNombre = true;
            guardar({ materias: [...estado.materias, nueva] });
          },
        },
          h('label', { clase: 'campo' }, 'Materia', nombre),
          h('label', { clase: 'campo' }, 'Comisión', comision),
          h('button', { clase: 'guardar', type: 'submit', texto: 'Guardar materia' }),
        ),
      );
      return { formulario, nombre };
    }

    chrome.storage.onChanged.addListener(dibujar);
    // A page restored from the back/forward cache must not keep the "Abriendo…" label.
    addEventListener('pageshow', (e) => { if (e.persisted) dibujar(); });
    dibujar();
  }

  function envolverTablas() {
    for (const tabla of document.querySelectorAll('table.sl-datos:not(.sl-reemplazada, .sl-angosta)')) {
      if (tabla.querySelector('input, select, textarea, form, button:not(.sl-orden)') || tabla.parentElement?.closest('form, table.sl-datos')) continue;
      // Rows stack on phones only under a header made of real header cells, so a data row
      // guessed as the header is never hidden.
      const filas = filasDe(tabla);
      const cabecera = filas.find((fila) => fila.classList.contains('sl-cabecera'));
      if (cabecera && [...cabecera.cells].every((c) => c.tagName === 'TH')) {
        tabla.classList.add('sl-apilable');
        declararRoles(tabla, filas, cabecera);
        for (const fila of filas) {
          if (fila === cabecera || fila.cells.length !== cabecera.cells.length) continue;
          [...fila.cells].forEach((celda, i) => {
            celda.dataset.slCol = cabecera.cells[i].textContent.trim();
            if (/^(-\.-)?$/.test(celda.textContent.trim())) celda.classList.add('sl-vacia');
          });
        }
      }
      const marco = h('div', { clase: 'sl-tabla-marco', tabindex: '0', role: 'region', 'aria-label': document.querySelector('h1.sl-titulo')?.textContent || 'Tabla' });
      tabla.before(marco);
      marco.append(tabla);
    }
  }

  // Student margin notes for the animated background. Decorative, and they only
  // exist in the page's stylesheet layer: no script runs after they are placed.
  const FRASES = [
    'Otra vez se cayó esta mierda',
    'Sistemas operativos te odio',
    '5to año y todavía no sé qué es un sistema',
    'Cupo lleno. Como siempre.',
    'F5, F5, F5, F5, F5',
    'Correlativas: el verdadero jefe final',
    'Final el lunes. Empiezo a estudiar el domingo.',
    'Recursar también es aprender',
    '¿Quién diseñó esto?',
    'En mi máquina funciona',
    'Análisis II me miró feo',
    'Ya casi me recibo, dije hace tres años',
  ];

  function montarFondo() {
    const frases = FRASES.map((texto, i) => {
      const frase = h('span', { clase: 'sl-frase', texto });
      frase.style.setProperty('--i', String(i));
      frase.style.setProperty('--y', `${22 + (i * 37) % 60}%`);
      frase.style.setProperty('--giro', `${((i * 53) % 7) - 3}deg`);
      return frase;
    });
    document.body.append(
      h('div', { clase: 'sl-fondo', 'aria-hidden': 'true' }, ...frases),
      h('div', { clase: 'sl-cielo', 'aria-hidden': 'true' },
        h('div', { clase: 'sl-avion' },
          h('div', { clase: 'sl-avion-vaiven' },
            h('span', { clase: 'sl-cartel', texto: 'Hay un solo camino... Y ES LA GUERRA!' }),
            h('span', { clase: 'sl-soga' }),
            parsear('<svg viewBox="0 0 64 32" width="72" height="36" fill="currentColor"><path d="M6 15.5 44 12c6 0 11 1.5 14 4-3 2.500-8 4-14 4L6 18z"/><path d="M6 16 2 5h7l6 10z"/><path d="M24 7h16v3H24zM24 22h16v3H24z"/><path d="M29 10h2v12h-2zM36 10h2v12h-2z"/><path d="M59 7h2v18h-2z" opacity=".6"/></svg>'),
          ),
        ),
      ),
    );
  }

  // Read before anything below touches the page.
  const copia = copiaDeLaPestana();
  if (copia) guardarPestana(copia);
  marcarTablas();
  marcarLogin();
  if (esPrincipal) montarFondo();
  mejorarMenu();
  ponerHeroe();
  if (esPrincipal) {
    mejorarEstadoAcademico();
    mejorarCorrelatividades();
    mejorarCertificados();
    mejorarListaDeExamenes();
    mejorarFechasDeExamen();
    mejorarInscripcionHecha();
    mejorarCertificadoDeExamenes();
    mejorarExamenes();
    mejorarTablas();
    envolverTablas();
  }

  // The menu and the login page have nothing for the panel to act on.
  const conPanel = esPrincipal && !document.querySelector('.sl-menu, input[type="password"]');

  if (conPanel) {
    montarPanel();
  } else {
    // Frames get the reskin and highlights, and follow changes made from the panel.
    const actualizar = async () => resaltar(await leer());
    chrome.storage.onChanged.addListener(actualizar);
    actualizar();
  }
})();
