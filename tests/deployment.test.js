import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assetVersion } from '../server/asset-version.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('browser API uses its deployment path and isolates saved overrides', () => {
  const source = fs.readFileSync(new URL('../client/js/api.js', import.meta.url), 'utf8');
  const saved = new Map([['forgetax.api', 'http://old-host:3001/api']]);
  function detect(base, search = '') {
    const context = {
      URL, URLSearchParams, location: { search },
      localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    };
    vm.runInNewContext(source.replaceAll('import.meta.url', JSON.stringify(`${base}js/api.js`))
      .replace(/^import .*;\r?$/gm, '')
      .replace(/^export /gm, '') + '\nglobalThis.result = API_BASE;', context);
    return context.result;
  }
  assert.equal(detect('https://game.example.com/'), 'https://game.example.com/api');
  assert.equal(detect('https://game.example.com/_v/0123456789abcdef/'), 'https://game.example.com/api');
  assert.equal(detect('https://game.example.com/forgetax/_v/0123456789abcdef/'), 'https://game.example.com/forgetax/api');
  assert.equal(detect('https://game.example.com/forgetax/'), 'https://game.example.com/forgetax/api');
  assert.equal(detect('https://game.example.com/forgetax/', '?api=https://api.example.com/api/'), 'https://api.example.com/api');
  assert.equal(detect('https://game.example.com/forgetax/'), 'https://api.example.com/api');
  assert.equal(detect('https://game.example.com/forgetax/_v/fedcba9876543210/'), 'https://api.example.com/api');
  assert.equal(detect('https://game.example.com/'), 'https://game.example.com/api');
});

test('resource versions change with content, additions and removals, not timestamps', t => {
  const root = fs.mkdtempSync(`${os.tmpdir()}/forgetax-assets-`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = `${root}/style.css`;
  fs.writeFileSync(file, 'body { color: red; }');
  const original = assetVersion([root]);
  assert.match(original, /^[a-f0-9]{16}$/);
  fs.utimesSync(file, new Date(0), new Date(0));
  assert.equal(assetVersion([root]), original);
  fs.writeFileSync(file, 'body { color: tan; }');
  assert.notEqual(assetVersion([root]), original);
  fs.writeFileSync(file, 'body { color: red; }');
  assert.equal(assetVersion([root]), original);
  fs.writeFileSync(`${root}/image.svg`, '<svg/>');
  assert.notEqual(assetVersion([root]), original);
  fs.unlinkSync(`${root}/image.svg`);
  assert.equal(assetVersion([root]), original);
});

async function launch(script, env) {
  const child = spawn(process.execPath, [script], {
    cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(output || 'Startup timeout')), 10000);
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child.stderr.on('data', chunk => { output += chunk; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Exited ${code}: ${output}`)); });
    });
    return { child, port };
  } catch (error) { child.kill(); throw error; }
}

async function stop(child) {
  if (child.exitCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}

test('root and stripped subpath serve the module graph, assets and API', async t => {
  const dataDir = fs.mkdtempSync(`${os.tmpdir()}/forgetax-deploy-`);
  let api, web, proxy;
  t.after(async () => {
    if (proxy) {
      proxy.closeAllConnections();
      await new Promise(resolve => proxy.close(resolve));
    }
    if (web) await stop(web.child);
    if (api) await stop(api.child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  api = await launch('server/src/index.js', { PORT: '0', FORGETAX_DATA_DIR: dataDir });
  web = await launch('server/static.js', { PORT: String(api.port), WEB_PORT: '0' });

  // Model Caddy handle_path: remove the prefix before proxying all methods.
  proxy = http.createServer((req, res) => {
    if (!req.url.startsWith('/forgetax/')) { res.writeHead(404); res.end(); return; }
    const upstream = http.request({ hostname: '127.0.0.1', port: web.port,
      path: req.url.slice('/forgetax'.length), method: req.method, headers: req.headers,
    }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(502); res.end();
    });
    req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));

  for (const base of [`http://127.0.0.1:${web.port}/`, `http://127.0.0.1:${proxy.address().port}/forgetax/`]) {
    const seen = new Set();
    async function visit(url) {
      if (seen.has(url)) return;
      seen.add(url);
      assert.ok(url.startsWith(base), `Escaped deployment path: ${url}`);
      const response = await fetch(url);
      assert.equal(response.status, 200, url);
      const type = response.headers.get('content-type');
      if (url.endsWith('.webmanifest')) {
        // Installed web app: launches at the deployment root, fullscreen landscape.
        assert.match(type, /application\/manifest\+json/);
        const manifest = await response.json();
        assert.equal(new URL(manifest.start_url, url).href, base);
        assert.equal(new URL(manifest.scope, url).href, base);
        assert.equal(manifest.orientation, 'landscape');
        for (const icon of manifest.icons) await visit(new URL(icon.src, url).href);
        return;
      }
      if (!/text\/html|javascript|text\/css/.test(type)) return;
      const source = await response.text();
      const documentBase = type.includes('html')
        ? new URL(source.match(/<base href="([^"]+)"/)[1], url).href
        : url;
      if (type.includes('html')) {
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.match(documentBase, /\/_v\/[a-f0-9]{16}\/$/);
      }
      const refs = type.includes('html')
        ? [...source.replace(/<base[^>]+>/, '').matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
        : type.includes('javascript')
          ? [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(m => m[1])
          : [...source.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)].map(m => m[1]);
      for (const ref of refs) await visit(new URL(ref, documentBase).href);
    }
    await visit(base);
    assert.ok(seen.size > 30, 'Crawled HTML, CSS, modules, fonts and images');
    assert.ok([...seen].filter(url => url !== base).every(url => /\/_v\/[a-f0-9]{16}\//.test(url)), 'Every resource in the graph carries a version');
    assert.equal((await (await fetch(`${base}api/health`)).json()).ok, true);
    const username = base.includes('/forgetax/') ? 'prefixuser' : 'rootuser';
    const registered = await fetch(`${base}api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'deploy-test-password' }),
    });
    assert.equal(registered.status, 201);
    const { token } = await registered.json();
    const me = await fetch(`${base}api/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 200);
    const login = await fetch(`${base}api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'deploy-test-password' }),
    });
    assert.equal(login.status, 200);
  }
});

test('layout media queries in CSS match the ones the controller uses', () => {
  const device = fs.readFileSync(new URL('../client/js/device.js', import.meta.url), 'utf8');
  const query = name => device.match(new RegExp(`${name} = '([^']+)'`))[1];
  const css = file => fs.readFileSync(new URL(`../client/css/${file}`, import.meta.url), 'utf8');
  const portrait = query('PORTRAIT_COMPACT_QUERY');
  for (const file of ['style.css', 'workshop.css']) {
    const blocks = css(file).match(/@media [^{]*max-width: 800px[^{]*\{/g).filter(m => !m.includes('min-width'));
    assert.ok(blocks.length > 0, file);
    for (const block of blocks) assert.equal(block, `@media ${portrait} {`, `${file}: ${block}`);
  }
  assert.ok(css('mobile.css').includes(`@media ${query('LANDSCAPE_COMPACT_QUERY')} {`));
  const fold = query('FOLD_QUERY');
  const foldBlocks = css('fold.css').match(/@media [^{]+\{/g);
  assert.ok(foldBlocks.length >= 4);
  for (const block of foldBlocks) assert.ok(block.startsWith(`@media ${fold.replace('(max-width: 1180px)', '')}`), block);
  assert.ok(fs.readFileSync(new URL('../client/index.html', import.meta.url), 'utf8').includes('href="./css/fold.css"'));
});
