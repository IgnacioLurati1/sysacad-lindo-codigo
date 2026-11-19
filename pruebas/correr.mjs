// Runs the end-to-end checks (pruebas/e2e.mjs) with the playwright-core that Node finds from here (this repo's
// node_modules or a parent folder's), and with Playwright's own Chromium if it is installed.
// PLAYWRIGHT_MODULE and CHROMIUM_PATH still win if they are set. SL_EXT points the checks at another copy (the package).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
if (!env.PLAYWRIGHT_MODULE) {
  try {
    env.PLAYWRIGHT_MODULE = dirname(createRequire(import.meta.url).resolve('playwright-core/package.json'));
  } catch {
    console.error('Falta Playwright: corré npm install (o poné PLAYWRIGHT_MODULE con la ruta al paquete).');
    process.exit(1);
  }
}
const chrome = join(homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe');
if (!env.CHROMIUM_PATH && existsSync(chrome)) env.CHROMIUM_PATH = chrome;
const r = spawnSync(process.execPath, [join(AQUI, 'e2e.mjs'), ...process.argv.slice(2)], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
