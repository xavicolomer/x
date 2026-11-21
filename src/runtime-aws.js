/* =====================================================================
   AWS runtime: used when the page is served with a config.json that names an API (see infra/).
   Provides the same calls as the claude.ai platform and the offline runtime (db, user, assets, downloads),
   backed by the Nido API (Lambda + DynamoDB), S3 uploads and Cognito sign-in.
   To keep costs per use, nothing polls fast: shared lists refresh on load, after your own changes,
   when you come back to the tab, and every five minutes while it's open.
   ===================================================================== */
function awsRuntime(cfg) {
  const base = cfg.apiBase || '/api';
  const AUTH_KEY = 'nido-auth', PKCE_KEY = 'nido-pkce';
  const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const decode = (jwt) => { try { const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4))))); } catch (e) { return null; } };
  let auth = store.get(AUTH_KEY);        // { id, refresh, exp, claims }

  /* ----- sign-in: Cognito's hosted page, authorization code with PKCE (no client secret in the browser) ----- */
  const redirectUri = location.origin + location.pathname;
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const tokenCall = async (params) => {
    const r = await fetch(cfg.authDomain + '/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cfg.clientId, ...params }) });
    if (!r.ok) throw new Error('token ' + r.status);
    return r.json();
  };
  const keep = (t, refresh) => {
    const claims = decode(t.id_token);
    auth = { id: t.id_token, refresh: t.refresh_token || refresh, exp: claims && claims.exp ? claims.exp * 1000 : Date.now() + 3e6, claims };
    store.set(AUTH_KEY, auth);
  };
  async function signIn() {
    if (cfg.dev) {                       // local development: no Cognito, just a name
      const name = (window.prompt ? window.prompt('Your name (local test sign-in)', 'Tester') : null) || 'Tester';
      const sub = 'dev-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      auth = { id: `dev:${sub}:${encodeURIComponent(name)}`, refresh: null, exp: Date.now() + 864e5 * 30, claims: { sub, name } };
      store.set(AUTH_KEY, auth); location.reload(); return;
    }
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48))), state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, hash: location.hash }));
    location.assign(`${cfg.authDomain}/oauth2/authorize?` + new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: redirectUri,
      scope: 'openid email profile', code_challenge_method: 'S256', code_challenge: challenge, state }));
  }
  function signOut() {
    auth = null; store.set(AUTH_KEY, null);
    if (cfg.dev) { location.reload(); return; }
    location.assign(`${cfg.authDomain}/logout?` + new URLSearchParams({ client_id: cfg.clientId, logout_uri: redirectUri }));
  }
  async function finishSignIn() {        // back from the sign-in page with ?code=…&state=…
    const q = new URLSearchParams(location.search);
    if (!q.get('code')) return;
    let saved = null; try { saved = JSON.parse(sessionStorage.getItem(PKCE_KEY)); } catch (e) {}
    sessionStorage.removeItem(PKCE_KEY);
    if (saved && saved.state === q.get('state')) {
      try { keep(await tokenCall({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri, code_verifier: saved.verifier })); } catch (e) {}
    }
    history.replaceState(null, '', location.pathname + ((saved && saved.hash) || location.hash));
  }
  async function token() {
    if (!auth) return null;
    if (cfg.dev || Date.now() < auth.exp - 60000) return auth.id;
    if (!auth.refresh) { auth = null; store.set(AUTH_KEY, null); return null; }
    try { keep(await tokenCall({ grant_type: 'refresh_token', refresh_token: auth.refresh }), auth.refresh); return auth.id; }
    catch (e) { auth = null; store.set(AUTH_KEY, null); return null; }
  }

  /* ----- API ----- */
  async function api(method, path, body) {
    const headers = {}, t = await token();
    if (t) headers.authorization = 'Bearer ' + t;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw { code: r.status === 400 || r.status === 401 || r.status === 403 ? 'invalid_argument' : r.status === 413 ? 'too_large' : 'unavailable', status: r.status };
    return r.json();
  }

  /* ----- the store calls the app makes, mapped onto the API ----- */
  const names = new Map();               // owner id -> display name, from the published list
  const listeners = { homes: new Set(), shops: new Set(), drafts: new Set() };
  const cache = { homes: null, shops: null, drafts: null };
  const snap = (id, data) => ({ id, exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false, hasPendingWrites: false } });
  const qsnap = (entries, prev) => {
    const docs = entries.map(([id, d]) => snap(id, d)), changes = docs.map(d => ({ type: prev && prev.has(d.id) ? 'modified' : 'added', doc: d }));
    if (prev) for (const id of prev.keys()) if (!entries.some(([i]) => i === id)) changes.push({ type: 'removed', doc: snap(id, prev.get(id)) });
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const emit = (kind, prev) => { const entries = [...cache[kind]]; for (const l of listeners[kind]) l(qsnap(entries, prev)); };
  const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  async function refresh(kind) {
    try {
      const prev = cache[kind];
      if (kind === 'homes') {
        const r = await api('GET', '/homes'), by = new Map();
        for (const h of r.homes || []) {
          if (h.ownerName) names.set(h.owner, h.ownerName);
          if (!by.has(h.owner)) by.set(h.owner, { rooms: [] });
          by.get(h.owner).rooms.push({ ...(h.summary || {}), id: h.id });
        }
        cache.homes = by;
      } else if (kind === 'shops') {
        cache.shops = new Map((await api('GET', '/shops')).shops.map(s => [s.id, parse(s.doc)]).filter(([, d]) => d));
      } else {
        cache.drafts = new Map((await api('GET', '/me/drafts')).drafts.map(s => [s.id, parse(s.doc)]).filter(([, d]) => d));
      }
      emit(kind, prev);
    } catch (e) { /* keep what's on screen; the next refresh tries again */ }
  }
  const watch = (kind) => (next) => { listeners[kind].add(next); if (cache[kind]) next(qsnap([...cache[kind]], null)); else refresh(kind); return () => listeners[kind].delete(next); };
  let last = Date.now();
  const tick = () => { if (document.visibilityState !== 'visible') return; last = Date.now(); if (listeners.homes.size) refresh('homes'); if (listeners.shops.size) refresh('shops'); };
  document.addEventListener('visibilitychange', () => { if (Date.now() - last > 30000) tick(); });
  setInterval(tick, 5 * 60 * 1000);

  const me = () => (auth && auth.claims ? auth.claims.sub : null);
  const route = (path) => {
    const s = path.split('/');
    if (s[0] === 'data' && s[1] === 'users' && s[2] === me()) return { kind: 'draft', id: s[3] };
    if (s[0] === 'homes' && s.length === 4 && s[2] === 'rooms') return { kind: 'home', owner: s[1], id: s[3] };
    if (s[0] === 'homes' && s.length === 2) return { kind: 'homeList', owner: s[1] };
    if (s[0] === 'shops' && s.length === 2) return { kind: 'shop', id: s[1] };
    return { kind: 'unknown' };
  };
  const docRef = (path) => {
    const r = route(path);
    return {
      id: path.split('/').pop(), path,
      async get() {
        if (r.kind === 'home') { try { const x = await api('GET', `/homes/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.id)}`); if (x.ownerName) names.set(r.owner, x.ownerName); return snap(r.id, parse(x.doc) || undefined); } catch (e) { if (e.status === 404) return snap(r.id, undefined); throw e; } }
        if (r.kind === 'draft') return snap(r.id, cache.drafts && cache.drafts.get(r.id));
        if (r.kind === 'shop') return snap(r.id, cache.shops && cache.shops.get(r.id));
        return snap(r.id, undefined);
      },
      async set(data) {
        if (r.kind === 'draft') {
          const prev = cache.drafts && new Map(cache.drafts); (cache.drafts || (cache.drafts = new Map())).set(r.id, data); emit('drafts', prev);
          await api('PUT', `/me/drafts/${encodeURIComponent(r.id)}`, { doc: data }); return;
        }
        if (r.kind === 'home') { await api('PUT', `/homes/${encodeURIComponent(r.id)}`, { home: data, summary: roomSummary(cleanHome(data), r.id) }); refresh('homes'); return; }
        if (r.kind === 'homeList') { refresh('homes'); return; }           // the server keeps the published list
        if (r.kind === 'shop') { await api('PUT', '/shops/me', { doc: data }); refresh('shops'); return; }
        throw { code: 'invalid_argument', message: 'not available' };
      },
      async update(data) { const cur = await this.get(); return this.set({ ...(cur.data() || {}), ...data }); },
      async delete() {
        if (r.kind === 'draft') { const prev = cache.drafts && new Map(cache.drafts); cache.drafts && cache.drafts.delete(r.id); emit('drafts', prev); await api('DELETE', `/me/drafts/${encodeURIComponent(r.id)}`); return; }
        if (r.kind === 'home') { await api('DELETE', `/homes/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.id)}`); refresh('homes'); return; }
      },
      onSnapshot(next) { this.get().then(next, () => {}); return () => {}; },
      collection: (c) => colRef(path + '/' + c),
    };
  };
  const colRef = (path) => ({
    path,
    doc: (id) => docRef(path + '/' + (id || Math.random().toString(36).slice(2))),
    onSnapshot: path === 'homes' ? watch('homes') : path === 'shops' ? watch('shops') : path === 'data/users/' + me() ? watch('drafts') : (next) => { next(qsnap([], null)); return () => {}; },
    async get() { return qsnap([], null); },
  });
  const db = { doc: docRef, collection: colRef };

  const initials = (n) => { const c = (n || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2c6b58"/><text x="12" y="16" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#fff">${c.replace(/[<&>]/g, '')}</text></svg>`); };
  const myName = () => (auth && auth.claims ? String(auth.claims.name || (auth.claims.email || '').split('@')[0] || 'You') : '');
  const user = {
    me: async () => ({ id: me(), name: myName(), avatarUrl: initials(myName()), color: '#2c6b58', email: auth && auth.claims ? auth.claims.email || null : null, isOwner: false,
      canEdit: !!(auth && auth.claims && String(auth.claims['cognito:groups'] || '').includes('admins')) || (cfg.dev && me() === 'dev-admin') }),
    id: async () => me(), can: async () => !!me(), isOwner: async () => false, canEdit: async () => false,
    profiles: async (ids) => Object.fromEntries([].concat(ids).map(i => { const n = i === me() ? myName() : names.get(i) || ''; return [i, { id: i, name: n, avatarUrl: initials(n), color: '#9aa69f', email: null, isMe: i === me(), guest: false }]; })),
    search: async () => [],
  };
  const assets = {
    async upload(blob, opts) {
      const type = (opts && opts.type) || blob.type;
      const p = await api('POST', '/uploads', { type, size: blob.size });
      const form = new FormData();
      for (const [k, v] of Object.entries(p.fields || {})) form.append(k, v);
      form.append('file', blob);
      const r = await fetch(p.url, { method: 'POST', body: form });
      if (!r.ok) throw { code: 'upstream_error', status: r.status };
      return { id: p.id, url: '/_blob/' + p.id, sizeBytes: blob.size, contentType: type };
    },
    list: async () => ({ assets: [], usage: {} }), delete: async () => ({ deleted: false }),
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const b = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      return { status: 'saved' };
    },
  };
  return {
    use: async (name) => ({ db, user, assets, downloads }[name] || null),
    ready: finishSignIn, signIn, signOut,
    get signedIn() { return !!me(); },
  };
}
