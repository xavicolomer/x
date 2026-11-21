/* Local development: the built app, the real API handler, an in-memory table (saved to dev/.data.json) and local uploads.
   Sign-in is simulated: the app shows a name prompt instead of Cognito. Usage: npm run dev, then open http://localhost:8080 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHandler } from '../lambda/api.mjs';
import { FakeDb } from './fake-db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..', '..', 'dist', 'web');
const ROUTES = ['GET /api/homes', 'GET /api/homes/{owner}/{id}', 'GET /api/shops', 'PUT /api/homes/{id}', 'DELETE /api/homes/{owner}/{id}',
  'GET /api/me/drafts', 'PUT /api/me/drafts/{id}', 'DELETE /api/me/drafts/{id}', 'PUT /api/shops/me', 'POST /api/uploads'];

export function devApp({ dataFile = join(here, '.data.json') } = {}) {
  const blobs = new Map();
  const api = makeHandler({ db: new FakeDb(dataFile), table: 'dev', presign: async ({ key, type }) => ({ url: '/dev-upload', fields: { key, 'Content-Type': type } }) });
  const match = (method, path) => {
    for (const r of ROUTES) {
      const [m, pattern] = r.split(' ');
      if (m !== method) continue;
      const names = [], re = new RegExp('^' + pattern.replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
      const hit = path.match(re);
      if (hit) return { routeKey: r, pathParameters: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])) };
    }
    return null;
  };
  // "Bearer dev:<id>:<name>" stands in for a Cognito token; the id dev-admin is in the admins group
  const claimsOf = (h) => {
    const m = /^Bearer dev:([\w-]{1,80}):(.{0,60})$/.exec(h || '');
    return m ? { sub: m[1], name: decodeURIComponent(m[2]), 'cognito:groups': m[1] === 'dev-admin' ? '[admins]' : '' } : null;
  };
  const body = (req) => new Promise((res) => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
  const multipart = (buf, type) => {
    const b = '--' + /boundary=(.+)$/.exec(type || '')[1], out = {};
    let i = buf.indexOf(b);
    while (i >= 0) {
      const next = buf.indexOf(b, i + b.length); if (next < 0) break;
      const part = buf.subarray(i + b.length + 2, next - 2), sep = part.indexOf('\r\n\r\n');
      const head = part.subarray(0, sep).toString(), name = /name="([^"]+)"/.exec(head);
      if (name) out[name[1]] = /filename=/.test(head) ? part.subarray(sep + 4) : part.subarray(sep + 4).toString();
      i = next;
    }
    return out;
  };
  return async (req, res) => {
    const url = new URL(req.url, 'http://local'), path = url.pathname;
    const send = (status, data, type = 'application/json') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(data); };
    if (path.startsWith('/api/')) {
      const m = match(req.method, path);
      if (!m) return send(404, '{"error":"No such route"}');
      const claims = claimsOf(req.headers.authorization);
      const r = await api({ ...m, body: (await body(req)).toString(), isBase64Encoded: false, requestContext: { authorizer: claims ? { jwt: { claims } } : undefined } });
      return send(r.statusCode, r.body);
    }
    if (path === '/dev-upload' && req.method === 'POST') {
      const f = multipart(await body(req), req.headers['content-type']);
      if (!f.key || !f.file) return send(400, '{}');
      blobs.set(f.key.replace(/^_blob\//, ''), { data: f.file, type: f['Content-Type'] });
      return send(204, '');
    }
    if (path.startsWith('/_blob/')) { const b = blobs.get(path.slice(7)); return b ? send(200, b.data, b.type) : send(404, ''); }
    if (path === '/config.json') return send(200, JSON.stringify({ apiBase: '/api', dev: true }));
    try { return send(200, await readFile(join(WEB, 'index.html')), 'text/html; charset=utf-8'); }
    catch (e) { return send(500, 'Run npm run build in the project folder first.', 'text/plain'); }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 8080 unless PORT says otherwise; if that port is taken by something else, try the next ones
  const first = Number(process.env.PORT || 8080), handler = devApp();
  const listen = (port) => {
    const server = createServer(handler);
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && port < first + 20) { console.log(`Port ${port} is in use, trying ${port + 1}…`); listen(port + 1); }
      else { console.error(e.message); process.exit(1); }
    });
    server.listen(port, () => console.log(`Nido dev server: http://localhost:${port}`));
  };
  listen(first);
}
