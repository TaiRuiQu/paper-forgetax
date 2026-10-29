import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const env = { ...process.env };

const children = [];
let shuttingDown = false;

function launch(label, script) {
  const child = spawn(process.execPath, [script], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[${label}] ${d}`));
  child.on('exit', code => {
    if (!shuttingDown) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code || 1);
    }
  });
  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try { c.kill(); } catch { /* ignore */ }
  }
  setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('  ______                    ______   ');
console.log(' / ____/____  _________  /_  __/___ | |');
console.log('/ /_  / __ \\/ ___/ __ \\  / / / __ `/| |');
console.log('  /_/ /_/  /_/  /_/  /_/ /_/ /_/ /_/ |_|  (2D)');
console.log('');
console.log('Starting ForgeTax 2D...');
console.log(`  Web:  http://127.0.0.1:${env.WEB_PORT || 5173}`);
console.log(`  API:  http://127.0.0.1:${env.PORT || 3001}/api/health`);
console.log('  Data: server/data/forgetax.db');
console.log('  Stop with Ctrl+C');
console.log('');

launch('api', 'server/src/index.js');
launch('web', 'server/static.js');
