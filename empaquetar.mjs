// Builds the package students download: salida/sysacad-lindo-<version>.zip, with a top folder «sysacad-lindo» and only
// what the browser loads (manifest, scripts, styles and fonts). The version comes from manifest.json.
// Options:
//   --seco      lists what would go in, without writing anything
//   --probar    unzips the package in a temporary folder and runs the checks against it (SL_EXT)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const seco = process.argv.includes('--seco');
const probar = process.argv.includes('--probar');
const { version } = JSON.parse(readFileSync(join(AQUI, 'manifest.json'), 'utf8'));
const ARCHIVOS = ['manifest.json', 'inicio.js', 'contenido.js', 'santo.js', 'supercvg.js', 'estilo.css', 'README.md'];
const fuentes = readdirSync(join(AQUI, 'fuentes')).map((f) => join('fuentes', f));
const todo = [...ARCHIVOS, ...fuentes];
const faltan = todo.filter((f) => !existsSync(join(AQUI, f)));
if (faltan.length) {
  console.error(`Faltan: ${faltan.join(', ')}`);
  process.exit(1);
}
const zip = join(AQUI, 'salida', `sysacad-lindo-${version}.zip`);
if (seco) {
  console.log(`Armaría ${zip} con:\n${todo.map((f) => `  sysacad-lindo/${f.replace(/\\/g, '/')}`).join('\n')}`);
  process.exit(0);
}

const temp = mkdtempSync(join(tmpdir(), 'sl-paquete-'));
try {
  const carpeta = join(temp, 'sysacad-lindo');
  for (const f of todo) {
    mkdirSync(dirname(join(carpeta, f)), { recursive: true });
    cpSync(join(AQUI, f), join(carpeta, f));
  }
  mkdirSync(dirname(zip), { recursive: true });
  rmSync(zip, { force: true });
  // Windows' own tar writes zip files (-a picks the format from the name).
  const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'zip';
  const args = process.platform === 'win32' ? ['-a', '-cf', zip, 'sysacad-lindo'] : ['-qr', zip, 'sysacad-lindo'];
  const r = spawnSync(tar, args, { cwd: temp, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('No pude armar el zip');
  console.log(`Listo: ${zip}`);

  if (probar) {
    const abierto = mkdtempSync(join(tmpdir(), 'sl-abierto-'));
    try {
      const x = spawnSync(tar, process.platform === 'win32' ? ['-xf', zip] : [zip], { cwd: abierto, stdio: 'inherit' });
      if (x.status !== 0) throw new Error('No pude abrir el zip');
      const p = spawnSync(process.execPath, [join(AQUI, 'pruebas', 'correr.mjs')], {
        stdio: 'inherit',
        env: { ...process.env, SL_EXT: join(abierto, 'sysacad-lindo') },
      });
      if (p.status !== 0) process.exitCode = 1;
    } finally {
      rmSync(abierto, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
