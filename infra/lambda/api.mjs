/* Nido API: one Lambda behind an HTTP API, one DynamoDB table (on-demand), uploads straight to S3.

   Table layout (PK, SK):
     USER#<sub>   DRAFT#<id>   a person's private draft home                 doc
     USER#<sub>   HOME#<id>    a published home; GSI1 = PUBLISHED / time     doc, summary, owner, ownerName
     SHOP#<id>    SHOP         a shop and its products; GSI1 = SHOPS / id    doc
   Documents are stored as JSON strings: the app validates and cleans everything it reads. */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { randomBytes } from 'node:crypto';
import ikea from '../../src/data/ikea-es.json' with { type: 'json' };
import serveiEstacio from '../../src/data/servei-estacio.json' with { type: 'json' };
import nidoPaint from '../../src/data/nido-paint.json' with { type: 'json' };

const MAX_DOC = 350 * 1024;              // DynamoDB items are at most 400 KB
const MAX_SUMMARY = 4 * 1024;
export const MAX_UPLOAD = 10 * 1024 * 1024;
export const UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json']);
const ID = /^[\w-]{1,60}$/, OWNER = /^[\w-]{1,80}$/;

/* Catalogues that ship with the app (read-only, so they cost nothing to store). Nido Paint is provisional: a stand-in
   brand for wall paint, linking to Amazon, until a paint shop's own catalogue is in Nido. */
export const BUILTIN_SHOPS = [{ id: 'ikea-es', doc: JSON.stringify(ikea) }, { id: 'servei-estacio', doc: JSON.stringify(serveiEstacio) }, { id: 'nido-paint', doc: JSON.stringify(nidoPaint) }];

/* db: a DynamoDB document client (anything with send(command)); presign({ key, type }) -> { url, fields }. */
export function makeHandler({ db, presign, table, now = () => Date.now(), builtinShops = BUILTIN_SHOPS }) {
  const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
  const fail = (statusCode, message) => json(statusCode, { error: message });
  const who = (ev) => {
    const c = ev.requestContext && ev.requestContext.authorizer && ev.requestContext.authorizer.jwt && ev.requestContext.authorizer.jwt.claims;
    if (!c || !c.sub || !OWNER.test(c.sub)) return null;
    const name = String(c.name || c.given_name || (c.email ? String(c.email).split('@')[0] : '') || 'Someone').slice(0, 60);
    return { sub: c.sub, name, admin: /(^|[\s,[\]"])admins([\s,[\]"]|$)/.test(String(c['cognito:groups'] || '')) };
  };
  const readBody = (ev) => {
    try { return JSON.parse(ev.isBase64Encoded ? Buffer.from(ev.body || '', 'base64').toString('utf8') : ev.body || '{}'); } catch (e) { return null; }
  };
  const docString = (v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const s = JSON.stringify(v);
    return Buffer.byteLength(s) <= MAX_DOC ? s : null;
  };
  const queryAll = async (input, max = 300) => {
    const out = [];
    let start;
    do {
      const r = await db.send(new QueryCommand({ TableName: table, ...input, ExclusiveStartKey: start }));
      out.push(...(r.Items || []));
      start = r.LastEvaluatedKey;
    } while (start && out.length < max);
    return out.slice(0, max);
  };
  const time = () => String(now()).padStart(15, '0');

  return async (ev) => {
    const route = ev.routeKey, p = ev.pathParameters || {}, u = who(ev);
    if (p.id !== undefined && !ID.test(p.id)) return fail(400, 'Bad id');
    if (p.owner !== undefined && !OWNER.test(p.owner)) return fail(400, 'Bad owner');
    try {
      switch (route) {
        // ----- public reads -----
        case 'GET /api/homes': {
          const items = await queryAll({ IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :p', ExpressionAttributeValues: { ':p': 'PUBLISHED' }, ScanIndexForward: false });
          return json(200, { homes: items.map(i => ({ owner: i.owner, id: i.id, ownerName: i.ownerName, summary: i.summary })) });
        }
        case 'GET /api/homes/{owner}/{id}': {
          const r = await db.send(new GetCommand({ TableName: table, Key: { PK: `USER#${p.owner}`, SK: `HOME#${p.id}` } }));
          return r.Item ? json(200, { doc: r.Item.doc, ownerName: r.Item.ownerName }) : fail(404, 'Not published');
        }
        case 'GET /api/shops': {
          const items = await queryAll({ IndexName: 'GSI1', KeyConditionExpression: 'GSI1PK = :p', ExpressionAttributeValues: { ':p': 'SHOPS' } });
          const shops = items.map(i => ({ id: i.id, doc: i.doc }));
          return json(200, { shops: [...builtinShops.filter(b => !shops.some(x => x.id === b.id)), ...shops] });
        }
      }
      // ----- everything else needs a signed-in person -----
      if (!u) return fail(401, 'Sign in first');
      switch (route) {
        case 'PUT /api/homes/{id}': {
          const b = readBody(ev), doc = b && docString(b.home);
          const summary = b && b.summary && typeof b.summary === 'object' && !Array.isArray(b.summary) && Buffer.byteLength(JSON.stringify(b.summary)) <= MAX_SUMMARY ? b.summary : null;
          if (!doc || !summary) return fail(400, 'The home is missing or too big');
          await db.send(new PutCommand({ TableName: table, Item: {
            PK: `USER#${u.sub}`, SK: `HOME#${p.id}`, GSI1PK: 'PUBLISHED', GSI1SK: `${time()}#${u.sub}#${p.id}`,
            owner: u.sub, id: p.id, ownerName: u.name, summary: { ...summary, id: p.id }, doc, updatedAt: now() } }));
          return json(200, { ok: true });
        }
        case 'DELETE /api/homes/{owner}/{id}': {
          if (p.owner !== u.sub && !u.admin) return fail(403, 'Only its owner can unpublish this home');
          await db.send(new DeleteCommand({ TableName: table, Key: { PK: `USER#${p.owner}`, SK: `HOME#${p.id}` } }));
          return json(200, { ok: true });
        }
        case 'GET /api/me/drafts': {
          const items = await queryAll({ KeyConditionExpression: 'PK = :p AND begins_with(SK, :s)', ExpressionAttributeValues: { ':p': `USER#${u.sub}`, ':s': 'DRAFT#' } }, 200);
          return json(200, { drafts: items.map(i => ({ id: i.id, doc: i.doc })) });
        }
        case 'PUT /api/me/drafts/{id}': {
          const b = readBody(ev), doc = b && docString(b.doc);
          if (!doc) return fail(400, 'The home is missing or too big');
          await db.send(new PutCommand({ TableName: table, Item: { PK: `USER#${u.sub}`, SK: `DRAFT#${p.id}`, id: p.id, doc, updatedAt: now() } }));
          return json(200, { ok: true });
        }
        case 'DELETE /api/me/drafts/{id}': {
          await db.send(new DeleteCommand({ TableName: table, Key: { PK: `USER#${u.sub}`, SK: `DRAFT#${p.id}` } }));
          return json(200, { ok: true });
        }
        case 'PUT /api/shops/me':
        case 'PUT /api/shops/{id}': {             // your own shop; admins can also keep a vendor that isn't on Nido itself
          const id = route === 'PUT /api/shops/me' ? u.sub : p.id;
          if (id !== u.sub && !u.admin) return fail(403, 'Only Nido’s admins can edit another vendor');
          const b = readBody(ev), doc = b && docString(b.doc);
          if (!doc) return fail(400, 'The shop is missing or too big');
          await db.send(new PutCommand({ TableName: table, Item: { PK: `SHOP#${id}`, SK: 'SHOP', GSI1PK: 'SHOPS', GSI1SK: id, id, owner: id === u.sub ? u.sub : 'nido', editedBy: u.sub, doc, updatedAt: now() } }));
          return json(200, { ok: true });
        }
        case 'POST /api/uploads': {
          const b = readBody(ev);
          if (!b || !UPLOAD_TYPES.has(b.type)) return fail(400, 'That file type isn’t supported');
          if (!(b.size > 0 && b.size <= MAX_UPLOAD)) return fail(413, 'Files can be at most 10 MB');
          const id = randomBytes(16).toString('hex');
          const post = await presign({ key: `_blob/${id}`, type: b.type });
          return json(200, { id, ...post });
        }
      }
      return fail(404, 'No such route');
    } catch (e) {
      console.error(route, e);
      return fail(500, 'Something went wrong');
    }
  };
}

/* In Lambda: the real clients, configured from the environment. */
let real = null;
export const handler = async (ev) => {
  if (!real) {
    const s3 = new S3Client({});
    real = makeHandler({
      db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
      table: process.env.TABLE,
      presign: ({ key, type }) => createPresignedPost(s3, {
        Bucket: process.env.BUCKET, Key: key, Expires: 300, Fields: { 'Content-Type': type },
        Conditions: [['content-length-range', 1, MAX_UPLOAD], ['eq', '$Content-Type', type]],
      }),
    });
  }
  return real(ev);
};
