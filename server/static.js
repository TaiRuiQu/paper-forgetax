import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetVersion } from './asset-version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const SHARED = path.join(ROOT, 'shared');
const PORT = Number(process.env.WEB_PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const API_HOST = HOST === '0.0.0.0' ? '127.0.0.1' : HOST === '::' ? '::1' : HOST;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function resolveSafe(base, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const target = path.resolve(base, '.' + decoded);
  if (!target.startsWith(base + path.sep) && target !== base) return null;
  return target;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = new URL(req.url, 'http://localhost').pathname; } catch { res.writeHead(400); res.end('Bad Request'); return; }

  // The versioned directory keeps relative module imports, CSS URLs and dynamic
  // image paths in the same version, including deployments below a subpath.
  const versioned = /^\/_v\/[a-f0-9]{16}\//.test(urlPath);
  if (versioned) urlPath = urlPath.replace(/^\/_v\/[a-f0-9]{16}/, '');

  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    const upstream = http.request({
      hostname: API_HOST,
      port: Number(process.env.PORT || 3001),
      method: req.method,
      path: req.url,
      headers: req.headers,
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'api-unavailable' }));
    });
    req.on('error', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }

  let base = CLIENT;
  let rel = urlPath;
  if (urlPath.startsWith('/shared/')) {
    base = SHARED;
    rel = urlPath.slice('/shared'.length);
  }
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = resolveSafe(base, rel);
  if (!target) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(target, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(target, req, res, versioned);
      return;
    }
    if (urlPath.startsWith('/shared/') || path.extname(urlPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    serveFile(path.join(CLIENT, 'index.html'), req, res, versioned);
  });
});

function serveFile(file, req, res, versioned = false) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    if (ext === '.html') {
      // Recompute on page loads so local edits also invalidate cached assets
      // without restarting the static server.
      const version = assetVersion([CLIENT, SHARED]);
      const prefix = versioned ? '../../' : './';
      data = Buffer.from(data.toString('utf8').replace('<head>', `<head>\n  <base href="${prefix}_v/${version}/">`));
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': data.length,
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  });
}

server.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`[forgetax-web] serving client at http://${HOST}:${addr.port}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));

export { server };
