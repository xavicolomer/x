/* =====================================================================
   Nido screens: Explore, My rooms, Catalogue, For shops, and the 3D studio.
   ===================================================================== */
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }
function openDialog(html, onClick, onSubmit) {
  const back = $('dlg'), box = $('dlg-box');
  box.innerHTML = html; back.hidden = false;
  box.onclick = (e) => { const t = e.target.closest('[data-close]'); if (t) { closeDialog(); return; } onClick && onClick(e); };
  box.onsubmit = (e) => { e.preventDefault(); onSubmit && onSubmit(e); };
  box.onchange = box.oninput = null; box.style.width = '';
  const first = box.querySelector('input, select, button'); first && first.focus();
  return box;
}
function closeDialog() { $('dlg').hidden = true; $('dlg-box').innerHTML = ''; }
$('dlg').addEventListener('click', (e) => { if (e.target === $('dlg')) closeDialog(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('dlg').hidden) closeDialog(); });
const sizeText = (r) => `${cm(r.w)} × ${cm(r.l)} cm`;
const homeText = (h) => (h.rooms > 1 ? `${h.rooms} rooms · ${Math.round(h.area)} m²` : `${cm(h.w)} × ${cm(h.l)} cm`);
const assetSrc = (id) => blobSrc('/_blob/' + id);
const ago = (t) => { if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
const cleanSummary = (x, owner) => ({ id: str(x.id, 60), owner, name: str(x.name, 60, 'Room'), w: num(x.w, 1, 15, 3), l: num(x.l, 1, 15, 3), h: num(x.h, 2, 5, 2.5),
  cover: ASSET.test(x.cover || '') ? x.cover : null, items: num(x.items, 0, 9999, 0), rooms: num(x.rooms, 1, 99, 1), area: num(x.area, 0, 10000, num(x.w, 1, 15, 3) * num(x.l, 1, 15, 3)), shops: Array.isArray(x.shops) ? x.shops.slice(0, 6).map(s => str(s, 60)) : [],
  total: num(x.total, 0, 1e8, 0), updatedAt: num(x.updatedAt, 0, 1e14, 0) });

/* A small floor plan for cards without a picture: every room, its openings and furniture. */
function planSVG(h) {
  if (!h.rooms || !Array.isArray(h.rooms)) return roomSVG({ w: h.w, l: h.l, openings: [], items: [] }, Math.min(150 / h.w, 90 / h.l), 100 - h.w * Math.min(150 / h.w, 90 / h.l) / 2, 62 - h.l * Math.min(150 / h.w, 90 / h.l) / 2, true);
  const b = homeBox(h), s = Math.min(170 / b.w, 104 / b.l);
  const gx = 100 - b.w * s / 2, gy = 62 - b.l * s / 2;
  return `<svg viewBox="0 0 200 124" width="100%" height="100%" aria-hidden="true">${h.rooms.map(r => roomSVG(r, s, gx + (r.x - r.w / 2 - b.x0) * s, gy + (r.z - r.l / 2 - b.z0) * s, false)).join('')}</svg>`;
}
function roomSVG(r, s, ox, oy, wrap) {
  const w = r.w * s, l = r.l * s;
  let out = `${wrap ? '<svg viewBox="0 0 200 124" width="100%" height="100%" aria-hidden="true">' : ''}<rect x="${ox}" y="${oy}" width="${w}" height="${l}" fill="var(--surface)" stroke="var(--fg)" stroke-width="${Math.max(1.2, Math.min(2.5, s / 20))}"/>`;
  for (const o of r.openings || []) {
    const len = o.off * s, ww = o.w * s, col = o.kind === 'window' ? '#5b8fcf' : o.kind === 'door' ? 'var(--surface)' : 'var(--muted)', sw = o.kind === 'radiator' ? 2 : 4;
    const seg = { back: [ox + len, oy, ox + len + ww, oy], front: [ox + w - len, oy + l, ox + w - len - ww, oy + l], left: [ox, oy + l - len, ox, oy + l - len - ww], right: [ox + w, oy + len, ox + w, oy + len + ww] }[o.wall];
    if (seg) out += `<line x1="${seg[0]}" y1="${seg[1] + (o.kind === 'radiator' ? (o.wall === 'back' ? 4 : 0) : 0)}" x2="${seg[2]}" y2="${seg[3] + (o.kind === 'radiator' ? (o.wall === 'back' ? 4 : 0) : 0)}" stroke="${col}" stroke-width="${sw}"/>`;
  }
  for (const it of r.items || []) {
    const f = it.rot % 2 ? [it.p.d, it.p.w] : [it.p.w, it.p.d];
    out += `<rect x="${ox + (it.x + r.w / 2 - f[0] / 2) * s}" y="${oy + (it.z + r.l / 2 - f[1] / 2) * s}" width="${f[0] * s}" height="${f[1] * s}" rx="1.5" fill="${it.p.kind === 'rug' ? 'none' : 'var(--accent-soft)'}" stroke="var(--accent)" stroke-width="1"${it.p.kind === 'rug' ? ' stroke-dasharray="3 2"' : ''}/>`;
  }
  return out + (wrap ? `<text x="100" y="${oy + l + 11 > 122 ? 122 : oy + l + 11}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="JetBrains Mono, monospace">${cm(r.w)} × ${cm(r.l)}</text></svg>` : '');
}

/* ---------- Router ---------- */
const VIEWS = ['explore', 'rooms', 'catalogue', 'shop'];
let view = 'explore';
function route() {
  const h = location.hash.slice(1);
  view = VIEWS.includes(h) ? h : 'explore';
  for (const v of VIEWS) $('view-' + v).hidden = v !== view;
  for (const a of document.querySelectorAll('[data-nav]')) { if (a.dataset.nav === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  render();
}
window.addEventListener('hashchange', route);
function render() {
  renderWho();
  if (view === 'explore') renderExplore();
  else if (view === 'rooms') renderMyRooms();
  else if (view === 'catalogue') renderCatalogue();
  else if (view === 'shop') renderShop();
}
function renderWho() {
  const el = $('who');
  if (S.cloud) {
    if (!S.uid) { el.innerHTML = '<span>Your homes stay in this browser until you sign in</span><button type="button" class="btn small primary" id="sign-in">Sign in</button>'; return; }
    el.innerHTML = `<img alt="" src="${esc(S.me.avatarUrl)}"><span></span><button type="button" class="btn small" id="sign-out">Sign out</button>`;
    el.querySelector('span').textContent = S.me.name || 'You';
    return;
  }
  if (!S.user || !S.uid) { el.innerHTML = '<span>Not signed in · rooms stay in this browser</span>'; return; }
  const me = S.me;
  el.innerHTML = `<img alt="" src="${esc(me.avatarUrl)}"><span></span>`;
  el.querySelector('span').textContent = S.offline ? 'Offline · saved in this browser' : (me.name || 'You') + (S.local ? ' · view only' : '');
}
function accessNote() {
  if (S.cloud) return S.uid ? '' : 'Sign in to keep your homes in your account and publish them. You can look around everything without one.';
  if (S.offline) return localRuntime.persistent ? '' : 'This browser isn’t letting Nido keep data (a private window, or storage turned off). Download your homes before closing it.';
  if (!S.db) return 'You’re trying Nido without a connection to the shared gallery. Rooms you make stay in this browser.';
  if (!S.uid) return 'Sign in to save rooms and publish them. You can still look around every room here.';
  if (S.canWrite === false) return 'You can look around and copy rooms into this browser. To publish rooms or list products, ask the owner of this page for Contributor access.';
  if (S.slow && !S.ready.homes) return 'The gallery is taking a while to load. It will appear here when it does.';
  return '';
}

/* ---------- Explore ---------- */
function renderExplore() {
  const note = accessNote();
  $('access-note').hidden = !note; $('access-note').textContent = note;
  const rooms = [];
  for (const [owner, list] of S.homes) for (const x of list) rooms.push(cleanSummary(x, owner));
  rooms.sort((a, b) => b.updatedAt - a.updatedAt);
  const g = $('gallery');
  if (!S.ready.homes) { g.innerHTML = '<p class="note">Loading rooms…</p>'; return; }
  if (!rooms.length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>No homes published yet</b><span>${S.offline ? 'Draw a room or a whole flat from its measurements, furnish it, then press Publish to keep it here. Homes opened from files appear in My homes.' : S.cloud ? 'Draw a room or a whole flat from its measurements, furnish it, then press Publish. Everyone who opens Nido will see it here.' : 'Draw a room or a whole flat from its measurements, furnish it, then press Publish. It will appear here for everyone with access to this page.'}</span><button type="button" class="btn primary" data-new-room>Draw your first room</button></div>`;
    return;
  }
  g.innerHTML = rooms.map(r => `<article class="card">
    <button type="button" class="pic" data-open-pub="${esc(r.owner)}|${esc(r.id)}" aria-label="Open ${esc(r.name)}"><span class="plan">${planSVG(r)}</span>${r.cover ? `<img alt="" loading="lazy" src="${assetSrc(r.cover)}" onerror="this.remove()">` : ''}</button>
    <div class="body">
      <div class="t"></div>
      <div class="meta"><span class="owner" data-owner="${esc(r.owner)}"><img alt=""><span></span></span><span class="num">${homeText(r)}</span></div>
      <div class="meta"><span>${r.items} piece${r.items === 1 ? '' : 's'}</span>${r.total ? `<span class="price">${euro(r.total)}</span>` : ''}${r.shops.length ? `<span class="shops"></span>` : ''}</div>
      <div class="row"><button type="button" class="btn small primary" data-open-pub="${esc(r.owner)}|${esc(r.id)}">Open</button></div>
    </div></article>`).join('');
  [...g.querySelectorAll('.card')].forEach((c, i) => {
    c.querySelector('.t').textContent = rooms[i].name;
    const sh = c.querySelector('.shops'); if (sh) sh.textContent = 'From ' + rooms[i].shops.join(', ');
  });
  fillOwners(g);
}
async function fillOwners(root) {
  const els = [...root.querySelectorAll('[data-owner]')];
  const ps = await profilesFor([...new Set(els.map(e => e.dataset.owner))]);
  for (const e of els) {
    const p = ps[e.dataset.owner] || {};
    e.querySelector('img').src = p.avatarUrl || '';
    e.querySelector('span').textContent = p.isMe ? 'You' : (p.name || 'Someone');
  }
}

/* ---------- My rooms ---------- */
let armedDelete = null;
function renderMyRooms() {
  const g = $('my-rooms');
  if (!S.ready.drafts) { g.innerHTML = '<p class="note">Loading your homes…</p>'; return; }
  const list = [...S.drafts.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  if (!list.length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Nothing here yet</b><span>Start with one room from your measurements, or with an example flat you can rearrange.</span><button type="button" class="btn primary" data-new-room>New home</button></div>`;
    return;
  }
  g.innerHTML = list.map(([id, r]) => `<article class="card">
    <button type="button" class="pic" data-edit="${esc(id)}" aria-label="Open ${esc(r.name)}">${r.cover ? `<img alt="" src="${assetSrc(r.cover)}" onerror="this.remove()">` : `<span class="plan">${planSVG(r)}</span>`}</button>
    <div class="body"><div class="t"></div>
      <div class="meta"><span class="num">${r.rooms.length > 1 ? `${r.rooms.length} rooms · ${Math.round(homeArea(r))} m²` : `${sizeText(r.rooms[0])} · ${cm(r.rooms[0].h)} high`}</span>${r.published ? '<span class="pill live">In Explore</span>' : '<span class="pill">Draft</span>'}</div>
      <div class="meta"><span>${r.rooms.reduce((t, x) => t + x.items.length, 0)} pieces</span><span>Saved ${ago(r.updatedAt)}</span></div>
      <div class="row"><button type="button" class="btn small primary" data-edit="${esc(id)}">Open</button><button type="button" class="btn small danger" data-del="${esc(id)}">${armedDelete === id ? 'Click again to delete' : 'Delete'}</button></div>
    </div></article>`).join('');
  [...g.querySelectorAll('.card')].forEach((c, i) => { c.querySelector('.t').textContent = list[i][1].name; });
}
function newRoomDialog(after) {
  let tpl = 'empty';
  const box = openDialog(`<form id="nr" style="display:flex;flex-direction:column;gap:14px">
    <div class="dlg-h"><h2 id="dlg-title">New home</h2><button type="button" class="btn small" data-close>Close</button></div>
    <label class="field" for="nr-name"><span>Name</span><span class="in"><input id="nr-name" maxlength="60" value="My room" required></span></label>
    <div><div class="sec-h" style="margin-bottom:6px">Start from</div><div class="templates" id="nr-tpl">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="tpl" data-tpl="${k}" aria-pressed="${k === 'empty'}"><b>${esc(t.name)}</b><span>${esc(t.note)}</span></button>`).join('')}</div></div>
    <div class="fields" id="nr-size">
      <label class="field" for="nr-w"><span>Width (window wall)</span><span class="in"><input id="nr-w" type="number" inputmode="decimal" min="100" max="1500" step="1" value="350" required><span class="u">cm</span></span></label>
      <label class="field" for="nr-l"><span>Length (side walls)</span><span class="in"><input id="nr-l" type="number" inputmode="decimal" min="100" max="1500" step="1" value="400" required><span class="u">cm</span></span></label>
      <label class="field" for="nr-h"><span>Ceiling height</span><span class="in"><input id="nr-h" type="number" inputmode="decimal" min="200" max="500" step="1" value="250" required><span class="u">cm</span></span></label>
    </div>
    <p class="note" id="nr-note">Measure along the floor, wall to wall. You can add more rooms, and windows, doors and radiators, once it’s open.</p>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Create room</button></div></form>`,
  (e) => {
    const b = e.target.closest('[data-tpl]'); if (!b) return;
    tpl = b.dataset.tpl;
    for (const x of box.querySelectorAll('[data-tpl]')) x.setAttribute('aria-pressed', x === b);
    const sz = TEMPLATES[tpl].size;
    if (sz) { $('nr-w').value = cm(sz[0]); $('nr-l').value = cm(sz[1]); $('nr-h').value = cm(sz[2]); }
    for (const l of $('nr-size').querySelectorAll('label')) l.hidden = tpl === 'flat' && !l.querySelector('#nr-h');
    $('nr-note').textContent = tpl === 'flat' ? 'An example flat of about 75 m² with doors between the rooms. Resize rooms, move them in Plan view, add or remove rooms.' : 'Measure along the floor, wall to wall. You can add more rooms, and windows, doors and radiators, once it’s open.';
    if ($('nr-name').value === 'My room' || Object.values(TEMPLATES).some(t => t.name === $('nr-name').value)) $('nr-name').value = tpl === 'empty' ? 'My room' : TEMPLATES[tpl].name;
  },
  () => {
    const w = +$('nr-w').value / 100, l = +$('nr-l').value / 100, h = +$('nr-h').value / 100;
    if (!(w >= 1 && l >= 1 && h >= 2)) return;
    const id = newId('r'), r = makeHome(tpl, $('nr-name').value.trim() || 'My room', w, l, h);
    saveDraft(id, r);
    closeDialog();
    openEditor(id);
    after && after(id);
  });
}
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = '';
  if (!file) return;
  const text = await file.text();
  let j = null; try { j = JSON.parse(text); } catch (er) {}
  if (j && j.app === 'nido-home' && j.home) { await importHomeFile(j, file.name); return; }
  const r = fromPlannerFile(text);
  if (!r) { toast(`${file.name} isn’t a room file from the planner.`); return; }
  r.name = file.name.replace(/\.json$/i, '').slice(0, 60) || r.name;
  const id = newId('r'); saveDraft(id, r); toast('Room imported. Wallpapers from the planner come in as paint.'); openEditor(id);
});

/* A home as a file: the home plus every picture and 3D model it uses, so it opens anywhere. */
const blobToDataUrl = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });
async function exportHome(home) {
  if (!S.downloads) { toast('Downloading files isn’t available here.'); return; }
  const assets = {};
  for (const id of new Set(JSON.stringify(home).match(/\b[0-9a-f]{32}\b/g) || [])) {
    try { const res = await fetch(assetSrc(id)); if (!res.ok) continue; const b = await res.blob(); if (b.size) assets[id] = await blobToDataUrl(b); } catch (er) {}
  }
  const name = (home.name || 'home').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home';
  try { await S.downloads.save({ filename: `${name}.nido.json`, data: JSON.stringify({ app: 'nido-home', v: 2, exportedAt: new Date().toISOString(), home, assets }) }); toast('Downloaded. Open it in Nido on any computer with “Open a file”.'); }
  catch (er) { if (!er || er.code !== 'declined') toast('Couldn’t download the file.'); }
}
async function importHomeFile(j, fileName) {
  let s = JSON.stringify(j.home), missing = 0;
  for (const [old, data] of Object.entries(j.assets && typeof j.assets === 'object' ? j.assets : {})) {
    if (!ASSET.test(old) || typeof data !== 'string' || !/^data:[\w/+.-]+;base64,/.test(data)) continue;
    try { const b = await (await fetch(data)).blob(); const up = await uploadFile(b, b.type); s = s.split(old).join(up.id); } catch (er) { missing++; }
  }
  const h = cleanHome(JSON.parse(s));
  h.published = false;
  const id = newId('r'); await saveDraft(id, h);
  toast(missing ? `Opened ${h.name}. ${missing} picture${missing === 1 ? '' : 's'} couldn’t be stored here.` : `Opened ${h.name} from ${fileName}.`);
  openEditor(id);
}

/* ---------- Catalogue ---------- */
let catKind = 'all', catQ = '';
function productCard(p, actions) {
  const pic = p.kind === 'paint' ? `<span style="position:absolute;inset:0;background:${p.color}"></span><span class="pill" style="position:absolute;left:10px;bottom:10px">${esc((p.paint && p.paint.code) || p.color)}</span>`
    : p.kind === 'wallpaper' && p.wallpaper && p.wallpaper.tile ? `<span style="position:absolute;inset:0;background:url(${assetSrc(p.wallpaper.tile)}) 0 0 / ${p.wallpaper.mural ? 'cover' : '33%'} repeat"></span>`
    : p.photo ? `<img alt="" loading="lazy" src="${assetSrc(p.photo)}" onerror="this.remove()">`
    : `<span class="plan"><svg viewBox="0 0 120 75" width="70%" height="70%" aria-hidden="true"><rect x="${60 - p.w / Math.max(p.w, p.d) * 40}" y="${38 - p.d / Math.max(p.w, p.d) * 28}" width="${p.w / Math.max(p.w, p.d) * 80}" height="${p.d / Math.max(p.w, p.d) * 56}" rx="4" fill="${p.color}" stroke="var(--line)"/></svg></span>`;
  const dims = p.kind === 'paint' ? (p.paint ? `${p.paint.tinL.toLocaleString()} L tin · ${p.paint.coverage} m²/L${p.paint.finish ? ' · ' + esc(p.paint.finish) : ''}` : '') : p.kind === 'wallpaper' ? (p.wallpaper ? (p.wallpaper.mural ? 'Mural, made to measure' : `Repeat ${p.wallpaper.width} cm · roll ${p.wallpaper.rollW} cm × ${(p.wallpaper.rollL / 100).toLocaleString()} m`) : '') : `${cm(p.w)} × ${cm(p.d)} × ${cm(p.h)} cm`;
  return `<article class="card"><div class="pic" style="cursor:default">${pic}</div><div class="body">
    <div class="t" data-name></div><div class="meta"><span data-shop></span>${p.curated ? '<span class="pill" title="Copied from the shop’s website by Nido, not listed by the shop itself">Added by Nido</span>' : ''}${p.model ? '<span class="pill live">3D model</span>' : ''}</div>
    <div class="meta"><span class="num">${dims}</span>${p.price !== null ? `<span class="price">${euro(p.price)}${p.kind === 'wallpaper' ? (p.wallpaper && p.wallpaper.unit === 'm2' ? ' /m²' : ' /roll') : p.kind === 'paint' ? ' /tin' : ''}</span>` : ''}</div>
    <div class="row">${actions}${p.url ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener">Shop ↗</a>` : ''}</div></div></article>`;
}
function catalogueList() {
  const q = catQ.trim().toLowerCase();
  return allProducts().filter(p => (catKind === 'all' || p.kind === catKind) && (!q || (p.name + ' ' + p.shop).toLowerCase().includes(q)));
}
function renderCatalogue() {
  const kinds = [['all', 'Everything'], ...Object.entries(KINDS).filter(([k]) => k !== 'box'), ['wallpaper', 'Wallpaper'], ['paint', 'Paint']];
  $('cat-kinds').innerHTML = kinds.map(([k, n]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === catKind}">${esc(n)}</button>`).join('');
  const list = catalogueList(), g = $('catalogue');
  if (!list.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Nothing here yet</b><span>${catKind === 'wallpaper' ? 'No shop has listed wallpaper yet.' : catKind === 'paint' ? 'No shop has listed paint yet.' : 'No products match.'} Shops can list theirs under For shops.</span></div>`; return; }
  g.innerHTML = list.map(p => productCard(p, p.kind === 'wallpaper' || p.kind === 'paint' ? '' : `<button type="button" class="btn small primary" data-place="${esc(p.ref)}">Place in a room</button>`)).join('');
  [...g.querySelectorAll('.card')].forEach((c, i) => { c.querySelector('[data-name]').textContent = list[i].name; c.querySelector('[data-shop]').textContent = list[i].shop; });
}
$('cat-q').addEventListener('input', (e) => { catQ = e.target.value; renderCatalogue(); });
function placeInRoomDialog(ref) {
  const rooms = [...S.drafts.entries()].sort((a, b) => b[1].updatedAt - a[1].updatedAt).flatMap(([id, h]) => h.rooms.map(r => ({ id, h, r })));
  openDialog(`<div class="dlg-h"><h2 id="dlg-title">Place in which room?</h2><button type="button" class="btn small" data-close>Close</button></div>
    <div class="list">${rooms.map((x, i) => `<button type="button" class="lrow" data-into="${i}"><span class="tx"><b></b><small class="num">${sizeText(x.r)}</small></span></button>`).join('')}</div>
    <button type="button" class="btn" data-into-new>New home</button>`,
  (e) => {
    const b = e.target.closest('[data-into]');
    if (b) { const x = rooms[+b.dataset.into]; closeDialog(); openEditor(x.id, x.r.id); addProduct(ref); return; }
    if (e.target.closest('[data-into-new]')) newRoomDialog(() => addProduct(ref));
  });
  [...$('dlg-box').querySelectorAll('[data-into] b')].forEach((b, i) => { b.textContent = rooms[i].h.rooms.length > 1 ? `${rooms[i].h.name} · ${rooms[i].r.name}` : rooms[i].r.name; });
}

/* ---------- For shops ---------- */
let pendingLogo = null, shopSeen = -1;
function renderShop() {
  const can = !S.local && S.db;
  for (const el of $('shop-form').elements) el.disabled = !can;
  $('add-product').disabled = !can;
  const shop = myShop();
  if (shop && shop.updatedAt !== shopSeen) {            // fill the form from the saved shop, once per save
    shopSeen = shop.updatedAt;
    $('shop-name').value = shop.name; $('shop-url').value = shop.url || ''; $('shop-about').value = shop.about;
  }
  const logo = pendingLogo || (shop && shop.logo);
  $('shop-logo-prev').style.backgroundImage = logo ? `url(${assetSrc(logo)})` : '';
  $('shop-status').textContent = can ? (shop ? `Live in the catalogue · ${shop.products.length} product${shop.products.length === 1 ? '' : 's'}` : 'Save your shop, then add products.') : (accessNote() || 'Listing products needs Contributor access.');
  const list = shop ? shop.products : [], box = $('shop-products');
  if (!list.length) { box.innerHTML = `<div class="empty"><b>No products yet</b><span>Add a product with its measurements, a photo and the link where people buy it.</span></div>`; return; }
  box.innerHTML = `<div style="overflow-x:auto"><table class="ptable"><thead><tr><th></th><th>Product</th><th>Size</th><th>Price</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
    <td><div class="thumb" style="background-image:${p.kind !== 'paint' && p.photo ? `url(${assetSrc(p.photo)})` : p.wallpaper && p.wallpaper.tile ? `url(${assetSrc(p.wallpaper.tile)})` : 'none'};${p.kind === 'paint' || (!p.photo && !(p.wallpaper && p.wallpaper.tile)) ? `background-color:${p.color}` : ''}"></div></td>
    <td><b data-pn></b><div class="note">${esc(p.kind === 'wallpaper' ? 'Wallpaper' : p.kind === 'paint' ? 'Paint' : KINDS[p.kind] || 'Other')}${p.model ? ' · 3D model' : ''}</div></td>
    <td class="num">${p.kind === 'wallpaper' ? (p.wallpaper ? `${p.wallpaper.width} cm repeat` : '') : p.kind === 'paint' ? (p.paint ? `${p.paint.tinL} L · ${esc(p.paint.code)}` : '') : `${cm(p.w)}×${cm(p.d)}×${cm(p.h)}`}</td>
    <td class="price">${p.price !== null ? euro(p.price) : '—'}</td>
    <td style="white-space:nowrap"><button type="button" class="btn small" data-pedit="${esc(p.id)}">Edit</button> <button type="button" class="btn small danger" data-pdel="${esc(p.id)}">${armedDelete === p.id ? 'Click again' : 'Remove'}</button></td></tr>`).join('')}</tbody></table></div>`;
  [...box.querySelectorAll('[data-pn]')].forEach((b, i) => { b.textContent = list[i].name; });
}
$('shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const shop = myShop() ? JSON.parse(JSON.stringify(myShop())) : { products: [] };
  shop.name = $('shop-name').value.trim().slice(0, 60); shop.url = safeUrl($('shop-url').value.trim()); shop.about = $('shop-about').value.trim().slice(0, 400);
  shop.logo = pendingLogo || shop.logo || null;
  if ($('shop-url').value.trim() && !shop.url) { $('shop-status').textContent = 'The website needs to start with https://'; return; }
  try { await saveShop(shop); pendingLogo = null; $('shop-status').textContent = 'Saved. Your shop is in the catalogue.'; } catch (er) { $('shop-status').textContent = 'Couldn’t save the shop. Check your access and try again.'; }
});
async function uploadFile(file, type) {
  if (!S.assets) throw { code: 'not_granted' };
  return S.assets.upload(file, type ? { type } : undefined);
}
const uploadError = (e) => e && e.code === 'too_large' ? 'That file is too big (20 MB at most).' : e && e.code === 'unsupported_type' ? 'That file type isn’t supported.'
  : e && e.code === 'not_granted' ? 'Uploading isn’t available for your account here.' : 'The upload didn’t work. Try again in a moment.';
$('shop-logo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const up = await uploadFile(f); pendingLogo = up.id; $('shop-logo-prev').style.backgroundImage = `url(${up.url})`; $('shop-status').textContent = 'Logo uploaded. Save your shop to keep it.'; }
  catch (er) { $('shop-status').textContent = uploadError(er); }
});
function imageAspect(file) {
  return new Promise((res) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i.naturalHeight / i.naturalWidth); URL.revokeObjectURL(u); }; i.onerror = () => res(1); i.src = u; });
}
function productDialog(pid) {
  const shop = myShop();
  if (!shop) { $('shop-status').textContent = 'Save your shop first, then add products.'; $('shop-name').focus(); return; }
  const cur = pid ? shop.products.find(p => p.id === pid) : null;
  const p = cur ? JSON.parse(JSON.stringify(cur)) : cleanShopProduct({ kind: 'sofa', name: '', w: 2, d: 0.9, h: 0.85, color: '#d9d0c2' });
  if (!p.wallpaper) p.wallpaper = { tile: null, width: 50, aspect: 1, mural: false, rollW: 53, rollL: 1005, unit: 'roll' };
  if (!p.paint) p.paint = { code: '', finish: 'Mate', tinL: 4, coverage: 10, coats: 2 };
  const kindOpts = [...Object.entries(KINDS), ['wallpaper', 'Wallpaper'], ['paint', 'Paint']].map(([k, n]) => `<option value="${k}" ${k === p.kind ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const box = openDialog(`<form id="pf" style="display:flex;flex-direction:column;gap:12px">
    <div class="dlg-h"><h2 id="dlg-title">${cur ? 'Edit product' : 'Add a product'}</h2><button type="button" class="btn small" data-close>Close</button></div>
    <div class="fields two">
      <label class="field" for="pf-name"><span>Name</span><span class="in"><input id="pf-name" maxlength="80" required></span></label>
      <label class="field" for="pf-kind"><span>What it is</span><span class="in"><select id="pf-kind">${kindOpts}</select></span></label>
    </div>
    <div class="fields" id="pf-dims">
      <label class="field" for="pf-w"><span>Width</span><span class="in"><input id="pf-w" type="number" inputmode="decimal" min="1" max="800" step="0.5" value="${cm(p.w)}"><span class="u">cm</span></span></label>
      <label class="field" for="pf-d"><span>Depth</span><span class="in"><input id="pf-d" type="number" inputmode="decimal" min="1" max="800" step="0.5" value="${cm(p.d)}"><span class="u">cm</span></span></label>
      <label class="field" for="pf-h"><span>Height</span><span class="in"><input id="pf-h" type="number" inputmode="decimal" min="0.5" max="400" step="0.5" value="${Math.round(p.h * 1000) / 10}"><span class="u">cm</span></span></label>
    </div>
    <div id="pf-wp" class="fields">
      <label class="field" for="pf-rep"><span>Pattern repeat (width)</span><span class="in"><input id="pf-rep" type="number" min="5" max="400" step="1" value="${p.wallpaper.width}"><span class="u">cm</span></span></label>
      <label class="field" for="pf-rw"><span>Roll width</span><span class="in"><input id="pf-rw" type="number" min="10" max="300" step="1" value="${p.wallpaper.rollW}"><span class="u">cm</span></span></label>
      <label class="field" for="pf-rl"><span>Roll length</span><span class="in"><input id="pf-rl" type="number" min="0.5" max="50" step="0.05" value="${p.wallpaper.rollL / 100}"><span class="u">m</span></span></label>
      <label class="check" for="pf-mural" style="grid-column:1/-1"><input type="checkbox" id="pf-mural" ${p.wallpaper.mural ? 'checked' : ''}><span>Mural: one picture made to measure for the wall, sold per m²</span></label>
    </div>
    <div id="pf-pt" class="fields">
      <label class="field" for="pf-code"><span>Colour code</span><span class="in"><input id="pf-code" maxlength="40" placeholder="e.g. NCS S 1005-Y20R"></span></label>
      <label class="field" for="pf-fin"><span>Finish</span><span class="in"><input id="pf-fin" maxlength="30" placeholder="Mate, satinado…"></span></label>
      <label class="field" for="pf-tin"><span>Tin size</span><span class="in"><input id="pf-tin" type="number" min="0.1" max="30" step="0.05" value="${p.paint.tinL}"><span class="u">L</span></span></label>
      <label class="field" for="pf-cov"><span>Covers</span><span class="in"><input id="pf-cov" type="number" min="2" max="25" step="0.5" value="${p.paint.coverage}"><span class="u">m²/L</span></span></label>
      <label class="field" for="pf-coats"><span>Coats</span><span class="in"><input id="pf-coats" type="number" min="1" max="4" step="1" value="${p.paint.coats}"></span></label>
    </div>
    <div class="fields two">
      <label class="field" for="pf-price"><span id="pf-price-lab">Price</span><span class="in"><input id="pf-price" type="number" inputmode="decimal" min="0" step="0.01" value="${p.price ?? ''}"><span class="u">€</span></span></label>
      <label class="field" for="pf-color"><span id="pf-color-lab">Main colour (when there’s no 3D model)</span><span class="in"><input id="pf-color" type="color" value="${p.color}" style="height:33px;padding:3px"></span></label>
    </div>
    <label class="field" for="pf-url"><span>Link to buy it</span><span class="in"><input id="pf-url" type="url" maxlength="300" placeholder="https://"></span></label>
    <div class="uploader" id="pf-photo-row"><div class="thumb" id="pf-photo-prev"></div><label class="btn small" for="pf-photo" id="pf-photo-lab">Upload a photo</label><input type="file" id="pf-photo" class="vh" accept="image/*"><span class="note" id="pf-photo-note">Product photo for the catalogue. For a rug, a top view cut out on a transparent background is laid on the floor.</span></div>
    <div class="uploader" id="pf-model-row"><div class="thumb" id="pf-model-prev" style="display:grid;place-items:center;font-size:11px;font-weight:800">3D</div><label class="btn small" for="pf-model">Upload a 3D model</label><input type="file" id="pf-model" class="vh" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"><span class="note" id="pf-model-note">Optional: a .glb file. It’s scaled to the measurements above.</span></div>
    <p class="note" id="pf-status" aria-live="polite"></p>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${cur ? 'Save product' : 'Add product'}</button></div></form>`,
  null, async () => {
    const isWp = $('pf-kind').value === 'wallpaper';
    p.name = $('pf-name').value.trim().slice(0, 80) || 'Product';
    p.kind = $('pf-kind').value;
    p.w = +$('pf-w').value / 100; p.d = +$('pf-d').value / 100; p.h = Math.max(0.004, +$('pf-h').value / 100);
    p.price = $('pf-price').value === '' ? null : Math.max(0, +$('pf-price').value);
    p.color = $('pf-color').value; p.url = safeUrl($('pf-url').value.trim());
    if ($('pf-url').value.trim() && !p.url) { $('pf-status').textContent = 'The link needs to start with https://'; return; }
    if (isWp) {
      Object.assign(p.wallpaper, { width: +$('pf-rep').value || 50, rollW: +$('pf-rw').value || 53, rollL: Math.round((+$('pf-rl').value || 10.05) * 100), mural: $('pf-mural').checked });
      p.wallpaper.unit = p.wallpaper.mural ? 'm2' : 'roll';
      if (!p.wallpaper.tile) { $('pf-status').textContent = 'Upload the pattern image first: one repeat, cut so it tiles.'; return; }
    } else delete p.wallpaper;
    if (p.kind === 'paint') Object.assign(p.paint, { code: $('pf-code').value.trim().slice(0, 40), finish: $('pf-fin').value.trim().slice(0, 30),
      tinL: clamp(+$('pf-tin').value || 4, 0.1, 30), coverage: clamp(+$('pf-cov').value || 10, 2, 25), coats: clamp(Math.round(+$('pf-coats').value || 2), 1, 4) });
    else delete p.paint;
    const next = JSON.parse(JSON.stringify(myShop()));
    const i = next.products.findIndex(x => x.id === p.id);
    if (i >= 0) next.products[i] = p; else next.products.push(p);
    $('pf-status').textContent = 'Saving…';
    try { await saveShop(next); closeDialog(); toast(`${p.name} is in the catalogue.`); } catch (er) { $('pf-status').textContent = 'Couldn’t save. Check your access and try again.'; }
  });
  $('pf-name').value = p.name; $('pf-url').value = p.url || ''; $('pf-code').value = p.paint.code; $('pf-fin').value = p.paint.finish;
  const sync = () => {
    const wp = $('pf-kind').value === 'wallpaper', pt = $('pf-kind').value === 'paint';
    $('pf-dims').hidden = wp || pt; $('pf-wp').hidden = !wp; $('pf-model-row').hidden = wp || pt; $('pf-pt').hidden = !pt; $('pf-photo-row').hidden = pt;
    $('pf-price-lab').textContent = wp ? ($('pf-mural').checked ? 'Price per m²' : 'Price per roll') : pt ? 'Price per tin' : 'Price';
    $('pf-color-lab').textContent = pt ? 'Colour, as close as a screen can show it' : 'Main colour (when there’s no 3D model)';
    $('pf-photo-lab').textContent = wp ? 'Upload the pattern' : 'Upload a photo';
    $('pf-photo-note').textContent = wp ? 'One repeat of the pattern, cut so it tiles seamlessly (a mural: the whole picture).' : 'Product photo for the catalogue. For a rug, a top view cut out on a transparent background is laid on the floor.';
    const img = wp ? p.wallpaper.tile : p.photo;
    $('pf-photo-prev').style.backgroundImage = img ? `url(${assetSrc(img)})` : '';
    $('pf-model-note').textContent = p.model ? '3D model uploaded. Upload another to replace it.' : 'Optional: a .glb file. It’s scaled to the measurements above.';
  };
  sync();
  box.onchange = async (e) => {
    const t = e.target;
    if (t.id === 'pf-kind' || t.id === 'pf-mural') sync();
    if (t.id === 'pf-photo' && t.files[0]) {
      const f = t.files[0]; t.value = '';
      $('pf-status').textContent = 'Uploading…';
      try {
        const up = await uploadFile(f);
        if ($('pf-kind').value === 'wallpaper') { p.wallpaper.tile = up.id; p.wallpaper.aspect = await imageAspect(f); } else p.photo = up.id;
        $('pf-status').textContent = 'Uploaded.'; sync();
      } catch (er) { $('pf-status').textContent = uploadError(er); }
    }
    if (t.id === 'pf-model' && t.files[0]) {
      const f = t.files[0]; t.value = '';
      $('pf-status').textContent = 'Preparing the model…';
      try {
        const text = /\.gltf$/i.test(f.name) ? selfContainedGltf(await f.text()) : await glbToGltfText(await f.arrayBuffer());
        const up = await uploadFile(new Blob([text], { type: 'application/json' }), 'application/json');
        p.model = up.id; $('pf-status').textContent = '3D model uploaded.'; sync();
      } catch (er) { $('pf-status').textContent = er && er.message === 'external' ? 'This .gltf points to other files. Export it as a single .glb instead.' : er && er.message === 'not-glb' ? 'That isn’t a .glb file.' : uploadError(er); }
    }
  };
}

/* ---------- Global clicks ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a'); if (!t || t.closest('#studio') || t.closest('#dlg')) return;
  if (t.hasAttribute('data-new-room')) { newRoomDialog(); return; }
  if (t.id === 'sign-in') { S.cloud.signIn(); return; }
  if (t.id === 'sign-out') { S.cloud.signOut(); return; }
  if (t.dataset.edit) { openEditor(t.dataset.edit); return; }
  if (t.dataset.openPub) { const [o, id] = t.dataset.openPub.split('|'); openViewer(o, id); return; }
  if (t.dataset.del) {
    if (armedDelete !== t.dataset.del) { armedDelete = t.dataset.del; renderMyRooms(); setTimeout(() => { if (armedDelete === t.dataset.del) { armedDelete = null; renderMyRooms(); } }, 4000); return; }
    armedDelete = null; await deleteDraft(t.dataset.del); toast('Room deleted.'); renderMyRooms(); return;
  }
  if (t.dataset.kind) { catKind = t.dataset.kind; renderCatalogue(); return; }
  if (t.dataset.place) { placeInRoomDialog(t.dataset.place); return; }
  if (t.id === 'add-product') { productDialog(null); return; }
  if (t.dataset.pedit) { productDialog(t.dataset.pedit); return; }
  if (t.dataset.pdel) {
    if (armedDelete !== t.dataset.pdel) { armedDelete = t.dataset.pdel; renderShop(); return; }
    armedDelete = null;
    const next = JSON.parse(JSON.stringify(myShop())); next.products = next.products.filter(p => p.id !== t.dataset.pdel);
    try { await saveShop(next); toast('Product removed from the catalogue.'); } catch (er) { toast('Couldn’t remove it. Try again.'); }
  }
});

/* =====================================================================
   Studio: the 3D room, editable (your draft) or read-only (someone's published room)
   ===================================================================== */
let studio = null, saveTimer = 0;
/* studio.home is the whole home; studio.room the room being worked on, or null for the whole home. */
function openStudio(st) {
  studio = st;
  const one = st.home.rooms.length === 1;
  studio.room = st.focus ? st.home.rooms.find(r => r.id === st.focus) || null : one ? st.home.rooms[0] : null;
  document.body.classList.add('studio-open');
  $('studio').hidden = false;
  closeDialog();
  layoutStudio();
  showHome(st.home, { editable: st.mode === 'edit', focus: studio.room && studio.room.id });
  if (!studio.room) studio.tab = st.mode === 'edit' ? 'flat' : 'list';
  renderStudio();
}
function openEditor(id, roomId) {
  const h = S.drafts.get(id); if (!h) { toast('That home isn’t here any more.'); return; }
  openStudio({ mode: 'edit', id, home: h, focus: roomId || null, tab: 'room', wall: 'back', part: 'hi' });
}
function focusRoom(id) {
  if (!studio) return;
  studio.room = id ? studio.home.rooms.find(r => r.id === id) || null : null;
  if (!studio.room) studio.tab = studio.mode === 'edit' ? 'flat' : 'list';
  else if (studio.mode === 'edit' && (studio.tab === 'flat')) studio.tab = 'room';
  selectItem(null);
  setFocus(studio.room && studio.room.id);
  renderStudio();
}
$('st-room').addEventListener('change', (e) => focusRoom(e.target.value || null));
async function openViewer(owner, id) {
  if (!S.db) return;
  toast('Opening…');
  let r = null; try { r = await fetchPublished(owner, id); } catch (e) {}
  if (!r) { toast('That room is no longer published.'); return; }
  $('toast').hidden = true;
  openStudio({ mode: 'view', owner, id, home: r, tab: 'list' });
}
function closeStudio() {
  if (studio && studio.mode === 'edit') flushSave();
  hideRoom(); studio = null;
  $('studio').hidden = true; $('props').hidden = true;
  document.body.classList.remove('studio-open');
  render();
}
$('st-back').addEventListener('click', closeStudio);
function layoutStudio() {
  const wide = window.innerWidth > 760;
  padLeft = wide ? 364 : 0;
  padBottom = wide ? 0 : stage.clientHeight * 0.46;
  layout();
}
window.addEventListener('resize', () => { if (studio) layoutStudio(); });
function changed(rebuild) {
  if (!studio || studio.mode !== 'edit') return;
  if (rebuild) { buildRoom(); showSelection(); }
  $('st-save').textContent = 'Saving…';
  clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700);
}
function flushSave() {
  clearTimeout(saveTimer);
  if (!studio || studio.mode !== 'edit') return;
  const st = studio;
  saveDraft(st.id, st.home).then(() => { if (studio === st && $('st-save')) $('st-save').textContent = S.local ? 'Saved in this browser' : (st.home.published ? 'Saved · press Update to refresh Explore' : 'Saved'); });
}
engineHooks.onChange = () => { changed(false); if (studio && studio.tab === 'room') renderPane(); };
engineHooks.onRoomTap = (id) => { if (studio) focusRoom(id); };
engineHooks.onRoomMoved = (id, done) => { if (done) { changed(false); if (studio && studio.tab === 'flat') renderPane(); } };
engineHooks.onSelect = (id) => { renderProps(); if (studio && studio.tab !== 'walls') renderPane(); };
engineHooks.onWall = (roomId, wid) => {
  if (!studio || studio.mode !== 'edit') return;
  if (!studio.room || studio.room.id !== roomId) { studio.wall = wid; studio.tab = 'walls'; focusRoom(roomId); return; }
  studio.wall = wid; studio.tab = 'walls'; renderStudio(); flyTo(wid);
};
engineHooks.onMode = (m) => { $('v-3d').setAttribute('aria-pressed', m === '3d'); $('v-plan').setAttribute('aria-pressed', m === 'plan'); };
$('v-3d').addEventListener('click', () => { if (mode === '3d') resetView(); setMode('3d'); });
$('v-plan').addEventListener('click', () => setMode('plan'));
$('t-day').addEventListener('click', () => { studio.home.evening = false; syncLamps(); syncTod(); changed(false); });
$('t-eve').addEventListener('click', () => { studio.home.evening = true; syncLamps(); syncTod(); changed(false); });
const syncTod = () => { $('t-day').setAttribute('aria-pressed', !studio.home.evening); $('t-eve').setAttribute('aria-pressed', !!studio.home.evening); };
$('st-name').addEventListener('input', (e) => {
  if (!studio || studio.mode !== 'edit') return;
  studio.home.name = e.target.value.slice(0, 60) || 'Untitled home';
  if (studio.home.rooms.length === 1) studio.home.rooms[0].name = studio.home.name;
  changed(false);
});

function renderStudio() {
  const st = studio, h = st.home, r = st.room, edit = st.mode === 'edit';
  $('st-name').value = h.name; $('st-name').readOnly = !edit;
  $('st-size').textContent = r ? `${sizeText(r)} · ${cm(r.h)} high` : `${h.rooms.length} rooms · ${Math.round(homeArea(h))} m²`;
  $('st-room').innerHTML = `<option value="">${h.rooms.length > 1 ? 'Whole home' : 'Whole home · add rooms'}</option>` + h.rooms.map(x => `<option value="${esc(x.id)}" ${r && r.id === x.id ? 'selected' : ''}></option>`).join('');
  [...$('st-room').options].slice(1).forEach((o, i) => { o.textContent = h.rooms[i].name; });
  if (!r) $('st-room').value = '';
  syncTod();
  $('st-hint').textContent = !r ? (edit && h.rooms.length > 1 ? 'Tap a room to work on it on its own · in Plan view, drag rooms to arrange them' : 'Tap a room to see it on its own · drag to look around')
    : edit ? 'Drag furniture to move it · tap a wall to change its finish · drag empty space to look around' : 'Drag to look around · tap a piece of furniture to see what it is';
  const acts = $('st-actions');
  if (edit) {
    const canPub = !S.local && S.db;
    acts.innerHTML = `<span class="save-state" id="st-save">${S.local ? 'Saved in this browser' : 'Saved'}</span>
      ${h.published ? '<button type="button" class="btn small" id="st-unpub">Unpublish</button>' : ''}
      ${S.downloads ? '<button type="button" class="btn small" id="st-dl">Download</button>' : ''}
      <button type="button" class="btn small primary" id="st-pub" ${canPub ? '' : 'disabled title="Publishing needs Contributor access"'}>${h.published ? 'Update in Explore' : 'Publish'}</button>`;
  } else {
    acts.innerHTML = `<span class="owner save-state" data-owner="${esc(st.owner)}"><img alt=""><span></span></span>
      ${S.isAdmin && st.owner !== S.uid ? '<button type="button" class="btn small danger" id="st-remove">Remove from Explore</button>' : ''}
      ${S.downloads ? '<button type="button" class="btn small" id="st-dl">Download</button>' : ''}
      <button type="button" class="btn small primary" id="st-copy">Copy to my homes</button>`;
    fillOwners(acts);
  }
  const tabs = !edit ? [['list', r ? 'In this room' : 'In this home']] : r ? [['room', 'Room'], ['walls', 'Walls'], ['furniture', 'Furniture'], ['list', 'Shopping']] : [['flat', 'Rooms'], ['list', 'Shopping']];
  if (!tabs.some(([k]) => k === st.tab)) st.tab = tabs[0][0];
  $('side-tabs').innerHTML = tabs.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${st.tab === k}">${n}</button>`).join('');
  renderPane(); renderProps();
}
$('side-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; studio.tab = b.dataset.tab; renderStudio(); if (studio.tab === 'walls') flyTo(studio.wall); });
$('st-actions').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const st = studio;
  if (b.id === 'st-pub') {
    b.disabled = true; b.textContent = 'Publishing…';
    selectItem(null);
    try { await publish(st.id, st.home, await captureCover()); toast('Published. It’s in Explore with a picture of this view.'); }
    catch (er) { toast('Couldn’t publish. Check your access and try again.'); }
    if (studio === st) renderStudio();
  }
  if (b.id === 'st-dl') { flushSave(); exportHome(st.home); return; }
  if (b.id === 'st-unpub') { try { await unpublish(st.id); toast('Taken out of Explore. It’s still in My rooms.'); } catch (er) { toast('Couldn’t unpublish. Try again.'); } if (studio === st) renderStudio(); }
  if (b.id === 'st-copy') {
    const id = newId('r'), copy = cleanHome(JSON.parse(JSON.stringify(st.home)));
    copy.name = ('Copy of ' + st.home.name).slice(0, 60); copy.published = false; copy.cover = null; copy.from = { owner: st.owner, id: st.id, name: st.home.name };
    await saveDraft(id, copy); toast('Copied to My homes. Change the sizes to match yours.'); openEditor(id);
  }
  if (b.id === 'st-remove') {
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Click again to remove'; return; }
    try { await unpublish(st.id, st.owner); toast('Removed from Explore.'); closeStudio(); } catch (er) { toast('Couldn’t remove it.'); }
  }
});

/* ---------- Side panel ---------- */
let fills = [];          // untrusted names, set as text after the pane's HTML is in place
function renderPane() {
  if (!studio) return;
  const p = $('pane'), keep = p.scrollTop;
  fills = [];
  if (studio.room) ctx(studio.room);
  p.innerHTML = studio.tab === 'flat' ? flatPane() : studio.tab === 'room' ? roomPane() : studio.tab === 'walls' ? wallsPane() : studio.tab === 'furniture' ? furniturePane() : listPane();
  for (const el of p.querySelectorAll('[data-fill]')) el.textContent = fills[+el.dataset.fill] || '';
  p.scrollTop = keep;
  if (studio.tab === 'list') fillListNames();
  if (studio.tab === 'furniture') fillFurnitureNames();
}
const numField = (label, act, val, extra = '', unit = 'cm', attrs = '') => `<label class="field"><span>${label}</span><span class="in"><input type="number" inputmode="decimal" data-act="${act}" ${extra} value="${val}" ${attrs}><span class="u">${unit}</span></span></label>`;
let armedRoom = null;
function flatPane() {
  const h = studio.home;
  return `<div class="sec-h">Rooms · ${h.rooms.length} · ${Math.round(homeArea(h))} m²</div>
    <div class="list">${h.rooms.map(r => `<button type="button" class="lrow" data-act="focus" data-id="${esc(r.id)}"><span class="thumb" style="display:grid;place-items:center;font-size:10px;font-weight:800;color:var(--muted);line-height:1.1;text-align:center">${Math.round(r.w * r.l)}<br>m²</span>
      <span class="tx"><b data-fill="${fills.push(r.name) - 1}"></b><small class="num">${sizeText(r)} · ${r.items.length} piece${r.items.length === 1 ? '' : 's'}</small></span></button>`).join('')}</div>
    <button type="button" class="btn primary" data-act="addroom">Add a room</button>
    <p class="note">Tap a room, here or in the 3D view, to work on it on its own. In Plan view, drag rooms to arrange them: they snap together with a 10 cm wall between, and doors cut through both sides.</p>`;
}
function addRoomDialog() {
  const h = studio.home, last = h.rooms[h.rooms.length - 1];
  const box = openDialog(`<form id="ar" style="display:flex;flex-direction:column;gap:12px">
    <div class="dlg-h"><h2 id="dlg-title">Add a room</h2><button type="button" class="btn small" data-close>Close</button></div>
    <label class="field" for="ar-name"><span>Name</span><span class="in"><input id="ar-name" maxlength="60" value="Bedroom" required></span></label>
    <div class="fields">
      <label class="field" for="ar-w"><span>Width</span><span class="in"><input id="ar-w" type="number" min="100" max="1500" step="1" value="300" required><span class="u">cm</span></span></label>
      <label class="field" for="ar-l"><span>Length</span><span class="in"><input id="ar-l" type="number" min="100" max="1500" step="1" value="350" required><span class="u">cm</span></span></label>
      <label class="field" for="ar-h"><span>Ceiling</span><span class="in"><input id="ar-h" type="number" min="200" max="500" step="1" value="${cm(last.h)}" required><span class="u">cm</span></span></label>
    </div>
    <div class="fields two">
      <label class="field" for="ar-next"><span>Next to</span><span class="in"><select id="ar-next">${h.rooms.map((r, i) => `<option value="${i}" ${r === last ? 'selected' : ''}></option>`).join('')}</select></span></label>
      <label class="field" for="ar-side"><span>On its</span><span class="in"><select id="ar-side"><option value="right">right side</option><option value="left">left side</option><option value="back">back side</option><option value="front">front side</option></select></span></label>
    </div>
    <label class="check" for="ar-door"><input type="checkbox" id="ar-door" checked><span>Put a door between them</span></label>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Add room</button></div></form>`,
  null, () => {
    const w = +$('ar-w').value / 100, l = +$('ar-l').value / 100, hh = +$('ar-h').value / 100;
    if (!(w >= 1 && l >= 1 && hh >= 2)) return;
    const o = h.rooms[+$('ar-next').value], side = $('ar-side').value;
    const r = cleanRoom({ name: $('ar-name').value.trim() || 'Room', w, l, h: hh, floor: o.floor });
    placeBeside(o, r, side);
    if ($('ar-door').checked) { const d = doorBetween(o, r, side); if (d) r.openings.push(d); }
    h.rooms.push(r);
    closeDialog(); changed(true); resetView(); focusRoom(r.id);
    toast(`${r.name} added. Arrange rooms by dragging them in Plan view.`);
  });
  [...box.querySelectorAll('#ar-next option')].forEach((op, i) => { op.textContent = h.rooms[i].name; });
}
function roomPane() {
  const r = studio.room;
  const ops = r.openings.map(o => `<div class="op-card"><div class="op-h"><span>${OP_KINDS[o.kind]}</span><button type="button" class="btn small danger" data-act="opdel" data-id="${o.id}">Remove</button></div>
    <label class="field"><span>Wall</span><span class="in"><select data-act="op" data-id="${o.id}" data-k="wall">${WALL_IDS.map(w => `<option value="${w}" ${w === o.wall ? 'selected' : ''}>${WALL_NAMES[w]}</option>`).join('')}</select></span></label>
    <div class="fields two">
      ${numField('From the left', 'op', cm(o.off), `data-id="${o.id}" data-k="off" min="0" step="1"`)}
      ${numField('Width', 'op', cm(o.w), `data-id="${o.id}" data-k="w" min="20" step="1"`)}
      ${numField('Height', 'op', cm(o.h), `data-id="${o.id}" data-k="h" min="10" step="1"`)}
      ${o.kind === 'door' ? '' : numField(o.kind === 'window' ? 'Sill height' : 'From the floor', 'op', cm(o.y), `data-id="${o.id}" data-k="y" min="0" step="1"`)}
    </div></div>`).join('');
  return `<label class="field"><span>Room name</span><span class="in"><input data-act="rname" maxlength="60" value="${esc(r.name)}"></span></label>
    <div class="sec-h">Size</div>
    <div class="fields">${numField('Width', 'dim', cm(r.w), 'data-k="w" min="100" max="1500" step="1"')}${numField('Length', 'dim', cm(r.l), 'data-k="l" min="100" max="1500" step="1"')}${numField('Ceiling', 'dim', cm(r.h), 'data-k="h" min="200" max="500" step="1"')}</div>
    <p class="note">Width runs along the back and front walls, length along the left and right walls. “From the left” is measured facing the wall.</p>
    <div class="sec-h">Floor</div>
    <div class="chips">${Object.entries(FLOORS).map(([k, [n]]) => `<button type="button" class="chip" data-act="floor" data-v="${k}" aria-pressed="${r.floor === k}">${n}</button>`).join('')}</div>
    <div class="sec-h">Windows, doors and radiators</div>
    ${ops || '<p class="note">None yet.</p>'}
    <div style="display:flex;gap:6px;flex-wrap:wrap">${Object.entries(OP_KINDS).map(([k, n]) => `<button type="button" class="btn small" data-act="opadd" data-v="${k}">Add ${n.toLowerCase()}</button>`).join('')}</div>
    <div class="sec-h">This home</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn small" data-act="addroom">Add another room</button>${studio.home.rooms.length > 1 ? `<button type="button" class="btn small danger" data-act="rdel">${armedRoom === r.id ? 'Click again to remove this room' : 'Remove this room'}</button>` : ''}</div>`;
}
function furniturePane() {
  const r = studio.room;
  return `<button type="button" class="btn primary" data-act="addfurn">Add furniture</button>
    <div class="sec-h">In the room · ${r.items.length}</div>
    <div class="list">${r.items.map(it => `<button type="button" class="lrow" data-act="sel" data-id="${it.id}" aria-pressed="${selId === it.id}">
      <span class="thumb" style="${it.p.photo ? `background-image:url(${assetSrc(it.p.photo)})` : `background-color:${it.p.color}`}"></span>
      <span class="tx"><b></b><small class="num">${cm(it.p.w)} × ${cm(it.p.d)} × ${cm(it.p.h)} cm</small></span></button>`).join('') || '<p class="note">Nothing yet. Add a sofa, a bed or anything from a shop.</p>'}</div>`;
}
function fillFurnitureNames() { const rows = $('pane').querySelectorAll('[data-act="sel"] b'); studio.room.items.forEach((it, i) => { if (rows[i]) rows[i].textContent = it.p.name; }); }

/* Shopping list: furniture grouped by product, wallpaper rolls worked out from the walls. */
function shopping(home) {
  const groups = new Map(), rooms = home.rooms;
  for (const it of rooms.flatMap(x => x.items)) {
    const k = it.p.ref || it.p.name;
    const g = groups.get(k) || { p: it.p, n: 0 }; g.n++; groups.set(k, g);
  }
  const papers = new Map();
  for (const r of rooms) for (const wid of WALL_IDS) for (const z of [r.walls[wid].lo, r.walls[wid].hi]) for (const f of [z.f, z.inner]) if (f && f.type === 'image' && f.img && f.img.ref) papers.set(f.img.ref, f.img);
  const paperRows = [...papers.values()].map(img => ({ img, plan: paperPlan(rooms, img) })).filter(x => x.plan.uses.length);
  const paints = new Map();
  for (const r of rooms) for (const wid of WALL_IDS) for (const z of [r.walls[wid].lo, r.walls[wid].hi]) for (const f of [z.f, z.inner]) if (f && f.paint) paints.set(f.paint.ref, f.paint);
  const paintRows = [...paints.values()].map(paint => ({ paint, plan: paintPlan(rooms, paint) })).filter(x => x.plan.tins);
  let total = 0, missing = 0;
  for (const g of groups.values()) { if (g.p.price !== null) total += g.p.price * g.n; else if (!g.p.ref.startsWith('basic:')) missing++; }
  for (const x of paperRows) if (x.plan.cost !== null) total += x.plan.cost;
  for (const x of paintRows) if (x.plan.cost !== null) total += x.plan.cost;
  return { groups: [...groups.values()], paperRows, paintRows, total, missing };
}
function listPane() {
  const r = studio.home, s = shopping(r), view = studio.mode === 'view';
  const rows = s.groups.map(g => `<div class="lrow" style="cursor:default">
      <span class="thumb" style="${g.p.photo ? `background-image:url(${assetSrc(g.p.photo)})` : `background-color:${g.p.color}`}"></span>
      <span class="tx"><b data-gname></b><small><span data-gshop></span>${g.n > 1 ? ` · ${g.n} ×` : ''}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${g.p.price !== null ? `<span class="price">${euro(g.p.price * g.n)}</span>` : '<small class="note">—</small>'}${g.p.url ? `<a href="${esc(g.p.url)}" target="_blank" rel="noopener" style="font-size:12px">Shop ↗</a>` : ''}</span></div>`).join('');
  const papers = s.paperRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="background-image:url(${blobSrc(x.img.src)})"></span>
      <span class="tx"><b data-pname></b><small>${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : ''}${x.img.url ? `<a href="${esc(x.img.url)}" target="_blank" rel="noopener" style="font-size:12px">Shop ↗</a>` : ''}</span></div>`).join('');
  return `${view ? `<p class="note">Everything in this ${r.rooms.length > 1 ? 'home' : 'room'}, with the prices the shops listed when it was furnished. Tap a piece to see it.</p>` : r.rooms.length > 1 ? '<p class="note">Everything in every room of this home.</p>' : ''}
    <div class="sec-h">Furniture</div><div class="list">${rows || '<p class="note">No furniture yet.</p>'}</div>
    ${papers ? `<div class="sec-h">Wallpaper</div><div class="list">${papers}</div>` : ''}
    ${s.paintRows.length ? `<div class="sec-h">Paint</div><div class="list">${s.paintRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="background-color:${x.paint.color || '#ddd'}"></span>
      <span class="tx"><b data-ptname></b><small>${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : ''}${x.paint.url ? `<a href="${esc(x.paint.url)}" target="_blank" rel="noopener" style="font-size:12px">Shop ↗</a>` : ''}</span></div>`).join('')}</div>` : ''}
    <div class="total"><span>Total</span><span class="price">${euro(s.total)}</span></div>
    <p class="note">${s.missing ? `${s.missing} product${s.missing === 1 ? ' has' : 's have'} no price listed. ` : ''}Generic pieces from Nido basics have no price.${papers ? ' Wallpaper includes 10 cm per strip to trim, rounded up to the pattern repeat.' : ''}</p>`;
}
function fillListNames() {
  const s = shopping(studio.home), p = $('pane');
  p.querySelectorAll('[data-gname]').forEach((b, i) => { b.textContent = s.groups[i].p.name; });
  p.querySelectorAll('[data-gshop]').forEach((b, i) => { b.textContent = s.groups[i].p.shop || ''; });
  p.querySelectorAll('[data-ptname]').forEach((b, i) => { const x = s.paintRows[i]; b.textContent = x.paint.name + (x.paint.code ? ' · ' + x.paint.code : '') + (x.paint.shop ? ' · ' + x.paint.shop : ''); });
  p.querySelectorAll('[data-pname]').forEach((b, i) => { b.textContent = s.paperRows[i].img.name + (s.paperRows[i].img.shop ? ' · ' + s.paperRows[i].img.shop : ''); });
}

/* ---------- Walls ---------- */
const finOf = (z, slot) => (slot === 'in' ? z.inner : z.f);
function zoneOf() { const cfg = studio.room.walls[studio.wall]; return cfg[cfg.layout === 'split' ? studio.part : 'lo']; }
function swatchRow(act, current, slot, withAuto) {
  return `<div class="swatches">${withAuto ? `<button type="button" class="btn small" data-act="${act}" data-slot="${slot || ''}" data-v="" aria-pressed="${!current}">Auto</button>` : ''}${PRESETS.map(([n, c]) => `<button type="button" class="dot" data-act="${act}" data-slot="${slot || ''}" data-v="${c}" title="${n}" aria-label="${n}" aria-pressed="${(current || '').toLowerCase() === c}" style="background:${c}"></button>`).join('')}
    <label class="in hexin"><input type="text" data-act="${act}" data-slot="${slot || ''}" data-hex="1" value="${current || ''}" placeholder="#rrggbb" maxlength="20" spellcheck="false" aria-label="Colour code"></label></div>`;
}
function wallpapers() {
  const shopWp = allProducts().filter(p => p.kind === 'wallpaper' && p.wallpaper && p.wallpaper.tile);
  const mine = new Map();
  for (const r of [studio.home, ...S.drafts.values()].flatMap(h => h.rooms)) for (const wid of WALL_IDS) for (const z of [r.walls[wid].lo, r.walls[wid].hi]) for (const f of [z.f, z.inner]) if (f && f.img && !f.img.ref) mine.set(f.img.src, f.img);
  return { shopWp, mine: [...mine.values()] };
}
function finishEditor(f, slot, title) {
  const tw = FIN_TYPES.map(([t, n]) => `<button type="button" data-act="ftype" data-slot="${slot}" data-v="${t}" aria-pressed="${f.type === t}">${n}</button>`).join('');
  let body = '';
  if (f.type === 'paint' || f.type === 'panel') {
    const paints = allProducts().filter(p => p.kind === 'paint');
    body = `${paints.length ? `<span class="note">Paint from shops</span><div class="swatches">${paints.map(p => `<button type="button" class="dot" data-act="fpaint" data-slot="${slot}" data-ref="${esc(p.ref)}" aria-pressed="${!!f.paint && f.paint.ref === p.ref}" title="${esc(p.name)}${p.paint && p.paint.code ? ' · ' + esc(p.paint.code) : ''} · ${esc(p.shop)}" aria-label="${esc(p.name)}" style="background:${p.color}"></button>`).join('')}</div>` : ''}
      ${f.paint ? `<p class="note"><b data-fill="${fills.push(f.paint.name + (f.paint.shop ? ' · ' + f.paint.shop : '')) - 1}"></b>${f.paint.code ? ' · ' + esc(f.paint.code) : ''}${f.paint.price !== null ? ` · ${euro(f.paint.price)} per ${f.paint.tinL.toLocaleString()} L tin` : ''}${f.paint.url ? ` <a href="${esc(f.paint.url)}" target="_blank" rel="noopener">Shop ↗</a>` : ''}</p>` : ''}
      <span class="note">${paints.length ? 'Or any colour' : 'Colour'}</span>${swatchRow('fcolor', f.color, slot)}${f.type === 'panel' ? numField('Board width', 'fsize', f.board, `data-slot="${slot}" min="3" max="60" step="1"`) : ''}`;
  }
  if (f.type === 'pattern') body = `<span class="note">Background</span>${swatchRow('fcolor', f.color, slot)}
    <div class="fields two"><label class="field"><span>Pattern</span><span class="in"><select data-act="fpattern" data-slot="${slot}">${Object.entries(PATTERNS).map(([k, n]) => `<option value="${k}" ${k === f.pattern ? 'selected' : ''}>${n}</option>`).join('')}</select></span></label>
    <label class="field"><span>Pattern colour</span><span class="in"><input type="color" data-act="fcolor2" data-slot="${slot}" value="${f.color2}" style="height:31px;padding:3px"></span></label></div>
    ${numField('Pattern size', 'fsize', f.tile, `data-slot="${slot}" min="5" max="300" step="1"`)}`;
  if (f.type === 'image') {
    const { shopWp, mine } = wallpapers(), cur = f.img;
    body = `<span class="note">From shops</span><div class="thumbs">${shopWp.map(p => `<button type="button" data-act="fimg" data-slot="${slot}" data-ref="${esc(p.ref)}" aria-pressed="${!!cur && cur.ref === p.ref}" title="${esc(p.name)} · ${esc(p.shop)}" style="background-image:url(${assetSrc(p.wallpaper.tile)})"></button>`).join('') || '<span class="note" style="grid-column:1/-1">No shop has listed wallpaper yet.</span>'}</div>
      <span class="note">Your images</span><div class="thumbs">${mine.map(m => `<button type="button" data-act="fmine" data-slot="${slot}" data-src="${esc(m.src)}" aria-pressed="${!!cur && cur.src === m.src && !cur.ref}" style="background-image:url(${blobSrc(m.src)})"></button>`).join('')}
        <label for="up-${slot}" title="Upload an image" aria-label="Upload an image" tabindex="0">+</label></div>
      <input type="file" id="up-${slot}" class="vh" accept="image/*" data-act="fupload" data-slot="${slot}">
      ${cur ? `<p class="note"><b data-fill="${fills.push(cur.name + (cur.shop ? ' · ' + cur.shop : '')) - 1}"></b>${cur.mural ? '. A mural: one picture stretched to cover this part of the wall.' : `. One repeat is ${cur.width} cm wide.`}${cur.url ? ` <a href="${esc(cur.url)}" target="_blank" rel="noopener">Shop ↗</a>` : ''}</p>` : '<p class="note">Pick a paper, or upload a photo of a sample.</p>'}
      ${cur && !cur.mural && !cur.ref ? numField('Repeat width', 'fsize', f.imgW, `data-slot="${slot}" min="5" max="400" step="1"`) : ''}`;
  }
  return `<div class="finish"><div class="fin-h">${title}</div><div class="types">${tw}</div>${body}</div>`;
}
function wallsPane() {
  const r = studio.room, wid = studio.wall, cfg = r.walls[wid], split = cfg.layout === 'split', z = zoneOf(), part = split ? studio.part : 'lo';
  const partName = !split ? 'the wall' : part === 'hi' ? 'the top part' : 'the bottom part';
  const ops = r.openings.filter(o => o.wall === wid).map(o => OP_KINDS[o.kind].toLowerCase());
  return `<div class="seg wide" role="group" aria-label="Wall">${WALL_IDS.map(w => `<button type="button" data-act="wallpick" data-v="${w}" aria-pressed="${w === wid}">${WALL_NAMES[w].replace(' wall', '')}</button>`).join('')}</div>
    <p class="note">${WALL_NAMES[wid]}, ${cm(wallLen(wid))} cm${ops.length ? ', with a ' + ops.join(' and a ') : ''}. Tap a wall in the room to pick it.</p>
    <div class="seg wide" role="group" aria-label="Layout"><button type="button" data-act="layout" data-v="whole" aria-pressed="${!split}">One part</button><button type="button" data-act="layout" data-v="split" aria-pressed="${split}">Split in two</button></div>
    ${split ? `<div class="fields two">${numField('Split height', 'split', cm(cfg.split), 'min="20" max="400" step="1"')}<label class="check" style="align-self:end;padding-bottom:7px"><input type="checkbox" data-act="rail" ${cfg.rail ? 'checked' : ''}><span>Rail</span></label></div>
      ${cfg.rail ? `<div class="seg wide" role="group" aria-label="Rail shape">${RAIL_STYLES.map(([k, n]) => `<button type="button" data-act="railStyle" data-v="${k}" aria-pressed="${cfg.railStyle === k}">${n}</button>`).join('')}</div>
      <span class="note">Rail colour</span>${swatchRow('trim', cfg.trim || '#fbfbf9', '', false)}` : ''}
      <div class="seg wide" role="group" aria-label="Part"><button type="button" data-act="part" data-v="hi" aria-pressed="${part === 'hi'}">Top part</button><button type="button" data-act="part" data-v="lo" aria-pressed="${part === 'lo'}">Bottom part</button></div>` : ''}
    ${finishEditor(z.f, 'f', !split ? 'Finish' : part === 'hi' ? 'Top part finish' : 'Bottom part finish')}
    <div class="finish"><label class="check"><input type="checkbox" data-act="frames" ${z.frames ? 'checked' : ''}><span>Mouldings or panels on ${partName}</span></label>
      ${z.frames ? `<div class="seg wide" role="group" aria-label="Kind of panel">${FRAME_STYLES.map(([k, n]) => `<button type="button" data-act="fstyle" data-v="${k}" aria-pressed="${z.style === k}">${n}</button>`).join('')}</div>
        <span class="note">${z.style === 'soft' || z.style === 'tops' ? 'Panel colour' : 'Moulding colour'}</span>${swatchRow('mould', z.mould, '', true)}
        ${numField('Number of panels', 'pcount', (z.panels || spreadPanels(wid, undefined, part)).length, 'min="1" max="24" step="1"', '')}
        ${z.style !== 'soft' ? `<div class="seg wide" role="group" aria-label="Inside"><button type="button" data-act="inner" data-v="same" aria-pressed="${!z.inner}">${z.style === 'tops' ? 'Plain colour' : 'Same as the wall'}</button><button type="button" data-act="inner" data-v="own" aria-pressed="${!!z.inner}">Its own finish</button></div>` : ''}` : ''}
    </div>
    ${z.frames && z.inner && z.style !== 'soft' ? finishEditor(z.inner, 'in', z.style === 'tops' ? 'Panel finish' : 'Inside the frames') : ''}
    ${paperNote(z)}${paintNote(z)}
    <button type="button" class="btn" data-act="allwalls">Use this on all four walls</button>`;
}
/* Litres of a shop's paint across the whole room: wall area (minus windows and doors) × coats ÷ coverage, in whole tins. */
function paintPlan(rooms, paint) {
  let area = 0;
  for (const r of rooms) for (const wid of WALL_IDS) {
    const cfg = r.walls[wid], len = wid === 'back' || wid === 'front' ? r.w : r.l;
    const holes = r.openings.filter(o => o.wall === wid && o.kind !== 'radiator').map(o => ({ u0: o.off, u1: o.off + o.w, v0: o.kind === 'door' ? 0 : o.y, v1: (o.kind === 'door' ? 0 : o.y) + o.h }));
    const blocks = r.openings.filter(o => o.wall === wid).map(o => ({ u0: o.off, u1: o.off + o.w, v0: o.kind === 'door' ? 0 : o.y, v1: (o.kind === 'door' ? 0 : o.y) + o.h }));
    const parts = cfg.layout === 'split' ? [['lo', 0, Math.min(cfg.split, r.h)], ['hi', Math.min(cfg.split, r.h), r.h]] : [['lo', 0, r.h]];
    for (const [key, z0, z1] of parts) {
      const z = cfg[key], uses = (f) => f && (f.type === 'paint' || f.type === 'panel') && f.paint && f.paint.ref === paint.ref;
      if (uses(z.f)) {
        area += len * (z1 - z0);
        for (const o of holes) area -= Math.max(0, Math.min(o.u1, len) - Math.max(o.u0, 0)) * Math.max(0, Math.min(o.v1, z1) - Math.max(o.v0, z0));
      }
      if (z.frames && z.style !== 'soft' && uses(z.inner)) {
        const [v0, v1] = frameSpan(cfg, key, r.h);
        if (v1 - v0 >= 0.15) for (const c of (z.panels || autoColumns(len, blocks, v0, v1, z.panelW))) area += c.w * (v1 - v0);
      }
    }
  }
  const litres = area * paint.coats / paint.coverage, tins = area > 0.01 ? Math.ceil(litres / paint.tinL - 1e-6) : 0;
  const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return { area, litres, tins, cost: paint.price !== null ? tins * paint.price : null,
    text: `${tins} tin${tins === 1 ? '' : 's'} of ${fmt(paint.tinL)} L · ${fmt(litres)} L for ${fmt(area)} m², ${paint.coats} coat${paint.coats === 1 ? '' : 's'}` };
}
function paintNote(z) {
  const paint = [z.f, z.inner].map(f => f && (f.type === 'paint' || f.type === 'panel') && f.paint).find(Boolean);
  if (!paint) return '';
  const plan = paintPlan(studio.home.rooms, paint);
  return `<div class="finish"><div class="fin-h">How much paint</div><div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}<p class="note">Across the whole home, windows and doors left out. Coverage and tin size from the shop.</p></div>`;
}
function paperNote(z) {
  const img = [z.f, z.inner].map(f => f && f.type === 'image' && f.img).find(Boolean);
  if (!img) return '';
  const plan = paperPlan(studio.home.rooms, img);
  return `<div class="finish"><div class="fin-h">How much paper</div><div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}<p class="note">Across the whole home. ${img.ref ? 'Roll size from the shop.' : 'For your own image, rolls of 53 cm × 10.05 m are assumed.'}</p></div>`;
}
function spreadPanels(wid, count, key) {
  const cfg = studio.room.walls[wid], [v0, v1] = frameSpan(cfg, key, H);
  return autoColumns(wallLen(wid), wallBlocks(wid), v0, v1, cfg[key].panelW, count);
}
/* Strips of roll width; shorter where a window or door takes the whole strip; 10 cm to trim; rounded up to the repeat. */
function paperPlan(rooms, img) {
  const rw = img.rollW / 100, rl = img.rollL / 100, rep = img.mural ? 0 : img.width * img.aspect / 100, trim = 0.1;
  const cutLen = (h) => (rep > 0.01 ? Math.ceil((h + trim) / rep - 1e-6) * rep : h + trim);
  const uses = [], pieces = [], slivers = [];
  let area = 0, order = 0;
  for (const r of rooms) for (const wid of WALL_IDS) {
    const cfg = r.walls[wid], len = wid === 'back' || wid === 'front' ? r.w : r.l;
    const box2 = (o) => ({ u0: o.off, u1: o.off + o.w, v0: o.kind === 'door' ? 0 : o.y, v1: (o.kind === 'door' ? 0 : o.y) + o.h });
    const holes = r.openings.filter(o => o.wall === wid && o.kind !== 'radiator').map(box2), blocks = r.openings.filter(o => o.wall === wid).map(box2);
    const parts = cfg.layout === 'split' ? [['lo', 0, Math.min(cfg.split, r.h)], ['hi', Math.min(cfg.split, r.h), r.h]] : [['lo', 0, r.h]];
    for (const [key, z0, z1] of parts) {
      const z = cfg[key], same = (f) => f && f.type === 'image' && f.img && (img.ref ? f.img.ref === img.ref : f.img.src === img.src);
      if (same(z.f) && z1 - z0 > 0.01) {
        uses.push(wid); order += (len + 0.1) * (z1 - z0 + 0.1);
        for (let u = 0; u < len - 0.005; u += rw) {
          const a = u, b = Math.min(u + rw, len);
          let spans = [[z0, z1]];
          for (const o of holes) if (o.u0 <= a + 0.005 && o.u1 >= b - 0.005) spans = spans.flatMap(([s0, s1]) => [[s0, Math.min(s1, o.v0)], [Math.max(s0, o.v1), s1]]).filter(([s0, s1]) => s1 - s0 > 0.01);
          for (const [s0, s1] of spans) { area += (b - a) * (s1 - s0); pieces.push(cutLen(s1 - s0)); }
        }
      }
      if (z.frames && z.style !== 'soft' && same(z.inner)) {
        const [v0, v1] = frameSpan(cfg, key, r.h); if (v1 - v0 < 0.15) continue;
        const bl = blocks.filter(o => o.v0 < v1 && o.v1 > v0);
        const cols = (z.panels || autoColumns(len, blocks, v0, v1, z.panelW)).filter(c => c.u + c.w <= len + 0.001 && !bl.some(o => c.u < o.u1 + 0.02 && c.u + c.w > o.u0 - 0.02));
        if (cols.length) uses.push(wid);
        for (const c of cols) {
          const h = v1 - v0, full = Math.floor(c.w / rw + 1e-3), rest = c.w - full * rw;
          area += c.w * h; order += (c.w + 0.1) * (h + 0.1);
          for (let k = 0; k < full; k++) pieces.push(cutLen(h));
          if (rest > 0.01) slivers.push({ w: rest, len: cutLen(h) });
        }
      }
    }
  }
  slivers.sort((a, b) => b.w - a.w);
  const shared = [];
  for (const sl of slivers) { const st = shared.find(t => t.free >= sl.w - 1e-6); if (st) { st.free -= sl.w; st.len = Math.max(st.len, sl.len); } else shared.push({ free: rw - sl.w, len: sl.len }); }
  for (const st of shared) pieces.push(st.len);
  pieces.sort((a, b) => b - a);
  const rolls = [];
  for (const pc of pieces) { const i = rolls.findIndex(left => left >= pc - 1e-6); if (i >= 0) rolls[i] -= pc; else rolls.push(rl - Math.min(pc, rl)); }
  const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (img.mural || img.unit === 'm2') {
    return { uses, area, cost: img.price !== null ? order * img.price : null, text: `Order ${fmt(order)} m² (made to measure, 5 cm extra on every side)` };
  }
  return { uses, area, rolls: rolls.length, cost: img.price !== null ? rolls.length * img.price : null,
    text: `${rolls.length} roll${rolls.length === 1 ? '' : 's'} · ${pieces.length} strip${pieces.length === 1 ? '' : 's'} up to ${Math.round((pieces[0] || 0) * 100)} cm · covers ${fmt(area)} m²` };
}

/* ---------- Pane events ---------- */
async function paneEvent(e) {
  if (!studio) return;
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, r = studio.room, type = e.type;
  if (r) ctx(r);
  if (type === 'click' && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'LABEL')) return;
  if (type === 'input' && !(t.type === 'color' || t.dataset.hex)) return;
  const rerender = () => renderPane();
  // room
  if (act === 'dim' && type === 'change') {
    const v = +t.value / 100, k = t.dataset.k, lim = { w: [1, 15], l: [1, 15], h: [2, 5] }[k];
    if (!(v >= lim[0] && v <= lim[1])) { rerender(); return; }
    r[k] = v;
    Object.assign(r, cleanRoom(r), { items: r.items });
    for (const it of r.items) { const c = clampItem(r, it); it.x = c.x; it.z = c.z; }
    changed(true); layoutStudio(); resetView(); renderStudio(); return;
  }
  if (act === 'floor') { r.floor = t.dataset.v; changed(true); rerender(); return; }
  if (act === 'opadd') {
    const k = t.dataset.v, wall = k === 'door' ? 'front' : 'back', len = wall === 'back' || wall === 'front' ? r.w : r.l;
    const d = { window: { w: 1.2, h: 1.3, y: 0.9 }, door: { w: 0.82, h: 2.03, y: 0 }, radiator: { w: 0.8, h: 0.6, y: 0.12 } }[k];
    r.openings.push({ id: newId('o'), kind: k, wall, off: Math.max(0, (len - d.w) / 2), ...d });
    changed(true); rerender(); return;
  }
  if (act === 'opdel') { r.openings = r.openings.filter(o => o.id !== t.dataset.id); changed(true); rerender(); return; }
  if (act === 'op' && type === 'change') {
    const o = r.openings.find(x => x.id === t.dataset.id); if (!o) return;
    const k = t.dataset.k;
    if (k === 'wall') o.wall = t.value;
    else { const v = +t.value / 100; if (!isFinite(v)) return; o[k] = v; }
    const len = o.wall === 'back' || o.wall === 'front' ? r.w : r.l;
    o.w = clamp(o.w, 0.2, len); o.off = clamp(o.off, 0, len - o.w); o.h = clamp(o.h, 0.1, r.h - 0.02); o.y = o.kind === 'door' ? 0 : clamp(o.y, 0, r.h - o.h - 0.02);
    changed(true); rerender(); return;
  }
  if (act === 'focus') { focusRoom(t.dataset.id); return; }
  if (act === 'addroom') { addRoomDialog(); return; }
  if (act === 'rname' && type === 'change') { r.name = t.value.trim().slice(0, 60) || 'Room'; if (studio.home.rooms.length === 1) studio.home.name = r.name; changed(false); renderStudio(); return; }
  if (act === 'rdel') {
    if (armedRoom !== r.id) { armedRoom = r.id; rerender(); setTimeout(() => { if (armedRoom === r.id) { armedRoom = null; if (studio && studio.tab === 'room') renderPane(); } }, 4000); return; }
    armedRoom = null; studio.home.rooms = studio.home.rooms.filter(x => x !== r); studio.room = null; changed(true); focusRoom(null); toast(`${r.name} removed.`); return;
  }
  // furniture
  if (act === 'addfurn') { pickFurnitureDialog(); return; }
  if (act === 'sel') { selectItem(t.dataset.id); return; }
  // walls
  const wid = studio.wall, cfg = r.walls[wid], z = zoneOf(), part = cfg.layout === 'split' ? studio.part : 'lo';
  if (act === 'wallpick') { studio.wall = t.dataset.v; flyTo(studio.wall); rerender(); return; }
  if (act === 'layout') { cfg.layout = t.dataset.v; if (cfg.layout === 'split') studio.part = 'hi'; changed(true); rerender(); return; }
  if (act === 'part') { studio.part = t.dataset.v; rerender(); return; }
  if (act === 'split' && type === 'change') { const v = +t.value / 100; if (v >= 0.2 && v <= r.h - 0.1) cfg.split = v; changed(true); rerender(); return; }
  if (act === 'rail') { cfg.rail = t.checked; changed(true); rerender(); return; }
  if (act === 'railStyle') { cfg.railStyle = t.dataset.v; changed(true); rerender(); return; }
  const hexVal = () => (t.dataset.hex ? (parseHex(t.value) || null) : t.tagName === 'INPUT' ? t.value : t.dataset.v);
  if (act === 'trim') { const h = hexVal(); if (!h && t.dataset.hex) return; cfg.trim = h || null; changed(true); if (type !== 'input') rerender(); return; }
  if (act === 'mould') { const h = hexVal(); if (!h && t.dataset.hex && t.value) return; z.mould = h || null; changed(true); if (type !== 'input') rerender(); return; }
  if (act === 'frames') { z.frames = t.checked; changed(true); rerender(); return; }
  if (act === 'fstyle') { z.style = t.dataset.v; changed(true); rerender(); return; }
  if (act === 'pcount' && type === 'change') { const n = parseInt(t.value, 10); if (n >= 1 && n <= 24) z.panels = spreadPanels(wid, n, part); changed(true); rerender(); return; }
  if (act === 'inner') { z.inner = t.dataset.v === 'own' ? (z.inner || defaultFinish({ color: '#d9a195' })) : null; changed(true); rerender(); return; }
  if (act === 'allwalls') { for (const w of WALL_IDS) if (w !== wid) r.walls[w] = JSON.parse(JSON.stringify(cfg)); changed(true); toast('All four walls now match this one.'); return; }
  const f = t.dataset.slot ? finOf(z, t.dataset.slot) : null;
  if (!f) return;
  if (act === 'ftype') {
    f.type = t.dataset.v;
    if (f.type === 'image' && !f.img) {
      const { shopWp, mine } = wallpapers();
      if (shopWp[0]) applyShopPaper(f, shopWp[0]); else if (mine[0]) { f.img = { ...mine[0] }; } else f.type = 'image';
    }
    changed(true); rerender(); return;
  }
  if (act === 'fcolor') { const h = hexVal(); if (!h) return; f.color = h; f.paint = null; changed(true); if (type !== 'input') rerender(); return; }
  if (act === 'fpaint') {
    const p = allProducts().find(x => x.ref === t.dataset.ref); if (!p) return;
    f.color = p.color; f.paint = cleanPaint({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, color: p.color, ...(p.paint || {}) });
    changed(true); rerender(); return;
  }
  if (act === 'fcolor2') { f.color2 = t.value; changed(true); return; }
  if (act === 'fpattern' && type === 'change') { f.pattern = t.value; changed(true); return; }
  if (act === 'fsize' && type === 'change') {
    const v = +t.value, key = f.type === 'pattern' ? 'tile' : f.type === 'panel' ? 'board' : 'imgW';
    if (v >= 3 && v <= 400) f[key] = v; changed(true); rerender(); return;
  }
  if (act === 'fimg') { const p = allProducts().find(x => x.ref === t.dataset.ref); if (p) { applyShopPaper(f, p); f.type = 'image'; changed(true); rerender(); } return; }
  if (act === 'fmine') { const m = wallpapers().mine.find(x => x.src === t.dataset.src); if (m) { f.img = { ...m }; f.imgW = m.width; f.type = 'image'; changed(true); rerender(); } return; }
  if (act === 'fupload' && type === 'change') {
    const file = t.files && t.files[0]; t.value = ''; if (!file) return;
    toast('Uploading…');
    try {
      const up = await uploadFile(file), aspect = await imageAspect(file);
      f.img = cleanImg({ src: '/_blob/' + up.id, aspect, width: 60, name: file.name.slice(0, 80) }); f.imgW = 60; f.type = 'image';
      $('toast').hidden = true; changed(true); rerender();
    } catch (er) { toast(uploadError(er)); }
  }
}
function applyShopPaper(f, p) {
  const wp = p.wallpaper;
  f.img = cleanImg({ src: '/_blob/' + wp.tile, aspect: wp.aspect, width: wp.width, mural: wp.mural, name: p.name, ref: p.ref, shop: p.shop, url: p.url, price: p.price, unit: wp.unit, rollW: wp.rollW, rollL: wp.rollL });
  f.imgW = wp.width;
}
function parseHex(v) {
  v = String(v || '').trim().toLowerCase();
  let m = v.match(/^#?([0-9a-f]{6})$/); if (m) return '#' + m[1];
  m = v.match(/^#?([0-9a-f]{3})$/); if (m) return '#' + [...m[1]].map(c => c + c).join('');
  m = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) return '#' + [m[1], m[2], m[3]].map(n => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  return null;
}
for (const ev of ['click', 'change', 'input']) $('pane').addEventListener(ev, paneEvent);
$('pane').addEventListener('keydown', (e) => { const l = e.target.closest('label[for^="up-"]'); if (l && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $(l.htmlFor).click(); } });

/* ---------- Furniture: add, inspect, rotate ---------- */
function pickFurnitureDialog() {
  let kind = 'all', q = '';
  const draw = () => {
    const list = allProducts().filter(p => p.kind !== 'wallpaper' && p.kind !== 'paint' && (kind === 'all' || p.kind === kind) && (!q || (p.name + ' ' + p.shop).toLowerCase().includes(q)));
    const g = $('pick-grid');
    g.innerHTML = list.map(p => productCard(p, `<button type="button" class="btn small primary" data-add="${esc(p.ref)}">Add</button>`)).join('') || '<p class="note">No products match.</p>';
    [...g.querySelectorAll('.card')].forEach((c, i) => { c.querySelector('[data-name]').textContent = list[i].name; c.querySelector('[data-shop]').textContent = list[i].shop; });
    for (const b of $('dlg-box').querySelectorAll('[data-pk]')) b.setAttribute('aria-pressed', b.dataset.pk === kind);
  };
  const box = openDialog(`<div class="dlg-h"><h2 id="dlg-title">Add furniture</h2><button type="button" class="btn small" data-close>Done</button></div>
    <label class="in" for="pick-q"><input id="pick-q" type="search" placeholder="Search products or shops" aria-label="Search products or shops"></label>
    <div class="chips">${[['all', 'Everything'], ...Object.entries(KINDS).filter(([k]) => k !== 'box')].map(([k, n]) => `<button type="button" class="chip" data-pk="${k}" aria-pressed="${k === 'all'}">${esc(n)}</button>`).join('')}</div>
    <div class="grid" id="pick-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))"></div>`,
  (e) => {
    const k = e.target.closest('[data-pk]'); if (k) { kind = k.dataset.pk; draw(); return; }
    const a = e.target.closest('[data-add]'); if (a) { addProduct(a.dataset.add); toast('Added to the room. Drag it into place.'); }
  });
  box.oninput = (e) => { if (e.target.id === 'pick-q') { q = e.target.value.trim().toLowerCase(); draw(); } };
  $('dlg-box').style.width = 'min(860px, 100%)';
  draw();
}
function addProduct(ref) {
  if (!studio || studio.mode !== 'edit') return;
  const p = allProducts().find(x => x.ref === ref); if (!p) return;
  if (!studio.room) { toast('Pick a room first, then add furniture to it.'); return; }
  const r = studio.room, it = { id: newId('i'), x: 0, z: 0, rot: 0, p: cleanProduct(p) };
  ctx(r);
  const c = freeSpot(r, it); it.x = c.x; it.z = c.z;
  r.items.push(it);
  syncItems(); selectItem(it.id); changed(false);
  if (studio.tab === 'furniture') renderPane();
}
/* The free spot nearest the middle of the room, so a new piece doesn't land inside another one. Rugs go anywhere. */
function freeSpot(r, it) {
  const f = (i) => (i.rot % 2 ? { w: i.p.d, d: i.p.w } : { w: i.p.w, d: i.p.d }), me = f(it);
  const rects = r.items.filter(o => o !== it && o.p.kind !== 'rug').map(o => { const g = f(o); return [o.x - g.w / 2, o.x + g.w / 2, o.z - g.d / 2, o.z + g.d / 2]; });
  if (it.p.kind === 'rug') return clampItem(r, it);
  let best = null;
  for (let x = -r.w / 2 + me.w / 2; x <= r.w / 2 - me.w / 2 + 1e-6; x += 0.05) for (let z = -r.l / 2 + me.d / 2; z <= r.l / 2 - me.d / 2 + 1e-6; z += 0.05) {
    if (rects.some(([a, b, c, d]) => x - me.w / 2 < b - 0.01 && x + me.w / 2 > a + 0.01 && z - me.d / 2 < d - 0.01 && z + me.d / 2 > c + 0.01)) continue;
    const dd = x * x + z * z; if (!best || dd < best.d) best = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, d: dd };
  }
  return best || clampItem(r, it);
}
function renderProps() {
  const el = $('props');
  const found = studio && selId && findItem(selId), it = found && found.it;
  if (!it) { el.hidden = true; return; }
  const edit = studio.mode === 'edit', p = it.p, canSize = edit && p.editable;
  el.hidden = false;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><h3 id="pr-name"></h3><button type="button" class="btn small" data-pr="close" aria-label="Close">×</button></div>
    ${p.photo ? `<img alt="" src="${assetSrc(p.photo)}" style="border-radius:10px;aspect-ratio:4/3;object-fit:cover;width:100%;background:var(--surface-2)" onerror="this.remove()">` : ''}
    ${p.ref.startsWith('shop:') && (allProducts().find(x => x.ref === p.ref) || {}).curated ? '<p class="note">Copied from the shop’s website by Nido. Check the link for today’s price.</p>' : ''}
    <dl class="kv"><dt>Shop</dt><dd id="pr-shop"></dd><dt>Size</dt><dd class="num">${cm(p.w)} × ${cm(p.d)} × ${cm(p.h)} cm</dd>${p.price !== null ? `<dt>Price</dt><dd class="price">${euro(p.price)}</dd>` : ''}</dl>
    ${p.url ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener">See it in the shop ↗</a>` : ''}
    ${canSize ? `<div class="fields">${numField('Width', 'pw', cm(p.w), 'data-k="w" min="5" max="800"')}${numField('Depth', 'pw', cm(p.d), 'data-k="d" min="5" max="800"')}${numField('Height', 'pw', cm(p.h), 'data-k="h" min="1" max="400"')}</div>
      <div class="swatches">${PRESETS.map(([n, c]) => `<button type="button" class="dot" data-pr="color" data-v="${c}" title="${n}" aria-label="${n}" aria-pressed="${p.color === c}" style="background:${c}"></button>`).join('')}<label class="in" style="width:44px"><input type="color" data-pr="colorpick" value="${p.color}" aria-label="Any colour" style="height:26px;padding:2px;border:0"></label></div>` : ''}
    ${edit ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn small" data-pr="rot">Rotate 90°</button><button type="button" class="btn small" data-pr="dup">Duplicate</button><button type="button" class="btn small danger" data-pr="del">Remove</button></div>` : ''}`;
  $('pr-name').textContent = p.name; $('pr-shop').textContent = p.shop || '—';
}
async function propsEvent(e) {
  const t = e.target.closest('[data-pr], [data-act="pw"]'); if (!t || !studio) return;
  const found = findItem(selId); if (!found) return;
  const it = found.it, room = found.r; ctx(room);
  const k = t.dataset.pr;
  if (e.type === 'click') {
    if (k === 'close') { selectItem(null); return; }
    if (k === 'rot') { it.rot = (it.rot + 1) % 4; const c = clampItem(room, it); it.x = c.x; it.z = c.z; placeItem(it); showSelection(); changed(false); return; }
    if (k === 'dup') { const c2 = JSON.parse(JSON.stringify(it)); c2.id = newId('i'); c2.x += 0.3; c2.z += 0.3; const c = clampItem(room, c2); c2.x = c.x; c2.z = c.z; room.items.push(c2); syncItems(); selectItem(c2.id); changed(false); return; }
    if (k === 'del') { room.items = room.items.filter(i => i !== it); syncItems(); selectItem(null); changed(false); if (studio.tab !== 'walls') renderPane(); return; }
    if (k === 'color') { it.p.color = t.dataset.v; buildItem(it); syncLamps(); changed(false); renderProps(); return; }
  }
  if (k === 'colorpick' && e.type === 'input') { it.p.color = t.value; buildItem(it); syncLamps(); changed(false); return; }
  if (t.dataset.act === 'pw' && e.type === 'change') {
    const v = +t.value / 100; if (!(v >= 0.01 && v <= 8)) { renderProps(); return; }
    it.p[t.dataset.k] = v; const c = clampItem(room, it); it.x = c.x; it.z = c.z;
    buildItem(it); syncLamps(); showSelection(); changed(false); renderProps();
  }
}
for (const ev of ['click', 'change', 'input']) $('props').addEventListener(ev, propsEvent);
document.addEventListener('keydown', (e) => {
  if (!studio || studio.mode !== 'edit' || !selId || e.target.closest('input, textarea, select')) return;
  if (e.key === 'r' || e.key === 'R') { $('props').querySelector('[data-pr="rot"]')?.click(); }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('props').querySelector('[data-pr="del"]')?.click(); }
});

/* ---------- Boot ---------- */
route();
connect().then(() => {
  if (S.offline) {           // the same app, kept on this computer
    $('explore-intro').textContent = 'Homes you’ve published on this computer. Open one to walk around it, see what’s in it and what it costs, or copy it as a start for a new one.';
    $('rooms-intro').textContent = 'A single room or a whole flat, kept in this browser. Download a home to keep a copy or send it to someone; open their files with “Open a file”.';
    $('shop-intro').textContent = 'Add products with their real sizes, price and link, then place them in your homes. Wallpaper and paint work out how many rolls or tins you need.';
  }
  render();
});
