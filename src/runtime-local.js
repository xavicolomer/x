/* =====================================================================
   Offline runtime. When the page isn't running inside claude.ai there is no shared
   database, sign-in or upload service, so this provides the same calls the app uses
   (db, user, assets, downloads), kept in this browser's IndexedDB.
   Documents are held in memory and written through; images and 3D models are blobs,
   shown through object URLs (see blobSrc).
   ===================================================================== */
const localRuntime = (() => {
  const docs = new Map(), blobs = new Map(), urls = new Map(), listeners = new Set();
  let idb = null, persistent = true;
  const openIdb = () => new Promise((res) => {
    try {
      const r = indexedDB.open('nido-offline', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('docs'); r.result.createObjectStore('blobs'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  const all = (store) => new Promise((res) => {
    const out = new Map();
    try {
      const req = idb.transaction(store).objectStore(store).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.set(c.key, c.value); c.continue(); } else res(out); };
      req.onerror = () => res(out);
    } catch (e) { res(out); }
  });
  const put = (store, key, value) => { if (!idb) return Promise.resolve(); return new Promise((res) => {
    try { const t = idb.transaction(store, 'readwrite'); value === undefined ? t.objectStore(store).delete(key) : t.objectStore(store).put(value, key); t.oncomplete = res; t.onerror = res; } catch (e) { res(); }
  }); };
  let readyP = null;          // opened on first use, so pages inside claude.ai never touch it
  const ready = () => readyP || (readyP = (async () => {
    idb = await openIdb();
    persistent = !!idb;
    if (idb) {
      for (const [k, v] of await all('docs')) docs.set(k, v);
      for (const [k, v] of await all('blobs')) { blobs.set(k, v); urls.set(k, URL.createObjectURL(v)); }
    }
    // the bundled catalogue, refreshed when the bundled copy is newer
    if (typeof IKEA_SEED !== 'undefined') {
      const cur = docs.get('shops/ikea-es');
      if (!cur || (cur.updatedAt || 0) < IKEA_SEED.updatedAt) { docs.set('shops/ikea-es', IKEA_SEED); put('docs', 'shops/ikea-es', IKEA_SEED); }
    }
  })());
  const segs = (p) => p.split('/');
  const parentOf = (p) => segs(p).slice(0, -1).join('/');
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const snapDoc = (p) => ({ id: segs(p).pop(), exists: docs.has(p), data: () => (docs.has(p) ? clone(docs.get(p)) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
  let firing = 0;
  const fire = () => { clearTimeout(firing); firing = setTimeout(() => { for (const l of listeners) l(); }, 0); };
  const write = async (p, v) => { await ready(); if (v === undefined) docs.delete(p); else docs.set(p, clone(v)); fire(); await put('docs', p, v === undefined ? undefined : clone(v)); };
  const docRef = (p) => ({
    id: segs(p).pop(), path: p,
    get: async () => { await ready(); return snapDoc(p); },
    set: (d) => write(p, d),
    update: async (d) => { await ready(); if (!docs.has(p)) throw { code: 'invalid_argument', message: 'missing' }; return write(p, { ...docs.get(p), ...d }); },
    delete: () => write(p, undefined),
    onSnapshot: (next) => { const l = () => next(snapDoc(p)); ready().then(() => { listeners.add(l); l(); }); return () => listeners.delete(l); },
    collection: (c) => colRef(p + '/' + c),
  });
  const colRef = (p) => ({
    path: p,
    doc: (id) => docRef(p + '/' + (id || Math.random().toString(36).slice(2))),
    get: async () => { await ready(); const d = [...docs.keys()].filter(k => parentOf(k) === p).map(snapDoc); return { docs: d, size: d.length, empty: !d.length, docChanges: () => [] }; },
    onSnapshot: (next) => {
      let prev = new Map();
      const l = () => {
        const keys = [...docs.keys()].filter(k => parentOf(k) === p), list = keys.map(snapDoc), changes = [];
        for (const d of list) changes.push({ type: prev.has(d.id) ? 'modified' : 'added', doc: d });
        for (const [id, d] of prev) if (!keys.some(k => segs(k).pop() === id)) changes.push({ type: 'removed', doc: d });
        prev = new Map(list.map(d => [d.id, d]));
        next({ docs: list, size: list.length, empty: !list.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } });
      };
      ready().then(() => { listeners.add(l); l(); });
      return () => listeners.delete(l);
    },
  });
  const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2c6b58"/><circle cx="12" cy="9.5" r="4" fill="#e0eee8"/><path d="M4.5 20a8 8 0 0 1 15 0" fill="#e0eee8"/></svg>');
  const me = { id: 'u_local', name: 'You', avatarUrl: avatar, color: '#2c6b58', email: null, isOwner: true, canEdit: true };
  const user = {
    me: async () => ({ ...me }), id: async () => me.id, name: async () => me.name, isOwner: async () => true, canEdit: async () => true, can: async () => true,
    profiles: async (ids) => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: i === me.id ? 'You' : 'Someone', avatarUrl: avatar, color: '#9aa69f', email: null, isMe: i === me.id, guest: false }])),
    search: async () => [],
  };
  const newAssetId = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const assets = {
    upload: async (blob, opts) => {
      await ready();
      if (!(blob instanceof Blob) || !blob.size) throw { code: 'invalid_request', message: 'empty' };
      if (blob.size > 20 * 1024 * 1024) throw { code: 'too_large', message: 'over 20 MB' };
      const type = (opts && opts.type) || blob.type || 'application/octet-stream', b = blob.type === type ? blob : new Blob([blob], { type }), id = newAssetId();
      blobs.set(id, b); urls.set(id, URL.createObjectURL(b)); await put('blobs', id, b);
      return { id, url: urls.get(id), sizeBytes: b.size, contentType: type };
    },
    list: async () => { await ready(); return { assets: [...blobs].map(([id, b]) => ({ id, url: urls.get(id), contentType: b.type, sizeBytes: b.size, createdAt: '' })), usage: { files: blobs.size, bytes: [...blobs.values()].reduce((t, b) => t + b.size, 0), maxFiles: Infinity, maxBytes: Infinity } }; },
    delete: async (id) => { await ready(); const had = blobs.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } await put('blobs', id, undefined); return { deleted: had }; },
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.json$/i.test(filename) ? 'application/json' : 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return { status: 'saved' };
    },
  };
  const db = { doc: docRef, collection: colRef };
  return {
    use: async (name) => ({ db, user, assets, downloads }[name] || null),
    urlFor: (id) => urls.get(id) || null,
    blob: (id) => blobs.get(id) || null,
    ready, get persistent() { return persistent; },
  };
})();
