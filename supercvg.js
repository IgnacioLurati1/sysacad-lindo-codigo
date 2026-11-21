// Super CVG (supercvg.lutastudios.com), the unofficial campus panel, shows the final grade of each subject the student
// passed in Sysacad. It always hears back, so it knows the extension is here, and gets the grades only if the student
// linked it (contenido.js keeps them from Estado académico). The page can also link or unlink it, like the switch in
// Ajustes. Everything stays in this same browser: nothing is sent anywhere.
//
// Since 2.4.0 it also hands over the text copies of the Sysacad tabs the student opened (docs/CONTRATO-SUPERCVG.md),
// with `v: 2` so the published Super CVG, which wants `v: 1`, ignores them. Since 2.5.0, the exams the student enrolled
// in, for its calendar, with `v: 3`.
(() => {
  'use strict';
  const limpios = (finales) =>
    (Array.isArray(finales) ? finales : [])
      .filter((f) => f && typeof f.nombre === 'string' && f.nombre.trim() && Number.isFinite(f.nota) && f.nota >= 1 && f.nota <= 10)
      .slice(0, 80)
      .map((f) => ({ nombre: f.nombre.trim().slice(0, 120), nota: f.nota }));

  // Same order and titles as the contract: Super CVG drops the whole message on any other.
  const PESTANAS = [
    ['estado', 'Estado académico'],
    ['parciales', 'Notas de parciales'],
    ['examenes', 'Exámenes'],
    ['plan', 'Materias del plan'],
    ['correlativas-cursar', 'Correlatividad para cursar'],
    ['correlativas-rendir', 'Correlatividad para rendir'],
    ['certificados', 'Certificados'],
  ];
  const TOPES = { bloques: 60, texto: 2000, titulo: 200, columnas: 30, filas: 500, celda: 300, alumno: 120 };
  const DIA = 24 * 60 * 60 * 1000;
  const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;
  // A string with no control characters, its spaces collapsed and cut, or '' for anything else.
  const texto = (t, tope) => (typeof t === 'string' ? t.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, tope).trimEnd() : '');

  // Rebuilds each block with only the keys of the contract, so whatever else is kept never reaches the page.
  const bloque = (b) => {
    if (!b || typeof b !== 'object') return null;
    if (b.t === 'titulo' || b.t === 'texto') {
      const t = texto(b.texto, b.t === 'titulo' ? TOPES.titulo : TOPES.texto);
      return t ? { t: b.t, texto: t } : null;
    }
    if (b.t !== 'tabla' || !Array.isArray(b.columnas) || !Array.isArray(b.filas)) return null;
    const columnas = b.columnas.slice(0, TOPES.columnas).map((c) => texto(c, TOPES.celda));
    const ancho = columnas.length || TOPES.columnas;
    const filas = b.filas
      .filter(Array.isArray)
      .slice(0, TOPES.filas)
      .map((f) => f.slice(0, ancho).map((c) => texto(c, TOPES.celda)));
    if (!columnas.length && !filas.length) return null;
    return { t: 'tabla', titulo: texto(b.titulo, TOPES.titulo) || null, columnas, filas };
  };

  const pestanas = (guardadas) => {
    if (!guardadas || typeof guardadas !== 'object') return [];
    const limite = Date.now() + DIA;
    return PESTANAS.flatMap(([clave, titulo]) => {
      const p = Object.hasOwn(guardadas, clave) ? guardadas[clave] : null;
      if (!p || !Number.isSafeInteger(p.fecha) || p.fecha <= 0 || p.fecha > limite || !Array.isArray(p.bloques)) return [];
      const bloques = p.bloques.map(bloque).filter(Boolean).slice(0, TOPES.bloques);
      return bloques.length ? [{ clave, titulo, fecha: p.fecha, bloques }] : [];
    });
  };

  const contestarPestanas = async () => {
    const s = await chrome.storage.local.get({ supercvgVinculado: false, supercvgGuardaPestanas: true, supercvgPestanas: null, supercvgAlumno: null });
    const vinculada = s.supercvgVinculado === true;
    window.postMessage({
      fuente: 'sysacad-lindo',
      para: 'super-cvg',
      v: 2,
      tipo: 'pestanas',
      vinculada,
      guarda: vinculada && s.supercvgGuardaPestanas === true,
      // Since 2.5.0 the name stays with the switch off (the exams use it), but this message still sends none then.
      alumno: (vinculada && s.supercvgGuardaPestanas === true && texto(s.supercvgAlumno, TOPES.alumno)) || null,
      pestanas: vinculada ? pestanas(s.supercvgPestanas) : [],
    }, location.origin);
  };

  // Since 2.5.0, the exams the student enrolled in, for Super CVG's calendar. Rebuilt with only the keys of the
  // contract and checked one by one: anything off stays out instead of spoiling the whole message.
  const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const diaValido = (d) => {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const [a, m, dd] = d.split('-').map(Number);
    const f = new Date(a, m - 1, dd);
    return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === dd;
  };
  const examenes = (guardados) => {
    const lista = Array.isArray(guardados) ? guardados : [];
    const vistos = new Set();
    return lista
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        materia: texto(e.materia, 120),
        dia: e.dia,
        turno: texto(e.turno, 20) || null,
        teorico: HORA.test(e.teorico) ? e.teorico : null,
        practico: HORA.test(e.practico) ? e.practico : null,
        tribunal: texto(e.tribunal, 80) || null,
      }))
      .filter((e) => {
        const clave = `${e.materia}|${e.dia}`;
        if (!e.materia || !diaValido(e.dia) || vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .slice(0, 30);
  };

  const contestarExamenes = async () => {
    const s = await chrome.storage.local.get({ supercvgVinculado: false, supercvgAlumno: null, examenesInscriptos: null });
    const vinculada = s.supercvgVinculado === true;
    const lista = vinculada ? examenes(s.examenesInscriptos?.examenes) : [];
    const fecha = s.examenesInscriptos?.fecha;
    const fechaValida = Number.isSafeInteger(fecha) && fecha > 0 && fecha <= Date.now() + DIA;
    window.postMessage({
      fuente: 'sysacad-lindo',
      para: 'super-cvg',
      v: 3,
      tipo: 'examenes',
      vinculada,
      alumno: (vinculada && texto(s.supercvgAlumno, TOPES.alumno)) || null,
      fecha: vinculada && fechaValida ? fecha : null,
      // With no valid date, no exams: the contract never pairs a list with a null date.
      examenes: vinculada && fechaValida ? lista : [],
    }, location.origin);
  };

  const contestar = async () => {
    const { supercvgVinculado, supercvgFinales } = await chrome.storage.local.get({ supercvgVinculado: false, supercvgFinales: null });
    const mensaje = { fuente: 'sysacad-lindo', para: 'super-cvg', v: 1, vinculada: supercvgVinculado === true };
    if (mensaje.vinculada && supercvgFinales && Array.isArray(supercvgFinales.finales) && Number.isFinite(supercvgFinales.fecha)) {
      mensaje.fecha = supercvgFinales.fecha;
      mensaje.finales = limpios(supercvgFinales.finales);
    }
    window.postMessage(mensaje, location.origin);
  };

  const PEDIDOS = {
    sysacad: () => contestar(),
    // Linked from here, Sysacad Lindo offers to go back here once it has read the grades.
    vincular: async () => {
      await chrome.storage.local.set({ supercvgVinculado: true, supercvgPreguntado: true, supercvgDesdeSuPagina: true });
      await contestar();
    },
    // Same as turning the switch off in Ajustes: what was kept goes away.
    desvincular: async () => {
      await chrome.storage.local.set({ supercvgVinculado: false, supercvgPreguntado: true });
      await chrome.storage.local.remove(['supercvgFinales', 'supercvgDesdeSuPagina', 'supercvgPestanas', 'supercvgAlumno']);
      await contestar();
    },
    pestanas: () => contestarPestanas(),
    examenes: () => contestarExamenes(),
    // Salir in Super CVG, or copies of another account: they go away, and it hears there are none.
    'olvidar-pestanas': async () => {
      await chrome.storage.local.remove(['supercvgPestanas', 'supercvgAlumno']);
      await contestarPestanas();
    },
  };

  // Only the page itself asks: not a frame inside it, nor a window that opened it.
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || !e.data || e.data.fuente !== 'super-cvg') return;
    if (Object.hasOwn(PEDIDOS, e.data.pide)) PEDIDOS[e.data.pide]();
  });
  // The page asks when it is ready; this also answers once on its own, in case the page was first.
  contestar();
})();
