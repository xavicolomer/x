import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHandler } from '../lambda/api.mjs';
import { FakeDb } from '../dev/fake-db.mjs';

const setup = () => {
  let t = 1000;
  return makeHandler({ db: new FakeDb(), table: 't', now: () => ++t, presign: async ({ key, type }) => ({ url: 'https://upload', fields: { key, 'Content-Type': type } }) });
};
const as = (sub, name = sub, groups = '') => ({ authorizer: { jwt: { claims: { sub, name, 'cognito:groups': groups } } } });
const call = async (h, routeKey, { params = {}, body, user } = {}) => {
  const r = await h({ routeKey, pathParameters: params, body: body && JSON.stringify(body), requestContext: user || {} });
  return { status: r.statusCode, body: JSON.parse(r.body || '{}') };
};
const home = { name: 'Piso', rooms: [{ id: 'room-1', name: 'Salón', w: 4, l: 5, h: 2.6, items: [] }] };
const summary = { name: 'Piso', rooms: 1, area: 20 };

test('publishing: anyone reads, only signed-in people publish, newest first', async () => {
  const h = setup();
  assert.equal((await call(h, 'PUT /api/homes/{id}', { params: { id: 'r-1' }, body: { home, summary } })).status, 401);
  assert.equal((await call(h, 'PUT /api/homes/{id}', { params: { id: 'r-1' }, body: { home, summary }, user: as('ana', 'Ana') })).status, 200);
  assert.equal((await call(h, 'PUT /api/homes/{id}', { params: { id: 'r-2' }, body: { home: { ...home, name: 'Casa' }, summary }, user: as('bea', 'Bea') })).status, 200);
  const list = await call(h, 'GET /api/homes');
  assert.deepEqual(list.body.homes.map(x => [x.owner, x.id, x.ownerName]), [['bea', 'r-2', 'Bea'], ['ana', 'r-1', 'Ana']]);
  const one = await call(h, 'GET /api/homes/{owner}/{id}', { params: { owner: 'ana', id: 'r-1' } });
  assert.equal(JSON.parse(one.body.doc).name, 'Piso');
});

test('unpublishing: the owner or an admin, nobody else', async () => {
  const h = setup();
  await call(h, 'PUT /api/homes/{id}', { params: { id: 'r-1' }, body: { home, summary }, user: as('ana') });
  assert.equal((await call(h, 'DELETE /api/homes/{owner}/{id}', { params: { owner: 'ana', id: 'r-1' }, user: as('bea') })).status, 403);
  assert.equal((await call(h, 'DELETE /api/homes/{owner}/{id}', { params: { owner: 'ana', id: 'r-1' }, user: as('mod', 'Mod', '[admins]') })).status, 200);
  assert.equal((await call(h, 'GET /api/homes')).body.homes.length, 0);
});

test('drafts are private to each person', async () => {
  const h = setup();
  await call(h, 'PUT /api/me/drafts/{id}', { params: { id: 'r-1' }, body: { doc: home }, user: as('ana') });
  assert.equal((await call(h, 'GET /api/me/drafts', { user: as('ana') })).body.drafts.length, 1);
  assert.equal((await call(h, 'GET /api/me/drafts', { user: as('bea') })).body.drafts.length, 0);
  assert.equal((await call(h, 'GET /api/me/drafts')).status, 401);
  await call(h, 'DELETE /api/me/drafts/{id}', { params: { id: 'r-1' }, user: as('ana') });
  assert.equal((await call(h, 'GET /api/me/drafts', { user: as('ana') })).body.drafts.length, 0);
});

test('shops: the built-in IKEA catalogue plus each person\'s own shop', async () => {
  const h = setup();
  let shops = (await call(h, 'GET /api/shops')).body.shops;
  assert.deepEqual(shops.map(s => s.id), ['ikea-es']);
  assert.ok(JSON.parse(shops[0].doc).products.length > 50);
  await call(h, 'PUT /api/shops/me', { body: { doc: { name: 'Casa Lino', products: [] } }, user: as('ana') });
  shops = (await call(h, 'GET /api/shops')).body.shops;
  assert.deepEqual(shops.map(s => s.id), ['ikea-es', 'ana']);
});

test('limits: bad ids, oversized homes, unsupported or oversized uploads', async () => {
  const h = setup();
  assert.equal((await call(h, 'PUT /api/me/drafts/{id}', { params: { id: '../x' }, body: { doc: home }, user: as('ana') })).status, 400);
  const big = { name: 'x'.repeat(400 * 1024) };
  assert.equal((await call(h, 'PUT /api/me/drafts/{id}', { params: { id: 'r-1' }, body: { doc: big }, user: as('ana') })).status, 400);
  assert.equal((await call(h, 'POST /api/uploads', { body: { type: 'text/html', size: 10 }, user: as('ana') })).status, 400);
  assert.equal((await call(h, 'POST /api/uploads', { body: { type: 'image/jpeg', size: 11 * 1024 * 1024 }, user: as('ana') })).status, 413);
  const ok = await call(h, 'POST /api/uploads', { body: { type: 'image/jpeg', size: 1000 }, user: as('ana') });
  assert.equal(ok.status, 200);
  assert.match(ok.body.id, /^[0-9a-f]{32}$/);
  assert.equal(ok.body.fields.key, `_blob/${ok.body.id}`);
});
