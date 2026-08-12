#!/usr/bin/env node

/**
 * Tiny static server dedicated to browser acceptance. It deliberately serves
 * the release root without build tooling, matching GitHub Pages path behavior.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SPECTER_ACCEPTANCE_PORT || 4175);
const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wav': 'audio/wav'
});

function localPath(urlPath) {
  const decoded = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const target = resolve(ROOT, `.${decoded}`);
  if (relative(ROOT, target).startsWith('..') || target.includes(`${sep}..${sep}`)) return null;
  return target;
}

const server = createServer(async (request, response) => {
  if (!request.url || request.method !== 'GET') { response.writeHead(405).end(); return; }
  const target = localPath(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!target) { response.writeHead(403).end(); return; }
  try {
    const info = await stat(target);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    const shell = ['.html', '.js', '.mjs', '.css', '.webmanifest'].includes(extname(target).toLowerCase());
    response.writeHead(200, {
      'content-type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      // Browser tests intentionally reload to validate saved settings. Keep the
      // shell fresh while letting large immutable models/maps use the context
      // cache, just as a normal deployed browser would after its first load.
      'cache-control': shell ? 'no-cache' : 'public, max-age=3600, immutable',
      'cross-origin-opener-policy': 'same-origin'
    });
    createReadStream(target).pipe(response);
  } catch { response.writeHead(404).end(); }
});

server.listen(port, '127.0.0.1', () => console.log(`SPECTER acceptance server listening at http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
