// End-to-end checks for the extension. Runs a real Chromium with the extension
// loaded. All traffic is answered locally and anything else is aborted, so these
// checks never contact the real Sysacad.
//
// Usage: npm test (pruebas/correr.mjs finds Playwright), or
//        PLAYWRIGHT_MODULE=<path to playwright package> node pruebas/e2e.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// SL_EXT points the tests at another copy, such as the unzipped release package.
const EXT = process.env.SL_EXT ?? join(HERE, '..');
const SHOTS = join(HERE, 'capturas');
mkdirSync(SHOTS, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const ORIGIN = 'https://alumnos.frro.utn.edu.ar';

const INSCRIPCION = `<!doctype html><html><head><title>Inscripcion a Cursado</title></head>
<body bgcolor="#C0C0C0" text="#000080"><center><font face="Arial" size="4"><b>Inscripción a cursado</b></font></center>
<table width="100%" border="1" bgcolor="#FFFFCC"><tr><td>
  <form method="post" action="/guardar.asp">
  <table id="lista" border="1" cellpadding="1" bgcolor="#99CCFF">
    <tr id="titulo"><td><b>Materia</b></td><td><b>Comisión</b></td><td><b>Horario</b></td><td></td></tr>
    <tr id="am2"><td>Análisis Matemático II</td><td>2K1</td><td>Lu 8 a 12</td><td><input type="radio" name="op" value="1"></td></tr>
    <tr id="am2b"><td>Análisis Matemático II</td><td>2K2</td><td>Ma 18 a 22</td><td><input type="radio" name="op" value="2"></td></tr>
    <tr id="fis"><td>Física II</td><td>2K1</td><td>Mi 8 a 12</td><td><input type="radio" name="op" value="3"></td></tr>
    <tr id="sis"><td>Sistemas Operativos</td><td>2K4</td><td>Ju 18 a 22</td><td><input type="radio" name="op" value="4" checked></td></tr>
    <tr id="pie"><td colspan="4"><input type="submit" value="Inscribirme"></td></tr>
  </table></form>
</td></tr></table></body></html>`;

const LOGIN = `<!doctype html><html><head><title>Sysacad Login</title></head><body bgcolor="#FFFFFF">
<form method="post" action="/validar.asp"><table border="1"><tr><td>Legajo</td><td><input id="u" name="legajo" value=""></td></tr>
<tr><td>Contraseña</td><td><input id="p" type="password" name="pass" value=""></td></tr>
<tr><td colspan="2"><input type="submit" value="Ingresar"></td></tr></table></form></body></html>`;

const LINKS_MENU = ['Calendario Académico', 'Trámites académicos', 'Certificado Regularidad', 'Materias del plan', 'Estado académico', 'Exámenes', 'Cursado / Notas de parciales / Encuestas', 'Correlatividad para cursar', 'Correlatividad para rendir', 'Inscripción a examen', 'Inscripción a cursado', 'Cambio de Contraseña', 'Avisos', 'Salir', 'Novedades'];
const MENU = `<!doctype html><html><head><title>Sysacad</title></head><body><table align="center"><tr><td><font face="Arial">Pérez, Ana<br>Ingeniería en Sistemas de Información<br>Año de ingreso: 2023</font></td></tr>
<tr><td><ul>${LINKS_MENU.map((l, i) => `<li><font face="Arial"><b><a href="${l === 'Inscripción a cursado' ? '/materiasCursado.asp' : `/l${i}.asp`}">${l}</a></b></font></li>`).join('')}</ul></td></tr></table></body></html>`;

const VERIFICACION = '<!doctype html><html><head><title>Verificando tu navegador — SYSACAD</title></head><body><p id="v">Comprobando</p><table><tr><td>x</td></tr></table></body></html>';

// Same shape as the real page, with invented subjects and grades.
const FILAS_ESTADO = [
  ['0', 'Matemática', 'Aprobada en 2023', '2008'],
  ['0', 'Física', 'Aprobada en 2023', '2008'],
  ['1', 'Algoritmos y Estructuras de Datos', 'Aprobada con 10 (5 hs.) Tomo: 111 Folio: 22', '2023'],
  ['1', 'Análisis Matemático I', 'Aprobada con 8 (5 hs.) Tomo: 111 Folio: 23', '2023'],
  ['1', 'Compl.de equiv. de Análisis Matemático I', '', '2023'],
  ['1', 'Física I', 'Aprobada con 7 (5 hs.) Tomo: 112 Folio: 1', '2023'],
  ['2', 'Física II', 'Regular en 2024', '2023'],
  ['2', 'Entornos Gráficos (Elec.)', 'Regular en 2024 (1C)', '2023'],
  ['2', 'Formación de Emprendedores (Elec.)', '', '2023'],
  ['2', 'Programación Competitiva (Elec.)', 'Aprobada con 9 (3 hs.) Tomo: 113 Folio: 4', '2023'],
  ['3', 'Sistemas Operativos', '', '2023'],
  ['3', 'Seminario Integrador', 'Aprobada con 8 (2 hs.) Tomo: 114 Folio: 2', '2023'],
  ['3', 'Redes de Datos', 'Inscripto', '2023'],
];
const ESTADO = `<!doctype html><html><head><title>Estado académico</title><link rel="stylesheet" href="/style.css"></head><body><div id="page-container"><div class="header"><h2 class="titulo">UTN</h2></div><div class="wrapper"><pre></pre>
<table align="center" width="800"><tbody><tr><td class="tituloTabla">Estado académico de Pérez, Ana al 2/11/2026 22:03:03</td></tr>
<tr><td><table id="estado" width="100%"><tbody><tr><td class="tituloTabla">Año</td><td class="tituloTabla">Materia</td><td class="tituloTabla">Estado</td><td class="tituloTabla">Plan</td></tr>
${FILAS_ESTADO.map((f) => `<tr>${f.map((c) => `<td class="textoTabla">${c}</td>`).join('')}</tr>`).join('')}
</tbody></table></td></tr></tbody></table><p class="textoTabla"><a href="/menuAlumno.asp">Volver a menú principal</a></p></div></div></body></html>`;

const EXAMENES = `<!doctype html><html><head><title>Exámenes</title></head><body><div class="wrapper"><table id="ex"><tr id="ex-cab"><th>Fecha</th><th>Materia</th><th>Resultado</th></tr>
${[['10/12/2024', 'Física I', 'Aprobado'], ['02/03/2023', 'Inglés I', 'Aprobado'], ['20/07/2025', 'Redes', 'Ausente'], ['15/02/2024', 'Álgebra', 'Aprobado'], ['01/08/2024', 'Química', 'Ausente'], ['09/09/2023', 'Sistemas', 'Aprobado'], ['05/05/2025', 'Economía', 'Desaprobado']].map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
<tr id="ex-pie"><td colspan="3">Total: 7 exámenes</td></tr>
</table></div></body></html>`;

// A long table inside the page's own form, the case where the search box sits in a form.
const FORMULARIO_LARGO = `<!doctype html><html><head><title>Inscripción</title></head><body><form method="post" action="/guardar.asp"><table id="larga"><tr><td>Materia</td><td>Nota</td><td>Elegir</td></tr>
${[1, 2, 3, 4, 5, 6, 7].map((i) => `<tr id="fila${i}"><td>Materia ${i}</td><td><input type="text" name="nota${i}" value=""></td><td><input type="radio" name="op" value="${i}"></td></tr>`).join('')}
</table><input type="submit" value="Inscribirme"></form></body></html>`;

const real = (archivo) => readFileSync(join(HERE, 'paginas', archivo), 'utf8');

// Sysacad's frame around every page, as in the real copies: its header, the title row, the table and its footer.
const MARCO = (titulo, adentro) => `<!doctype html><html><head><title>${titulo}</title><link rel="stylesheet" href="/style.css"></head><body><div id="page-container">
<div class="header"><a href="/menuAlumno.asp" class="logo"><img src="/utn1.gif"></a><div class="header-right"><h2 class="titulo">Universidad Tecnológica Nacional <br> Facultad Regional Rosario</h2><p class="subtitulo">Sistema de autogestión alumnos</p></div></div>
<div class="wrapper"><pre></pre>
<table border="0" align="center" width="700"><tbody><tr><td class="tituloTabla"><div>${titulo} de Pérez, Ana al 2/11/2026 22:03:03</div></td></tr><tr><td bgcolor="#0000FF"><table width="100%"><tbody><tr><td>
${adentro}
</td></tr></tbody></table></td></tr></tbody></table>
<p class="textoTabla" align="center"><a href="/menuAlumno.asp">Volver a menú principal</a></p></div>
<div class="footer aviso"><font color="red">IMPORTANTE: AL GENERAR EL CERTIFICADO DE CURSADO NO SE PODRÁN ELIMINAR LAS INSCRIPCIONES</font></div></div></body></html>`;

// Materias del plan has not been seen yet: the same frame, with the subjects of the plan by year.
const FILAS_PLAN = [
  ['1', 'Análisis Matemático I', '5', 'Anual', ''],
  ['1', 'Algoritmos y Estructuras de Datos', '5', 'Anual', ''],
  ['1', 'Física I', '5', 'Anual', ''],
  ['2', 'Análisis Matemático II', '5', 'Anual', ''],
  ['2', 'Entornos Gráficos (Elec.)', '3', '1er cuatrimestre', 'Sí'],
  ['3', 'Comunicación de Datos', '4', 'Anual', ''],
];
const PLAN = MARCO('Materias del plan', `<table width="100%" border="1" bgcolor="#FFFFFF"><tbody><tr class="textoTabla"><th>Año</th><th>Materia</th><th>Horas</th><th>Cursado</th><th>Electiva</th></tr>
${FILAS_PLAN.map((f) => `<tr class="textoTabla">${f.map((c) => `<td>${c || '&nbsp;'}</td>`).join('')}</tr>`).join('')}
</tbody></table>`);

// Fields, images and hidden parts on a tab that gets copied: none of it may reach the copy.
const CON_CAMPOS = MARCO('Notas de parciales', `<p>Elegí la comisión<br>y después guardá.</p>
<table border="1"><tr><th>Materia</th><th>Nota</th><th>Elegir</th></tr>
<tr><td>Física I</td><td><input name="nota" value="SECRETO-1"></td><td><select name="op"><option selected>SECRETO-2</option></select></td></tr>
<tr><td>Química</td><td><input type="password" value="SECRETO-3"></td><td><img src="/x.gif" alt="SECRETO-4"></td></tr></table>
<p><textarea>SECRETO-5</textarea>Comentario</p>
<form action="/guardar.asp"><table><tr><td>SECRETO-6</td><td><input name="x"></td></tr><tr><td>a</td><td>b</td></tr></table></form>
<div hidden>SECRETO-7</div><div style="display: none">SECRETO-8</div><script>window.x = 'SECRETO-9';</script><button type="button">SECRETO-10</button>`);

// More than every cap: blocks, columns, rows, characters, control characters and runs of spaces.
const GRANDE = MARCO('Materias del plan', `<h2>${'Título largo '.repeat(30)}</h2>
<p>${'palabra '.repeat(400)}</p>
<p>con\u0007control y\t\tespacios&nbsp;&nbsp;juntos</p>
<table border="1"><tr>${Array.from({ length: 40 }, (_, i) => `<th>Columna ${i}</th>`).join('')}</tr>
${Array.from({ length: 520 }, (_, f) => `<tr>${Array.from({ length: 40 }, (_, c) => `<td>${f === 0 && c === 0 ? 'x'.repeat(400) : `${f}.${c}`}</td>`).join('')}</tr>`).join('')}</table>
${Array.from({ length: 80 }, (_, i) => `<p>Párrafo ${i}</p>`).join('')}`);

// Stands in for El Santo Resumen's map: it asks like the real one and keeps what Sysacad Lindo hands over.
const SANTO = 'https://lutastudios.com';
const SANTO_PAGES = {
  '/utn/materias.html': `<!doctype html><html><head><title>Todas las materias</title></head><body><h1>Todas las materias</h1><script>
window.recibidos = [];
addEventListener('message', (e) => { if (e.source === window && e.data && e.data.fuente === 'sysacad-lindo') window.recibidos.push(e.data); });
postMessage({ fuente: 'santo-resumen', pide: 'sysacad' }, location.origin);
</script></body></html>`,
};

// Stands in for Super CVG: it asks like the real one, keeps every answer, and can ask to link or unlink.
const SUPERCVG = 'https://supercvg.lutastudios.com';
const SUPERCVG_PAGES = {
  '/': `<!doctype html><html><head><title>Super CVG</title></head><body><h1>Super CVG</h1><script>
window.recibidos = [];
addEventListener('message', (e) => { if (e.source === window && e.data && e.data.fuente === 'sysacad-lindo' && e.data.para === 'super-cvg') window.recibidos.push(e.data); });
postMessage({ fuente: 'super-cvg', pide: 'sysacad' }, location.origin);
</script></body></html>`,
};

// An exam ten days from today and next year's enrollment schedule, so "Próximas fechas" always has something ahead.
const FUTURO = new Date();
FUTURO.setDate(FUTURO.getDate() + 10);
const dos = (n) => String(n).padStart(2, '0');
const FUTURO_ISO = `${FUTURO.getFullYear()}-${dos(FUTURO.getMonth() + 1)}-${dos(FUTURO.getDate())}`;
const FUTURO_TEXTO = `${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][FUTURO.getDay()]} ${FUTURO.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][FUTURO.getMonth()]}`;
const PROXIMO = new Date().getFullYear() + 1;

const PAGES = {
  '/loginAlumno.asp': real('login-real.html'),
  '/loginAlumno.asp?futuro': real('login-real.html').replaceAll('/2026 (8hs)', `/${PROXIMO} (8hs)`),
  '/certificadoExamen.asp?futuro': real('certificado-examen-real.html').replace('jueves 10 de diciembre', FUTURO_TEXTO),
  '/notasParciales.asp?id=11111-1': real('notas-real.html'),
  '/examenes.asp?id=2': real('examenes-real.html'),
  '/correlatividadCursado.asp?id=11111-1': real('correlatividad-cursado-real.html'),
  '/correlatividadExamen.asp?id=11111-1': real('correlatividad-examen-real.html'),
  '/menuCertificados.asp?id=11111-1': real('certificados-real.html'),
  '/materiasExamen.asp?id=11111-1': real('inscripcion-examen-materias-real.html'),
  '/materiasExamen.asp?refrescar': real('inscripcion-examen-materias-real.html'),
  '/fechasExamen.asp?plan=2023&materia=406&nombre=Tecnolog%EDas%20para%20la%20Automatizaci%F3n': real('inscripcion-examen-fechas-real.html'),
  '/inscripcionExamen.asp': real('inscripcion-examen-hecha-real.html'),
  '/certificadoExamen.asp': real('certificado-examen-real.html'),
  '/materiasPlan.asp?id=11111-1': PLAN,
  '/notasParciales.asp?id=campos': CON_CAMPOS,
  '/materiasPlan.asp?id=grande': GRANDE,
  '/formulario-largo.asp': FORMULARIO_LARGO,
  '/estadoAcademico.asp?id=11111-1': ESTADO,
  '/examenes.asp?id=11111-1': EXAMENES,
  '/materiasCursado.asp': INSCRIPCION,
  '/login.asp': LOGIN,
  '/principal.asp': MENU,
  '/verificacion.asp': VERIFICACION,
  '/menu.asp?usuario=52': '<!doctype html><html><head><title>Menu</title></head><body><p>Menú</p></body></html>',
  '/menuAlumno.asp': readFileSync(join(HERE, 'paginas', 'menu-real.html'), 'utf8'),
  '/materiasCursado.asp?id=11111-1': readFileSync(join(HERE, 'paginas', 'cursado-cerrado-real.html'), 'utf8'),
  '/style.css': readFileSync(join(HERE, 'paginas', 'style.css'), 'utf8'),
  '/otra.asp': '<!doctype html><html><head><title>Otra</title></head><body><p id="otra">Otra</p></body></html>',
};

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`ok    ${name}`);
  } catch (err) {
    results.push(false);
    console.log(`FALLA ${name}\n      ${err.message.split('\n').slice(0, 6).join('\n      ')}`);
  }
}

const staticCheck = () => {
  const source = ['contenido.js', 'inicio.js'].map((f) => readFileSync(join(EXT, f), 'utf8')).join('\n').replace(/^\s*\/\/.*$/gm, '');
  const forbidden = [/setTimeout/, /setInterval/, /requestAnimationFrame/, /requestIdleCallback/, /\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /\.submit\s*\(/, /requestSubmit/, /\.click\s*\(/, /dispatchEvent/, /chrome\.alarms/, /\.value\s*=[^=]/, /localStorage/];
  for (const pattern of forbidden) assert.ok(!pattern.test(source), `contenido.js contains ${pattern}`);
  const manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.host_permissions, undefined);
};

await check('source has no timers, network calls or form submits, and only the storage permission', staticCheck);

const profile = mkdtempSync(join(tmpdir(), 'sl-e2e-'));
const context = await chromium.launchPersistentContext(profile, {
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

const requests = [];
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === 'chrome-extension:') return route.continue();
  const body = url.origin === ORIGIN ? PAGES[url.pathname + url.search] : url.origin === SANTO ? SANTO_PAGES[url.pathname] : url.origin === SUPERCVG ? SUPERCVG_PAGES[url.pathname] : undefined;
  if (body === undefined) return route.abort();
  requests.push({ path: url.pathname + url.search, method: route.request().method() });
  return route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8', body });
});

const page = await context.newPage();
const open = async (path) => {
  await page.goto(ORIGIN + path);
};
const panel = page.locator('#sysacad-lindo');
// Presses a download link like the student and gives back the rows of the CSV, after checking how Excel will read it.
const descargar = async (enlace) => {
  const [archivo] = await Promise.all([page.waitForEvent('download'), enlace.click()]);
  const texto = readFileSync(await archivo.path(), 'utf8');
  assert.ok(texto.startsWith('﻿'), 'a byte order mark, so Excel reads the accents');
  return { nombre: archivo.suggestedFilename(), filas: texto.slice(1).trimEnd().split('\r\n').map((l) => l.split(';')) };
};
const addSubject = async (name, commission = '') => {
  await panel.getByRole('button', { name: /Agregar materia|Mostrar panel/ }).first().waitFor();
  const toggle = panel.getByRole('button', { name: 'Agregar materia' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const form = panel.locator('form').first();
  await form.getByLabel('Materia').fill(name);
  await form.getByLabel('Comisión').fill(commission);
  await panel.getByRole('button', { name: 'Guardar materia' }).click();
};
const rowClass = (id) => page.locator(`#${id}`).getAttribute('class');
// The element's center must match the window's center, within one pixel.
const assertCentered = async (locator, label) => {
  const box = await locator.boundingBox();
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  assert.ok(Math.abs(box.x + box.width / 2 - width / 2) <= 1, `${label} is off center: x=${box.x} w=${box.width} of ${width}`);
};
// Resolves any CSS color, color-mix included, to its sRGB channels.
const aRgb = (color) => page.evaluate((c) => {
  const lienzo = document.createElement('canvas').getContext('2d');
  lienzo.fillStyle = c;
  lienzo.fillRect(0, 0, 1, 1);
  return [...lienzo.getImageData(0, 0, 1, 1).data].slice(0, 3);
}, color);
const assertRgb = (real, esperado, label) => {
  assert.ok(real.every((c, i) => Math.abs(c - esperado[i]) <= 2), `${label}: ${real} instead of ${esperado}`);
};
const assertNoSidewaysScroll = async () => {
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(scroll <= client, `page scrolls sideways: ${scroll} > ${client}`);
};

try {
  await check('browser check page stays untouched', async () => {
    await open('/verificacion.asp');
    await page.waitForLoadState('load');
    assert.equal(await panel.count(), 0);
    assert.ok(!(await page.locator('html').getAttribute('class'))?.includes('sl-activo'));
    assert.equal(await page.locator('html').getAttribute('data-sl-tema'), null);
    assert.equal(await page.locator('html').getAttribute('style'), null);
    assert.equal(await page.locator('html').getAttribute('class'), null);
    assert.equal(await page.locator('.sl-fondo').count(), 0);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    assert.ok(!font.includes('Lindo'), font);
  });

  await check('login page has no panel, a prominent button, and its fields stay empty', async () => {
    await open('/login.asp');
    await page.locator('.sl-ingresar').waitFor();
    assert.equal(await panel.count(), 0);
    assert.equal(await page.locator('#u').inputValue(), '');
    assert.equal(await page.locator('#p').inputValue(), '');
    assert.match(await page.locator('input[type="submit"]').getAttribute('class'), /sl-ingresar/);
    await page.waitForTimeout(500);
    assert.ok(requests.every((r) => r.method === 'GET'), 'the login form is never sent by itself');
    await assertCentered(page.locator('form.sl-login'), 'login form');
    await page.screenshot({ path: join(SHOTS, 'login.png') });
  });

  await check('real menu page: every link survives and the frame is gone', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    const links = await page.locator('.sl-menu a').evaluateAll((all) => all.map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('target')]));
    assert.equal(links.length, 14);
    const byName = Object.fromEntries(links.map(([name, href, target]) => [name, { href, target }]));
    assert.equal(byName['Inscripción a cursado'].href, `${ORIGIN}/materiasCursado.asp?id=11111-1`);
    assert.equal(byName['Calendario Académico'].target, '_blank');
    assert.equal(await page.locator('.sl-grupo-principal a').first().textContent(), 'Inscripción a cursado');
    assert.equal(await page.locator('.sl-alumno h1').textContent(), 'Hola, Ana');
    assert.ok(await page.locator('.sl-alumno').getByText('Año de ingreso: 2023').isVisible());
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.fonts.check('600 40px "Lindo Serif"') && document.fonts.check('italic 400 17px "Lindo Serif"') && document.fonts.check('400 16px "Lindo Sans"')), 'bundled font loads');
    await assertNoSidewaysScroll();
    assert.ok(!(await page.locator('.header').isVisible()));
    assert.ok(await page.locator('.footer.aviso').isVisible());
    assert.equal(await page.locator('td.tituloTabla').count(), 0);
    assert.equal(await page.locator('body ul').count(), 0);
    await assertCentered(page.locator('.sl-menu'), 'menu');
    await page.screenshot({ path: join(SHOTS, 'real-menu.png') });
    await page.setViewportSize({ width: 1618, height: 1023 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(SHOTS, 'menu-grande.png') });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await assertCentered(page.locator('.sl-menu'), 'menu on a wide window');
    await page.setViewportSize({ width: 768, height: 900 });
    await assertNoSidewaysScroll();
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'menu-angosto.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('dark mode: the switch changes the theme and survives a reload', async () => {
    await open('/menuAlumno.asp');
    const tema = () => page.locator('html').getAttribute('data-sl-tema');
    const fondo = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    assert.equal(await tema(), 'claro');
    const claro = await fondo();
    await page.getByRole('button', { name: 'Modo oscuro' }).click();
    await page.locator('html[data-sl-tema="oscuro"]').waitFor({ state: 'attached' });
    assert.notEqual(await fondo(), claro);
    assert.equal(await page.getByRole('button', { name: 'Modo oscuro' }).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(SHOTS, 'oscuro-menu.png') });
    await open('/materiasCursado.asp?id=11111-1');
    assert.equal(await tema(), 'oscuro');
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    await page.screenshot({ path: join(SHOTS, 'oscuro-cursado.png') });
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(SHOTS, 'oscuro-estado.png'), fullPage: true });
    await panel.getByRole('button', { name: 'Modo oscuro' }).click();
    await page.locator('html[data-sl-tema="claro"]').waitFor({ state: 'attached' });
    await panel.getByRole('button', { name: 'Modo oscuro' }).waitFor();
  });

  const dialogo = page.getByRole('dialog', { name: 'Ajustes' });
  const abrirAjustes = async () => {
    await page.getByRole('button', { name: 'Ajustes' }).first().click();
    await dialogo.waitFor();
  };
  const cerrarAjustes = async () => {
    await dialogo.getByRole('button', { name: 'Listo' }).click();
    await dialogo.waitFor({ state: 'detached' });
  };
  const elegir = async (nombre) => {
    await abrirAjustes();
    await dialogo.getByRole('radio', { name: nombre }).check();
    await cerrarAjustes();
  };
  const restablecer = async () => {
    await abrirAjustes();
    await dialogo.getByRole('button', { name: 'Volver a lo original' }).click();
    await cerrarAjustes();
    await page.locator('html:not([data-sl-plantilla])').waitFor({ state: 'attached' });
  };
  const atributo = (nombre) => page.locator('html').getAttribute(nombre);

  await check('settings: each one applies live, survives a reload, and resets', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await abrirAjustes();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, 'ajustes.png') });
    await dialogo.getByRole('radio', { name: /Analítico/ }).check();
    await page.locator('html[data-sl-plantilla="analitico"]').waitFor({ state: 'attached' });
    await dialogo.getByRole('radio', { name: 'Grande', exact: true }).check();
    await page.locator('html[data-sl-letra="grande"]').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '18px', 'the letter size scales the root');
    await dialogo.getByRole('radio', { name: 'Rojo y verde' }).check();
    await page.locator('html[data-sl-vision="rojo-verde"]').waitFor({ state: 'attached' });
    await dialogo.getByRole('radio', { name: 'Bordó' }).check();
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--sl-base') === '#6d1f2f');
    await dialogo.getByRole('radio', { name: 'Celeste' }).check();
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--sl-marca') === '#5bb4dc');
    await dialogo.getByRole('checkbox', { name: /Alto contraste/ }).check();
    await page.locator('html[data-sl-contraste="si"]').waitFor({ state: 'attached' });
    assert.ok(await dialogo.getByRole('radio', { name: 'Bordó' }).isDisabled(), 'high contrast locks the colors');
    await dialogo.getByRole('checkbox', { name: /Bajo movimiento/ }).check();
    await page.locator('html[data-sl-movimiento="bajo"]').waitFor({ state: 'attached' });
    await page.keyboard.press('Escape');
    await dialogo.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.classList.contains('sl-abrir-ajustes'), null, { timeout: 2000 });
    await page.reload();
    await page.locator('.sl-menu').waitFor();
    await page.locator('html[data-sl-plantilla="analitico"][data-sl-contraste="si"][data-sl-movimiento="bajo"]').waitFor({ state: 'attached' });
    await restablecer();
    for (const nombre of ['data-sl-letra', 'data-sl-vision', 'data-sl-contraste', 'data-sl-movimiento']) {
      assert.equal(await atributo(nombre), null, `${nombre} is cleared`);
    }
    assert.ok(!(await atributo('style')), 'the inline colors are cleared');
  });

  await check('settings open from every kind of page and never touch a form', async () => {
    await open('/login.asp');
    await page.locator('.sl-ingresar').waitFor();
    await abrirAjustes();
    await cerrarAjustes();
    assert.equal(await page.locator('#u').inputValue(), '');
    await open('/materiasCursado.asp');
    await panel.getByRole('button', { name: 'Ajustes' }).waitFor();
    await page.locator('#sis input').waitFor({ state: 'attached' });
    assert.ok(await page.locator('#sis input').isChecked());
    await abrirAjustes();
    await dialogo.getByRole('radio', { name: /Tablero/ }).check();
    assert.ok(await page.locator('#sis input').isChecked(), 'the page keeps its checked option');
    await cerrarAjustes();
    assert.ok(requests.every((r) => r.method === 'GET'), 'changing settings sends nothing');
    await page.waitForFunction(() => document.querySelector('#sysacad-lindo').shadowRoot.activeElement?.classList.contains('abrir-ajustes'), null, { timeout: 2000 });
    await restablecer();
  });

  await check('every template renders the three page kinds without sideways scroll', async () => {
    mkdirSync(join(SHOTS, 'plantillas'), { recursive: true });
    const vistas = [['menu', '/menuAlumno.asp', '.sl-menu'], ['estado', '/estadoAcademico.asp?id=11111-1', '.sl-tablero'], ['cursado', '/materiasCursado.asp', '#lista'], ['login', '/login.asp', '.sl-ingresar']];
    for (const [plantilla, etiqueta] of [['claustro', /Claustro/], ['analitico', /Analítico/], ['tablero', /Tablero/]]) {
      await open('/menuAlumno.asp');
      await page.locator('.sl-menu').waitFor();
      await elegir(etiqueta);
      if (plantilla !== 'claustro') await page.locator(`html[data-sl-plantilla="${plantilla}"]`).waitFor({ state: 'attached' });
      for (const [vista, ruta, marca] of vistas) {
        await open(ruta);
        await page.locator(marca).first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        for (const [ancho, alto] of [[1280, 800], [820, 900], [390, 800]]) {
          await page.setViewportSize({ width: ancho, height: alto });
          await assertNoSidewaysScroll();
        }
        await page.setViewportSize({ width: 390, height: 800 });
        await page.screenshot({ path: join(SHOTS, 'plantillas', `${plantilla}-${vista}-390.png`), fullPage: true });
        await page.setViewportSize({ width: 1440, height: 900 });
        await assertNoSidewaysScroll();
        await page.screenshot({ path: join(SHOTS, 'plantillas', `${plantilla}-${vista}.png`), fullPage: true });
      }
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await restablecer();
  });

  await check('the biggest letter size keeps every page usable on a phone', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await elegir('Muy grande');
    await page.locator('html[data-sl-letra="enorme"]').waitFor({ state: 'attached' });
    for (const [ruta, marca] of [['/menuAlumno.asp', '.sl-menu'], ['/estadoAcademico.asp?id=11111-1', '.sl-tablero'], ['/materiasCursado.asp', '#lista']]) {
      await open(ruta);
      await page.locator(marca).first().waitFor();
      await page.setViewportSize({ width: 390, height: 800 });
      await assertNoSidewaysScroll();
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await page.setViewportSize({ width: 390, height: 800 });
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    await page.screenshot({ path: join(SHOTS, 'letra-enorme-390.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
    await restablecer();
  });

  await check('text keeps 4.5:1 contrast in every mode and preset color', async () => {
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    const fallas = await page.evaluate(() => {
      const raiz = document.documentElement;
      const sonda = document.createElement('i');
      document.body.append(sonda);
      const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const canales = (token) => {
        sonda.style.color = `var(${token})`;
        lienzo.clearRect(0, 0, 1, 1);
        lienzo.fillStyle = getComputedStyle(sonda).color;
        lienzo.fillRect(0, 0, 1, 1);
        return [...lienzo.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const razon = (a, b) => {
        const [x, y] = [lum(canales(a)), lum(canales(b))].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
      };
      const pares = [
        ['--sl-texto', '--sl-fondo'], ['--sl-texto', '--sl-superficie'], ['--sl-texto-2', '--sl-fondo'], ['--sl-texto-2', '--sl-superficie'], ['--sl-texto-2', '--sl-superficie-2'],
        ['--sl-acento', '--sl-superficie'], ['--sl-acento', '--sl-fondo'], ['--sl-sobre-acento', '--sl-acento'], ['--sl-sobre-banda', '--sl-banda'], ['--sl-sobre-oro', '--sl-oro'],
        ['--sl-sobre-mia-fila', '--sl-mia-fila'], ['--sl-sobre-mia-fila', '--sl-mia-suave'], ['--sl-ok', '--sl-superficie'], ['--sl-regular', '--sl-superficie'], ['--sl-error', '--sl-superficie'], ['--sl-ok', '--sl-fondo'], ['--sl-regular', '--sl-fondo'], ['--sl-error', '--sl-fondo'],
      ];
      const salida = [];
      const colores = ['#1c3a5e', '#6d1f2f', '#1f4d3a', '#0f4c5c', '#4a2a6b', '#2f3640'];
      const marcas = ['#d9b13b', '#5bb4dc', '#e58fb1', '#6cc08b'];
      for (const tema of ['claro', 'oscuro']) for (const contraste of [false, true]) for (const vision of [null, 'rojo-verde', 'azul-amarillo']) for (const plantilla of ['claustro', 'analitico', 'tablero']) for (const color of colores) for (const marca of marcas) {
        raiz.dataset.slTema = tema;
        raiz.dataset.slPlantilla = plantilla;
        if (contraste) raiz.dataset.slContraste = 'si'; else delete raiz.dataset.slContraste;
        if (vision) raiz.dataset.slVision = vision; else delete raiz.dataset.slVision;
        raiz.style.setProperty('--sl-base', color);
        raiz.style.setProperty('--sl-marca', marca);
        for (const [a, b] of pares) {
          const r = razon(a, b);
          if (r < 4.5) salida.push(`${tema} contraste=${contraste} vision=${vision} ${plantilla} ${color} ${marca}: ${a} on ${b} = ${r.toFixed(2)}`);
        }
      }
      sonda.remove();
      return salida;
    });
    assert.equal(fallas.length, 0, `${fallas.length} low-contrast pairs, first: ${fallas.slice(0, 5).join(' | ')}`);
  });

  await check('the airplane flies the banner, never takes a click, and shares the switches', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    const cartel = page.locator('.sl-cartel');
    assert.equal(await cartel.textContent(), 'Hay un solo camino... Y ES LA GUERRA!');
    assert.equal(await page.locator('.sl-cielo').evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    assert.equal(await page.locator('.sl-cielo').getAttribute('aria-hidden'), 'true');
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        if (a.animationName !== 'sl-vuelo') continue;
        a.pause();
        a.currentTime = 15000 + 120000 * 0.08;
      }
    });
    const caja = await cartel.boundingBox();
    assert.ok(caja.x > 0 && caja.x + caja.width < 1440, `the banner crosses the window: x=${caja.x}`);
    await page.screenshot({ path: join(SHOTS, 'avion.png') });
    await assertNoSidewaysScroll();
    // A click under the banner lands on the page.
    const encima = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.sl-cielo') !== null, [caja.x + 20, caja.y + 10]);
    assert.equal(encima, false, 'clicks pass through');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.sl-cielo').evaluate((el) => getComputedStyle(el).display), 'none', 'low motion removes it');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await abrirAjustes();
    await dialogo.getByRole('checkbox', { name: /Fondo con frases/ }).uncheck();
    await page.locator('html[data-sl-fondo="no"]').waitFor({ state: 'attached' });
    await cerrarAjustes();
    assert.equal(await page.locator('.sl-cielo').evaluate((el) => getComputedStyle(el).display), 'none', 'the background switch removes it');
    await restablecer();
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('background notes: one at a time, never clickable, gone in low motion', async () => {
    await page.setViewportSize({ width: 1618, height: 1023 });
    await open('/materiasCursado.asp?id=11111-1');
    await page.locator('.sl-fondo').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.sl-fondo').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.sl-fondo').evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
    assert.ok(await page.locator('.sl-frase', { hasText: 'Otra vez se cayó esta mierda' }).count());
    const animadas = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'sl-frase').length);
    assert.equal(animadas, 12, 'every note animates through CSS');
    // Moves the clock to when note 0 and note 1 are on stage, the busiest moment.
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        if (a.animationName !== 'sl-frase') continue;
        a.pause();
        a.currentTime = 10500;
      }
    });
    const visibles = await page.locator('.sl-frase').evaluateAll((all) => all.filter((el) => Number(getComputedStyle(el).opacity) > 0.05).length);
    assert.ok(visibles >= 1 && visibles <= 3, `${visibles} notes on stage at once`);
    await page.screenshot({ path: join(SHOTS, 'fondo-frases.png') });
    const caja = await page.locator('.sl-frase').first().boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= 1618, 'a note stays inside the window');
    await assertNoSidewaysScroll();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(!(await page.locator('.sl-fondo').isVisible()), 'the system low motion setting removes it');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await abrirAjustes();
    await dialogo.getByRole('checkbox', { name: /Bajo movimiento/ }).check();
    await page.locator('html[data-sl-movimiento="bajo"]').waitFor({ state: 'attached' });
    await cerrarAjustes();
    assert.equal(await page.locator('.sl-fondo').evaluate((el) => getComputedStyle(el).display), 'none', 'the low motion setting removes it');
    await abrirAjustes();
    await dialogo.getByRole('checkbox', { name: /Bajo movimiento/ }).uncheck();
    await dialogo.getByRole('checkbox', { name: /Fondo con frases/ }).uncheck();
    await page.locator('html[data-sl-fondo="no"]').waitFor({ state: 'attached' });
    await cerrarAjustes();
    assert.equal(await page.locator('.sl-fondo').evaluate((el) => getComputedStyle(el).display), 'none', 'its own switch removes it');
    await restablecer();
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('academic record: summary, sections by year and filters', async () => {
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    assert.ok(!(await page.locator('#estado').isVisible()), 'the raw table is replaced');
    assert.equal(await page.locator('.sl-promedio strong').textContent(), '8,40', 'average of 10, 8, 7, the elective 9 and Seminario Integrador 8');
    assert.ok(await page.getByText('5 de 8 materias aprobadas').isVisible(), 'electives and Seminario Integrador never count for progress, approved or not');
    assert.equal(await page.locator('.sl-anio', { hasText: 'Año 2' }).locator('.sl-anio-cabeza > span').textContent(), '0 de 1 aprobadas', 'the approved elective is not in its year either');
    assert.equal(await page.locator('.sl-electivas').textContent(), 'Las electivas van aparte y suman 3 hs. Tenés 2 aprobadas y 1 regular. Para recibirte necesitás 20 hs y te faltan 17.', 'Seminario Integrador is an elective without elective hours');
    assert.equal(await page.locator('.sl-anio', { hasText: 'Año 3' }).locator('.sl-anio-cabeza > span').textContent(), '0 de 2 aprobadas', 'Seminario Integrador is not in its year');
    assert.deepEqual(await page.locator('.sl-anio', { hasText: 'Año 3' }).locator('.sl-materia-nombre').allTextContents(), ['Sistemas Operativos', 'Redes de Datos', 'Seminario Integrador'], 'the subjects of the plan first, then the electives');
    assert.deepEqual(await page.locator('.sl-anio', { hasText: 'Año 2' }).locator('.sl-materia-nombre').allTextContents(), ['Física II', 'Entornos Gráficos (Elec.)', 'Formación de Emprendedores (Elec.)', 'Programación Competitiva (Elec.)']);
    assert.deepEqual(await page.locator('.sl-anio h2').allTextContents(), ['Ingreso', 'Año 1', 'Año 2', 'Año 3']);
    assert.ok(await page.getByText('Datos al 2/11/2026 22:03:03').isVisible());
    const fila = page.locator('tr.sl-materia', { hasText: 'Algoritmos' });
    assert.equal(await fila.locator('.sl-nota').textContent(), '10');
    assert.equal(await fila.locator('.sl-col-registro').textContent(), 'Tomo 111, folio 22');
    assert.equal(await fila.locator('.sl-col-hs').textContent(), '5 hs');
    assert.equal(await page.locator('tr.sl-materia', { hasText: 'Redes de Datos' }).locator('.sl-col-estado').textContent(), 'Inscripto', 'an unknown state keeps its original text');
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(SHOTS, 'estado.png'), fullPage: true });
    const izquierdaMarca = await page.locator('#sysacad-lindo').evaluate((host) => host.shadowRoot.querySelector('.marca').getBoundingClientRect().left);
    const izquierdaTablero = await page.locator('.sl-tablero').evaluate((t) => t.getBoundingClientRect().left);
    assert.equal(izquierdaMarca, izquierdaTablero, 'the header lines up with the page content');

    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Año 1' }).click();
    assert.deepEqual(await page.locator('.sl-anio:visible h2').allTextContents(), ['Año 1']);
    await page.getByRole('group', { name: 'Filtrar por estado' }).getByRole('button', { name: /Sin cursar/ }).click();
    assert.equal(await page.locator('tr.sl-materia:visible').count(), 0, 'a complement not taken does not count, like in the summary');
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Año 3' }).click();
    assert.deepEqual(await page.locator('tr.sl-materia:visible .sl-materia-nombre').allTextContents(), ['Sistemas Operativos']);
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Todos' }).click();
    await page.getByRole('group', { name: 'Filtrar por estado' }).getByRole('button', { name: 'Todas' }).click();
    await page.getByRole('searchbox', { name: 'Buscar materia' }).fill('fisica');
    assert.equal(await page.locator('tr.sl-materia:visible').count(), 3, 'search ignores accents');
    await page.getByRole('searchbox', { name: 'Buscar materia' }).fill('zzz');
    assert.ok(await page.getByText('Ninguna materia coincide').isVisible());
    await assertNoSidewaysScroll();
    await page.getByRole('searchbox', { name: 'Buscar materia' }).fill('');
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'estado-angosto.png') });
    await page.setViewportSize({ width: 1280, height: 800 });

    const { nombre, filas } = await descargar(page.getByRole('link', { name: 'Descargar en Excel' }));
    assert.match(nombre, /^estado-academico-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.deepEqual(filas[0], ['Año', 'Materia', 'Tipo', 'Estado', 'Cuándo', 'Nota', 'Horas', 'Registro']);
    assert.equal(filas.length, 1 + await page.locator('tr.sl-materia').count(), 'every subject, filtered or not');
    const algoritmos = filas.find((f) => f[1].startsWith('Algoritmos'));
    assert.deepEqual([algoritmos[2], algoritmos[3], algoritmos[5], algoritmos[6], algoritmos[7]], ['Obligatoria', 'Aprobada', '10', '5', 'Tomo 111, folio 22']);
    assert.equal(filas.find((f) => f[1] === 'Redes de Datos')[3], 'Inscripto');
  });

  await check('academic record: each state shows the same number in the summary and in its filter, electives apart', async () => {
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    const estado = page.getByRole('group', { name: 'Filtrar por estado' });
    const chip = (nombre) => estado.getByRole('button', { name: new RegExp(`^${nombre}`) });
    const cuenta = async (nombre) => Number(await chip(nombre).locator('small').textContent());
    const enLeyenda = async (palabra) => Number(await page.locator('.sl-leyenda > span', { hasText: palabra }).locator('b').textContent());
    const aprobadas = Number((await page.locator('.sl-avance-titulo').textContent()).match(/^(\d+) de /)[1]);
    assert.equal(await cuenta('Aprobadas'), aprobadas, 'the approved elective is not in either');
    assert.equal(await enLeyenda('regular'), 1);
    assert.equal(await cuenta('Regulares'), 1, 'the regular elective is counted apart, in the filter too');
    assert.equal(await cuenta('Sin cursar'), await enLeyenda('sin cursar'));
    assert.match(await page.locator('.sl-electivas').textContent(), /Tenés 2 aprobadas y 1 regular/);
    assert.equal(await cuenta('Electivas'), 4);
    const visibles = () => page.locator('tr.sl-materia:visible .sl-materia-nombre').allTextContents();
    for (const nombre of ['Aprobadas', 'Regulares', 'Sin cursar', 'Electivas']) {
      await chip(nombre).click();
      assert.equal((await visibles()).length, await cuenta(nombre), `${nombre} lists what it counts`);
    }
    assert.deepEqual(await visibles(), ['Entornos Gráficos (Elec.)', 'Formación de Emprendedores (Elec.)', 'Programación Competitiva (Elec.)', 'Seminario Integrador']);
    await chip('Regulares').click();
    assert.deepEqual(await visibles(), ['Física II']);
    for (const ancho of [1280, 390]) {
      await page.setViewportSize({ width: ancho, height: ancho > 800 ? 800 : 1100 });
      await page.locator('.sl-tablero').evaluate((t) => scrollTo(0, t.getBoundingClientRect().top + scrollY - 76));
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(SHOTS, `estado-regulares-${ancho}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await estado.getByRole('button', { name: 'Todas' }).click();
  });

  await check('a redraw keeps the keyboard focus, and Escape returns it to the button', async () => {
    await open('/materiasCursado.asp');
    await addSubject('Física II');
    await panel.getByRole('button', { name: 'Quitar Física II' }).waitFor();
    await open('/materiasCursado.asp');
    const solo = panel.getByLabel('Mostrar solo mis materias');
    await solo.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    assert.equal(await panel.getByLabel('Mostrar solo mis materias').evaluate((el) => el === el.getRootNode().activeElement), true, 'focus stays on the checkbox');
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await panel.getByRole('button', { name: 'Agregar materia' }).click();
    await panel.locator('form').waitFor();
    await page.keyboard.press('Escape');
    await panel.locator('form').waitFor({ state: 'detached' });
    assert.equal(await panel.getByRole('button', { name: 'Agregar materia' }).evaluate((el) => el === el.getRootNode().activeElement), true, 'focus is back on the button');
    await panel.getByRole('button', { name: 'Quitar Física II' }).click();
    await panel.getByRole('button', { name: 'Quitar Física II' }).waitFor({ state: 'detached' });
  });

  await check('long tables get search, filters and sorting', async () => {
    await open('/examenes.asp?id=11111-1');
    await page.locator('.sl-filtros').waitFor();
    await page.getByRole('group', { name: 'Filtrar por Resultado' }).getByRole('button', { name: 'Ausente' }).click();
    assert.equal(await page.locator('#ex tr:visible').count(), 4, 'header, 2 rows and the footer');
    await page.getByRole('group', { name: 'Filtrar por Resultado' }).getByRole('button', { name: /todos/ }).click();
    await page.getByRole('button', { name: 'Fecha' }).click();
    assert.equal(await page.locator('#ex tr').nth(1).locator('td').first().textContent(), '02/03/2023', 'dates sort as dates');
    await page.getByRole('button', { name: 'Fecha' }).click();
    assert.equal(await page.locator('#ex tr').nth(1).locator('td').first().textContent(), '20/07/2025');
    assert.equal(await page.locator('#ex tr').last().getAttribute('id'), 'ex-pie', 'a footer row stays last after sorting');
    await page.screenshot({ path: join(SHOTS, 'tabla-generica.png') });
  });

  await check('a search box inside the page form never submits it, and filled rows stay', async () => {
    await open('/formulario-largo.asp');
    const buscar = page.getByRole('searchbox', { name: 'Buscar en esta tabla' });
    await buscar.waitFor();
    assert.ok(await page.locator('form input.sl-buscar').count(), 'the fixture puts the box inside the form');
    await page.locator('#fila3 input[type="text"]').fill('algo escrito');
    await page.locator('#fila5 input[type="radio"]').check();
    await buscar.fill('Materia 1');
    await buscar.press('Enter');
    await page.waitForTimeout(300);
    assert.ok(requests.every((r) => r.method === 'GET'), 'Enter sends nothing');
    assert.ok(page.url().endsWith('/formulario-largo.asp'), 'the page stays');
    assert.ok(await page.locator('#fila1').isVisible());
    assert.ok(!(await page.locator('#fila2').isVisible()), 'other rows are filtered out');
    assert.ok(await page.locator('#fila3').isVisible(), 'a row with typed text stays visible');
    assert.ok(await page.locator('#fila5').isVisible(), 'a row with a checked option stays visible');
  });

  await check('real login: the form works as a card and the schedule points at your turn', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await open('/loginAlumno.asp');
    await page.locator('.sl-ingresar').waitFor();
    assert.equal(await page.locator('input[name="legajo"]').inputValue(), '');
    assert.equal(await page.locator('input[name="password"]').inputValue(), '');
    assert.ok(!(await page.getByText('Inicio de Sesión').isVisible()), 'the old title gives way to the brand');
    await page.locator('p.sl-tu-turno', { hasText: 'Año de Ingreso 2023' }).waitFor();
    assert.equal(await page.locator('p.sl-tu-turno').count(), 1);
    await assertNoSidewaysScroll();
    await page.waitForTimeout(500);
    assert.ok(requests.every((r) => r.method === 'GET'), 'the login form is never sent by itself');
    await page.screenshot({ path: join(SHOTS, 'real-login.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    const banda = await page.evaluate(() => [document.documentElement.scrollHeight, getComputedStyle(document.documentElement).height]);
    assert.ok(Math.abs(parseFloat(banda[1]) - banda[0]) < 1, 'the root grows with the page, so the band does not tile again');
    await page.screenshot({ path: join(SHOTS, 'real-login-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real exams: title without the student name, and grades in words sort as numbers', async () => {
    await open('/examenes.asp?id=2');
    await page.getByRole('button', { name: 'Nota', exact: true }).waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Exámenes');
    assert.ok(await page.getByText('Datos al 2/11/2026 22:03:03').isVisible());
    assert.ok(!(await page.getByText('Pérez').isVisible()), 'the row with the name is gone');
    const notaAlto = () => page.locator('tr.textoTabla', { hasText: '10' }).first().isVisible();
    assert.equal(await page.locator('table.sl-datos').getByText(/^(cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|Ausen\.)$/).count(), 0, 'grades as numbers, absences in full');
    assert.ok(await page.locator('table.sl-datos td', { hasText: /^Ausente$/ }).first().isVisible());
    assert.ok(await notaAlto());
    await page.getByRole('button', { name: 'Nota', exact: true }).click();
    await page.getByRole('button', { name: 'Nota', exact: true }).click();
    const primera = await page.locator('table.sl-datos tr').nth(1).locator('td').nth(2).textContent();
    assert.equal(primera.trim(), '10', 'descending order starts at the top grade');
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examenes.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examenes-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real exams: the history adds up the table, by year, period and grade, and downloads it', async () => {
    await open('/examenes.asp?id=2');
    await page.locator('.sl-historial').waitFor();
    // The same numbers, worked out here from the raw rows.
    const filas = (await page.locator('table.sl-datos tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.trim())))).filter((f) => /^\d{2}\/\d{2}\/\d{4}$/.test(f[0]));
    const notas = filas.map((f) => (/^\d+$/.test(f[2]) ? Number(f[2]) : -1)).filter((n) => n >= 0);
    assert.equal(notas.length + filas.filter((f) => f[2] === 'Ausente').length, filas.length, 'every grade a number or an absence');
    const aprobadas = notas.filter((n) => n >= 6);
    const media = (l) => (l.reduce((a, b) => a + b, 0) / l.length).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    assert.ok(aprobadas.length < notas.length, 'the page has fails, so both averages show');
    assert.deepEqual(await page.locator('.sl-historial .sl-promedio strong').allTextContents(), [media(aprobadas), media(notas)]);
    assert.equal(await page.locator('.sl-historial .sl-avance-titulo').textContent(), `${aprobadas.length} de ${filas.length} exámenes aprobados`);
    assert.equal(await page.locator('.sl-g-nota').count(), aprobadas.length, 'a dot per passed final');
    assert.deepEqual(await page.locator('.sl-anio h2').allTextContents(), ['Tu promedio en el tiempo', 'Año por año', 'Por turno', 'Tus notas', 'Las que más vueltas te dieron']);
    const anios = await page.locator('.sl-anio', { hasText: 'Año por año' }).locator('tbody th').allTextContents();
    assert.deepEqual(anios, [...new Set(filas.map((f) => f[0].slice(-4)))].sort());
    const algebra = filas.filter((f) => f[1] === 'Álgebra y Geometría Analítica').length;
    assert.equal(await page.locator('.sl-intentos li', { hasText: 'Álgebra y Geometría Analítica' }).locator('span').textContent().then((t) => t.split(':')[0]), `${algebra} veces`, 'every try of a subject');
    assert.equal(await page.locator('.sl-reparto li').first().locator('.sl-reparto-nota').textContent(), '10');
    assert.ok(await page.locator('table.sl-datos').isVisible(), 'the table stays below');

    const { nombre, filas: csv } = await descargar(page.getByRole('link', { name: 'Descargar en Excel' }));
    assert.match(nombre, /^examenes-\d{4}-\d{2}-\d{2}\.csv$/);
    assert.deepEqual(csv[0], ['Fecha', 'Materia', 'Nota', 'Resultado', 'Plan', 'Código']);
    assert.equal(csv.length, filas.length + 1);
    assert.deepEqual(csv[1], ['01/01/2021', 'Algoritmos y Estructuras de Datos', '8', 'Aprobado', '2023', '106'], 'oldest first, grade as a number');
    assert.ok(csv.some((f) => f[3] === 'Ausente' && f[2] === ''));
    assert.ok(csv.some((f) => f[3] === 'Aplazo' && f[2] === '5'));

    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examenes-historial.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examenes-historial-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real midterm grades: eight columns keep every value and fit a phone', async () => {
    await open('/notasParciales.asp?id=11111-1');
    await page.locator('table.sl-datos').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Notas de parciales');
    assert.ok(await page.getByRole('link', { name: 'Comunicación de Datos' }).isVisible(), 'the subject links survive');
    assert.ok(await page.getByRole('cell', { name: 'Par. 1: 7 (siete)' }).isVisible());
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-notas.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    assert.ok(await page.getByRole('cell', { name: 'Par. 1: 7 (siete)' }).isVisible(), 'the grade shows on a phone');
    await page.screenshot({ path: join(SHOTS, 'real-notas-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real prerequisites to enroll: by year, with a missing title rebuilt from the page', async () => {
    await open('/correlatividadCursado.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Correlatividades para cursar', 'this page ships a broken title');
    assert.ok(!(await page.getByText('Pérez').isVisible()));
    const pueden = (real('correlatividad-cursado-real.html').match(/Puede cursar/g) ?? []).length;
    assert.equal(await page.locator('.sl-promedio strong').textContent(), String(pueden));
    assert.deepEqual(await page.locator('.sl-lista .sl-anio h2').allTextContents(), ['Año 1', 'Año 2', 'Año 3', 'Año 4', 'Año 5']);
    assert.ok(await page.getByText('Lo que más te frena').isVisible());
    assert.match(await page.locator('.sl-frenos li').first().textContent(), /Administración de Sistemas de Información.*frena \d+ materias/);
    // Along the chain, each subject also counts what the subjects it holds back hold back in turn.
    const cuentas = async () => Object.fromEntries(await page.locator('.sl-frenos-vista:visible button.sl-freno').evaluateAll((bs) => bs.map((b) => [b.querySelector('span').textContent, Number(b.querySelector('small').textContent.match(/\d+/)[0])])));
    const modo = page.getByRole('group', { name: 'Cómo contar lo que frena' });
    const directas = await cuentas();
    await modo.getByRole('button', { name: 'En cadena' }).click();
    assert.ok(await page.getByText('Suma también lo que frenan, a su vez, esas materias.').isVisible());
    const enCadena = await cuentas();
    assert.deepEqual(Object.keys(enCadena).sort(), Object.keys(directas).sort(), 'the same subjects');
    assert.ok(Object.keys(directas).every((n) => enCadena[n] >= directas[n]), 'never fewer than directly');
    assert.ok(enCadena['Comunicación de Datos'] > directas['Comunicación de Datos'], 'Redes de Datos waits for it, and others wait for Redes de Datos');
    const orden = Object.values(enCadena);
    assert.deepEqual(orden, [...orden].sort((a, b) => b - a), 'most first');
    await modo.getByRole('button', { name: 'Directas' }).click();
    assert.deepEqual(await cuentas(), directas);
    assert.equal(await page.locator('.sl-estado').getByText('Ord.').count(), 0, 'the ordinance number stays out of the view');
    const nombres = await page.locator('.sl-materia-nombre').allTextContents();
    assert.ok(nombres.includes('Administración de Sistemas de Información'), 'a cut name is completed from another row');
    assert.ok(nombres.includes('Introducción a la Práctica Profesional (Elec.)'), 'a name cut inside the elective mark gets it back');
    await page.getByRole('group', { name: 'Filtrar por situación' }).getByRole('button', { name: /Podés cursar/ }).click();
    assert.equal(await page.locator('tr.sl-materia:visible').count(), pueden);
    await page.getByRole('group', { name: 'Filtrar por situación' }).getByRole('button', { name: 'Todas' }).click();
    await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: /Obligatorias/ }).click();
    assert.equal(await page.locator('tr.sl-materia:visible', { hasText: 'Elec.' }).count(), 0, 'electives filter out');
    assert.equal(await page.locator('tr.sl-materia:visible', { hasText: 'Seminario Integrador' }).count(), 0, 'Seminario Integrador goes with the electives');
    await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: 'Todas' }).click();
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-correlatividad-cursado.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-correlatividad-cursado-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real prerequisites to enroll: stages from what you can take now to the last one, with the longest chain', async () => {
    await open('/correlatividadCursado.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    const etapas = page.locator('.sl-etapas');
    assert.ok(!(await etapas.isVisible()), 'the list comes first');
    await page.getByRole('group', { name: 'Cambiar vista' }).getByRole('button', { name: 'Etapas' }).click();
    assert.ok(await etapas.isVisible());
    assert.ok(!(await page.locator('.sl-lista').isVisible()) && !(await page.locator('.sl-mapa').isVisible()));
    const pueden = (real('correlatividad-cursado-real.html').match(/Puede cursar/g) ?? []).length;
    const primera = etapas.locator('.sl-anio').first();
    assert.equal(await primera.locator('h2').textContent(), 'Ya podés cursar');
    assert.equal(await primera.locator('tr.sl-etapa-fila').count(), pueden, 'stage 1 is everything you can take now');
    const titulos = await etapas.locator('.sl-anio h2').allTextContents();
    assert.deepEqual(titulos, ['Ya podés cursar', ...titulos.slice(1).map((_, i) => `Etapa ${i + 2}`)], 'stages in order, none skipped');
    assert.equal(await etapas.locator('tr.sl-etapa-fila').count(), await page.locator('.sl-lista tr.sl-materia').count(), 'every subject in one stage');
    // Each subject sits one stage after the latest of the subjects it waits for.
    const etapaDe = Object.fromEntries(await etapas.locator('.sl-anio').evaluateAll((secciones) => secciones.flatMap((s, i) => [...s.querySelectorAll('.sl-materia-nombre')].map((n) => [n.textContent, i + 1]))));
    assert.equal(etapaDe['Redes de Datos'], etapaDe['Comunicación de Datos'] + 1);
    assert.equal(etapaDe['Ciencia de Datos'], etapaDe['Simulación'] + 1);
    const resumen = await page.locator('.sl-tarjeta-etapas .sl-electivas').textContent();
    const cuantas = Math.max(...Object.entries(etapaDe).filter(([n]) => !/\(Elec\.\)|^Seminario/.test(n)).map(([, e]) => e));
    assert.match(resumen, new RegExp(`^Al menos ${cuantas} etapas de cursado\\. La cadena más larga: .+ → .+\\.$`));
    const cadena = resumen.replace(/^.*La cadena más larga: /, '').replace(/\.$/, '').split(' → ');
    assert.equal(cadena.length, cuantas, 'one subject per stage');
    assert.deepEqual(cadena.map((n) => etapaDe[n]), cadena.map((_, i) => i + 1));
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Año 5' }).click();
    assert.ok((await etapas.locator('tr.sl-etapa-fila:visible .sl-col-anio').allTextContents()).every((t) => t === 'Año 5'), 'the filters work on the stages too');
    assert.ok(await etapas.locator('tr.sl-etapa-fila:visible').count() > 0);
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Todos' }).click();
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-correlatividad-etapas.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-correlatividad-etapas-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real certificates: a card per certificate, the warning beside it, no name', async () => {
    await open('/menuCertificados.asp?id=11111-1');
    await page.locator('.sl-certificados').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Certificados');
    assert.ok(!(await page.getByText('Pérez').isVisible()), 'the row with the name is gone');
    assert.ok(!(await page.getByText('Descarga de certificados').isVisible()));
    const enlace = page.getByRole('link', { name: 'Certificado de alumno regular', exact: true });
    assert.ok(await enlace.isVisible(), 'the visible label is the accessible name');
    assert.match(await enlace.getAttribute('href'), /certalreg\.asp\?id=11111-1$/, 'the link keeps its target');
    assert.match(await page.locator('p.sl-aviso-cert').textContent(), /no se pueden eliminar las inscripciones/);
    assert.ok(await page.getByRole('link', { name: 'Volver a menú principal' }).isVisible());
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-certificados.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-certificados-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    assert.ok(requests.every((r) => !r.path.includes('certalreg')), 'nothing is generated until the student clicks');
  });

  await check('what if: supposing subjects done frees the ones that wait only for them', async () => {
    await open('/correlatividadCursado.asp?id=11111-1');
    await page.locator('.sl-simulador').waitFor();
    const resultado = page.locator('p.sl-simulacion');
    assert.equal(await resultado.textContent(), 'Tocá una para ver qué se te libera si la sacás.');
    await page.locator('.sl-frenos-vista:not(.sl-filtrada) button.sl-freno', { hasText: 'Simulación' }).click();
    assert.equal(await page.locator('.sl-frenos-vista:not(.sl-filtrada) button.sl-freno', { hasText: 'Simulación' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await resultado.textContent(), 'Si sacás Simulación, ya podés cursar Ciencia de Datos e Inteligencia Artificial.');
    assert.equal(await page.locator('tr.sl-libera').count(), 2);
    await page.locator('.sl-frenos-vista:not(.sl-filtrada) button.sl-freno', { hasText: 'Administración de Sistemas de Información' }).click();
    assert.equal(await page.locator('tr.sl-libera').count(), 5, 'subjects waiting for both get freed too');
    assert.ok(await page.locator('tr.sl-libera', { hasText: 'Fabricación Aditiva' }).isVisible());
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    assert.equal(await page.locator('tr.sl-libera').count(), 0);
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains('sl-freno')), 'focus stays on a switch when the reset button hides');
    assert.equal(await resultado.textContent(), 'Tocá una para ver qué se te libera si la sacás.');
    assert.ok(!(await page.getByRole('button', { name: 'Empezar de nuevo' }).isVisible()));
    assert.ok(requests.every((r) => r.method === 'GET'), 'the simulation sends nothing');
  });

  await check('the map draws a line per missing subject and shares the simulation', async () => {
    await open('/correlatividadCursado.asp?id=11111-1');
    await page.locator('.sl-simulador').waitFor();
    assert.ok(!(await page.locator('.sl-mapa').isVisible()), 'the list is the default view');
    await page.getByRole('group', { name: 'Cambiar vista' }).getByRole('button', { name: 'Mapa' }).click();
    await page.locator('.sl-mapa').waitFor();
    assert.ok(!(await page.locator('.sl-lista').isVisible()));
    assert.equal(await page.locator('button.sl-nodo').count(), await page.locator('tr.sl-materia').count());
    const lineas = await page.locator('.sl-mapa-lineas path').count();
    assert.ok(lineas > 10, `lines: ${lineas}`);
    await page.waitForFunction(() => [...document.querySelectorAll('.sl-mapa-lineas path')].every((p) => /^M[\d.]+ [\d.]+C/.test(p.getAttribute('d') ?? '')));
    const redes = page.locator('button.sl-nodo', { hasText: 'Redes de Datos' });
    await page.locator('button.sl-nodo', { hasText: 'Comunicación de Datos' }).click();
    assert.match(await redes.getAttribute('class'), /sl-n-libera/);
    assert.equal(await page.locator('.sl-frenos-vista:not(.sl-filtrada) button.sl-freno', { hasText: 'Comunicación de Datos' }).getAttribute('aria-pressed'), 'true', 'the summary follows the map');
    await page.locator('button.sl-nodo', { hasText: 'Ciencia de Datos' }).hover();
    assert.match(await page.locator('button.sl-nodo', { hasText: 'Simulación' }).getAttribute('class'), /sl-en-cadena/, 'pointing at a subject lights what is behind it');
    await page.mouse.move(5, 5);
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Año 5' }).click();
    assert.match(await page.locator('button.sl-nodo', { hasText: 'Física II' }).getAttribute('class'), /sl-atenuada/, 'filters dim the map');
    await page.getByRole('group', { name: 'Filtrar por año' }).getByRole('button', { name: 'Todos' }).click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.sl-chip[aria-pressed="true"]').first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'a pressed tab keeps its look');
    await assertNoSidewaysScroll();
    await page.locator('.sl-mapa').screenshot({ path: join(SHOTS, 'mapa.png') });
    assert.ok(!(await page.locator('.sl-mapa-deslizar').isVisible()), 'a wide window fits the whole map');
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    assert.ok(await page.locator('.sl-mapa-deslizar').isVisible(), 'a phone is told to swipe');
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    await page.locator('.sl-mapa').screenshot({ path: join(SHOTS, 'mapa-390.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('real prerequisites to take exams: long lists fold, and elective hours are read', async () => {
    await open('/correlatividadExamen.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    assert.equal(await page.locator('.sl-electivas').textContent(), 'Te faltan 17 de 20 hs para recibirte.');
    const proyecto = page.locator('tr.sl-materia', { hasText: 'Proyecto Final' });
    assert.ok(await proyecto.getByText('Regularizar esta materia').isVisible());
    assert.ok(!(await proyecto.getByText('Te faltan 17 de 20 hs de electivas').isVisible()), 'the tail of a long list starts folded');
    await proyecto.locator('summary').click();
    assert.ok(await proyecto.getByText('Te faltan 17 de 20 hs de electivas').isVisible());
    assert.equal(await proyecto.getByText('321=').count(), 0, 'the code list stays out');
    const nombres = await page.locator('.sl-materia-nombre').allTextContents();
    assert.ok(nombres.includes('Análisis y Diseño de Datos e Información (Elec.)'), 'a name cut by Sysacad is restored from its own requirement');
    assert.ok(nombres.includes('Seguridad en los Sistemas de Información'), 'a full name of exactly 40 characters stays as is');
    assert.ok(nombres.includes('Soporte a la Gestión de Datos con Programación Visual (Elec.)'));
    await assertNoSidewaysScroll();
    await page.locator('tr.sl-materia', { hasText: 'Algoritmos Genéticos' }).waitFor();
    await page.getByRole('group', { name: 'Cambiar vista' }).getByRole('button', { name: 'Mapa' }).click();
    await page.locator('button.sl-nodo', { hasText: 'Algoritmos Genéticos' }).click();
    assert.match(await page.locator('button.sl-nodo', { hasText: 'Algoritmos Genéticos' }).getAttribute('class'), /sl-n-libera/, 'regularizing it lets you take its exam');
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await page.getByRole('group', { name: 'Cambiar vista' }).getByRole('button', { name: 'Lista' }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(SHOTS, 'real-correlatividad-examen.png'), fullPage: true });
  });

  await check('a subject listed as a requirement does not mark the row that needs it', async () => {
    await open('/materiasCursado.asp');
    await addSubject('Comunicación de Datos');
    await open('/correlatividadCursado.asp?id=11111-1');
    await page.locator('tr.sl-materia.sl-fuerte').first().waitFor();
    assert.deepEqual(await page.locator('tr.sl-materia.sl-fuerte .sl-materia-nombre').allTextContents(), ['Comunicación de Datos']);
    await panel.getByRole('button', { name: 'Quitar Comunicación de Datos' }).click();
  });

  await check('real closed enrollment page: error stands out and the button reloads once', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu a', { hasText: 'Inscripción a cursado' }).click();
    await page.waitForURL('**/materiasCursado.asp?id=11111-1');
    await page.locator('p.textoError').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Inscripción a cursado');
    assert.ok(await page.getByRole('link', { name: 'Volver a menú principal' }).isVisible());
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    await assertCentered(panel.locator('.barra'), 'top bar');
    await assertCentered(page.locator('p.textoError'), 'error');
    await page.screenshot({ path: join(SHOTS, 'real-cursado-cerrado.png') });
    const before = requests.filter((r) => r.path.startsWith('/materiasCursado.asp')).length;
    await Promise.all([
      page.waitForEvent('load'),
      panel.getByRole('button', { name: 'Probar de nuevo' }).click(),
    ]);
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    assert.equal(requests.filter((r) => r.path.startsWith('/materiasCursado.asp')).length, before + 1);
    assert.equal(requests.at(-1).method, 'GET');
  });

  await check('away from enrollment the button goes to the menu', async () => {
    await open('/otra.asp');
    await Promise.all([
      page.waitForURL('**/menuAlumno.asp'),
      panel.getByRole('link', { name: 'Ir al menú' }).click(),
    ]);
  });

  await check('main menu is rebuilt from its own links without losing any', async () => {
    await open('/principal.asp');
    await page.locator('.sl-menu').waitFor();
    assert.equal(await panel.count(), 0);
    const links = await page.locator('.sl-menu a').evaluateAll((all) => all.map((a) => a.textContent.trim()));
    assert.deepEqual([...links].sort(), [...LINKS_MENU].sort());
    assert.equal(await page.locator('.sl-menu a', { hasText: 'Novedades' }).getAttribute('href'), '/l14.asp');
    assert.equal(await page.locator('.sl-grupo-principal a').first().textContent(), 'Inscripción a cursado');
    assert.equal(await page.locator('.sl-alumno h1').textContent(), 'Hola, Ana');
    assert.equal(await page.locator('body ul').count(), 0);
    assert.equal(await page.getByText('Año de ingreso: 2023').count(), 1);
    await page.screenshot({ path: join(SHOTS, 'menu.png') });
    const before = requests.length;
    await Promise.all([
      page.waitForURL('**/materiasCursado.asp'),
      page.locator('.sl-menu a', { hasText: 'Inscripción a cursado' }).click(),
    ]);
    assert.equal(requests.length, before + 1);
  });

  await check('subjects are highlighted, with commission mismatch marked softer', async () => {
    await open('/materiasCursado.asp');
    await page.screenshot({ path: join(SHOTS, 'inscripcion-vacia.png') });
    await addSubject('analisis matematico ii', '2K1');
    await page.locator('#am2.sl-fuerte').waitFor();
    assert.match(await rowClass('am2'), /sl-fuerte/);
    assert.match(await rowClass('am2b'), /sl-suave/);
    assert.ok(!(await rowClass('fis'))?.includes('sl-'));
    const rowColor = (id) => page.locator(`#${id} td`).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    assertRgb(await aRgb(await rowColor('am2')), [241, 225, 181], 'exact match is painted gold');
    assertRgb(await aRgb(await rowColor('am2b')), [250, 244, 228], 'other commission is painted pale gold');
    assert.equal(await rowColor('fis'), 'rgba(0, 0, 0, 0)', 'other subjects stay unmarked');
    await page.locator('#am2').hover({ force: true });
    assertRgb(await aRgb(await rowColor('am2')), [241, 225, 181], 'pointing at the row keeps the highlight');
    await addSubject('Física II');
    await page.locator('#fis.sl-fuerte').waitFor();
    await assertCentered(page.locator('#lista'), 'data table');
    assert.equal(await panel.locator('input[type="text"]').first().evaluate((el) => el === el.getRootNode().activeElement), true, 'the name field is ready for the next subject');
    await page.screenshot({ path: join(SHOTS, 'inscripcion-formulario.png') });
    await panel.getByRole('button', { name: 'Agregar materia' }).click();
    await panel.locator('form').waitFor({ state: 'detached' });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(SHOTS, 'inscripcion-resaltada.png') });
  });

  await check('dock stays on screen and centered while the page scrolls', async () => {
    await page.setViewportSize({ width: 1280, height: 300 });
    await page.evaluate(() => scrollTo(0, 200));
    const box = await panel.locator('.barra').boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 300, `dock is at y=${box.y}, height ${box.height}`);
    await assertCentered(panel.locator('.barra'), 'dock');
    const cabecera = await panel.locator('.cabecera').boundingBox();
    assert.equal(cabecera.y, 0, 'the header stays at the top');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => scrollTo(0, 0));
  });

  await check('a subject name does not match inside a longer word', async () => {
    await addSubject('Sistemas Oper');
    await panel.getByRole('button', { name: 'Quitar Sistemas Oper' }).waitFor();
    assert.ok(!(await rowClass('sis'))?.includes('sl-fuerte'));
    await panel.getByRole('button', { name: 'Quitar Sistemas Oper' }).click();
    await panel.getByRole('button', { name: 'Quitar Sistemas Oper' }).waitFor({ state: 'detached' });
  });

  await check('solo mis materias keeps header, footer and checked rows visible', async () => {
    await panel.getByLabel('Mostrar solo mis materias').check();
    await page.waitForTimeout(300);
    assert.match(await rowClass('am2'), /sl-fuerte/, 'the matched row is really highlighted');
    assert.ok(await page.locator('#titulo').isVisible(), 'header');
    assert.ok(await page.locator('#pie').isVisible(), 'footer');
    assert.ok(await page.locator('#sis').isVisible(), 'checked row');
    assert.ok(await page.locator('#am2').isVisible(), 'match');
    await page.screenshot({ path: join(SHOTS, 'solo-mias.png') });
    await panel.getByLabel('Mostrar solo mis materias').uncheck();
  });

  await check('a row that is not checked gets hidden by solo mis materias', async () => {
    await panel.getByRole('button', { name: 'Quitar Física II' }).click();
    await panel.getByLabel('Mostrar solo mis materias').check();
    await page.locator('#fis.sl-oculta').waitFor({ state: 'attached' });
    assert.ok(!(await page.locator('#fis').isVisible()));
    await panel.getByLabel('Mostrar solo mis materias').uncheck();
    await addSubject('Física II');
  });

  await check('Probar de nuevo reloads the enrollment page once per click', async () => {
    const before = requests.length;
    await Promise.all([
      page.waitForEvent('load'),
      panel.getByRole('button', { name: 'Probar de nuevo' }).click(),
    ]);
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1).path, '/materiasCursado.asp');
    assert.equal(requests.at(-1).method, 'GET');
  });

  await check('synthetic clicks do nothing', async () => {
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    const before = requests.length;
    await page.evaluate(() => {
      const shadow = document.querySelector('#sysacad-lindo').shadowRoot;
      shadow.querySelector('.reintentar').click();
      shadow.querySelector('.reintentar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    assert.equal(requests.length, before);
    assert.equal(await panel.locator('.reintentar').textContent(), 'Probar de nuevo');
  });

  await check('real exam enrollment: list, dates, enrolled and certificate, with nothing sent until the student clicks', async () => {
    await open('/materiasExamen.asp?id=11111-1');
    await page.locator('.sl-examenes').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Inscripción a exámenes');
    assert.ok(!(await page.getByText('Pérez').isVisible()), 'the row with the name is gone');
    assert.ok(!(await page.locator('table.sl-datos').first().isVisible()), 'Sysacad table is replaced');
    assert.deepEqual(await page.locator('.sl-examen-anio .sl-anio-cabeza h2').allTextContents(), ['Año 2', 'Año 3', 'Año 4', 'Año 5']);
    const anio2 = page.locator('.sl-examen-anio').first();
    assert.deepEqual(await anio2.locator(':scope > .sl-examen-lista .sl-materia-nombre').allTextContents(), ['Física II'], 'the career subjects go first');
    assert.ok((await anio2.locator('.sl-examen-electivas .sl-materia-nombre').allTextContents()).includes('Entornos Gráficos (Elec.)'), 'electives go apart');
    assert.ok((await page.locator('.sl-materia-nombre').allTextContents()).includes('Sistemas de Información Geográfica (Elec.)'), 'a cut name gets its mark back');
    assert.match(await page.locator('li.sl-materia', { hasText: 'Física II' }).getAttribute('class'), /sl-fuerte/, 'saved subjects are highlighted');
    await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: /Electivas/ }).click();
    assert.equal(await page.locator('li.sl-materia:visible', { hasText: 'Física II' }).count(), 0, 'the electives filter hides the career subjects');
    await page.getByRole('group', { name: 'Filtrar por tipo' }).getByRole('button', { name: 'Todas' }).click();
    assert.ok(await panel.getByRole('button', { name: 'Agregar materia' }).isVisible());
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-materias.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-materias-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.getByRole('link', { name: 'Inscribirse a Tecnologías para la Automatización' }).click();
    await page.waitForURL('**/fechasExamen.asp?**');
    await page.locator('.sl-mesas').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Tecnologías para la Automatización');
    const opciones = page.locator('form[name="inscripcion"] input[type="radio"][name="seleccion"]');
    assert.equal(await opciones.count(), 6);
    assert.ok(await opciones.first().isChecked(), 'Sysacad picks the first date, the extension leaves it');
    assert.ok(await opciones.evaluateAll((rs) => rs.every((r) => r.form?.name === 'inscripcion' && r.closest('label.sl-mesa'))), 'each radio stays in its form, inside its card');
    assert.deepEqual(await page.locator('.sl-mesa-dia h2 > span').allTextContents(), ['Jueves 26 de noviembre', 'Jueves 10 de diciembre', 'Jueves 17 de diciembre']);
    assert.ok(await page.getByRole('radio', { name: /Tribunal Sosa Rivas/ }).first().isVisible(), 'the card names the radio');
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-fechas.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-fechas-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    assert.ok(requests.every((r) => !r.path.startsWith('/inscripcionExamen.asp')), 'nothing is sent before the click');

    // Pressing the text of a card picks its radio.
    await page.locator('.sl-mesa-dia').nth(1).locator('label.sl-mesa').first().getByText('Turno tarde').click();
    assert.ok(await opciones.nth(2).isChecked());
    assert.ok(requests.every((r) => !r.path.startsWith('/inscripcionExamen.asp')), 'picking a date sends nothing');
    await Promise.all([page.waitForURL('**/inscripcionExamen.asp'), page.getByRole('button', { name: 'Inscribirse' }).click()]);
    assert.deepEqual(requests.filter((r) => r.path === '/inscripcionExamen.asp').map((r) => r.method), ['POST'], 'one click, one enrollment');
    await page.locator('.sl-comprobante').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Inscripción a examen');
    assert.ok(await page.getByText('Listo, te inscribiste').isVisible());
    assert.ok(await page.locator('.sl-comprobante-cabeza p').getByText('Tecnologías para la Automatización').isVisible(), 'the subject comes from the dates page');
    assert.equal(await page.locator('.sl-codigo strong').textContent(), 'R3N8VD');
    assert.ok(await page.getByRole('link', { name: 'Inscribirse a otra materia' }).isVisible());
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-inscripto.png'), fullPage: true });

    await Promise.all([page.waitForURL('**/certificadoExamen.asp'), page.getByRole('link', { name: 'Imprimir certificado y salir' }).click()]);
    await page.locator('.sl-comprobantes').waitFor();
    assert.equal(await page.locator('h1.sl-titulo').textContent(), 'Certificado de exámenes');
    assert.ok(await page.getByText('Datos al 16/11/2026 10:41:07').isVisible());
    assert.ok(!(await page.getByText('Pérez').isVisible()), 'the row with the name is gone');
    assert.equal(await page.locator('.sl-comprobante h2').textContent(), 'Tecnologías para la Automatización');
    assert.equal(await page.getByRole('link', { name: 'presidente.mesa@ejemplo.com' }).getAttribute('href'), 'mailto:presidente.mesa@ejemplo.com');
    assert.match(await page.getByRole('link', { name: 'Imprimir' }).getAttribute('href'), /window\.print/);
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-certificado.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'real-examen-certificado-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await check('menu: what comes next, from the schedule on the login page and the exams you enrolled in', async () => {
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await open('/loginAlumno.asp?futuro');
    await page.locator('.sl-ingresar').waitFor();
    await open('/certificadoExamen.asp?futuro');
    await page.locator('.sl-comprobantes').waitFor();
    await page.waitForTimeout(300);
    await open('/menuAlumno.asp');
    const viene = page.locator('.sl-viene');
    await viene.waitFor();
    assert.equal(await viene.getByRole('heading').textContent(), 'Próximas fechas');
    const items = await viene.locator('li').evaluateAll((lis) => lis.map((li) => [li.querySelector('.sl-viene-falta').textContent, li.querySelector('strong').textContent, li.querySelector('div > span').textContent]));
    assert.deepEqual(items.map((i) => i[1]), ['Examen de Tecnologías para la Automatización', 'Inscripción a cursado 2026: tu turno', 'Inscripción a cursado 2026: electivas'], 'soonest first, and only your turn');
    assert.equal(items[0][0], 'En 10 días');
    assert.match(items[0][2], /^\S+ \d+ de \S+ · 15:00 · tribunal Ferreyra$/);
    assert.match(items[1][2], /^\S+ 4 de marzo · desde las 8$/, 'the turn of the year of entry, 2023');
    assert.match(items[2][2], /^\S+ 9 de marzo · desde las 8$/);
    assert.ok(await viene.evaluate((v) => v.previousElementSibling?.classList.contains('sl-grupo-principal')), 'under the two enrollment cards');
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'menu-lo-que-viene.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 800 });
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'menu-lo-que-viene-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    // What already went by stays out.
    await open('/loginAlumno.asp');
    await page.locator('.sl-ingresar').waitFor();
    await open('/certificadoExamen.asp');
    await page.locator('.sl-comprobantes').waitFor();
    await page.waitForTimeout(300);
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await page.waitForTimeout(300);
    const pasado = new Date() > new Date(2026, 11, 10);
    assert.equal(await page.locator('.sl-viene').count(), pasado ? 0 : 1, 'March 2026 is gone, and the exam of the real page too once it went by');
  });

  await check('idle page sends nothing for 3 seconds', async () => {
    await open('/materiasCursado.asp');
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    const before = requests.length;
    await page.waitForTimeout(3000);
    assert.equal(requests.length, before);
    assert.deepEqual(requests.filter((r) => r.method !== 'GET').map((r) => r.path), ['/inscripcionExamen.asp'], 'the only POST in this run is the enrollment the student clicked');
  });

  // Super CVG in its own tab: what it got when it loaded, and the answer to what it asks.
  let cvg = null;
  const abrirCvg = async () => {
    cvg ??= await context.newPage();
    await cvg.goto(`${SUPERCVG}/`);
    await cvg.waitForFunction(() => window.recibidos.length > 0);
    await cvg.waitForTimeout(300);
    return cvg.evaluate(() => window.recibidos);
  };
  const pedirCvg = async (pide) => {
    const antes = await cvg.evaluate(() => window.recibidos.length);
    await cvg.evaluate((p) => postMessage({ fuente: 'super-cvg', pide: p }, location.origin), pide);
    await cvg.waitForFunction((n) => window.recibidos.length > n, antes);
    return cvg.evaluate(() => window.recibidos.at(-1));
  };
  const sinVincular = { fuente: 'sysacad-lindo', para: 'super-cvg', v: 1, vinculada: false };
  // The same screen at 1280 and at 390, with what matters in view.
  const fotos = async (nombre, enVista) => {
    for (const ancho of [1280, 390]) {
      await page.setViewportSize({ width: ancho, height: 800 });
      await enVista?.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(SHOTS, `${nombre}-${ancho}.png`) });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  };

  await check('Super CVG: the extension always answers, and unlinked it hands nothing over', async () => {
    const alCargar = await abrirCvg();
    assert.ok(alCargar.length <= 2, `${alCargar.length} answers on load`);
    for (const mensaje of alCargar) assert.deepEqual(mensaje, sinVincular);
    assert.deepEqual(await pedirCvg('sysacad'), sinVincular, 'the record was read already, but it is not linked');
    const antes = await cvg.evaluate(() => window.recibidos.length);
    await cvg.evaluate(() => postMessage({ fuente: 'super-cvg', pide: 'toString' }, location.origin));
    await cvg.waitForTimeout(300);
    assert.equal(await cvg.evaluate(() => window.recibidos.length), antes, 'an unknown request gets no answer');
  });

  await check('El Santo Resumen: invited on the menu and the record, linked there, and only then handed over', async () => {
    const santo = await context.newPage();
    const recibidos = async () => {
      await santo.goto(`${SANTO}/utn/materias.html`);
      await santo.waitForTimeout(400);
      return santo.evaluate(() => window.recibidos);
    };
    assert.deepEqual(await recibidos(), [], 'nothing before linking');
    await open('/menuAlumno.asp');
    const tarjeta = page.locator('.sl-santo');
    await tarjeta.getByRole('heading', { name: '¿Usás El Santo Resumen?' }).waitFor();
    assert.equal(await page.locator('.sl-supercvg').count(), 0, 'El Santo Resumen asks first, and one at a time');
    await page.screenshot({ path: join(SHOTS, 'santo-menu.png') });
    await open('/estadoAcademico.asp?id=11111-1');
    await tarjeta.getByRole('heading', { name: '¿Usás El Santo Resumen?' }).waitFor();
    assert.ok(await tarjeta.evaluate((t) => t.nextElementSibling?.classList.contains('sl-estado')), 'the invitation goes above the record');
    await page.screenshot({ path: join(SHOTS, 'santo-estado.png') });
    await tarjeta.getByRole('button', { name: 'Vincular' }).click();
    const listo = tarjeta.getByRole('heading', { name: 'Quedó vinculado' });
    await listo.waitFor();
    assert.ok(await listo.evaluate((el) => el === document.activeElement), 'the focus goes to what changed');
    assert.equal(await tarjeta.getByRole('link', { name: /Abrir El Santo Resumen/ }).getAttribute('href'), `${SANTO}/utn/materias.html`);
    const [mensaje] = await recibidos();
    assert.ok(mensaje?.fecha > 0, 'it says when it was read');
    const nombres = (tipo) => mensaje.materias.filter((m) => m.tipo === tipo).map((m) => m.nombre).sort();
    assert.ok(nombres('aprobada').includes('Física I') && nombres('aprobada').includes('Programación Competitiva (Elec.)'));
    assert.deepEqual(nombres('regular'), ['Entornos Gráficos (Elec.)', 'Física II']);
    assert.ok(mensaje.materias.every((m) => Object.keys(m).join() === 'nombre,tipo'), 'only names and states: no grades, no record numbers');
    // Linked: no invitation on the menu, and the record says where it stands below everything.
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    assert.equal(await page.locator('.sl-santo').count(), 0);
    await open('/estadoAcademico.asp?id=11111-1');
    await tarjeta.getByRole('heading', { name: 'Vinculado con El Santo Resumen' }).waitFor();
    assert.ok(await tarjeta.evaluate((t) => t.previousElementSibling?.classList.contains('sl-estado')), 'once linked it goes below');
    // Unlinked from Ajustes: what was kept goes away and nothing more is handed over.
    await abrirAjustes();
    await dialogo.getByRole('checkbox', { name: /Vincular con El Santo Resumen/ }).uncheck();
    await cerrarAjustes();
    assert.deepEqual(await recibidos(), []);
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    assert.equal(await page.locator('.sl-santo').count(), 0, 'turned down from Ajustes, it does not ask again');
    await santo.close();
  });

  const FINALES = [
    { nombre: 'Algoritmos y Estructuras de Datos', nota: 10 },
    { nombre: 'Análisis Matemático I', nota: 8 },
    { nombre: 'Física I', nota: 7 },
    { nombre: 'Programación Competitiva (Elec.)', nota: 9 },
    { nombre: 'Seminario Integrador', nota: 8 },
  ];
  const tarjetaCvg = page.locator('.sl-supercvg');

  await check('Super CVG: invited after El Santo Resumen, linked on the record, and only then handed the finals', async () => {
    await open('/menuAlumno.asp');
    await tarjetaCvg.getByRole('heading', { name: '¿Usás Super CVG?' }).waitFor();
    assert.equal(await page.locator('.sl-vinculo').count(), 1, 'one invitation at a time');
    assert.ok(await tarjetaCvg.getByText('Después lo podés cambiar en Ajustes.').isVisible());
    await fotos('supercvg-invitacion-menu', tarjetaCvg);
    await open('/estadoAcademico.asp?id=11111-1');
    await tarjetaCvg.getByRole('heading', { name: '¿Usás Super CVG?' }).waitFor();
    assert.ok(await tarjetaCvg.evaluate((t) => t.nextElementSibling?.classList.contains('sl-estado')), 'the invitation goes above the record');
    await fotos('supercvg-invitacion-estado');
    await abrirCvg();
    assert.deepEqual(await pedirCvg('sysacad'), sinVincular, 'nothing before linking');

    await page.bringToFront();
    await tarjetaCvg.getByRole('button', { name: 'Vincular' }).click();
    const listo = tarjetaCvg.getByRole('heading', { name: 'Quedó vinculado' });
    await listo.waitFor();
    assert.ok(await listo.evaluate((el) => el === document.activeElement), 'the focus goes to what changed');
    const abrir = tarjetaCvg.getByRole('link', { name: /^Abrir Super CVG\s*, se abre en otra pestaña$/ });
    assert.equal(await abrir.getAttribute('href'), `${SUPERCVG}/`);
    assert.equal(await abrir.getAttribute('target'), '_blank');
    await fotos('supercvg-recien-vinculado', tarjetaCvg);

    const mensaje = (await abrirCvg()).at(-1);
    assert.deepEqual(Object.keys(mensaje), ['fuente', 'para', 'v', 'vinculada', 'fecha', 'finales']);
    assert.equal(mensaje.vinculada, true);
    assert.ok(mensaje.fecha > Date.now() - 60000 && mensaje.fecha <= Date.now(), 'it says when the record was read');
    assert.deepEqual(mensaje.finales, FINALES, 'only name and grade of what was passed with a grade');
    assert.deepEqual(await pedirCvg('sysacad'), mensaje, 'asking again gets the same');

    // Linked with its finals: nothing on the menu, and the record says so below everything.
    await page.bringToFront();
    await open('/menuAlumno.asp');
    await page.locator('.sl-menu').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.sl-vinculo').count(), 0);
    await open('/estadoAcademico.asp?id=11111-1');
    await tarjetaCvg.getByRole('heading', { name: 'Vinculado con Super CVG' }).waitFor();
    assert.ok(await tarjetaCvg.evaluate((t) => t.previousElementSibling?.classList.contains('sl-estado')), 'once linked it goes below');
    await fotos('supercvg-ya-vinculado', tarjetaCvg);

    // Unlinked from Ajustes: what was kept goes away and nothing more is handed over.
    await abrirAjustes();
    const interruptor = dialogo.getByRole('checkbox', { name: /Vincular con Super CVG/ });
    assert.ok(await interruptor.isChecked());
    assert.ok(!(await dialogo.getByRole('checkbox', { name: /Vincular con El Santo Resumen/ }).isChecked()));
    await fotos('supercvg-ajustes', dialogo.locator('label.interruptor', { hasText: 'Vincular con Super CVG' }));
    await interruptor.uncheck();
    await cerrarAjustes();
    assert.deepEqual((await abrirCvg()).at(-1), sinVincular);
    await page.bringToFront();
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.sl-vinculo').count(), 0, 'turned down from Ajustes, it does not ask again');
    assert.deepEqual(await pedirCvg('sysacad'), sinVincular, 'and the record keeps nothing for it');
  });

  await check('Super CVG: linked from its page, the menu waits for the finals and the record brings them', async () => {
    assert.deepEqual(await pedirCvg('vincular'), { ...sinVincular, vinculada: true }, 'linked, still without finals');
    await page.bringToFront();
    await open('/menuAlumno.asp');
    await tarjetaCvg.getByRole('heading', { name: 'Super CVG espera tus finales' }).waitFor();
    assert.equal(await page.locator('.sl-vinculo').count(), 1);
    const ir = tarjetaCvg.getByRole('link', { name: 'Ir a Estado académico' });
    assert.equal(await ir.getAttribute('href'), `${ORIGIN}/estadoAcademico.asp?id=11111-1`, 'the same link as the menu');
    assert.equal(await ir.getAttribute('target'), null);
    await fotos('supercvg-espera-menu', tarjetaCvg);
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/menuAlumno.asp', 'it never goes there by itself');

    await ir.click();
    await page.waitForURL((url) => url.pathname === '/estadoAcademico.asp');
    await tarjetaCvg.getByRole('heading', { name: 'Tus finales ya están en Super CVG' }).waitFor();
    assert.ok(await tarjetaCvg.evaluate((t) => t.nextElementSibling?.classList.contains('sl-estado')), 'the news goes above the record');
    const volver = tarjetaCvg.getByRole('link', { name: /^Volver a Super CVG\s*, se abre en otra pestaña$/ });
    assert.equal(await volver.getAttribute('href'), `${SUPERCVG}/`);
    await fotos('supercvg-finales-traidos', tarjetaCvg);
    const respuesta = await pedirCvg('sysacad');
    assert.equal(respuesta.vinculada, true);
    assert.deepEqual(respuesta.finales, FINALES);
    await open('/estadoAcademico.asp?id=11111-1');
    await tarjetaCvg.getByRole('heading', { name: 'Vinculado con Super CVG' }).waitFor();

    // Unlinked from its page: the same as the switch in Ajustes.
    assert.deepEqual(await pedirCvg('desvincular'), sinVincular);
    assert.deepEqual((await abrirCvg()).at(-1), sinVincular, 'what was kept is gone');
    await page.bringToFront();
    await open('/estadoAcademico.asp?id=11111-1');
    await page.locator('.sl-tablero').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.sl-vinculo').count(), 0);
    assert.deepEqual(await pedirCvg('sysacad'), sinVincular);
    await abrirAjustes();
    assert.ok(!(await dialogo.getByRole('checkbox', { name: /Vincular con Super CVG/ }).isChecked()));
    await cerrarAjustes();
    await cvg.close();
    // The checks below start where the idle check left off.
    await open('/materiasCursado.asp');
  });

  // The tabs copied for Super CVG (docs/CONTRATO-SUPERCVG.md), and what the extension keeps, read from its own world.
  const PESTANAS = [
    ['estado', '/estadoAcademico.asp?id=11111-1', 'Estado académico'],
    ['parciales', '/notasParciales.asp?id=11111-1', 'Notas de parciales'],
    ['examenes', '/examenes.asp?id=2', 'Exámenes'],
    ['plan', '/materiasPlan.asp?id=11111-1', 'Materias del plan'],
    ['correlativas-cursar', '/correlatividadCursado.asp?id=11111-1', 'Correlatividad para cursar'],
    ['correlativas-rendir', '/correlatividadExamen.asp?id=11111-1', 'Correlatividad para rendir'],
    ['certificados', '/menuCertificados.asp?id=11111-1', 'Certificados'],
  ];
  const deLaExtension = (c) => c.auxData?.type === 'isolated' && (c.origin?.startsWith('chrome-extension://') || c.name === 'Sysacad Lindo');
  const enLaExtension = async (expresion) => {
    const cdp = await context.newCDPSession(cvg);
    const mundos = [];
    cdp.on('Runtime.executionContextCreated', ({ context: c }) => mundos.push(c));
    await cdp.send('Runtime.enable');
    for (let i = 0; i < 40 && !mundos.some(deLaExtension); i++) await cvg.waitForTimeout(50);
    const mundo = mundos.find(deLaExtension);
    assert.ok(mundo, 'the world of supercvg.js');
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: expresion, contextId: mundo.id, awaitPromise: true, returnByValue: true });
    await cdp.detach();
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const guardado = () => enLaExtension('chrome.storage.local.get(null)');
  // Opens a tab and waits until its copy is newer than before (or a moment, when none should come).
  const abrirPestana = async (ruta, clave) => {
    const antes = (await guardado()).supercvgPestanas?.[clave]?.fecha ?? 0;
    await page.bringToFront();
    await open(ruta);
    await page.waitForLoadState('load');
    if (!clave) return page.waitForTimeout(300);
    for (let i = 0; i < 40; i++) {
      if (((await guardado()).supercvgPestanas?.[clave]?.fecha ?? 0) > antes) return;
      await page.waitForTimeout(50);
    }
    throw new Error(`no copy of ${clave}`);
  };
  const sinPestanas = (vinculada, guarda) => ({ fuente: 'sysacad-lindo', para: 'super-cvg', v: 2, tipo: 'pestanas', vinculada, guarda, alumno: null, pestanas: [] });
  const ajustePestanas = () => dialogo.getByRole('checkbox', { name: /Guardar las pestañas que abrís/ });
  const LAYOUT = /Volver a men|IMPORTANTE|Universidad Tecnol|autogesti|Promedio|sl-/;

  await check('Super CVG: unlinked or with the switch off, no tab is copied', async () => {
    cvg = null;
    await abrirCvg();
    for (const [, ruta] of PESTANAS) await abrirPestana(ruta);
    await abrirPestana('/menuAlumno.asp');
    let s = await guardado();
    assert.equal(s.supercvgPestanas, undefined, 'unlinked: nothing');
    assert.equal(s.supercvgAlumno, undefined);
    assert.deepEqual(await pedirCvg('pestanas'), sinPestanas(false, false));

    assert.equal((await pedirCvg('vincular')).vinculada, true);
    await page.bringToFront();
    await abrirAjustes();
    assert.ok(await ajustePestanas().isChecked(), 'on by default');
    await fotos('supercvg-ajuste-pestanas', dialogo.locator('label.interruptor', { hasText: 'Guardar las pestañas' }));
    await ajustePestanas().uncheck();
    await cerrarAjustes();
    for (const [, ruta] of PESTANAS) await abrirPestana(ruta);
    await abrirPestana('/menuAlumno.asp');
    s = await guardado();
    assert.equal(s.supercvgGuardaPestanas, false);
    assert.equal(s.supercvgPestanas, undefined, 'switched off: no copies');
    assert.equal(s.supercvgAlumno, 'Pérez, Ana', 'the name stays for the exams');
    assert.deepEqual(await pedirCvg('pestanas'), sinPestanas(true, false));
    await page.bringToFront();
    await abrirAjustes();
    await ajustePestanas().check();
    await cerrarAjustes();
    assert.deepEqual(await pedirCvg('pestanas'), { ...sinPestanas(true, true), alumno: 'Pérez, Ana' }, 'the name kept with the switch off goes once it is on');
  });

  await check('Super CVG: each tab keeps its text copy, as Sysacad shows it and without its frame', async () => {
    await abrirPestana('/menuAlumno.asp');
    assert.equal((await guardado()).supercvgAlumno, 'Pérez, Ana', 'the name on the menu');
    for (const [clave, ruta] of PESTANAS) await abrirPestana(ruta, clave);
    const mensaje = await pedirCvg('pestanas');
    writeFileSync(join(SHOTS, 'supercvg-pestanas.json'), JSON.stringify(mensaje, null, 1));
    assert.deepEqual(Object.keys(mensaje), ['fuente', 'para', 'v', 'tipo', 'vinculada', 'guarda', 'alumno', 'pestanas']);
    assert.deepEqual({ ...mensaje, pestanas: [] }, { ...sinPestanas(true, true), alumno: 'Pérez, Ana' });
    assert.deepEqual(mensaje.pestanas.map((p) => [p.clave, p.titulo]), PESTANAS.map(([clave, , titulo]) => [clave, titulo]), 'every tab, in the order of the contract');
    for (const p of mensaje.pestanas) {
      assert.deepEqual(Object.keys(p), ['clave', 'titulo', 'fecha', 'bloques']);
      assert.ok(Number.isInteger(p.fecha) && p.fecha > Date.now() - 120000 && p.fecha <= Date.now(), `${p.clave}: when`);
      assert.doesNotMatch(JSON.stringify(p.bloques), LAYOUT, `${p.clave}: only what Sysacad shows, never its frame or the extension`);
    }
    const de = Object.fromEntries(mensaje.pestanas.map((p) => [p.clave, p.bloques]));
    const titulo = (texto) => ({ t: 'titulo', texto: `${texto} de Pérez, Ana al 2/11/2026 22:03:03` });
    const tabla = (columnas, filas) => ({ t: 'tabla', titulo: null, columnas, filas });

    assert.deepEqual(de.estado, [titulo('Estado académico'), tabla(['Año', 'Materia', 'Estado', 'Plan'], FILAS_ESTADO)], 'the original table, not the rebuilt record');
    assert.deepEqual(de.plan, [titulo('Materias del plan'), tabla(['Año', 'Materia', 'Horas', 'Cursado', 'Electiva'], FILAS_PLAN)]);

    assert.equal(de.examenes.length, 2);
    assert.deepEqual(de.examenes[0], titulo('Exámenes'));
    assert.deepEqual(de.examenes[1].columnas, ['Fecha', 'Materia', 'Nota', 'Especialidad', 'Plan', 'Código']);
    assert.equal(de.examenes[1].filas.length, 24);
    assert.deepEqual(de.examenes[1].filas[0], ['01/01/2021', 'Algoritmos y Estructuras de Datos', 'ocho', 'Ing. Sist. Inf.', '2023', '106']);
    assert.deepEqual(de.examenes[1].filas.at(-1), ['27/08/2024', 'Desarrollo de Software', 'nueve', 'Ing. Sist. Inf.', '2023', '304']);

    assert.equal(de.parciales.length, 2);
    assert.deepEqual(de.parciales[1].columnas, ['Año', 'Materia', 'Comisión', 'Aula', 'Horarios', 'Notas', 'Inasistencias', 'Obs.']);
    assert.equal(de.parciales[1].filas.length, 8);
    assert.deepEqual(de.parciales[1].filas[0], ['3', 'Comunicación de Datos', '4 (3K04)', '202 Zeballos 1341', 'Miércoles 15:00-16:50, Viernes 13:35-15:00', 'Par. 1: 7 (siete)', '-.-', ''], 'links keep their words, empty cells stay');

    for (const [clave, nombre] of [['correlativas-cursar', 'Correlatividades para cursar'], ['correlativas-rendir', 'Correlatividades para rendir']]) {
      assert.equal(de[clave].length, 2);
      assert.deepEqual(de[clave][0], titulo(nombre));
      assert.deepEqual(de[clave][1].columnas, ['Año', 'Materia', 'Correlatividad', 'Plan']);
      assert.equal(de[clave][1].filas.length, 37);
      assert.ok(de[clave][1].filas.every((f) => f.length === 4 && /^\d$/.test(f[0]) && f[3] === '2023'), `${clave}: every row in its columns`);
    }
    assert.deepEqual(de['correlativas-cursar'][1].filas.find((f) => f[1] === 'Seguridad en los Sistemas de Información'),
      ['5', 'Seguridad en los Sistemas de Información', 'No regularizó Redes de Datos (Ord. 1878) · No regularizó Administración de Sistemas de Información (Ord. 1878) · No aprobó ni está inscripto a Comunicación de Datos (Ord. 1878)', '2023'],
      'lines inside a cell stay apart');

    assert.deepEqual(de.certificados, [
      { t: 'titulo', texto: 'Pérez, Ana' },
      { t: 'texto', texto: 'Descarga de certificados' },
      { t: 'texto', texto: 'Certificado de alumno regular' },
    ]);

    // Opened again, a tab replaces its own copy and leaves the others.
    const otras = (await guardado()).supercvgPestanas;
    await abrirPestana('/examenes.asp?id=11111-1', 'examenes');
    const despues = await pedirCvg('pestanas');
    const examenes = despues.pestanas.find((p) => p.clave === 'examenes');
    assert.deepEqual(examenes.bloques, [tabla(['Fecha', 'Materia', 'Resultado'], [
      ['10/12/2024', 'Física I', 'Aprobado'], ['02/03/2023', 'Inglés I', 'Aprobado'], ['20/07/2025', 'Redes', 'Ausente'], ['15/02/2024', 'Álgebra', 'Aprobado'],
      ['01/08/2024', 'Química', 'Ausente'], ['09/09/2023', 'Sistemas', 'Aprobado'], ['05/05/2025', 'Economía', 'Desaprobado'], ['Total: 7 exámenes'],
    ])]);
    assert.ok(examenes.fecha > otras.examenes.fecha);
    assert.deepEqual(despues.pestanas.filter((p) => p.clave !== 'examenes').map((p) => p.fecha), mensaje.pestanas.filter((p) => p.clave !== 'examenes').map((p) => p.fecha));
  });

  await check('Super CVG: fields, their values, images, scripts and hidden parts never reach a copy', async () => {
    await abrirPestana('/notasParciales.asp?id=campos', 'parciales');
    const { supercvgPestanas } = await guardado();
    assert.doesNotMatch(JSON.stringify(supercvgPestanas), /SECRETO/);
    assert.deepEqual(supercvgPestanas.parciales.bloques, [
      { t: 'titulo', texto: 'Notas de parciales de Pérez, Ana al 2/11/2026 22:03:03' },
      { t: 'texto', texto: 'Elegí la comisión · y después guardá.' },
      { t: 'tabla', titulo: null, columnas: ['Materia', 'Nota', 'Elegir'], filas: [['Física I', '', ''], ['Química', '', '']] },
      { t: 'texto', texto: 'Comentario' },
    ]);
  });

  await check('Super CVG: the copies stay within the caps, also when what is kept is not', async () => {
    await abrirPestana('/materiasPlan.asp?id=grande', 'plan');
    const plan = (await guardado()).supercvgPestanas.plan.bloques;
    assert.equal(plan.length, 60, 'blocks');
    assert.deepEqual(plan[0], { t: 'titulo', texto: 'Materias del plan de Pérez, Ana al 2/11/2026 22:03:03' });
    assert.equal(plan[1].t, 'titulo', 'a heading is a title even when long');
    assert.equal(plan[1].texto.length, 200);
    assert.equal(plan[2].t, 'texto');
    assert.ok(plan[2].texto.length <= 2000 && plan[2].texto.length > 1990);
    assert.deepEqual(plan[3], { t: 'texto', texto: 'con control y espacios juntos' }, 'no control characters, spaces collapsed');
    assert.equal(plan[4].columnas.length, 30);
    assert.equal(plan[4].filas.length, 500);
    assert.ok(plan[4].filas.every((f) => f.length === 30));
    assert.equal(plan[4].filas[0][0], 'x'.repeat(300));
    assert.deepEqual(plan.at(-1), { t: 'texto', texto: 'Párrafo 54' });

    // Whatever is in the storage, the page only gets the shapes of the contract within the caps.
    const ahora = Date.now();
    await enLaExtension(`chrome.storage.local.set({
      supercvgAlumno: ' PÉREZ,\\u0000\\n  Ana ' + 'x'.repeat(200),
      supercvgPestanas: {
        examenes: { fecha: ${ahora}, extra: 1, bloques: [
          { t: 'titulo', texto: 'a'.repeat(300), extra: 1 },
          { t: 'tabla', titulo: 5, columnas: ['A', ' B\\t'], filas: [['1', '2', '3'], 'no', [4, null]] },
          { t: 'imagen', src: '/x.gif' },
          { t: 'texto', texto: '   ' },
          { t: 'texto' },
          ...Array(70).fill({ t: 'texto', texto: 'y' }),
        ] },
        otra: { fecha: ${ahora}, bloques: [{ t: 'texto', texto: 'z' }] },
        plan: { fecha: ${ahora + 3 * 86400000}, bloques: [{ t: 'texto', texto: 'z' }] },
        estado: { fecha: 1.5, bloques: [{ t: 'texto', texto: 'z' }] },
        parciales: { fecha: ${ahora}, bloques: [] },
        certificados: { fecha: ${ahora}, bloques: 'no' },
      },
    })`);
    const mensaje = await pedirCvg('pestanas');
    assert.equal(mensaje.alumno, `PÉREZ, Ana ${'x'.repeat(109)}`);
    assert.deepEqual(mensaje.pestanas, [{ clave: 'examenes', titulo: 'Exámenes', fecha: ahora, bloques: [
      { t: 'titulo', texto: 'a'.repeat(200) },
      { t: 'tabla', titulo: null, columnas: ['A', 'B'], filas: [['1', '2'], ['', '']] },
      ...Array(58).fill({ t: 'texto', texto: 'y' }),
    ] }]);
    // The answer of 2.3.0 stays the same.
    const v1 = await pedirCvg('sysacad');
    assert.deepEqual(Object.keys(v1), ['fuente', 'para', 'v', 'vinculada', 'fecha', 'finales']);
    assert.deepEqual({ ...v1, fecha: 0 }, { ...sinVincular, vinculada: true, fecha: 0, finales: FINALES });
  });

  await check('Super CVG: the exams you enrolled in go to its calendar, checked like the contract says', async () => {
    await abrirPestana('/menuAlumno.asp');
    await abrirPestana('/certificadoExamen.asp?futuro');
    const mensaje = await pedirCvg('examenes');
    assert.deepEqual(Object.keys(mensaje), ['fuente', 'para', 'v', 'tipo', 'vinculada', 'alumno', 'fecha', 'examenes']);
    assert.deepEqual({ ...mensaje, fecha: 0 }, {
      fuente: 'sysacad-lindo', para: 'super-cvg', v: 3, tipo: 'examenes', vinculada: true, alumno: 'Pérez, Ana', fecha: 0,
      examenes: [{ materia: 'Tecnologías para la Automatización', dia: FUTURO_ISO, turno: 'Tarde', teorico: '15:00', practico: '15:00', tribunal: 'Ferreyra' }],
    });
    assert.ok(Number.isInteger(mensaje.fecha) && mensaje.fecha <= Date.now() && mensaje.fecha > Date.now() - 120000);
    assert.doesNotMatch(JSON.stringify(mensaje), /R3N8VD|residente|@/, 'never the security code nor the mail');

    // Whatever is kept, only valid exams go, once each and in order.
    await enLaExtension(`chrome.storage.local.set({ examenesInscriptos: { fecha: Date.now(), examenes: [
      { materia: 'Física II', dia: '2027-02-30', turno: 'Mañana', teorico: '08:00', practico: null, tribunal: 'X' },
      { materia: '  ', dia: '2027-02-10', turno: 'Mañana', teorico: null, practico: null, tribunal: null },
      { materia: 'Física II', dia: '2027-02-10', turno: '', teorico: '25:00', practico: '8:00', tribunal: '', codigo: 'ABC' },
      { materia: 'Física II', dia: '2027-02-10', turno: 'Tarde', teorico: null, practico: null, tribunal: null },
      { materia: 'Economía', dia: '2027-02-03', turno: 'Noche', teorico: '19:00', practico: '19:30', tribunal: 'Sosa' },
    ] } })`);
    assert.deepEqual((await pedirCvg('examenes')).examenes, [
      { materia: 'Economía', dia: '2027-02-03', turno: 'Noche', teorico: '19:00', practico: '19:30', tribunal: 'Sosa' },
      { materia: 'Física II', dia: '2027-02-10', turno: null, teorico: null, practico: null, tribunal: null },
    ]);
    await enLaExtension(`chrome.storage.local.set({ examenesInscriptos: { fecha: Date.now() + 3 * 86400000, examenes: [{ materia: 'Economía', dia: '2027-02-03', turno: null, teorico: null, practico: null, tribunal: null }] } })`);
    const adelantado = await pedirCvg('examenes');
    assert.deepEqual([adelantado.fecha, adelantado.examenes], [null, []], 'a date ahead of the clock sends nothing');

    // Unlinked: nothing at all.
    await enLaExtension(`chrome.storage.local.set({ supercvgVinculado: false })`);
    assert.deepEqual(await pedirCvg('examenes'), { fuente: 'sysacad-lindo', para: 'super-cvg', v: 3, tipo: 'examenes', vinculada: false, alumno: null, fecha: null, examenes: [] });
    await enLaExtension(`chrome.storage.local.set({ supercvgVinculado: true })`);

    // Another student on the menu: the exams of the one before go away.
    await abrirPestana('/certificadoExamen.asp?futuro');
    await enLaExtension(`chrome.storage.local.set({ alumnoMenu: 'GÓMEZ, Luis' })`);
    await abrirPestana('/menuAlumno.asp');
    assert.equal((await guardado()).examenesInscriptos, undefined);
    assert.deepEqual(await pedirCvg('examenes'), { fuente: 'sysacad-lindo', para: 'super-cvg', v: 3, tipo: 'examenes', vinculada: true, alumno: 'Pérez, Ana', fecha: null, examenes: [] });
  });

  await check('Super CVG: other pages copy nothing, and forgetting, another student or unlinking wipe the copies', async () => {
    assert.deepEqual(await pedirCvg('olvidar-pestanas'), sinPestanas(true, true));
    let s = await guardado();
    assert.ok(!('supercvgPestanas' in s) && !('supercvgAlumno' in s), 'forgotten');
    for (const ruta of ['/loginAlumno.asp', '/login.asp', '/materiasCursado.asp?id=11111-1', '/materiasExamen.asp?id=11111-1', '/fechasExamen.asp?plan=2023&materia=406&nombre=Tecnolog%EDas%20para%20la%20Automatizaci%F3n', '/inscripcionExamen.asp', '/certificadoExamen.asp', '/otra.asp', '/formulario-largo.asp']) await abrirPestana(ruta);
    assert.equal((await guardado()).supercvgPestanas, undefined, 'only the tabs of the contract');
    await abrirPestana('/principal.asp');
    assert.deepEqual(await pedirCvg('pestanas'), { ...sinPestanas(true, true), alumno: 'Pérez, Ana' });

    // Someone else signs in on this browser: the copies of the one before go away.
    await abrirPestana('/examenes.asp?id=2', 'examenes');
    await enLaExtension(`chrome.storage.local.set({ supercvgAlumno: 'GÓMEZ, Luis' })`);
    await abrirPestana('/menuAlumno.asp');
    s = await guardado();
    assert.equal(s.supercvgAlumno, 'Pérez, Ana');
    assert.equal(s.supercvgPestanas, undefined);

    // Switched off in Ajustes, or Super CVG unlinked there or from its page: nothing stays.
    await abrirPestana('/examenes.asp?id=2', 'examenes');
    await abrirAjustes();
    await ajustePestanas().uncheck();
    await cerrarAjustes();
    s = await guardado();
    assert.ok(!('supercvgPestanas' in s) && s.supercvgAlumno === 'Pérez, Ana', 'switched off: the copies go, the name stays');
    await abrirAjustes();
    await ajustePestanas().check();
    await cerrarAjustes();
    await abrirPestana('/menuAlumno.asp');
    await abrirPestana('/examenes.asp?id=2', 'examenes');
    await abrirAjustes();
    await dialogo.getByRole('checkbox', { name: /Vincular con Super CVG/ }).uncheck();
    assert.ok(!(await ajustePestanas().isVisible()), 'only while linked');
    await cerrarAjustes();
    s = await guardado();
    assert.ok(!('supercvgPestanas' in s) && !('supercvgAlumno' in s), 'unlinked in Ajustes');
    assert.deepEqual(await pedirCvg('pestanas'), sinPestanas(false, false));

    await pedirCvg('vincular');
    await abrirPestana('/menuAlumno.asp');
    await abrirPestana('/examenes.asp?id=2', 'examenes');
    assert.equal((await pedirCvg('pestanas')).pestanas.length, 1);
    assert.deepEqual(await pedirCvg('desvincular'), sinVincular);
    s = await guardado();
    assert.ok(!('supercvgPestanas' in s) && !('supercvgAlumno' in s) && !('supercvgFinales' in s), 'unlinked from its page');
    assert.deepEqual(await pedirCvg('pestanas'), sinPestanas(false, false));
    await cvg.close();
    await open('/materiasCursado.asp');
  });

  await check('panel hides and comes back, and the page regains the space', async () => {
    await panel.getByRole('button', { name: 'Ocultar' }).click();
    await panel.getByRole('button', { name: 'Mostrar panel' }).waitFor();
    const conFoco = (locator) => locator.evaluate((el) => el.getRootNode().activeElement === el);
    assert.ok(await conFoco(panel.getByRole('button', { name: 'Mostrar panel' })), 'focus lands on the tab after hiding');
    assert.equal(await panel.locator('.barra').count(), 0);
    assert.ok(await panel.getByRole('link', { name: 'Ir al menú' }).isVisible(), 'the header stays');
    await assertCentered(page.locator('#lista'), 'data table with the panel hidden');
    await page.screenshot({ path: join(SHOTS, 'plegado.png') });
    await panel.getByRole('button', { name: 'Mostrar panel' }).click();
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    assert.ok(await conFoco(panel.getByRole('button', { name: 'Probar de nuevo' })), 'focus lands in the panel after showing it');
  });

  await check('narrow window keeps the panel usable', async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await panel.getByRole('button', { name: 'Probar de nuevo' }).waitFor();
    assert.ok(await panel.getByRole('button', { name: 'Probar de nuevo' }).isVisible());
    await assertNoSidewaysScroll();
    await page.screenshot({ path: join(SHOTS, 'angosta.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
  });
} finally {
  await context.close();
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} de ${results.length} pasaron`);
process.exitCode = failed ? 1 : 0;
