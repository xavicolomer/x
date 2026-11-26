/* =====================================================================
   Nido screens: Explore, My rooms, Catalogue, For shops, and the 3D studio.
   ===================================================================== */
let toastTimer = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }
/* opts.full: a picker, full screen on phones (its search and filters stay at the top while the choices scroll). */
function openDialog(html, onClick, onSubmit, opts) {
  const back = $('dlg'), box = $('dlg-box');
  box.innerHTML = html; back.hidden = false; back.classList.toggle('full', !!(opts && opts.full));
  box.onclick = (e) => { const t = e.target.closest('[data-close]'); if (t) { closeDialog(); return; } onClick && onClick(e); };
  box.onsubmit = (e) => { e.preventDefault(); onSubmit && onSubmit(e); };
  box.onchange = box.oninput = null; box.style.width = '';
  const first = box.querySelector('input, select, button'); first && first.focus();
  return box;
}
function closeDialog() { $('dlg').hidden = true; $('dlg').classList.remove('full'); $('dlg-box').innerHTML = ''; }
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
  return out + (wrap ? `<text x="100" y="${oy + l + 11 > 122 ? 122 : oy + l + 11}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Geist Mono, monospace">${cm(r.w)} × ${cm(r.l)}</text></svg>` : '');
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
/* The profile menu: your name opens it; a click anywhere else or Escape closes it. */
function whoMenu(open) {
  const m = $('who-menu'), b = $('who-btn'); if (!m || !b) return;
  m.hidden = !open; b.setAttribute('aria-expanded', open);
  if (open) m.querySelector('[role="menuitem"]').focus();
}
document.addEventListener('pointerdown', (e) => { if ($('who-menu') && !$('who-menu').hidden && !e.target.closest('#who')) whoMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('who-menu') && !$('who-menu').hidden) { whoMenu(false); $('who-btn').focus(); } });
function renderWho() {
  const el = $('who');
  if (S.cloud) {
    if (!S.uid) { el.innerHTML = '<span>Your homes stay in this browser until you sign in</span><button type="button" class="btn small primary" id="sign-in">Sign in</button>'; return; }
    el.innerHTML = `<button type="button" class="who-btn" id="who-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="who-menu"><img alt="" src="${esc(S.me.avatarUrl)}"><span></span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="menu" id="who-menu" role="menu" aria-labelledby="who-btn" hidden><div class="menu-h"><b></b><small>Signed in</small></div><button type="button" role="menuitem" id="sign-out">Sign out</button></div>`;
    el.querySelector('#who-btn span').textContent = S.me.name || 'You';
    el.querySelector('.menu-h b').textContent = S.me.name || 'You';
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
      <div class="meta"><span class="owner" data-owner="${esc(r.owner)}"><img alt="" hidden><span></span></span><span class="num">${homeText(r)}</span></div>
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
    const img = e.querySelector('img');       // hidden until there's a picture: Cognito accounts have none
    img.hidden = !p.avatarUrl; if (p.avatarUrl) img.src = p.avatarUrl;
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
      <div class="row"><button type="button" class="btn small primary" data-edit="${esc(id)}">Open</button><button type="button" class="btn small" data-dup="${esc(id)}">Duplicate</button><button type="button" class="btn small danger" data-del="${esc(id)}">${armedDelete === id ? 'Click again to delete' : 'Delete'}</button></div>
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
/* A link to buy something, with its vendor's affiliate tracking (catalog.js, buyLink); marked sponsored when it has some. */
function shopLink(url, ref, label = 'Shop ↗', attrs = '', lead = '') {
  if (!url) return '';
  const { href, sponsored } = buyLink(url, ref);
  return `${lead}<a${attrs} href="${esc(href)}" target="_blank" rel="${sponsored ? 'sponsored noopener' : 'noopener'}">${label}</a>`;
}
/* The disclosure for a set of products, when any of their links earn Nido a commission: each vendor's own wording, or Nido's. */
function disclosureFor(items) {
  const out = new Set();
  for (const { url, ref } of items) { const b = url && buyLink(url, ref); if (b && b.sponsored) out.add(b.vendor.affiliate.disclosure || 'Some shop links earn Nido a commission, at no extra cost to you.'); }
  return [...out].join(' ');
}
/* Under a single shop link (a piece's panel, a wall's paint, paper or moulding): its disclosure, when it earns a commission. */
function linkDisclosure(url, ref) {
  const d = disclosureFor([{ url, ref }]);
  return d ? `<p class="note">${esc(d)}</p>` : '';
}
/* Under a grid of product cards (the Catalogue, Add furniture): the disclosure, across the whole row. */
function gridDisclosure(g, list) {
  const d = disclosureFor(list);
  if (d) g.insertAdjacentHTML('beforeend', `<p class="note" style="grid-column:1/-1">${esc(d)}</p>`);
}
/* Products the 3D can draw get pictures made by it (engine.js, productPreview): a three-quarter view, then side, top and
   front while the pointer is on the picture, or a tap at a time on a phone. A shop's photo, when there is one, comes first. */
const canPreview = (p) => !!(KINDS[p.kind] || (p.kind === 'moulding' && p.moulding));
const VIEW_NAMES = { photo: 'Photo', '3q': '3D', side: 'Side', top: 'Top', front: 'Front' };
let pvObserver = null;
function wirePreviews(box, list) {
  if (!pvObserver && 'IntersectionObserver' in window) pvObserver = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { pvObserver.unobserve(e.target); e.target.pvShow(0); } }, { rootMargin: '300px' });
  box.querySelectorAll('.pic[data-pv]').forEach(pic => {
    const p = list[+pic.dataset.pv]; if (!p) return;
    const views = p.photo ? ['photo', '3q', 'side', 'top'] : ['3q', 'side', 'top', 'front'], img = pic.querySelector('img.pv'), tag = pic.querySelector('.pv-tag');
    let at = 0, timer = 0;
    pic.pvShow = (i) => {
      at = i; const v = views[i];
      tag.hidden = i === 0; tag.textContent = VIEW_NAMES[v];
      if (v === 'photo') { img.hidden = true; return; }
      productPreview(p, v).then(url => { if (views[at] !== v) return; img.src = url; img.hidden = false; const plan = pic.querySelector('.plan'); if (plan) plan.hidden = true; }).catch(() => {});
      if (i > 0 && views[i + 1]) productPreview(p, views[i + 1]).catch(() => {});   // while pointed at: the next view, ready before it's needed
    };
    pic.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; clearInterval(timer); pic.pvShow(1); timer = setInterval(() => pic.pvShow(at + 1 < views.length ? at + 1 : 1), 1100); });
    pic.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; clearInterval(timer); pic.pvShow(0); });
    pic.addEventListener('click', (e) => { if (e.pointerType === 'mouse') return; pic.pvShow((at + 1) % views.length); });
    if (!p.photo) { if (pvObserver) pvObserver.observe(pic); else pic.pvShow(0); }
  });
}
/* A product's picture, size line and price, as catalogue cards and the material picker show them. */
function productPic(p) {
  return p.kind === 'paint' && p.paint && p.paint.mix ? `<span style="position:absolute;inset:0;background:linear-gradient(90deg,#ece6d8 0 20%,#c9d6cf 20% 40%,#e3b9a8 40% 60%,#b4c3d3 60% 80%,#efe0b0 80%)"></span><span class="pill" style="position:absolute;left:10px;bottom:10px">Any colour, mixed in the shop</span>`
    : p.kind === 'paint' ? `<span style="position:absolute;inset:0;background:${p.color}"></span><span class="pill" style="position:absolute;left:10px;bottom:10px">${esc((p.paint && p.paint.code) || p.color)}</span>`
    : p.kind === 'wallpaper' && p.wallpaper && p.wallpaper.tile ? `<span style="position:absolute;inset:0;background:url(${assetSrc(p.wallpaper.tile)}) 0 0 / ${p.wallpaper.mural ? 'cover' : '33%'} repeat"></span>`
    : p.kind === 'flooring' ? `<span style="position:absolute;inset:0;background:${p.flooring && p.flooring.pic ? `url(${p.flooring.pic}) center / cover` : p.flooring && p.flooring.tile ? `url(${assetSrc(p.flooring.tile)}) 0 0 / 50% repeat` : p.color}"></span>`
    : p.photo ? `<img alt="" loading="lazy" src="${assetSrc(p.photo)}" onerror="this.remove()">`
    : p.kind === 'moulding' && p.moulding ? `<span class="plan">${profileSvg(p.moulding, p.color)}</span>`
    : `<span class="plan"><svg viewBox="0 0 120 75" width="70%" height="70%" aria-hidden="true"><rect x="${60 - p.w / Math.max(p.w, p.d) * 40}" y="${38 - p.d / Math.max(p.w, p.d) * 28}" width="${p.w / Math.max(p.w, p.d) * 80}" height="${p.d / Math.max(p.w, p.d) * 56}" rx="4" fill="${p.color}" stroke="var(--line)"/></svg></span>`;
}
function productDims(p) {
  if (p.nido) return `${FLOOR_SURFACES[p.flooring.surface]} · drawn by Nido`;
  if (p.mine) return p.mine.mural ? 'Your image, as a mural' : `Your image · repeat ${p.mine.width} cm`;
  return p.kind === 'paint' ? (p.paint ? `${p.paint.tinL.toLocaleString()} L tin · ${p.paint.coverage} m²/L${p.paint.finish ? ' · ' + esc(p.paint.finish) : ''}` : '') : p.kind === 'wallpaper' ? (p.wallpaper ? (p.wallpaper.mural ? 'Mural, made to measure' : `Repeat ${p.wallpaper.width} cm · roll ${p.wallpaper.rollW} cm × ${(p.wallpaper.rollL / 100).toLocaleString()} m`) : '')
    : p.kind === 'moulding' ? (p.moulding ? mouldText(p.moulding) : '')
    : p.kind === 'flooring' ? (p.flooring ? `${FLOOR_SURFACES[p.flooring.surface]} · ${p.flooring.pack ? `${p.flooring.pack.toLocaleString()} m² a pack` : 'by the m²'}` : '') : `${cm(p.w)} × ${cm(p.d)} × ${cm(p.h)} cm`;
}
function productPrice(p) {
  return p.price !== null ? `<span class="price">${euro(p.price)}${p.kind === 'wallpaper' ? (p.wallpaper && p.wallpaper.unit === 'm2' ? ' /m²' : ' /roll') : p.kind === 'paint' ? ' /tin' : p.kind === 'moulding' ? ' /strip' : p.kind === 'flooring' ? (p.flooring && p.flooring.unit === 'pack' ? ' /pack' : ' /m²') : ''}</span>` : p.priceOnSite ? '<span class="note">Price on the shop’s site</span>' : '';
}
function productCard(p, actions, i) {
  const pv = canPreview(p) && i !== undefined;
  return `<article class="card"><div class="pic" ${pv ? `data-pv="${i}" title="Point at it to see it from other sides"` : 'style="cursor:default"'}>${productPic(p)}${pv ? '<img class="pv" alt="" hidden><span class="pill pv-tag" hidden></span>' : ''}</div><div class="body">
    <div class="t" data-name></div><div class="meta"><span data-shop></span>${p.curated ? '<span class="pill" title="Copied from the shop’s website by Nido, not listed by the shop itself">Added by Nido</span>' : ''}${p.model ? '<span class="pill live">3D model</span>' : ''}</div>
    <div class="meta"><span class="num">${productDims(p)}</span>${productPrice(p)}</div>
    <div class="row">${actions}${shopLink(p.url, p.ref, "Shop ↗", " class=\"btn small\"", "")}</div></div></article>`;
}
/* A moulding's size the way shops label it: face × thickness in mm, and the strip's length. */
const mm = (m) => Math.round(m * 1000);
const mouldText = (m) => `${MOULD_SHAPES[m.shape]} · ${mm(m.face)} × ${mm(m.depth)} mm · ${m.len.toLocaleString()} m strip`;
/* Its cross-section, to scale, for catalogue cards: a half round is drawn as one, a corner as an L. */
function profileSvg(m, color) {
  const k = 60 / Math.max(m.face, m.depth * 2), w = m.face * k, d = m.depth * k, x = 60 - w / 2, y = 38 + d / 2;
  const shape = m.shape === 'half' ? `<path d="M${x} ${y} A${w / 2} ${d} 0 0 1 ${x + w} ${y} Z"/>`
    : m.shape === 'corner' ? `<path d="M${x} ${y} h${w} v${-Math.max(3, d * 0.35)} h${-(w - Math.max(3, d * 0.35))} v${-(d * 2 - Math.max(3, d * 0.35))} h${-Math.max(3, d * 0.35)} Z"/>`
    : m.shape === 'profiled' ? `<path d="M${x} ${y} h${w} v${-d * 0.45} q${-w * 0.2} 0 ${-w * 0.3} ${-d * 0.55} h${-w * 0.7} Z"/>`
    : `<rect x="${x}" y="${y - d}" width="${w}" height="${d}"/>`;
  return `<svg viewBox="0 0 120 75" width="70%" height="70%" aria-hidden="true"><g fill="${color}" stroke="var(--line)">${shape}</g><line x1="${x - 6}" y1="${y + 0.5}" x2="${x + w + 6}" y2="${y + 0.5}" stroke="var(--muted)" stroke-dasharray="2 2"/></svg>`;
}
function catalogueList() {
  const q = catQ.trim().toLowerCase();
  return allProducts().filter(p => (catKind === 'all' || p.kind === catKind) && (!q || (p.name + ' ' + p.shop).toLowerCase().includes(q)));
}
function renderCatalogue() {
  const kinds = [['all', 'Everything'], ...Object.entries(KINDS).filter(([k]) => k !== 'box'), ['flooring', 'Flooring'], ['wallpaper', 'Wallpaper'], ['paint', 'Paint'], ['moulding', 'Mouldings']];
  $('cat-kinds').innerHTML = kinds.map(([k, n]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === catKind}">${esc(n)}</button>`).join('');
  const list = catalogueList(), g = $('catalogue');
  if (!list.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Nothing here yet</b><span>${MATERIALS[catKind] ? `No shop has listed ${MATERIALS[catKind].toLowerCase()} yet.` : 'No products match.'} Shops can list theirs under For shops.</span></div>`; return; }
  g.innerHTML = list.map((p, i) => productCard(p, MATERIALS[p.kind] ? '' : `<button type="button" class="btn small primary" data-place="${esc(p.ref)}">Place in a room</button>`, i)).join('');
  [...g.querySelectorAll('.card')].forEach((c, i) => { c.querySelector('[data-name]').textContent = list[i].name; c.querySelector('[data-shop]').textContent = list[i].shop; });
  wirePreviews(g, list);
  gridDisclosure(g, list);
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

/* ---------- For shops: a vendor, its products and its offers (catalog.js, docs/CATALOG.md) ---------- */
let pendingLogo = null, shopSeen = '', vendorId = null;      // vendorId: the vendor being edited; null is your own shop
const curVendor = () => (vendorId ? S.shops.get(vendorId) || null : myShop());
const vendorDraft = () => JSON.parse(JSON.stringify(curVendor() || { id: vendorId || S.uid, name: '', url: null, about: '', logo: null, curated: false, locations: [], products: [], offers: [] }));
const money = (v, cur) => v.toLocaleString(undefined, { style: 'currency', currency: CURRENCIES[cur] ? cur : 'EUR' });
const offerOf = (v, p) => v.offers.find(o => o.productId === p.id) || null;
/* A product's specs in a line: "33 mm · 5 mm · 2.4 m · Flat strip", a choice by its name. */
const specLine = (p) => p.specs.filter(s => s.value !== '').slice(0, 4).map(s => {
  const pre = TYPES[p.type].specs.find(x => x.key === s.key), name = pre && pre.options && pre.options[s.value];
  return name || `${typeof s.value === 'number' ? s.value.toLocaleString() : s.value}${s.unit ? ' ' + unitLabel(s.unit) : ''}`;
}).join(' · ');
const SPEC_GRID = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,.8fr) 32px;gap:6px;align-items:center';
function renderShop() {
  const can = !S.local && S.db, v = curVendor(), own = !vendorId || vendorId === S.uid;
  $('vendor-pick-wrap').hidden = !S.isAdmin;
  if (S.isAdmin) {                       // admins keep vendors that aren't on Nido themselves
    const others = [...S.shops.values()].filter(x => x.id !== S.uid), pick = $('vendor-pick');
    pick.innerHTML = '<option value="">Your shop</option>' + others.map(x => `<option value="${esc(x.id)}"></option>`).join('') + (vendorId && !v ? `<option value="${esc(vendorId)}"></option>` : '') + '<option value="+">New vendor…</option>';
    [...pick.options].forEach(o => { const x = S.shops.get(o.value); if (x && o.value) o.textContent = x.name + (x.curated ? ' · added by Nido' : ''); else if (o.value === vendorId && !x) o.textContent = 'New vendor (not saved yet)'; });
    pick.value = own ? '' : vendorId;
  }
  $('shop-title').textContent = own ? 'Your shop' : 'Vendor';
  for (const el of $('shop-form').elements) el.disabled = !can;
  $('add-product').disabled = !can;
  const sig = v ? `${v.id}:${v.updatedAt}` : `new:${vendorId}`;
  if (sig !== shopSeen) {                // fill the form from the saved vendor, once per save or switch
    shopSeen = sig;
    $('shop-name').value = v ? v.name : ''; $('shop-url').value = (v && v.url) || ''; $('shop-about').value = v ? v.about : '';
    renderLocations(v ? v.locations : []);
    const a = (v && v.affiliate) || {};
    $('aff-mode').value = a.mode || ''; $('aff-template').value = a.template || ''; $('aff-param').value = a.param || ''; $('aff-value').value = a.value || '';
    $('aff-disclosure').value = a.disclosure || ''; $('aff-onsite').checked = !!(v && v.priceOnSite);
  }
  $('aff-box').hidden = !S.isAdmin; syncAffiliate();
  const logo = pendingLogo || (v && v.logo);
  $('shop-logo-prev').style.backgroundImage = logo ? `url(${assetSrc(logo)})` : '';
  $('shop-status').textContent = can ? (v ? `Live in the catalogue · ${v.products.length} product${v.products.length === 1 ? '' : 's'}` : own ? 'Save your shop, then add products.' : 'Save this vendor, then add its products.') : (accessNote() || 'Listing products needs Contributor access.');
  const list = v ? v.products : [], box = $('shop-products');
  if (!list.length) { box.innerHTML = `<div class="empty"><b>No products yet</b><span>Add a product with its specs, a photo, its price and the link where people buy it.</span></div>`; return; }
  box.innerHTML = `<div style="overflow-x:auto"><table class="ptable"><thead><tr><th></th><th>Product</th><th>Specs</th><th>Price</th><th></th></tr></thead><tbody>${list.map(p => {
    const o = offerOf(v, p), pr = priceOf(p, o, p.unit);
    return `<tr><td><div class="thumb" style="background-image:${p.image && p.type !== 'paint' ? `url(${assetSrc(p.image)})` : 'none'};background-color:${p.color}"></div></td>
    <td><b data-pn></b><div class="note">${esc(TYPES[p.type].label)}${p.material ? ' · ' + esc(p.material) : ''}${p.model ? ' · 3D model' : ''}</div></td>
    <td class="num">${esc(specLine(p))}</td>
    <td class="price">${pr !== null ? `${money(pr, (o && o.currency) || p.currency)} /${esc(unitLabel(p.unit))}` : '—'}</td>
    <td style="white-space:nowrap"><button type="button" class="btn small" data-pedit="${esc(p.id)}">Edit</button> <button type="button" class="btn small danger" data-pdel="${esc(p.id)}">${armedDelete === p.id ? 'Click again' : 'Remove'}</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
  [...box.querySelectorAll('[data-pn]')].forEach((b, i) => { b.textContent = list[i].name; });
}
/* Only the fields of the tracking chosen: a deep-link template, or a parameter and its value. */
function syncAffiliate() { const m = $('aff-mode').value; $('aff-template-row').hidden = m !== 'wrap'; $('aff-param-row').hidden = m !== 'param'; }
$('aff-mode').addEventListener('change', syncAffiliate);
/* Where people can see the products in person: a name, an address and a link to it on a map. */
function renderLocations(locs) {
  $('shop-locs').innerHTML = locs.map(() => `<div class="locrow"><div class="fields">
    <label class="field"><span>Name</span><span class="in"><input data-loc="name" maxlength="60" placeholder="Gràcia shop"></span></label>
    <label class="field"><span>Address</span><span class="in"><input data-loc="address" maxlength="160"></span></label>
    <label class="field"><span>Map link</span><span class="in"><input data-loc="map" type="url" maxlength="300" placeholder="https://"></span></label></div>
    <button type="button" class="btn small" data-loc-del>Remove</button></div>`).join('');
  [...$('shop-locs').querySelectorAll('.locrow')].forEach((row, i) => { for (const k of ['name', 'address', 'map']) row.querySelector(`[data-loc="${k}"]`).value = locs[i][k] || ''; });
}
const rawLocations = () => [...$('shop-locs').querySelectorAll('.locrow')].map(row => ({ name: row.querySelector('[data-loc="name"]').value.trim(), address: row.querySelector('[data-loc="address"]').value.trim(), map: row.querySelector('[data-loc="map"]').value.trim() }));
const readLocations = () => rawLocations().map(cleanLocation).filter(Boolean);
$('vendor-pick').addEventListener('change', (e) => {
  if (e.target.value !== '+') { vendorId = e.target.value || null; pendingLogo = null; renderShop(); return; }
  openDialog(`<form style="display:flex;flex-direction:column;gap:12px"><div class="dlg-h"><h2 id="dlg-title">New vendor</h2><button type="button" class="btn small" data-close>Close</button></div>
    <label class="field" for="nv-name"><span>Vendor name</span><span class="in"><input id="nv-name" maxlength="60" required placeholder="Bruguer"></span></label>
    <p class="note">A shop, a brand or a marketplace that isn't on Nido itself. It shows in the catalogue as added by Nido.</p>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Continue</button></div></form>`, null, () => {
    const name = $('nv-name').value.trim(); if (!name) return;
    let id = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'vendor', n = 2;
    while (S.shops.has(id)) id = id.replace(/-\d+$/, '') + '-' + n++;
    vendorId = id; closeDialog(); renderShop(); $('shop-name').value = name; $('shop-url').focus();
  });
  renderShop();                          // the select goes back to the vendor still being edited until the new one exists
});
$('shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = vendorDraft();
  v.id = vendorId || S.uid; v.curated = v.id !== S.uid;
  v.name = $('shop-name').value.trim().slice(0, 60); v.url = safeUrl($('shop-url').value.trim()); v.about = $('shop-about').value.trim().slice(0, 400);
  v.logo = pendingLogo || v.logo || null; v.locations = readLocations();
  if ($('shop-url').value.trim() && !v.url) { $('shop-status').textContent = 'The website needs to start with https://'; return; }
  const bad = [...$('shop-locs').querySelectorAll('[data-loc="map"]')].find(i => i.value.trim() && !safeUrl(i.value.trim()));
  if (bad) { $('shop-status').textContent = 'Map links need to start with https://'; bad.focus(); return; }
  if (S.isAdmin) {                       // affiliate tracking is Nido's own, so only admins set it
    const mode = $('aff-mode').value;
    v.affiliate = mode ? cleanAffiliate({ mode, template: $('aff-template').value.trim(), param: $('aff-param').value.trim(), value: $('aff-value').value.trim(), disclosure: $('aff-disclosure').value.trim() }) : null;
    if (mode && !v.affiliate) { $('shop-status').textContent = mode === 'wrap' ? 'The deep link needs to start with https:// and contain {url}.' : 'The parameter and value can only use letters, numbers, dots and dashes.'; return; }
    v.priceOnSite = $('aff-onsite').checked;
  }
  try { await saveVendor(v); pendingLogo = null; $('shop-status').textContent = v.curated ? 'Saved. This vendor is in the catalogue.' : 'Saved. Your shop is in the catalogue.'; }
  catch (er) { $('shop-status').textContent = 'Couldn’t save. Check your access and try again.'; }
});
async function uploadFile(file, type) {
  if (!S.assets) throw { code: 'not_granted' };
  return S.assets.upload(file, type ? { type } : undefined);
}
const uploadError = (e) => e && e.code === 'too_large' ? 'That file is too big (20 MB at most).' : e && e.code === 'unsupported_type' ? 'That file type isn’t supported.'
  : e && e.code === 'not_granted' ? 'Uploading isn’t available for your account here.' : 'The upload didn’t work. Try again in a moment.';
$('shop-logo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const up = await uploadFile(f); pendingLogo = up.id; $('shop-logo-prev').style.backgroundImage = `url(${up.url})`; $('shop-status').textContent = 'Logo uploaded. Save to keep it.'; }
  catch (er) { $('shop-status').textContent = uploadError(er); }
});
function imageAspect(file) {
  return new Promise((res) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i.naturalHeight / i.naturalWidth); URL.revokeObjectURL(u); }; i.onerror = () => res(1); i.src = u; });
}

/* The product editor. A product is its type, what it's sold by and its price, words and pictures, and spec rows:
   the type's own rows first (TYPES[type].specs), then any the vendor adds. The listing is this vendor's link, price and reference. */
function productDialog(pid) {
  const v0 = curVendor();
  if (!v0) { $('shop-status').textContent = 'Save the vendor first, then add products.'; $('shop-name').focus(); return; }
  const cur = pid ? v0.products.find(p => p.id === pid) : null, curOffer = cur ? offerOf(v0, cur) : null;
  const p = cur ? JSON.parse(JSON.stringify(cur)) : cleanCatalogProduct({ type: 'moulding' });
  const o = curOffer ? { ...curOffer } : cleanOffer({ productId: p.id });
  let rows = specRows(p.type, p.specs);
  const typeOpts = [['furniture', 'In rooms'], ['floor', 'On floors'], ['wall', 'On walls']].map(([g, n]) => `<optgroup label="${n}">${Object.entries(TYPES).filter(([, T]) => T.group === g).map(([k, T]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${esc(T.label)}</option>`).join('')}</optgroup>`).join('');
  const box = openDialog(`<form id="pf" style="display:flex;flex-direction:column;gap:12px">
    <div class="dlg-h"><h2 id="dlg-title">${cur ? 'Edit product' : 'Add a product'}</h2><button type="button" class="btn small" data-close>Close</button></div>
    <div class="fields two">
      <label class="field" for="pf-name"><span>Name</span><span class="in"><input id="pf-name" maxlength="80" required></span></label>
      <label class="field" for="pf-type"><span>What it is</span><span class="in"><select id="pf-type">${typeOpts}</select></span></label>
    </div>
    <div class="fields">
      <label class="field" for="pf-unit"><span>Sold by</span><span class="in"><select id="pf-unit"></select></span></label>
      <label class="field" for="pf-price"><span id="pf-price-lab">Price</span><span class="in"><input id="pf-price" type="number" inputmode="decimal" min="0" step="0.01"></span></label>
      <label class="field" for="pf-cur"><span>Currency</span><span class="in"><select id="pf-cur">${Object.keys(CURRENCIES).map(c => `<option value="${c}" ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></span></label>
    </div>
    <div class="fields two">
      <label class="field" for="pf-mat"><span>Material</span><span class="in"><input id="pf-mat" maxlength="60" placeholder="Pine, beech, MDF…"></span></label>
      <label class="field" for="pf-color"><span id="pf-color-lab">Colour</span><span class="in"><input id="pf-color" type="color" value="${p.color}" style="height:33px;padding:3px"></span></label>
    </div>
    <label class="field" for="pf-about"><span>Description</span><span class="in"><textarea id="pf-about" maxlength="600"></textarea></span></label>
    <div class="sec-h">Technical specs</div>
    <div id="pf-specs" style="display:flex;flex-direction:column;gap:8px"></div>
    <div><button type="button" class="btn small" data-spec-add>Add a spec</button></div>
    <p class="note">A price on a spec is for one of what the product is sold by. The product's price comes before it, and your listing's price before both.</p>
    <div class="uploader"><div class="thumb" id="pf-photo-prev"></div><label class="btn small" for="pf-photo" id="pf-photo-lab">Upload a photo</label><input type="file" id="pf-photo" class="vh" accept="image/*"><span class="note" id="pf-photo-note"></span></div>
    <div class="uploader" id="pf-model-row"><div class="thumb" style="display:grid;place-items:center;font-size:11px;font-weight:800">3D</div><label class="btn small" for="pf-model">Upload a 3D model</label><input type="file" id="pf-model" class="vh" accept=".glb,.gltf,model/gltf-binary,model/gltf+json"><span class="note" id="pf-model-note"></span></div>
    <div class="sec-h">Your listing</div>
    <div class="fields">
      <label class="field" for="pf-url"><span>Link to buy it</span><span class="in"><input id="pf-url" type="url" maxlength="300" placeholder="https://"></span></label>
      <label class="field" for="pf-oprice"><span>Your price</span><span class="in"><input id="pf-oprice" type="number" inputmode="decimal" min="0" step="0.01" placeholder="The product’s"></span></label>
      <label class="field" for="pf-sku"><span>Reference</span><span class="in"><input id="pf-sku" maxlength="40" placeholder="Ref. 10131"></span></label>
    </div>
    <p class="note" id="pf-status" aria-live="polite"></p>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">${cur ? 'Save product' : 'Add product'}</button></div></form>`,
  (e) => {
    if (e.target.closest('[data-spec-add]')) { rows = readSpecRows(rows); rows.push({ key: '', label: '', value: '', unit: '', price: null, own: true }); drawSpecs(); const l = $('pf-specs').querySelectorAll('[data-sl]'); l[l.length - 1].focus(); return; }
    const del = e.target.closest('[data-spec-del]');
    if (del) { rows = readSpecRows(rows); rows.splice(+del.dataset.specDel, 1); drawSpecs(); }
  },
  async () => {
    rows = readSpecRows(rows);
    const T = TYPES[$('pf-type').value];
    p.type = $('pf-type').value; p.name = $('pf-name').value.trim().slice(0, 80) || 'Product'; p.unit = $('pf-unit').value; p.currency = $('pf-cur').value;
    p.price = $('pf-price').value === '' ? null : Math.max(0, +$('pf-price').value);
    p.material = $('pf-mat').value.trim().slice(0, 60); p.color = $('pf-color').value; p.about = $('pf-about').value.trim().slice(0, 600);
    const missing = T.specs.find(s => s.need && !(rows.find(r => r.key === s.key && typeof r.value === 'number' && r.value > 0)));
    if (missing) { $('pf-status').textContent = `Fill in the ${missing.label.toLowerCase()}.`; return; }
    if (p.type === 'wallpaper' && !p.image) { $('pf-status').textContent = 'Upload the pattern first: one repeat, cut so it tiles.'; return; }
    if (p.type === 'flooring' && p.unit === 'pack' && !rows.find(r => r.key === 'pack' && typeof r.value === 'number' && r.value > 0)) { $('pf-status').textContent = 'Fill in how much one pack covers, or sell it by the m².'; return; }
    p.specs = rows.filter(r => r.value !== '' && r.key).map(({ key, label, value, unit, price }) => ({ key, label, value, unit, price, currency: p.currency }));
    if (T.group !== 'furniture') p.model = null;
    o.url = safeUrl($('pf-url').value.trim()); o.sku = $('pf-sku').value.trim().slice(0, 40);
    o.price = $('pf-oprice').value === '' ? null : Math.max(0, +$('pf-oprice').value);
    if ($('pf-url').value.trim() && !o.url) { $('pf-status').textContent = 'The link needs to start with https://'; return; }
    const next = vendorDraft(), clean = cleanCatalogProduct(p);
    next.id = vendorId || S.uid;
    next.products = [...next.products.filter(x => x.id !== clean.id), clean];
    next.offers = [...next.offers.filter(x => x.productId !== clean.id), cleanOffer({ ...o, productId: clean.id })];
    $('pf-status').textContent = 'Saving…';
    try { await saveVendor(next); closeDialog(); toast(`${clean.name} is in the catalogue.`); } catch (er) { $('pf-status').textContent = 'Couldn’t save. Check your access and try again.'; }
  });
  $('pf-name').value = cur ? p.name : ''; $('pf-mat').value = p.material; $('pf-about').value = p.about;
  $('pf-price').value = p.price ?? ''; $('pf-url').value = o.url || ''; $('pf-oprice').value = o.price ?? ''; $('pf-sku').value = o.sku;
  /* Spec rows on screen: the type's own (label fixed, unit among those that convert) and the vendor's (everything typed). */
  function drawSpecs() {
    const T = TYPES[$('pf-type').value];
    $('pf-specs').innerHTML = rows.map((r, i) => {
      const pre = T.specs.find(s => s.key === r.key && !r.own), dim = pre && UNITS[pre.unit] && UNITS[pre.unit].dim;
      const units = dim ? Object.keys(UNITS).filter(u => UNITS[u].dim === dim) : null;
      const value = pre && pre.options ? `<select data-sv>${Object.entries(pre.options).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>` : `<input data-sv maxlength="60" ${pre && pre.unit !== '' && !pre.options && pre.key !== 'code' && pre.key !== 'finish' ? 'inputmode="decimal"' : ''}>`;
      const unit = units ? `<select data-su>${units.map(u => `<option value="${u}">${esc(UNITS[u].label)}</option>`).join('')}</select>` : pre ? `<input data-su disabled>` : `<input data-su maxlength="12" placeholder="mm, kg, %">`;
      return `<div class="specrow" data-i="${i}" ${pre ? `data-key="${pre.key}"` : `data-own ${r.key ? `data-key="${esc(r.key)}"` : ''}`} style="${SPEC_GRID}">
        <span class="in">${pre ? `<input data-sl disabled aria-label="Spec">` : '<input data-sl maxlength="40" placeholder="Radius, finish…" aria-label="Spec">'}</span>
        <span class="in">${value.replace(/^<(\w+)/, '<$1 aria-label="Value"')}</span>
        <span class="in">${unit.replace(/^<(\w+)/, '<$1 aria-label="Unit"')}</span>
        <span class="in"><input data-sp type="number" inputmode="decimal" min="0" step="0.01" aria-label="Price" placeholder="—"></span>
        ${pre && pre.need ? '<span></span>' : `<button type="button" class="btn small" data-spec-del="${i}" aria-label="Remove this spec">×</button>`}</div>`;
    }).join('');
    $('pf-specs').insertAdjacentHTML('afterbegin', `<div class="note" style="${SPEC_GRID};font-weight:700"><span>Spec</span><span>Value</span><span>Unit</span><span>Price</span><span></span></div>`);
    [...$('pf-specs').querySelectorAll('.specrow')].forEach((el, i) => {
      const r = rows[i];
      el.querySelector('[data-sl]').value = r.label; el.querySelector('[data-sv]').value = r.value === null ? '' : String(r.value);
      const su = el.querySelector('[data-su]'); su.value = r.unit || ''; if (su.tagName === 'SELECT' && !su.value) su.selectedIndex = 0;
      el.querySelector('[data-sp]').value = r.price ?? '';
    });
  }
  const sync = () => {
    const T = TYPES[$('pf-type').value], wp = $('pf-type').value === 'wallpaper', pt = $('pf-type').value === 'paint', fl = $('pf-type').value === 'flooring', u = $('pf-unit');
    const keep = T.sold.includes(u.value) ? u.value : T.sold.includes(p.unit) ? p.unit : T.sold[0];
    u.innerHTML = T.sold.map(x => `<option value="${x}">${esc(unitLabel(x))}</option>`).join(''); u.value = keep;
    $('pf-price-lab').textContent = `Price per ${unitLabel(u.value)}`;
    $('pf-model-row').hidden = T.group !== 'furniture';
    $('pf-color-lab').textContent = pt ? 'Colour, as close as a screen can show it' : T.group === 'furniture' ? 'Main colour (when there’s no 3D model)' : fl ? 'Colour (when there’s no picture)' : 'Colour';
    $('pf-photo-lab').textContent = wp ? 'Upload the pattern' : fl ? 'Upload the floor' : 'Upload a photo';
    $('pf-photo-note').textContent = wp ? 'One repeat of the pattern, cut so it tiles seamlessly (a mural: the whole picture).'
      : fl ? 'A photo straight down at the floor, cut so it tiles seamlessly. Give the width of floor it shows in the specs.' : 'A photo for the catalogue.';
    $('pf-photo-prev').style.backgroundImage = p.image ? `url(${assetSrc(p.image)})` : '';
    $('pf-model-note').textContent = p.model ? '3D model uploaded. Upload another to replace it.' : 'Optional: a .glb file, scaled to the width, depth and height.';
  };
  drawSpecs(); sync();
  box.onchange = async (e) => {
    const t = e.target;
    if (t.id === 'pf-type') { rows = specRows(t.value, readSpecRows(rows)); drawSpecs(); sync(); }
    if (t.id === 'pf-unit') sync();
    if (t.id === 'pf-photo' && t.files[0]) {
      const f = t.files[0]; t.value = '';
      $('pf-status').textContent = 'Uploading…';
      try { const up = await uploadFile(f); p.image = up.id; p.imageAspect = await imageAspect(f); $('pf-status').textContent = 'Uploaded.'; sync(); }
      catch (er) { $('pf-status').textContent = uploadError(er); }
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
/* The rows a type starts with, filled from the specs a product has; specs of another type stay as the vendor's own rows. */
function specRows(type, specs) {
  const T = TYPES[type], have = (k) => specs.find(s => s.key === k);
  const pre = T.specs.map(s => { const h = have(s.key); return { key: s.key, label: s.label, value: h ? h.value : s.options ? Object.keys(s.options)[0] : '', unit: h && h.unit ? h.unit : s.unit, price: h ? h.price : null, own: false }; });
  const own = specs.filter(s => !T.specs.some(x => x.key === s.key) && s.value !== '').map(s => ({ ...s, own: true }));
  return [...pre, ...own];
}
/* What's typed in the spec rows now. A vendor's row gets its key from its label; numbers are kept as numbers. */
function readSpecRows(prev) {
  return [...$('pf-specs').querySelectorAll('.specrow')].map((el) => {
    const i = +el.dataset.i;
    const r = prev[i] || {}, label = el.querySelector('[data-sl]').value.trim().slice(0, 40), raw = el.querySelector('[data-sv]').value.trim().replace(',', '.');
    const key = el.dataset.key || label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/^(\d)/, 's$1').slice(0, 30);
    const value = raw === '' ? '' : /^-?\d+(\.\d+)?$/.test(raw) ? +raw : raw.slice(0, 60), pr = el.querySelector('[data-sp]').value;
    return { key, label: label || r.label || '', value, unit: el.querySelector('[data-su]').value.trim().slice(0, 12), price: pr === '' ? null : Math.max(0, +pr), own: el.hasAttribute('data-own') };
  });
}

/* ---------- Global clicks ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a'); if (!t || t.closest('#studio') || t.closest('#dlg')) return;
  if (t.hasAttribute('data-new-room')) { newRoomDialog(); return; }
  if (t.id === 'sign-in') { S.cloud.signIn(); return; }
  if (t.id === 'who-btn') { whoMenu($('who-menu').hidden); return; }
  if (t.id === 'sign-out') { whoMenu(false); S.cloud.signOut(); return; }
  if (t.dataset.edit) { openEditor(t.dataset.edit); return; }
  if (t.dataset.openPub) { const [o, id] = t.dataset.openPub.split('|'); openViewer(o, id); return; }
  if (t.dataset.dup) {                   // a private copy of one of your homes; pictures are shared, they never change
    const src = S.drafts.get(t.dataset.dup); if (!src) return;
    const copy = cleanHome(JSON.parse(JSON.stringify(src)));
    copy.name = copyName(src.name, [...S.drafts.values()].map(h => h.name)); copy.published = false; copy.cover = null;
    if (copy.rooms.length === 1) copy.rooms[0].name = copy.name;
    await saveDraft(newId('r'), copy); renderMyRooms(); toast(`Made ${copy.name}. The original is unchanged.`); return;
  }
  if (t.dataset.del) {
    if (armedDelete !== t.dataset.del) { armedDelete = t.dataset.del; renderMyRooms(); setTimeout(() => { if (armedDelete === t.dataset.del) { armedDelete = null; renderMyRooms(); } }, 4000); return; }
    armedDelete = null; await deleteDraft(t.dataset.del); toast('Room deleted.'); renderMyRooms(); return;
  }
  if (t.dataset.kind) { catKind = t.dataset.kind; renderCatalogue(); return; }
  if (t.dataset.place) { placeInRoomDialog(t.dataset.place); return; }
  if (t.id === 'add-product') { productDialog(null); return; }
  if (t.dataset.pedit) { productDialog(t.dataset.pedit); return; }
  if (t.id === 'loc-add') { renderLocations([...rawLocations(), { name: '', address: '', map: '' }]); const n = $('shop-locs').querySelectorAll('[data-loc="name"]'); n[n.length - 1].focus(); return; }
  if (t.hasAttribute('data-loc-del')) { t.closest('.locrow').remove(); return; }
  if (t.dataset.pdel) {
    if (armedDelete !== t.dataset.pdel) { armedDelete = t.dataset.pdel; renderShop(); return; }
    armedDelete = null;
    const next = vendorDraft(); next.id = vendorId || S.uid;
    next.products = next.products.filter(p => p.id !== t.dataset.pdel); next.offers = next.offers.filter(o => o.productId !== t.dataset.pdel);
    try { await saveVendor(next); toast('Product removed from the catalogue.'); } catch (er) { toast('Couldn’t remove it. Try again.'); }
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
  placeProps();
  sheetTo('low', 'instant');           // the room first: the sheet waits low and the camera frames what's left
  showHome(st.home, { editable: st.mode === 'edit', focus: studio.room && studio.room.id });
  if (!studio.room) studio.tab = st.mode === 'edit' ? 'flat' : 'list';
  renderStudio();
  nameTools();
}
function openEditor(id, roomId) {
  const h = S.drafts.get(id); if (!h) { toast('That home isn’t here any more.'); return; }
  openStudio({ mode: 'edit', id, home: h, focus: roomId || null, tab: 'room', node: null, wall: 'back', part: 'lo' });
}
function focusRoom(id) {
  if (!studio) return;
  studio.room = id ? studio.home.rooms.find(r => r.id === id) || null : null;
  studio.node = null;                  // another room opens on its tree
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
  setTool('select');
  hideRoom(); studio = null;
  $('studio').hidden = true; $('props').hidden = true;
  stMenu(false); endNames();
  document.body.classList.remove('studio-open');
  render();
}
$('st-back').addEventListener('click', closeStudio);

/* ---------- Layout: the top bar, the panel (a bottom sheet on phones), and the part of the room they leave clear ---------- */
const studioEl = $('studio'), side = $('side'), studioBar = document.querySelector('#studio .sbar');
const isSheet = () => window.innerWidth <= 760;
let sheet = 'low';
/* The panels the camera keeps the room clear of, in px: the top bar, and the side panel or the sheet. how: 'instant' (opening, a
   resize), 'live' (the sheet following a finger: the room's centre moves, the framing waits), or nothing (it glides). A sheet
   higher than half covers the room anyway, so the room stays framed for half. */
function syncPads(how, sheetPx) {
  const box = studioEl.getBoundingClientRect(), top = Math.round(studioBar.getBoundingClientRect().bottom - box.top + 8);
  if (!isSheet()) { setPads(Math.round(side.getBoundingClientRect().right - box.left + 12), top, 0, how); return; }
  const hs = sheetHeights();
  setPads(0, top, Math.min(sheetPx ?? hs[sheet], hs.half), how);
}
/* The sheet's three resting heights: low shows its handle and one line, half the panel, and full stops under the top bar. */
function sheetHeights() {
  const H = studioEl.clientHeight || window.innerHeight, safe = parseFloat(getComputedStyle(side).paddingBottom) || 0;
  const top = studioBar.getBoundingClientRect().bottom - studioEl.getBoundingClientRect().top;
  const low = Math.round(96 + safe), half = Math.max(low + 120, Math.round(H * 0.46));
  return { low, half, full: Math.max(half, Math.round(H - top - 8)) };
}
const setSheetPx = (px) => studioEl.style.setProperty('--sheet-h', px + 'px');
const sheetShown = () => Math.round(studioEl.getBoundingClientRect().bottom - side.getBoundingClientRect().top);    // mid-slide too
function sheetTo(s, how) {
  sheet = s;
  side.dataset.sheet = s; studioEl.dataset.sheet = s;
  if (isSheet()) {
    if (how === 'instant') studioEl.classList.add('still');      // opening, or a resize: it takes its place without sliding there
    const hs = sheetHeights();
    studioEl.style.setProperty('--sheet-full', hs.full + 'px'); studioEl.style.setProperty('--sheet-rest', hs[s] + 'px');
    setSheetPx(hs[s]);
    if (how === 'instant') { void side.offsetHeight; studioEl.classList.remove('still'); }    // laid out at its place first, so nothing slides
  }
  $('st-grab').setAttribute('aria-label', s === 'low' ? 'Open the panel' : s === 'half' ? 'Open the panel fully' : 'Lower the panel');
  syncPads(how);
}
const raiseSheet = () => { if (isSheet() && sheet === 'low') sheetTo('half'); };
/* A piece's panel and the tools' panel float at the right on wide screens; on phones they live in the sheet, in the place of its tabs. */
function placeProps() {
  const p = $('props'), home = isSheet() ? side : studioEl;
  if (p.parentNode !== home) home.appendChild(p);
  side.classList.toggle('with-props', !p.hidden && home === side);
}
window.addEventListener('resize', () => { if (!studio) return; placeProps(); sheetTo(sheet, 'instant'); });
/* The side panel and the view switch start below the top bar, whatever its height. */
new ResizeObserver(() => { studioEl.style.setProperty('--bar', studioBar.offsetHeight + 'px'); if (studio) syncPads('instant'); }).observe(studioBar);
/* Tapping the handle steps the sheet up (low, half, full, then low again); the summary line opens it to half. Dragging the handle,
   the line or the tabs moves it with the finger; let go and it rests at the nearest height, or the next one along after a quick
   flick. A drag isn't a tap, so the click after it is swallowed. */
$('st-grab').addEventListener('click', () => sheetTo(sheet === 'low' ? 'half' : sheet === 'half' ? 'full' : 'low'));
$('st-peek').addEventListener('click', () => sheetTo('half'));
let sheetDrag = null, swallowClick = false;
for (const el of [$('st-grab'), $('st-peek'), $('side-tabs')]) el.addEventListener('pointerdown', (e) => {
  if (!isSheet() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  sheetDrag = { id: e.pointerId, el, y0: e.clientY, h0: sheetShown(), hs: sheetHeights(), moved: false, trail: [[e.timeStamp, e.clientY]] };
});
document.addEventListener('pointermove', (e) => {
  const d = sheetDrag; if (!d || e.pointerId !== d.id) return;
  const dy = e.clientY - d.y0;
  if (!d.moved) {
    if (Math.abs(dy) < 6) return;
    d.moved = true; studioEl.classList.add('dragging');
    try { d.el.setPointerCapture(e.pointerId); } catch (er) {}
  }
  const px = clamp(d.h0 - dy, d.hs.low, d.hs.full), s = px < d.hs.low + 30 ? 'low' : px > d.hs.half + 30 ? 'full' : 'half';
  setSheetPx(px); side.dataset.sheet = s; studioEl.dataset.sheet = s;
  d.trail.push([e.timeStamp, e.clientY]); if (d.trail.length > 5) d.trail.shift();
  syncPads('live', px);
});
function sheetUp(e) {
  const d = sheetDrag; if (!d || e.pointerId !== d.id) return;
  sheetDrag = null;
  if (!d.moved) return;                                  // a tap: the button's own click deals with it
  swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);
  studioEl.classList.remove('dragging');
  const px = sheetShown(), [t0, y0] = d.trail[0], v = (e.clientY - y0) / Math.max(1, e.timeStamp - t0);   // px per ms, down is +
  const order = ['low', 'half', 'full'], hs = d.hs;
  let s = order.reduce((a, b) => (Math.abs(hs[b] - px) < Math.abs(hs[a] - px) ? b : a));
  if (Math.abs(v) > 0.45) s = v < 0 ? order.find(k => hs[k] > px + 1) || 'full' : [...order].reverse().find(k => hs[k] < px - 1) || 'low';
  sheetTo(s);
}
document.addEventListener('pointerup', sheetUp);
document.addEventListener('pointercancel', sheetUp);
side.addEventListener('click', (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
/* The sheet's line when it rests low: what's open and its gist. Names come from storage: set as text. */
function renderPeek() {
  if (!studio) return;
  const [t, s] = peekInfo();
  $('peek-t').textContent = t; $('peek-s').textContent = s;
}
function peekInfo() {
  const st = studio, h = st.home, r = st.room;
  if (tool === 'measure') { const [a, b] = st.measure || []; return ['Measure', !a ? 'Tap a face, then a second one' : !b ? 'Now tap the second face' : `${cm(measureBetween(a, b).d)} cm`]; }
  if (tool === 'paint') {
    const p = paintSums(), n = p.rows.length;
    return ['Paint', n ? `${n} surface${n === 1 ? '' : 's'} · ${p.tins} tin${p.tins === 1 ? '' : 's'} of ${st.paint.tinL.toLocaleString(undefined, { maximumFractionDigits: 1 })} L` : 'Tap walls or furniture to add them'];
  }
  const f = selId && findItem(selId);
  if (f) return [f.it.p.name, `${cm(f.it.p.w)} × ${cm(f.it.p.d)} × ${cm(f.it.p.h)} cm`];
  if (st.tab === 'list') return [st.mode === 'edit' ? 'Shopping' : r ? 'In this room' : 'In this home', `${euro(shopping(h).total)} in all`];
  if (st.tab === 'flat' || !r) return ['Rooms', `${h.rooms.length} rooms · ${Math.round(homeArea(h))} m²`];
  if (!st.node) return ['Room', `${sizeText(r)} · ${cm(r.h)} cm high · ${r.items.length} piece${r.items.length === 1 ? '' : 's'}`];
  return [nodeName(st.node), nodeSummary(st.node)];
}
/* The ⋯ menu in the top bar: what most people need less often (Download, Take out of Explore). */
function stMenu(open) {
  const m = $('st-menu'), b = $('st-more'); if (!m || !b) return;
  m.hidden = !open; b.setAttribute('aria-expanded', open);
  if (open) m.querySelector('[role="menuitem"]').focus();
}
document.addEventListener('pointerdown', (e) => { if ($('st-menu') && !$('st-menu').hidden && !e.target.closest('.menuwrap')) stMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('st-menu') && !$('st-menu').hidden) { stMenu(false); $('st-more').focus(); } });
const PUB_ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>';
const DOTS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const moreMenu = (items) => (items.length ? `<span class="menuwrap"><button type="button" class="rbtn" id="st-more" aria-label="More" title="More" aria-haspopup="menu" aria-expanded="false" aria-controls="st-menu">${DOTS}</button>
  <div class="menu" id="st-menu" role="menu" aria-labelledby="st-more" hidden>${items.join('')}</div></span>` : '');
/* The round buttons have their names beside them on the first visit, until one is tapped or a few seconds pass. */
let namesTimer = 0;
function nameTools() {
  try { if (localStorage.getItem('nido-tools-named') === '1') return; } catch (e) { return; }
  studioEl.classList.add('named');
  clearTimeout(namesTimer); namesTimer = setTimeout(endNames, 6000);
}
function endNames() {
  clearTimeout(namesTimer);
  if (!studioEl.classList.contains('named')) return;
  studioEl.classList.remove('named');
  try { localStorage.setItem('nido-tools-named', '1'); } catch (e) {}
}
for (const el of studioEl.querySelectorAll('.rbtn')) el.addEventListener('click', endNames);
$('st-fit').addEventListener('click', () => { if (studio) resetView(true); });
function changed(rebuild) {
  if (!studio || studio.mode !== 'edit') return;
  if (rebuild) { buildRoom(); showSelection(); }
  if (tool === 'paint') renderProps();          // the areas follow edits made in the side panel
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
/* A piece selected (on the way down, in the tree): its panel opens, and the tree marks it (a wall's page stays as it is). */
engineHooks.onSelect = (id) => { renderProps(); if (studio && (studio.tab !== 'room' || !studio.node || studio.node === 'furniture')) renderPane(); };
/* A tap, not a drag, on a piece raises the sheet to show its panel; dragging it leaves the sheet where it is, so the room doesn't
   slide under the finger. */
engineHooks.onItemTap = () => { if (studio && selId) raiseSheet(); };     // (arranging rooms in the plan selects nothing)
/* A wall tapped in the room opens its page (and raises the sheet on phones). "Zoom to this wall" moves the view. */
engineHooks.onWall = (roomId, wid) => {
  if (!studio || studio.mode !== 'edit') return;
  if (!studio.room || studio.room.id !== roomId) focusRoom(roomId);
  if (selId) selectItem(null);           // the wall's page, not the piece's panel
  setNode('wall:' + wid); studio.tab = 'room'; renderStudio(); $('pane').scrollTop = 0;
  raiseSheet();
};
/* Empty floor tapped on a phone: whatever was picked is let go (a piece, a wall's page) and the sheet goes back down. */
engineHooks.onBlankTap = () => {
  if (!studio || !isSheet()) return;
  const k = studio.node ? studio.node.split(':')[0] : '';
  if (['wall', 'part', 'frames', 'rail', 'op'].includes(k)) { studio.node = null; renderPane(); }
  if (sheet !== 'low') sheetTo('low');
};
/* How the room is shown: one round toggle, Plan view, and 3D when it's off. */
engineHooks.onMode = (m) => { $('v-plan').setAttribute('aria-pressed', m === 'plan'); };
$('v-plan').addEventListener('click', () => setMode(mode === 'plan' ? '3d' : 'plan'));
/* The evening light: a setting, so an icon toggle (the moon fills when it's on). */
$('t-eve').addEventListener('click', () => { if (!studio) return; studio.home.evening = !studio.home.evening; syncLamps(); syncTod(); changed(false); });
const syncTod = () => { $('t-eve').setAttribute('aria-pressed', !!studio.home.evening); };

function renderStudio() {
  const st = studio, h = st.home, r = st.room, edit = st.mode === 'edit';
  /* the bar: the room's name (the home's for the whole home), a menu of the rooms when there are several, and under it "Saved" or
     whose room it is */
  $('st-title').textContent = r ? r.name : h.name;
  $('st-name').classList.toggle('rooms', h.rooms.length > 1);
  $('st-room').innerHTML = '<option value="">Whole home</option>' + h.rooms.map(x => `<option value="${esc(x.id)}" ${r && r.id === x.id ? 'selected' : ''}></option>`).join('');
  [...$('st-room').options].slice(1).forEach((o, i) => { o.textContent = h.rooms[i].name; });
  if (!r) $('st-room').value = '';
  const sub = $('st-sub');
  if (edit) { sub.innerHTML = '<span id="st-save"></span>'; $('st-save').textContent = S.local ? 'Saved in this browser' : 'Saved'; }
  else { sub.innerHTML = `<span class="owner" data-owner="${esc(st.owner)}"><img alt="" hidden><span></span></span>`; fillOwners(sub); }
  syncTod();
  syncTools();
  const acts = $('st-actions'), more = [];
  if (S.downloads) more.push('<button type="button" role="menuitem" id="st-dl">Download</button>');
  if (edit) {
    const canPub = !S.local && S.db;
    if (h.published) more.push('<button type="button" role="menuitem" id="st-unpub">Take out of Explore</button>');
    const pub = h.published ? 'Update in Explore' : 'Publish';
    acts.innerHTML = moreMenu(more) + `<button type="button" class="rbtn primary" id="st-pub" title="${canPub ? pub : 'Publishing needs Contributor access'}" ${canPub ? '' : 'disabled'}>${PUB_ARROW}<span class="vh">${pub}</span></button>`;
  } else {
    if (S.isAdmin && st.owner !== S.uid) more.push('<button type="button" role="menuitem" class="danger" id="st-remove">Remove from Explore</button>');
    acts.innerHTML = moreMenu(more) + '<button type="button" class="btn small primary" id="st-copy"><span class="lbl-long">Copy to my homes</span><span class="lbl-short">Copy</span></button>';
  }
  const tabs = !edit ? [['list', r ? 'In this room' : 'In this home']] : r ? [['room', 'Room'], ['list', 'Shopping']] : [['flat', 'Rooms'], ['list', 'Shopping']];
  if (!tabs.some(([k]) => k === st.tab)) st.tab = tabs[0][0];
  $('side-tabs').innerHTML = tabs.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${st.tab === k}">${n}</button>`).join('');
  renderPane(); renderProps();
}
function syncTools() {
  const st = studio, r = st.room, edit = st.mode === 'edit', h = st.home;
  for (const b of $('st-tools').querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', b.dataset.tool === tool);
  $('st-hint').textContent = tool === 'measure' ? 'Tap a face, then a second one · drag to look around'
    : tool === 'paint' ? 'Tap walls or furniture to add them · tap again to take one off'
    : !r ? (edit && h.rooms.length > 1 ? 'Tap a room to work on it on its own · in Plan view, drag rooms to arrange them' : 'Tap a room to see it on its own · drag to look around')
    : edit ? 'Drag furniture to move it · tap a wall to change its finish · drag empty space to look around' : 'Drag to look around · tap a piece of furniture to see what it is';
}
/* Measure and Paint are toggles: tapping the one that's on goes back to selecting (as does its panel's ×). */
$('st-tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b && studio) useTool(tool === b.dataset.tool ? 'select' : b.dataset.tool); });
function useTool(t) {
  studio.measure = [];                // before setTool: it clears the selection, which redraws the panel
  if (!studio.paint) studio.paint = { surfaces: [], coats: 2, coverage: 10, tinL: 4 };
  setTool(t);
  syncTools(); renderProps(); syncWallMark();
  if (t !== 'select' && isSheet() && sheet !== 'low') sheetTo('low');      // the room free to tap; the sheet's line keeps the result
}
$('side-tabs').addEventListener('click', (e) => {     // the Room tab, tapped again, goes back up to the tree
  const b = e.target.closest('[data-tab]'); if (!b) return;
  if (b.dataset.tab === 'room' && studio.tab === 'room') studio.node = null;
  studio.tab = b.dataset.tab; renderStudio();
});
$('st-actions').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const st = studio;
  if (b.id === 'st-more') { stMenu($('st-menu').hidden); return; }
  if (b.closest('#st-menu') && b.id !== 'st-remove') stMenu(false);      // Remove asks again, so its menu stays open
  if (b.id === 'st-pub') {
    b.disabled = true; if ($('st-save')) $('st-save').textContent = 'Publishing…';
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
  if (studio.room) { ctx(studio.room); setNode(studio.node); }
  p.innerHTML = studio.tab === 'flat' ? flatPane() : studio.tab === 'room' ? (studio.node ? nodePage() : roomTree()) : listPane();
  for (const el of p.querySelectorAll('[data-fill]')) el.textContent = fills[+el.dataset.fill] || '';
  p.scrollTop = keep;
  if (studio.tab === 'list') fillListNames();
  syncWallMark();
  renderPeek();
}
/* Tint the wall (or the part of it) whose page is open: a wall, one of its parts, its mouldings, its rail, or a window on it.
   Nothing on the tree, the other pages, or with Measure or Paint on. */
function syncWallMark() {
  const st = studio, r = st && st.room, k = st && st.node ? st.node.split(':')[0] : '';
  if (!r || st.mode !== 'edit' || st.tab !== 'room' || !['wall', 'part', 'frames', 'rail', 'op'].includes(k) || tool !== 'select') { showWall(null); return; }
  const cfg = r.walls[st.wall], sp = Math.min(cfg.split, r.h);
  const [z0, z1] = (k === 'part' || k === 'frames') && cfg.layout === 'split' ? (st.part === 'hi' ? [sp, r.h] : [0, sp]) : [0, r.h];
  showWall({ r, wid: st.wall, z0, z1 });
}
const numField = (label, act, val, extra = '', unit = 'cm', attrs = '') => `<label class="field"><span>${label}</span><span class="in"><input type="number" inputmode="decimal" data-act="${act}" ${extra} value="${val}" ${attrs}><span class="u">${unit}</span></span></label>`;
let armedRoom = null;
function flatPane() {
  const h = studio.home;
  return `<label class="field"><span>Home name</span><span class="in"><input data-act="hname" maxlength="60" value="${esc(h.name)}"></span></label>
    <div class="sec-h">Rooms · ${h.rooms.length} · ${Math.round(homeArea(h))} m²</div>
    <div class="list">${h.rooms.map(r => `<button type="button" class="lrow" data-act="focus" data-id="${esc(r.id)}"><span class="thumb" style="display:grid;place-items:center;font-size:10px;font-weight:800;color:var(--muted);line-height:1.1;text-align:center">${Math.round(r.w * r.l)}<br>m²</span>
      <span class="tx"><b data-fill="${fills.push(r.name) - 1}"></b><small class="num">${sizeText(r)} · ${r.items.length} piece${r.items.length === 1 ? '' : 's'}</small></span></button>`).join('')}</div>
    <button type="button" class="btn primary" data-act="addroom">Add a room</button>
    <p class="note">Tap a room, here or in the 3D view, to work on it on its own. In Plan view, drag rooms to arrange them: they snap together with a 10 cm wall between, and doors cut through both sides.</p>`;
}
/* Where a duplicated room goes in the home's plan. placeBeside(o, r, side) sets r.x and r.z so r sits against
   that side of o with a 10 cm wall between; homeBox(home) and each room's x, z, w, l (centre and size) describe the plan.
   TODO: this always puts the copy on the original's right, so in a flat it can land on top of another room.
   Pick a free spot instead: for example, try the sides in turn and keep the first one where the copy overlaps no room,
   or fall back to the far edge of the whole home. */
function placeCopy(home, src, copy) {
  placeBeside(src, copy, 'right');
}
/* "Kids' room" → "Kids' room (copy)", then "(copy 2)", "(copy 3)"…, skipping names in use; never "(copy) (copy)". */
function copyName(name, taken) {
  const base = name.replace(/ \(copy(?: \d+)?\)$/, '').slice(0, 49);
  for (let n = 1; ; n++) { const c = `${base} (copy${n > 1 ? ' ' + n : ''})`; if (!taken.includes(c)) return c; }
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
    const r = cleanRoom({ name: $('ar-name').value.trim() || 'Room', w, l, h: hh, floor: o.floor, flooring: o.flooring });
    placeBeside(o, r, side);
    if ($('ar-door').checked) { const d = doorBetween(o, r, side); if (d) r.openings.push(d); }
    h.rooms.push(r);
    closeDialog(); changed(true); resetView(); focusRoom(r.id);
    toast(`${r.name} added. Arrange rooms by dragging them in Plan view.`);
  });
  [...box.querySelectorAll('#ar-next option')].forEach((op, i) => { op.textContent = h.rooms[i].name; });
}
/* ---------- The room as a tree ---------- */
/* The Room tab shows the room as a tree: the room, its floor, its four walls with what's on each (windows, doors, radiators,
   mouldings, the rail, the two parts of a split wall) and its furniture. Each line opens its own page (studio.node):
   'room', 'floor', 'furniture', 'wall:<wid>', 'part:<wid>:<hi|lo>', 'frames:<wid>:<hi|lo>', 'rail:<wid>', 'op:<id>'; null is the tree.
   Wall pages set studio.wall and studio.part, which the wall editors and their events read (zoneOf). Furniture opens its own
   floating panel, as when it's tapped in the room. */
const PART_NAMES = { hi: 'Top part', lo: 'Bottom part' };
const GLYPHS = {
  room: '<path d="M3 21V9.5L12 3l9 6.5V21z"/><path d="M9 21v-6h6v6"/>',
  window: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M5 12h14"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>',
  radiator: '<path d="M6 6v12M10 6v12M14 6v12M18 6v12M4 18h16"/>',
  frames: '<rect x="4" y="4" width="7" height="16" rx="1"/><rect x="13" y="4" width="7" height="16" rx="1"/>',
  rail: '<path d="M3 11h18M3 14h18M3 5v15M21 5v15"/>',
  furniture: '<path d="M5 12V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 12h18v5H3zM5 17v2M19 17v2"/>',
};
const glyph = (k) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[k]}</svg>`;
const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
/* One line of the tree: a picture (a style, or a glyph), a name and a summary. Names come from storage: set as text. */
function tnode(node, pic, name, sub) {
  return `<button type="button" class="tnode" data-act="node" data-v="${esc(node)}"><span class="thumb" style="${pic.style || ''}">${pic.glyph ? glyph(pic.glyph) : ''}</span>
    <span class="tx"><b data-fill="${fills.push(name) - 1}"></b><small data-fill="${fills.push(sub) - 1}"></small></span>${CHEV}</button>`;
}
/* What a finish is, in a few words, and its colour or picture. */
function finishText(f) {
  if (f.type === 'image') return f.img ? `Wallpaper · ${f.img.name}` : 'Wallpaper, none chosen';
  if (f.type === 'pattern') return `Pattern · ${PATTERNS[f.pattern]}`;
  const what = f.type === 'panel' ? 'Panelling' : 'Paint', pre = PRESETS.find(([, c]) => c === String(f.color).toLowerCase());
  return `${what} · ${f.paint ? f.paint.name + (f.paint.mix && f.paint.code ? ' ' + f.paint.code : '') : pre ? pre[0] : f.color}`;
}
const finishPic = (f) => ({ style: f.type === 'image' && f.img ? `background-image:url(${blobSrc(f.img.src)})` : `background:${f.color}` });
const framesText = (z) => (FRAME_STYLES.find(([k]) => k === z.style) || ['', 'Mouldings'])[1] + (z.style === 'mould' && z.moulding ? ` · ${z.moulding.name}` : '');
const railText = (cfg) => (RAIL_STYLES.find(([k]) => k === cfg.railStyle) || ['', 'Rail'])[1] + (cfg.railStyle === 'straight' && cfg.railM ? ` · ${cfg.railM.name}` : '');
const opText = (o) => `${cm(o.w)} × ${cm(o.h)} cm, ${cm(o.off)} cm from the left`;
/* A wall's finish: once when both parts of a split wall have the same one. */
function wallText(cfg) {
  if (cfg.layout !== 'split') return finishText(cfg.lo.f);
  const hi = finishText(cfg.hi.f), lo = finishText(cfg.lo.f);
  return hi === lo ? hi : `${hi}, over ${lo.toLowerCase()}`;
}
/* A page's gist, as its line in the tree says it (the sheet's line shows it when the sheet rests low). */
function nodeSummary(n) {
  const [k, a, b] = n.split(':'), r = studio.room, cfg = r.walls[a];
  if (k === 'room') return `${sizeText(r)} · ${cm(r.h)} cm high`;
  if (k === 'floor') return r.flooring ? r.flooring.name : FLOORS[r.floor][0];
  if (k === 'furniture') return r.items.length ? `${r.items.length} piece${r.items.length === 1 ? '' : 's'}` : 'None yet';
  if (k === 'op') { const o = r.openings.find(x => x.id === a); return o ? opText(o) : ''; }
  if (!cfg) return '';
  if (k === 'wall') return wallText(cfg);
  if (k === 'part') return cfg[b] ? finishText(cfg[b].f) : '';
  if (k === 'frames') return cfg[b] ? framesText(cfg[b]) : '';
  if (k === 'rail') return railText(cfg);
  return '';
}
/* What hangs on a wall, as lines of the tree: its windows, doors and radiators, then its parts and their mouldings, then the rail. */
function wallKids(r, wid) {
  const cfg = r.walls[wid], split = cfg.layout === 'split', out = [];
  for (const o of r.openings.filter(x => x.wall === wid)) out.push(tnode('op:' + o.id, { glyph: o.kind }, OP_KINDS[o.kind], opText(o)));
  const frames = (key) => (cfg[key].frames ? tnode(`frames:${wid}:${key}`, { glyph: 'frames' }, 'Mouldings and panels', framesText(cfg[key])) : '');
  if (split) for (const key of ['hi', 'lo']) {
    out.push(tnode(`part:${wid}:${key}`, finishPic(cfg[key].f), PART_NAMES[key], finishText(cfg[key].f)));
    const f = frames(key); if (f) out.push(`<div class="tgroup">${f}</div>`);
  } else if (cfg.lo.frames) out.push(frames('lo'));
  if (split && cfg.rail) out.push(tnode('rail:' + wid, { glyph: 'rail' }, 'Rail', railText(cfg)));
  return out.join('');
}
function roomTree() {
  const r = studio.room, fl = r.flooring, n = r.items.length;
  const walls = WALL_IDS.map(wid => {
    const cfg = r.walls[wid], split = cfg.layout === 'split', kids = wallKids(r, wid);
    return tnode('wall:' + wid, finishPic(cfg[split ? 'hi' : 'lo'].f), WALL_NAMES[wid], wallText(cfg)) + (kids ? `<div class="tgroup">${kids}</div>` : '');
  }).join('');
  const items = r.items.map(it => `<button type="button" class="tnode" data-act="sel" data-id="${it.id}" aria-pressed="${selId === it.id}">
      <span class="thumb" style="${it.p.photo ? `background-image:url(${assetSrc(it.p.photo)})` : `background:${it.p.color}`}"></span>
      <span class="tx"><b data-fill="${fills.push(it.p.name) - 1}"></b><small class="num">${cm(it.p.w)} × ${cm(it.p.d)} × ${cm(it.p.h)} cm</small></span></button>`).join('');
  return `<div class="tree">
    ${tnode('room', { glyph: 'room' }, r.name, `${sizeText(r)} · ${cm(r.h)} cm high`)}
    ${tnode('floor', { style: fl ? (fl.src ? `background-image:url(${blobSrc(fl.src)})` : `background:${fl.color}`) : `background-image:url(${floorPic(r.floor)})` }, 'Floor', fl ? fl.name : FLOORS[r.floor][0])}
    ${walls}
    ${tnode('furniture', { glyph: 'furniture' }, 'Furniture', n ? `${n} piece${n === 1 ? '' : 's'}` : 'None yet')}
    <div class="tgroup">${items}<button type="button" class="tadd" data-act="addfurn">+ Add furniture</button></div></div>
    <p class="note">Tap a line to change it, or tap a wall or a piece of furniture in the room.</p>`;
}
/* The page a line opens: a way back, its name, its editor. */
function nodeParent(n) {
  const [k, a, b] = n.split(':'), r = studio.room;
  if (k === 'op') { const o = r.openings.find(x => x.id === a); return o ? 'wall:' + o.wall : null; }
  if (k === 'frames') return r.walls[a].layout === 'split' ? `part:${a}:${b}` : 'wall:' + a;
  if (k === 'part' || k === 'rail') return 'wall:' + a;
  return null;
}
function nodeName(n) {
  const [k, a, b] = n.split(':'), r = studio.room;
  if (k === 'room') return 'Name and size';     // the crumb above it already says the room's name
  if (k === 'wall') return WALL_NAMES[a];
  if (k === 'part') return `${PART_NAMES[b]} of the ${WALL_NAMES[a].toLowerCase()}`;
  if (k === 'frames') return 'Mouldings and panels';
  if (k === 'op') { const o = r.openings.find(x => x.id === a); return o ? OP_KINDS[o.kind] : ''; }
  return { floor: 'Floor', furniture: 'Furniture', rail: 'Rail' }[k] || '';
}
/* A node that no longer exists (a window removed, a wall no longer split) falls back to the nearest one that does. */
function validNode(n) {
  if (!n) return null;
  const [k, a, b] = n.split(':'), r = studio.room;
  if (k === 'op') return r.openings.some(o => o.id === a) ? n : null;
  if (!['part', 'frames', 'rail', 'wall'].includes(k)) return n;
  if (!r.walls[a]) return null;
  const split = r.walls[a].layout === 'split';
  if (k === 'part') return split ? n : 'wall:' + a;
  if (k === 'rail') return split && r.walls[a].rail ? n : 'wall:' + a;
  if (k === 'frames') { const key = split ? b : 'lo'; return r.walls[a][key].frames ? `frames:${a}:${key}` : split ? `part:${a}:${b}` : 'wall:' + a; }
  return n;
}
function setNode(n) {
  const st = studio, r = st.room;
  n = r ? validNode(n) : null;
  st.node = n;
  if (!n) return;
  const [k, a, b] = n.split(':'), wid = k === 'op' ? r.openings.find(o => o.id === a).wall : r.walls[a] ? a : null;
  if (wid) { st.wall = wid; st.part = r.walls[wid].layout !== 'split' ? 'lo' : b === 'hi' || b === 'lo' ? b : st.part || 'hi'; }
}
function goNode(n) { setNode(n); studio.tab = 'room'; renderPane(); $('pane').scrollTop = 0; }
function nodePage() {
  const n = studio.node, [k, a, b] = n.split(':'), par = nodeParent(n), r = studio.room;
  const sub = k === 'op' ? `On the ${WALL_NAMES[studio.wall].toLowerCase()}` : k === 'frames' ? `On the ${WALL_NAMES[a].toLowerCase()}${r.walls[a].layout === 'split' ? ', ' + PART_NAMES[b].toLowerCase() : ''}`
    : k === 'wall' ? `${cm(wallLen(a))} cm long` : k === 'rail' ? `Along the ${WALL_NAMES[a].toLowerCase()}, ${cm(Math.min(r.walls[a].split, r.h))} cm up` : '';
  const body = k === 'room' ? roomEditor() : k === 'floor' ? floorNote(r) : k === 'furniture' ? furnitureEditor() : k === 'wall' ? wallEditor(a)
    : k === 'part' ? partEditor(a, b) : k === 'frames' ? framesEditor(a, b) : k === 'rail' ? railEditor(a) : opEditor(a);
  return `<div class="node-top"><button type="button" class="crumb" data-act="nodeback"><span aria-hidden="true">‹</span> <span data-fill="${fills.push(par ? nodeName(par) : r.name) - 1}"></span></button>
    <h3 class="node-h" data-fill="${fills.push(nodeName(n)) - 1}"></h3>${sub ? `<p class="note">${sub}</p>` : ''}</div>${body}`;
}
function roomEditor() {
  const r = studio.room;
  return `<label class="field"><span>Room name</span><span class="in"><input data-act="rname" maxlength="60" value="${esc(r.name)}"></span></label>
    <div class="fields">${numField('Width', 'dim', cm(r.w), 'data-k="w" min="100" max="1500" step="1"')}${numField('Length', 'dim', cm(r.l), 'data-k="l" min="100" max="1500" step="1"')}${numField('Ceiling', 'dim', cm(r.h), 'data-k="h" min="200" max="500" step="1"')}</div>
    <p class="note">Width runs along the back and front walls, length along the left and right walls. “From the left” is measured facing the wall.</p>
    <div class="sec-h">This home</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn small" data-act="addroom">Add another room</button><button type="button" class="btn small" data-act="rdup">Duplicate this room</button>${studio.home.rooms.length > 1 ? `<button type="button" class="btn small danger" data-act="rdel">${armedRoom === r.id ? 'Click again to remove this room' : 'Remove this room'}</button>` : ''}</div>`;
}
function furnitureEditor() {
  const r = studio.room;
  return `<button type="button" class="btn primary" data-act="addfurn">Add furniture</button>
    <div class="list">${r.items.map(it => `<button type="button" class="lrow" data-act="sel" data-id="${it.id}" aria-pressed="${selId === it.id}">
      <span class="thumb" style="${it.p.photo ? `background-image:url(${assetSrc(it.p.photo)})` : `background-color:${it.p.color}`}"></span>
      <span class="tx"><b data-fill="${fills.push(it.p.name) - 1}"></b><small class="num">${cm(it.p.w)} × ${cm(it.p.d)} × ${cm(it.p.h)} cm</small></span></button>`).join('') || '<p class="note">Nothing yet. Add a sofa, a bed or anything from a shop.</p>'}</div>
    ${r.items.length ? '<p class="note">Tap a piece to rotate, copy or remove it, or drag it in the room.</p>' : ''}`;
}
function opEditor(id) {
  const o = studio.room.openings.find(x => x.id === id);
  return `<label class="field"><span>Wall</span><span class="in"><select data-act="op" data-id="${o.id}" data-k="wall">${WALL_IDS.map(w => `<option value="${w}" ${w === o.wall ? 'selected' : ''}>${WALL_NAMES[w]}</option>`).join('')}</select></span></label>
    <div class="fields two">
      ${numField('From the left', 'op', cm(o.off), `data-id="${o.id}" data-k="off" min="0" step="1"`)}
      ${numField('Width', 'op', cm(o.w), `data-id="${o.id}" data-k="w" min="20" step="1"`)}
      ${numField('Height', 'op', cm(o.h), `data-id="${o.id}" data-k="h" min="10" step="1"`)}
      ${o.kind === 'door' ? '' : numField(o.kind === 'window' ? 'Sill height' : 'From the floor', 'op', cm(o.y), `data-id="${o.id}" data-k="y" min="0" step="1"`)}
    </div>
    <p class="note">“From the left” is measured facing the wall.</p>
    <div><button type="button" class="btn small danger" data-act="opdel" data-id="${o.id}">Remove this ${OP_KINDS[o.kind].toLowerCase()}</button></div>`;
}

/* Shopping list: furniture grouped by product, flooring packs from the rooms, wallpaper rolls, paint tins and moulding strips from the walls. */
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
  for (const r of rooms) for (const wid of WALL_IDS) for (const z of [r.walls[wid].lo, r.walls[wid].hi]) for (const f of [z.f, z.inner]) { for (const m of [f && f.paint, f && f.type === 'image' && f.base]) if (m && !paints.has(paintKey(m))) paints.set(paintKey(m), m); }   // the first wall names the line
  const paintRows = [...paints.values()].map(paint => ({ paint, plan: paintPlan(rooms, paint) })).filter(x => x.plan.tins);
  const moulds = new Map();
  for (const r of rooms) for (const wid of WALL_IDS) { const w = r.walls[wid]; for (const m of [w.railM, w.lo.moulding, w.hi.moulding]) if (m) moulds.set(m.ref, m); }
  const mouldRows = [...moulds.values()].map(m => ({ m, plan: mouldingPlan(rooms, m) })).filter(x => x.plan.strips);
  const floors = new Map();
  for (const r of rooms) if (r.flooring && !floors.has(r.flooring.ref)) floors.set(r.flooring.ref, r.flooring);     // the first room names the line
  const floorRows = [...floors.values()].map(fl => ({ fl, plan: floorPlan(rooms, fl) }));
  let total = 0, missing = 0;
  let onSite = 0;
  for (const g of groups.values()) { if (g.p.price !== null) total += g.p.price * g.n; else if (priceOnSite(g.p.ref)) onSite++; else if (!g.p.ref.startsWith('basic:')) missing++; }
  for (const x of paperRows) if (x.plan.cost !== null) total += x.plan.cost;
  for (const x of paintRows) if (x.plan.cost !== null) total += x.plan.cost;
  for (const x of mouldRows) if (x.plan.cost !== null) total += x.plan.cost;
  for (const x of floorRows) if (x.plan.cost !== null) total += x.plan.cost;
  return { groups: [...groups.values()], floorRows, paperRows, paintRows, mouldRows, total, missing, onSite };
}
function listPane() {
  const r = studio.home, s = shopping(r), view = studio.mode === 'view';
  const rows = s.groups.map(g => `<div class="lrow" style="cursor:default">
      <span class="thumb" style="${g.p.photo ? `background-image:url(${assetSrc(g.p.photo)})` : `background-color:${g.p.color}`}"></span>
      <span class="tx"><b data-gname></b><small><span data-gshop></span>${g.n > 1 ? ` · ${g.n} ×` : ''}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${g.p.price !== null ? `<span class="price">${euro(g.p.price * g.n)}</span>` : priceOnSite(g.p.ref) ? '<small class="note">Price at the shop</small>' : '<small class="note">—</small>'}${shopLink(g.p.url, g.p.ref, "Shop ↗", " style=\"font-size:12px\"", "")}</span></div>`).join('');
  const papers = s.paperRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="background-image:url(${blobSrc(x.img.src)})"></span>
      <span class="tx"><b data-pname></b><small>${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : priceOnSite(x.img.ref) ? '<small class="note">Price at the shop</small>' : ''}${shopLink(x.img.url, x.img.ref, "Shop ↗", " style=\"font-size:12px\"", "")}</span></div>`).join('');
  return `${view ? `<p class="note">Everything in this ${r.rooms.length > 1 ? 'home' : 'room'}, with the prices the shops listed when it was furnished. Tap a piece to see it.</p>` : r.rooms.length > 1 ? '<p class="note">Everything in every room of this home.</p>' : ''}
    <div class="sec-h">Furniture</div><div class="list">${rows || '<p class="note">No furniture yet.</p>'}</div>
    ${s.floorRows.length ? `<div class="sec-h">Flooring</div><div class="list">${s.floorRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="${x.fl.src ? `background-image:url(${blobSrc(x.fl.src)})` : `background-color:${x.fl.color}`}"></span>
      <span class="tx"><b data-fname></b><small>${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : priceOnSite(x.fl.ref) ? '<small class="note">Price at the shop</small>' : ''}${shopLink(x.fl.url, x.fl.ref, "Shop ↗", " style=\"font-size:12px\"", "")}</span></div>`).join('')}</div>` : ''}
    ${papers ? `<div class="sec-h">Wallpaper</div><div class="list">${papers}</div>` : ''}
    ${s.paintRows.length ? `<div class="sec-h">Paint</div><div class="list">${s.paintRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="background-color:${x.paint.color || '#ddd'}"></span>
      <span class="tx"><b data-ptname></b><small>${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : priceOnSite(x.paint.ref) ? '<small class="note">Price at the shop</small>' : ''}${shopLink(x.paint.url, x.paint.ref, "Shop ↗", " style=\"font-size:12px\"", "")}</span></div>`).join('')}</div>` : ''}
    ${s.mouldRows.length ? `<div class="sec-h">Mouldings</div><div class="list">${s.mouldRows.map(x => `<div class="lrow" style="cursor:default"><span class="thumb" style="display:grid;place-items:center">${profileSvg(x.m, '#d8c3a0')}</span>
      <span class="tx"><b data-mname></b><small>${mm(x.m.face)} × ${mm(x.m.depth)} mm · ${x.plan.text}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">${x.plan.cost !== null ? `<span class="price">${euro(x.plan.cost)}</span>` : priceOnSite(x.m.ref) ? '<small class="note">Price at the shop</small>' : ''}${shopLink(x.m.url, x.m.ref, "Shop ↗", " style=\"font-size:12px\"", "")}</span></div>`).join('')}</div>` : ''}
    <div class="total"><span>Total</span><span class="price">${euro(s.total)}</span></div>
    <p class="note">${s.missing ? `${s.missing} product${s.missing === 1 ? ' has' : 's have'} no price listed. ` : ''}Generic pieces from Nido basics have no price.${s.onSite ? ` ${s.onSite} product${s.onSite === 1 ? ' shows its' : 's show their'} price only on the shop’s site, so the total leaves ${s.onSite === 1 ? 'it' : 'them'} out.` : ''}${papers ? ' Wallpaper includes 10 cm per strip to trim, rounded up to the pattern repeat.' : ''}</p>
    ${(() => { const d = disclosureFor([...s.groups.map(g => g.p), ...s.floorRows.map(x => x.fl), ...s.paperRows.map(x => x.img), ...s.paintRows.map(x => x.paint), ...s.mouldRows.map(x => x.m)]); return d ? `<p class="note">${esc(d)}</p>` : ''; })()}`;
}
function fillListNames() {
  const s = shopping(studio.home), p = $('pane');
  p.querySelectorAll('[data-gname]').forEach((b, i) => { b.textContent = s.groups[i].p.name; });
  p.querySelectorAll('[data-gshop]').forEach((b, i) => { b.textContent = s.groups[i].p.shop || ''; });
  p.querySelectorAll('[data-fname]').forEach((b, i) => { const fl = s.floorRows[i].fl; b.textContent = fl.name + (fl.shop ? ' · ' + fl.shop : ''); });
  p.querySelectorAll('[data-mname]').forEach((b, i) => { const m = s.mouldRows[i].m; b.textContent = m.name + (m.shop ? ' · ' + m.shop : ''); });
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
    const mixed = !!(f.paint && f.paint.mix), cur = f.paint, link = cur ? shopLink(cur.url, cur.ref, 'See it in the shop ↗') : '';
    body = `${pickField('Paint', 'pickpaint', `data-slot="${slot}"`, cur ? { thumb: `background:${f.color}`, name: cur.name,
      sub: subLine(cur.shop, mixed ? 'mixed in the shop' : cur.code, priceEach(cur.price, `a ${cur.tinL.toLocaleString()} L tin`)) }
      : { thumb: `background:${f.color}`, name: 'Your own colour', sub: `${f.color} · not from a shop` })}
      ${mixed ? `<label class="field"><span>Colour code</span><span class="in"><input data-act="fcode" data-slot="${slot}" maxlength="40" value="${esc(cur.code)}" placeholder="NCS S 1005-Y20R, RAL 9010, or the tin’s code"></span></label>` : ''}
      ${mixed || link ? `<p class="note">${mixed ? 'Copy the code from the fan deck or the tin; the shop mixes it. Pick below how it looks on screen.' : ''}${link ? (mixed ? ' ' : '') + link : ''}</p>${linkDisclosure(cur.url, cur.ref)}` : ''}
      ${mixed ? `<span class="note">How it looks on screen</span>${swatchRow('fcolor', f.color, slot)}`
        : `<label class="field"><span>Or type any colour</span><span class="in hexin"><input type="text" data-act="fcolor" data-slot="${slot}" data-hex="1" value="${f.color}" placeholder="#rrggbb" maxlength="20" spellcheck="false"></span></label>`}${f.type === 'panel' ? numField('Board width', 'fsize', f.board, `data-slot="${slot}" min="3" max="60" step="1"`) : ''}`;
  }
  if (f.type === 'pattern') body = `<span class="note">Background</span>${swatchRow('fcolor', f.color, slot)}
    <div class="fields two"><label class="field"><span>Pattern</span><span class="in"><select data-act="fpattern" data-slot="${slot}">${Object.entries(PATTERNS).map(([k, n]) => `<option value="${k}" ${k === f.pattern ? 'selected' : ''}>${n}</option>`).join('')}</select></span></label>
    <label class="field"><span>Pattern colour</span><span class="in"><input type="color" data-act="fcolor2" data-slot="${slot}" value="${f.color2}" style="height:31px;padding:3px"></span></label></div>
    ${numField('Pattern size', 'fsize', f.tile, `data-slot="${slot}" min="5" max="300" step="1"`)}`;
  if (f.type === 'image') {
    const cur = f.img;
    body = `${pickField('Wallpaper', 'pickpaper', `data-slot="${slot}"`, cur && { thumb: `background-image:url(${blobSrc(cur.src)})`, name: cur.name,
      sub: cur.ref ? subLine(cur.shop, priceEach(cur.price, cur.unit === 'm2' ? 'a m²' : 'a roll')) : 'Your image, not from a shop' }, ['None yet', 'Pick a shop’s paper, or upload a photo of a sample'])}
      ${cur ? `<p class="note">${cur.mural ? 'A mural: one picture stretched to cover this part of the wall.' : `One repeat is ${cur.width} cm wide.`}${shopLink(cur.url, cur.ref, 'See it in the shop ↗', '', ' ')}</p>${linkDisclosure(cur.url, cur.ref)}` : '<p class="note">Pick a paper, or upload a photo of a sample.</p>'}
      ${cur && !cur.mural && !cur.ref ? numField('Repeat width', 'fsize', f.imgW, `data-slot="${slot}" min="5" max="400" step="1"`) : ''}`;
  }
  return `<div class="finish"><div class="fin-h">${title}</div><div class="types">${tw}</div>${body}</div>`;
}
/* A shop's moulding for the panel frames or the rail, and how many strips of it the whole home needs. */
function mouldPick(act, cur, label) {
  const list = allProducts().filter(p => p.kind === 'moulding' && p.moulding);
  const listed = cur && list.some(p => p.ref === cur.ref);
  const plan = cur && mouldingPlan(studio.home.rooms, cur);
  return `${pickField(label, 'pickmould', `data-v="${act}"`, cur && { html: profileSvg(cur, '#d8c3a0'), name: cur.name + (listed ? '' : ' (no longer listed)'),
    sub: subLine(cur.shop, `${mm(cur.face)} × ${mm(cur.depth)} mm`, priceEach(cur.price, 'a strip')) }, ['Any moulding, not from a shop', inShops(list.length, list.length === 1 ? 'moulding' : 'mouldings')])}
    ${plan ? `<div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}
    <p class="note">Across the whole home: each frame side and rail stretch cut from ${cur.len.toLocaleString()} m strips, corners mitred, 5 mm lost a cut.${shopLink(cur.url, cur.ref, "Shop ↗", "", " ")}</p>${linkDisclosure(cur.url, cur.ref)}` : ''}`;
}
/* What can be added to a wall or a part of it, as buttons under its lines. */
function addRow(wid, key) {
  const cfg = studio.room.walls[wid], split = cfg.layout === 'split', b = (act, v, label, extra = '') => `<button type="button" class="btn small" data-act="${act}" data-v="${v}" data-wall="${wid}" ${extra}>${label}</button>`;
  const here = key ? [] : Object.entries(OP_KINDS).map(([k, n]) => b('opadd', k, 'Add ' + n.toLowerCase()));
  if ((key || !split) && !cfg[key || 'lo'].frames) here.push(b('framesadd', key || 'lo', 'Add mouldings or panels'));
  if (!key && split && !cfg.rail) here.push(b('railadd', '', 'Add a rail'));
  return here.length ? `<div class="addrow">${here.join('')}</div>` : '';
}
/* A wall: how it's laid out (one part, or split in two at a height), its finish when it's one part, and what's on it. */
function wallEditor(wid) {
  const r = studio.room, cfg = r.walls[wid], split = cfg.layout === 'split', z = cfg.lo, kids = wallKids(r, wid);
  return `<div class="pair"><button type="button" class="btn small" data-act="wallzoom">Zoom to this wall</button><button type="button" class="btn small" data-act="wallroom">Whole room</button></div>
    <div class="seg wide" role="group" aria-label="Layout"><button type="button" data-act="layout" data-v="whole" aria-pressed="${!split}">One part</button><button type="button" data-act="layout" data-v="split" aria-pressed="${split}">Split in two</button></div>
    ${split ? numField('Split height', 'split', cm(cfg.split), 'min="20" max="400" step="1"') : `${finishEditor(z.f, 'f', 'Finish')}${paperNote(z)}${baseNote(z)}${paintNote(z)}`}
    <div class="sec-h">On this wall</div>
    ${kids ? `<div class="tree">${kids}</div>` : '<p class="note">Nothing yet.</p>'}
    ${addRow(wid)}
    <button type="button" class="btn" data-act="allwalls">Use this wall on all four walls</button>`;
}
/* One part of a split wall: its finish and its mouldings. */
function partEditor(wid, key) {
  const z = studio.room.walls[wid][key];
  return `${finishEditor(z.f, 'f', 'Finish')}${paperNote(z)}${baseNote(z)}${paintNote(z)}
    ${z.frames ? `<div class="sec-h">On this part</div><div class="tree">${tnode(`frames:${wid}:${key}`, { glyph: 'frames' }, 'Mouldings and panels', framesText(z))}</div>` : ''}
    ${addRow(wid, key)}`;
}
/* Mouldings or panels on a wall or a part of it: their kind, moulding, colour, how many and how big, and what's inside them. */
function framesEditor(wid, key) {
  const z = studio.room.walls[wid][key], pn = panelNow(wid, key);
  return `<div class="seg wide" role="group" aria-label="Kind of panel">${FRAME_STYLES.map(([k, n]) => `<button type="button" data-act="fstyle" data-v="${k}" aria-pressed="${z.style === k}">${n}</button>`).join('')}</div>
    ${z.style === 'mould' ? mouldPick('pmould', z.moulding, 'Moulding') : ''}
    <span class="note">${z.style === 'soft' || z.style === 'tops' ? 'Panel colour' : 'Moulding colour'}</span>${swatchRow('mould', z.mould, '', true)}
    <div class="fields">${numField('Panels', 'pcount', pn.n, 'min="1" max="24" step="1"', '')}${numField('Width', 'pwidth', cm(pn.w), 'min="5" max="400" step="1"')}${numField('Height', 'pheight', cm(pn.h), 'min="10" max="400" step="1"')}${numField('Separation', 'pgap', cm(pn.gap), 'min="0" max="100" step="1"')}${numField('Padding', 'ppad', cm(pn.pad), 'min="3" max="200" step="1"')}</div>
    <p class="note">Padding is the space at the ends of the wall and around windows and doors. A new width keeps the number and separation and moves the padding; the other values keep the rest and change the width. The height stays centred.${pn.uneven ? ' Panels beside a window or door get their own width to fill their stretch.' : ''}</p>
    ${z.style !== 'soft' ? `<div class="seg wide" role="group" aria-label="Inside"><button type="button" data-act="inner" data-v="same" aria-pressed="${!z.inner}">${z.style === 'tops' ? 'Plain colour' : 'Same as the wall'}</button><button type="button" data-act="inner" data-v="own" aria-pressed="${!!z.inner}">Its own finish</button></div>` : ''}
    ${z.inner && z.style !== 'soft' ? finishEditor(z.inner, 'in', z.style === 'tops' ? 'Panel finish' : 'Inside the frames') : ''}
    <div><button type="button" class="btn small danger" data-act="framesdel" data-v="${key}" data-wall="${wid}">Remove the mouldings</button></div>`;
}
/* The rail where a split wall changes finish: its shape, moulding and colour. */
function railEditor(wid) {
  const cfg = studio.room.walls[wid];
  return `<div class="seg wide" role="group" aria-label="Rail shape">${RAIL_STYLES.map(([k, n]) => `<button type="button" data-act="railStyle" data-v="${k}" aria-pressed="${cfg.railStyle === k}">${n}</button>`).join('')}</div>
    ${cfg.railStyle === 'straight' ? mouldPick('railmould', cfg.railM, 'Rail moulding') : ''}
    <span class="note">Rail colour</span>${swatchRow('trim', cfg.trim || '#fbfbf9', '', false)}
    <div><button type="button" class="btn small danger" data-act="raildel" data-wall="${wid}">Remove the rail</button></div>`;
}
/* A wall's area between two heights: its length × the height, minus the windows and doors in it (radiators are painted behind). */
function wallPartArea(r, wid, z0, z1) {
  const len = wid === 'back' || wid === 'front' ? r.w : r.l;
  let area = len * (z1 - z0);
  for (const o of r.openings) if (o.wall === wid && o.kind !== 'radiator') {
    const v0 = o.kind === 'door' ? 0 : o.y;
    area -= Math.max(0, Math.min(o.off + o.w, len) - Math.max(o.off, 0)) * Math.max(0, Math.min(v0 + o.h, z1) - Math.max(v0, z0));
  }
  return area;
}
/* Every piece of one moulding the home needs, in metres: four mitred sides per panel frame (outer length) and the rail
   between the windows and doors it meets, the way the 3D draws them. */
function mouldingPieces(rooms, m) {
  const pieces = [];
  for (const r of rooms) for (const wid of WALL_IDS) {
    const cfg = r.walls[wid], len = wid === 'back' || wid === 'front' ? r.w : r.l;
    const blocks = r.openings.filter(o => o.wall === wid).map(o => ({ u0: o.off, u1: o.off + o.w, v0: o.kind === 'door' ? 0 : o.y, v1: (o.kind === 'door' ? 0 : o.y) + o.h }));
    for (const key of cfg.layout === 'split' ? ['lo', 'hi'] : ['lo']) {
      const z = cfg[key];
      if (!z.frames || z.style !== 'mould' || !z.moulding || z.moulding.ref !== m.ref) continue;
      const [v0, v1] = frameSpan(cfg, key, r.h); if (v1 - v0 < 0.15) continue;
      const bl = blocks.filter(o => o.v0 < v1 && o.v1 > v0);
      const cols = (z.panels || autoColumns(len, blocks, v0, v1, z.panelW)).filter(c => c.u + c.w <= len + 0.001 && !bl.some(o => c.u < o.u1 + 0.02 && c.u + c.w > o.u0 - 0.02));
      for (const c of cols) pieces.push(c.w + m.face, c.w + m.face, v1 - v0 + m.face, v1 - v0 + m.face);
    }
    if (cfg.layout === 'split' && cfg.rail && cfg.railStyle === 'straight' && cfg.railM && cfg.railM.ref === m.ref && cfg.split < r.h - 0.03) {
      const y = cfg.split;
      let cur = 0;
      for (const o of blocks.filter(o => o.v0 < y + 0.03 && o.v1 > y - 0.03).sort((a, b) => a.u0 - b.u0)) { if (o.u0 - 0.045 - cur > 0.01) pieces.push(o.u0 - 0.045 - cur); cur = o.u1 + 0.045; }
      if (len - cur > 0.01) pieces.push(len - cur);
    }
  }
  return pieces;
}
/* Strips to buy: longest piece first, each cut from the first strip with room left (5 mm lost a cut).
   A piece longer than a strip takes whole strips joined end to end, then the rest like any other piece. */
function mouldingPlan(rooms, m) {
  const pieces = mouldingPieces(rooms, m).sort((a, b) => b - a), kerf = 0.005, left = [];
  let strips = 0, metres = 0;
  for (let p of pieces) {
    metres += p;
    while (p > m.len + 1e-6) { strips++; p -= m.len; }
    const need = Math.min(p + kerf, m.len), i = left.findIndex(l => l >= need - 1e-6);
    if (i >= 0) left[i] -= need; else { strips++; left.push(m.len - need); }
  }
  const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return { pieces: pieces.length, metres, strips, cost: m.price !== null ? strips * m.price : null,
    text: `${strips} strip${strips === 1 ? '' : 's'} of ${fmt(m.len)} m · ${pieces.length} piece${pieces.length === 1 ? '' : 's'}, ${fmt(metres)} m in all` };
}
/* Litres of a shop's paint across the whole room: wall area (minus windows and doors) × coats ÷ coverage, in whole tins. */
function paintPlan(rooms, paint) {
  let area = 0;
  for (const r of rooms) for (const wid of WALL_IDS) {
    const cfg = r.walls[wid], len = wid === 'back' || wid === 'front' ? r.w : r.l;
    const blocks = r.openings.filter(o => o.wall === wid).map(o => ({ u0: o.off, u1: o.off + o.w, v0: o.kind === 'door' ? 0 : o.y, v1: (o.kind === 'door' ? 0 : o.y) + o.h }));
    const parts = cfg.layout === 'split' ? [['lo', 0, Math.min(cfg.split, r.h)], ['hi', Math.min(cfg.split, r.h), r.h]] : [['lo', 0, r.h]];
    for (const [key, z0, z1] of parts) {
      const z = cfg[key], uses = (f) => f && (f.type === 'image' ? f.base : (f.type === 'paint' || f.type === 'panel') && f.paint) && paintKey(f.type === 'image' ? f.base : f.paint) === paintKey(paint);
      if (uses(z.f)) area += wallPartArea(r, wid, z0, z1);
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
/* Paint on the wall before the paper goes up. Any paint unless a shop's is picked: one coat, 10 m² a litre, 4 L tins.
   Walls papered over the same base paint add up, like any other paint. */
const anyBase = (coats = 1) => cleanPaint({ ref: 'base:any', name: 'Paint under the wallpaper', tinL: 4, coverage: 10, coats });
function baseNote(z) {
  const slot = z.f && z.f.type === 'image' ? 'f' : z.inner && z.inner.type === 'image' && z.frames && z.style !== 'soft' ? 'in' : null;
  if (!slot) return '';
  const f = finOf(z, slot), b = f.base;
  const box = `<label class="check"><input type="checkbox" data-act="fbase" data-slot="${slot}" ${b ? 'checked' : ''}><span>Paint the wall before papering</span></label>`;
  if (!b) return `<div class="finish">${box}</div>`;
  const paints = allProducts().filter(p => p.kind === 'paint' && !(p.paint && p.paint.mix)), plan = paintPlan(studio.home.rooms, b), own = b.ref !== 'base:any';
  return `<div class="finish">${box}
    ${pickField('Paint', 'pickbase', `data-slot="${slot}"`, own && { thumb: `background:${b.color || '#e6e3dc'}`, name: b.name,
      sub: subLine(b.shop, b.code, priceEach(b.price, `a ${b.tinL.toLocaleString()} L tin`)) }, ['Any paint', inShops(paints.length, paints.length === 1 ? 'paint' : 'paints')])}
    ${own && b.url ? `<p class="note">${shopLink(b.url, b.ref, 'See it in the shop ↗')}</p>${linkDisclosure(b.url, b.ref)}` : ''}
    ${numField('Coats', 'fbasecoats', b.coats, `data-slot="${slot}" min="1" max="4" step="1"`, '')}
    <div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}
    <p class="note">Across the whole home, on every wall papered with this base, windows and doors left out. ${own ? 'Coverage and tin size from the shop.' : `Any paint: 10 m² a litre and 4 L tins assumed${paints.length ? '; pick a shop’s paint for its own coverage and price' : ''}.`}</p></div>`;
}
function paperNote(z) {
  const img = [z.f, z.inner].map(f => f && f.type === 'image' && f.img).find(Boolean);
  if (!img) return '';
  const plan = paperPlan(studio.home.rooms, img);
  return `<div class="finish"><div class="fin-h">How much paper</div><div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}<p class="note">Across the whole home. ${img.ref ? 'Roll size from the shop.' : 'For your own image, rolls of 53 cm × 10.05 m are assumed.'}</p></div>`;
}

/* ---------- Flooring from shops ---------- */
/* A shop's flooring as a room keeps it (cleanFlooring), keeping the room's extra for cuts when it swaps one floor for another. */
function shopFlooring(p, prev) {
  const f = p.flooring;
  return cleanFlooring({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, color: p.color, src: f.tile ? '/_blob/' + f.tile : null,
    aspect: f.aspect, width: f.width, pack: f.pack, surface: f.surface, extra: prev ? prev.extra : 10 });
}
/* Every room laid with this flooring: its floor area plus that room's extra for cuts, in whole packs, or in m² to a tenth when it has no pack. */
function floorPlan(rooms, fl) {
  let area = 0, need = 0;
  const extras = new Set();
  for (const r of rooms) if (r.flooring && r.flooring.ref === fl.ref) { const a = r.w * r.l; area += a; need += a * (1 + r.flooring.extra / 100); extras.add(r.flooring.extra); }
  const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }), ex = [...extras];
  const tail = ex.length > 1 ? ' + extra for cuts' : ex[0] ? ` + ${ex[0]}% for cuts` : '';
  if (fl.pack) {
    const packs = area > 0.01 ? Math.ceil(need / fl.pack - 1e-6) : 0;
    return { area, packs, cost: fl.price !== null ? packs * fl.price : null, text: `${packs} pack${packs === 1 ? '' : 's'} of ${fmt(fl.pack)} m² · ${fmt(area)} m² of floor${tail}` };
  }
  const m2 = Math.ceil(need * 10 - 1e-6) / 10;
  return { area, m2, cost: fl.price !== null ? m2 * fl.price : null, text: `${fmt(m2)} m² · ${fmt(area)} m² of floor${tail}` };
}
/* The room's floor: one field that opens the picker (Nido's floors and the shops'), and for a shop's, what the whole home needs. */
function floorNote(r) {
  const fl = r.flooring, many = studio.home.rooms.length > 1;
  const pick = pickField('', 'pickfloor', '', fl ? { thumb: fl.src ? `background-image:url(${blobSrc(fl.src)})` : `background:${fl.color}`,
    name: fl.name, sub: subLine(fl.shop, priceEach(fl.price, fl.pack ? `a pack of ${fl.pack.toLocaleString()} m²` : 'a m²')) }
    : { thumb: `background-image:url(${floorPic(r.floor)})`, name: FLOORS[r.floor][0], sub: 'Nido basics · drawn by Nido, no shop' });
  if (!fl) return pick;
  const plan = floorPlan(studio.home.rooms, fl), link = shopLink(fl.url, fl.ref, 'See it in the shop ↗');
  return `${pick}<div class="finish"><div class="fin-h">How much flooring</div>
    ${link ? `<p class="note">${link}</p>${linkDisclosure(fl.url, fl.ref)}` : ''}
    ${numField('Extra for cuts', 'floorextra', fl.extra, 'min="0" max="50" step="1"', '%')}
    <div>${plan.text}</div>${plan.cost !== null ? `<div class="price">${euro(plan.cost)}</div>` : ''}
    <p class="note">Across the whole home${many ? ', in every room with this floor' : ''}. ${fl.pack ? 'Pack size from the shop.' : 'Sold by the m².'}${SURFACE_LOOK[fl.surface][2] ? ' Laying it diagonally or in herringbone? Add 15% or more.' : ''}</p>
    ${many ? '<button type="button" class="btn small" data-act="floorall">Use this floor in every room</button>' : ''}</div>`;
}
function spreadPanels(wid, count, key, opt) {
  const cfg = studio.room.walls[wid], [v0, v1] = frameSpan(cfg, key, H);
  return autoColumns(wallLen(wid), wallBlocks(wid), v0, v1, cfg[key].panelW, count, opt);
}
/* The panels of one part as the fields show them: how many, how wide and high, how far apart, and the padding before the first. */
function panelNow(wid, key) {
  const z = studio.room.walls[wid][key], cols = z.panels || spreadPanels(wid, undefined, key), [v0, v1] = frameSpan(studio.room.walls[wid], key, H);
  let gap = Infinity;
  for (let i = 1; i < cols.length; i++) gap = Math.min(gap, cols[i].u - cols[i - 1].u - cols[i - 1].w);      // the smallest step: across a window it's wider
  return { n: cols.length, w: cols.length ? cols[0].w : 0, h: v1 - v0, pad: cols.length ? cols[0].u : 0.12, gap: isFinite(gap) ? gap : z.gap ?? 0.1,
    uneven: cols.some(c => Math.abs(c.w - cols[0].w) > 0.005) };
}
/* Lay the panels out again with some values changed and the rest kept. Changing the width keeps the number and the separation
   and moves the padding; changing anything else keeps the other two and the width follows. Returns false if they don't fit. */
function relayPanels(wid, key, o) {
  const z = studio.room.walls[wid][key], cur = panelNow(wid, key), gap = o.gap ?? cur.gap;
  const cols = spreadPanels(wid, o.n ?? cur.n, key, o.w ? { gap, w: o.w } : { pad: o.pad ?? cur.pad, gap });
  if (!cols.length || cols.some(c => c.w < 0.05)) return false;
  z.panels = cols.map(({ u, w }) => ({ u, w })); z.gap = gap;
  return true;
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
    changed(true); resetView(); renderStudio(); return;
  }
  if (act === 'hname' && type === 'change') {          // the home's name (a single room's is its room's, set on its page)
    studio.home.name = t.value.trim().slice(0, 60) || 'Untitled home';
    if (studio.home.rooms.length === 1) studio.home.rooms[0].name = studio.home.name;
    changed(false); renderStudio(); return;
  }
  if (act === 'pickfloor') {             // one of Nido's floors, or a shop's
    pickMaterial({ kind: 'flooring', title: 'Floor', list: [...nidoFloors(), ...allProducts().filter(p => p.kind === 'flooring')], cur: r.flooring ? r.flooring.ref : 'nido:floor:' + r.floor,
      onPick: (p) => { if (p.nido) { r.floor = p.nido; r.flooring = null; } else r.flooring = shopFlooring(p, r.flooring); ctx(r); changed(true); renderPane(); } });
    return;
  }
  if (act === 'floorextra' && type === 'change' && r.flooring) { const v = +t.value; if (v >= 0 && v <= 50) r.flooring.extra = v; changed(true); rerender(); return; }
  if (act === 'floorall' && r.flooring) { for (const x of studio.home.rooms) x.flooring = { ...r.flooring }; changed(true); rerender(); toast('Every room has this floor now.'); return; }
  // the tree: open a line, go back up, add or remove what hangs on a wall
  if (act === 'node') { goNode(t.dataset.v); return; }
  if (act === 'nodeback') { goNode(studio.node && nodeParent(studio.node)); return; }
  if (act === 'framesadd' || act === 'framesdel') {
    const w = t.dataset.wall, key = t.dataset.v, cfg = r.walls[w]; if (!cfg || !cfg[key]) return;
    cfg[key].frames = act === 'framesadd'; changed(true);
    goNode(act === 'framesadd' ? `frames:${w}:${key}` : cfg.layout === 'split' ? `part:${w}:${key}` : 'wall:' + w); return;
  }
  if (act === 'railadd' || act === 'raildel') {
    const w = t.dataset.wall; if (!r.walls[w]) return;
    r.walls[w].rail = act === 'railadd'; changed(true); goNode(act === 'railadd' ? 'rail:' + w : 'wall:' + w); return;
  }
  if (act === 'opadd') {                 // on the wall whose page it was added from; then its own page
    const k = t.dataset.v, wall = WALL_IDS.includes(t.dataset.wall) ? t.dataset.wall : k === 'door' ? 'front' : 'back', len = wall === 'back' || wall === 'front' ? r.w : r.l;
    const d = { window: { w: 1.2, h: 1.3, y: 0.9 }, door: { w: 0.82, h: 2.03, y: 0 }, radiator: { w: 0.8, h: 0.6, y: 0.12 } }[k];
    const o = { id: newId('o'), kind: k, wall, off: Math.max(0, (len - d.w) / 2), ...d };
    r.openings.push(o); changed(true); goNode('op:' + o.id); return;
  }
  if (act === 'opdel') { const o = r.openings.find(x => x.id === t.dataset.id); r.openings = r.openings.filter(x => x !== o); changed(true); goNode(o ? 'wall:' + o.wall : null); return; }
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
  if (act === 'rdup') {                  // same size, walls, windows and furniture; new ids so nothing is shared with the original
    if (studio.home.rooms.length >= 24) { toast('A home can have at most 24 rooms.'); return; }
    const copy = JSON.parse(JSON.stringify(r));
    copy.id = newId('room'); copy.name = copyName(r.name, studio.home.rooms.map(x => x.name));
    for (const o of copy.openings) o.id = newId('o');
    for (const it of copy.items) it.id = newId('i');
    placeCopy(studio.home, r, copy);
    studio.home.rooms.push(copy);
    changed(true); resetView(); focusRoom(copy.id);
    toast(`${copy.name} added. Drag it in Plan view to move it.`); return;
  }
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
  if (act === 'wallzoom') { flyTo(studio.wall); return; }
  if (act === 'wallroom') { setMode('3d'); resetView(true); return; }
  if (act === 'layout') { cfg.layout = t.dataset.v; if (cfg.layout === 'split') studio.part = 'hi'; changed(true); rerender(); return; }
  if (act === 'split' && type === 'change') { const v = +t.value / 100; if (v >= 0.2 && v <= r.h - 0.1) cfg.split = v; changed(true); rerender(); return; }
  if (act === 'railStyle') { cfg.railStyle = t.dataset.v; changed(true); rerender(); return; }
  if (act === 'pickmould') {              // a moulding no longer listed stays until another is picked
    const which = t.dataset.v, was = which === 'pmould' ? z.moulding : cfg.railM;
    pickMaterial({ kind: 'moulding', title: which === 'pmould' ? 'Moulding for the frames' : 'Rail moulding', cur: was && was.ref,
      none: ['Any moulding, not from a shop', 'Nido draws a plain one and leaves it out of the shopping list'],
      onPick: (p) => {
        const m = p ? cleanMoulding({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, ...p.moulding }) : null;
        if (which === 'pmould') z.moulding = m; else cfg.railM = m;
        changed(true); renderPane();
      } });
    return;
  }
  const hexVal = () => (t.dataset.hex ? (parseHex(t.value) || null) : t.tagName === 'INPUT' ? t.value : t.dataset.v);
  if (act === 'trim') { const h = hexVal(); if (!h && t.dataset.hex) return; cfg.trim = h || null; changed(true); if (type !== 'input') rerender(); return; }
  if (act === 'mould') { const h = hexVal(); if (!h && t.dataset.hex && t.value) return; z.mould = h || null; changed(true); if (type !== 'input') rerender(); return; }
  if (act === 'fstyle') { z.style = t.dataset.v; changed(true); rerender(); return; }
  if (['pcount', 'pwidth', 'pgap', 'ppad', 'pheight'].includes(act)) {
    if (type !== 'change') return;
    const v = +t.value, m = v / 100;
    const ok = act === 'pheight' ? (m >= 0.1 && m <= 4 ? ((z.panelH = m), true) : false)
      : act === 'pcount' ? Number.isInteger(v) && v >= 1 && v <= 24 && relayPanels(wid, part, { n: v })
      : act === 'pwidth' ? m >= 0.05 && m <= 4 && relayPanels(wid, part, { w: m })
      : act === 'pgap' ? m >= 0 && m <= 1 && relayPanels(wid, part, { gap: m })
      : m >= 0.03 && m <= 2 && relayPanels(wid, part, { pad: m });
    if (!ok) toast('That doesn’t fit on this wall.');
    else {
      changed(true);
      const now = panelNow(wid, part);
      if (act === 'pwidth' && now.w < m - 0.005) toast(`The widest that fits is ${cm(now.w)} cm.`);
      if (act === 'pheight' && now.h < m - 0.005) toast(`The tallest that fits is ${cm(now.h)} cm.`);
    }
    rerender(); return;
  }
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
  if (act === 'fcolor') {                 // any colour drops a shop's ready-made paint; a mixed one keeps its base and code
    const h = hexVal(); if (!h) return; f.color = h;
    if (f.paint && f.paint.mix) f.paint.color = h; else f.paint = null;
    changed(true); if (type !== 'input') rerender(); return;
  }
  if (act === 'pickpaint') {             // a ready-made colour sets the wall's colour; one mixed in the shop keeps it and asks for the code
    const slot = t.dataset.slot;
    pickMaterial({ kind: 'paint', title: 'Paint', cur: f.paint && f.paint.ref, none: ['Your own colour', 'Not from a shop: type any colour code in the panel'],
      onPick: (p) => {
        if (!p) f.paint = null;
        else if (p.paint.mix) f.paint = cleanPaint({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, ...p.paint, mix: true, color: f.color, code: f.paint && f.paint.mix ? f.paint.code : '' });
        else { f.color = p.color; f.paint = cleanPaint({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, color: p.color, ...p.paint }); }
        changed(true); renderPane();
        if (p && p.paint.mix) { const c = $('pane').querySelector(`[data-act="fcode"][data-slot="${slot}"]`); if (c && !c.value) c.focus(); }
      } });
    return;
  }
  if (act === 'fcode' && type === 'change' && f.paint && f.paint.mix) { f.paint.code = t.value.trim().slice(0, 40); changed(true); rerender(); return; }
  if (act === 'fbase') { f.base = t.checked ? anyBase() : null; changed(true); rerender(); return; }
  if (act === 'pickbase' && f.base) {
    pickMaterial({ kind: 'paint', title: 'Paint under the wallpaper', list: allProducts().filter(p => p.kind === 'paint' && p.paint && !p.paint.mix),
      cur: f.base.ref !== 'base:any' ? f.base.ref : null, none: ['Any paint', '10 m² a litre and 4 L tins assumed'],
      onPick: (p) => { f.base = p ? cleanPaint({ ref: p.ref, name: p.name, shop: p.shop, url: p.url, price: p.price, color: p.color, ...p.paint, coats: f.base.coats }) : anyBase(f.base.coats); changed(true); renderPane(); } });
    return;
  }
  if (act === 'fbasecoats' && type === 'change' && f.base) { const n = parseInt(t.value, 10); if (n >= 1 && n <= 4) f.base.coats = n; changed(true); rerender(); return; }
  if (act === 'fcolor2') { f.color2 = t.value; changed(true); return; }
  if (act === 'fpattern' && type === 'change') { f.pattern = t.value; changed(true); return; }
  if (act === 'fsize' && type === 'change') {
    const v = +t.value, key = f.type === 'pattern' ? 'tile' : f.type === 'panel' ? 'board' : 'imgW';
    if (v >= 3 && v <= 400) f[key] = v; changed(true); rerender(); return;
  }
  if (act === 'pickpaper') {             // the shops' papers, the images you uploaded, or a new upload
    pickMaterial({ kind: 'wallpaper', title: 'Wallpaper', list: [...wallpapers().shopWp, ...myPapers()], cur: f.img && (f.img.ref || 'mine:' + f.img.src),
      onPick: (p) => {
        if (p.mine) { f.img = { ...p.mine }; f.imgW = p.mine.width; } else applyShopPaper(f, p);
        f.type = 'image'; changed(true); renderPane();
      },
      upload: async (file) => {
        toast('Uploading…');
        try {
          const up = await uploadFile(file), aspect = await imageAspect(file);
          f.img = cleanImg({ src: '/_blob/' + up.id, aspect, width: 60, name: file.name.slice(0, 80) }); f.imgW = 60; f.type = 'image';
          $('toast').hidden = true; changed(true); renderPane();
        } catch (er) { toast(uploadError(er)); }
      } });
    return;
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
    const list = allProducts().filter(p => !MATERIALS[p.kind] && (kind === 'all' || p.kind === kind) && (!q || (p.name + ' ' + p.shop).toLowerCase().includes(q)));
    const g = $('pick-grid');
    g.innerHTML = list.map((p, i) => productCard(p, `<button type="button" class="btn small primary" data-add="${esc(p.ref)}">Add</button>`, i)).join('') || '<p class="note">No products match.</p>';
    [...g.querySelectorAll('.card')].forEach((c, i) => { c.querySelector('[data-name]').textContent = list[i].name; c.querySelector('[data-shop]').textContent = list[i].shop; });
    wirePreviews(g, list);
    gridDisclosure(g, list);
    for (const b of $('dlg-box').querySelectorAll('[data-pk]')) b.setAttribute('aria-pressed', b.dataset.pk === kind);
  };
  const box = openDialog(`<div class="dlg-top"><div class="dlg-h"><h2 id="dlg-title">Add furniture</h2><button type="button" class="btn small" data-close>Done</button></div>
    <label class="in" for="pick-q"><input id="pick-q" type="search" placeholder="Search products or shops" aria-label="Search products or shops"></label>
    <div class="chips">${[['all', 'Everything'], ...Object.entries(KINDS).filter(([k]) => k !== 'box')].map(([k, n]) => `<button type="button" class="chip" data-pk="${k}" aria-pressed="${k === 'all'}">${esc(n)}</button>`).join('')}</div></div>
    <div class="grid" id="pick-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))"></div>`,
  (e) => {
    const k = e.target.closest('[data-pk]'); if (k) { kind = k.dataset.pk; draw(); return; }
    const a = e.target.closest('[data-add]'); if (a) { addProduct(a.dataset.add); toast('Added to the room. Drag it into place.'); }
  }, null, { full: true });
  box.oninput = (e) => { if (e.target.id === 'pick-q') { q = e.target.value.trim().toLowerCase(); draw(); } };
  $('dlg-box').style.width = 'min(860px, 100%)';
  draw();
}

/* ---------- Picking a material: flooring, paint, wallpaper, moulding ---------- */
/* What tells one material's products apart, for the dialog's one row of filters (shown when there are two kinds or more). */
const MATERIAL_FACETS = {
  flooring: (p) => [p.flooring.surface, FLOOR_SURFACES[p.flooring.surface]],
  paint: (p) => (p.paint.mix ? ['mix', 'Mixed in the shop'] : ['ready', 'Ready-made colours']),
  wallpaper: (p) => (p.mine ? ['mine', 'Your images'] : p.wallpaper.mural ? ['mural', 'Murals'] : ['roll', 'By the roll']),
  moulding: (p) => [p.moulding.shape, MOULD_SHAPES[p.moulding.shape]],
};
/* Choices that aren't a shop's, in the same pickers as the shops' products: the floors Nido draws, and the wallpaper images
   you uploaded. (Paint has no such list: until a paint shop is in Nido, the provisional Nido Paint brand stands in.) */
const floorPics = new Map();
function floorPic(k) {                    // a small picture of a built-in floor, cut from the texture the 3D uses
  if (!floorPics.has(k)) {
    const c = document.createElement('canvas'); c.width = c.height = 192;
    c.getContext('2d').drawImage(floorTexture(k).image, 0, 0, 1024, 1024, 0, 0, 192, 192);
    floorPics.set(k, c.toDataURL('image/jpeg', 0.82));
  }
  return floorPics.get(k);
}
const nidoFloors = () => Object.entries(FLOORS).map(([k, [name]]) => ({ ref: 'nido:floor:' + k, kind: 'flooring', nido: k, name, shop: 'Nido basics', color: '#c8b49a', price: null, url: null,
  flooring: { pic: floorPic(k), surface: k === 'tile' ? 'tile' : k === 'carpet' ? 'carpet' : 'wood' } }));
const myPapers = () => wallpapers().mine.map(m => ({ ref: 'mine:' + m.src, kind: 'wallpaper', mine: m, name: m.name, shop: 'Your image', price: null, url: null,
  wallpaper: { tile: m.src.slice(7), mural: m.mural, width: m.width } }));
/* The shops' products of one material as option cards: search, filters, tap one to choose it. Full screen on phones.
   o: { kind, title, cur: the chosen ref, list: the products (default: all of that kind), none: [label, note] for "not from a shop",
   upload(file): offers a card to upload your own, onPick(product, or null for none) } */
function pickMaterial(o) {
  const all = (o.list || allProducts().filter(p => p.kind === o.kind)).filter(p => p[o.kind]);
  const facets = new Map(all.map(MATERIAL_FACETS[o.kind])), fromShops = all.some(p => p.ref.startsWith('shop:'));
  let facet = 'all', q = '';
  const draw = () => {
    const list = all.filter(p => (facet === 'all' || MATERIAL_FACETS[o.kind](p)[0] === facet)
      && (!q || [p.name, p.shop, p.material, p.paint && p.paint.code].join(' ').toLowerCase().includes(q)));
    const extra = (on, inner, label, note, attrs) => `<button type="button" class="opt" ${attrs} aria-pressed="${on}"><span class="pic"><span class="plan" aria-hidden="true">${inner}</span>${on ? '<span class="pill live on">✓ Chosen</span>' : ''}</span>
      <span class="body"><span class="t">${esc(label)}</span><span class="meta">${esc(note)}</span></span></button>`;
    const up = o.upload && (facet === 'all' || facet === 'mine') && !q ? extra(false, '+', 'Upload a photo of a sample', 'One repeat, cut so it tiles, or a whole mural', 'data-upload') : '';
    const none = o.none && facet === 'all' && !q ? extra(!o.cur, '—', o.none[0], o.none[1], 'data-pick=""') : '';
    const g = $('pick-grid');
    g.innerHTML = up + none + list.map(p => { const on = p.ref === o.cur; return `<button type="button" class="opt" data-pick="${esc(p.ref)}" aria-pressed="${on}"><span class="pic">${productPic(p)}${on ? '<span class="pill live on">✓ Chosen</span>' : ''}</span>
      <span class="body"><span class="t" data-name></span><span class="meta" data-shop></span><span class="meta"><span class="num">${productDims(p)}</span>${productPrice(p)}</span></span></button>`; }).join('')
      + (!list.length && (facet !== 'all' || q) ? '<p class="note" style="grid-column:1/-1">Nothing matches. Try another word or filter.</p>' : '')
      + (!fromShops && facet === 'all' && !q ? `<p class="note" style="grid-column:1/-1">No shop has listed ${MATERIALS[o.kind].toLowerCase()} yet. Shops can list theirs under For shops.</p>` : '');
    [...g.querySelectorAll('[data-name]')].forEach((el, i) => { el.textContent = list[i].name; });
    [...g.querySelectorAll('[data-shop]')].forEach((el, i) => { el.textContent = list[i].shop; });
    for (const b of $('dlg-box').querySelectorAll('[data-facet]')) b.setAttribute('aria-pressed', b.dataset.facet === facet);
  };
  const box = openDialog(`<div class="dlg-top"><div class="dlg-h"><h2 id="dlg-title">${esc(o.title)}</h2><button type="button" class="btn small" data-close>Close</button></div>
    <label class="in" for="pick-q"><input id="pick-q" type="search" placeholder="Search by name or shop${o.kind === 'paint' ? ', or a colour code' : ''}" aria-label="Search ${esc(o.title.toLowerCase())}"></label>
    ${facets.size > 1 ? `<div class="chips">${[['all', 'All'], ...facets].map(([k, n]) => `<button type="button" class="chip" data-facet="${esc(k)}" aria-pressed="${k === 'all'}">${esc(n)}</button>`).join('')}</div>` : ''}</div>
    <div class="opts" id="pick-grid"></div>${o.upload ? '<input type="file" id="pick-up" class="vh" accept="image/*">' : ''}`,
  (e) => {
    const c = e.target.closest('[data-facet]'); if (c) { facet = c.dataset.facet; draw(); return; }
    if (e.target.closest('[data-upload]')) { $('pick-up').click(); return; }
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const p = b.dataset.pick ? all.find(x => x.ref === b.dataset.pick) : null;
    if (b.dataset.pick && !p) return;
    closeDialog(); o.onPick(p);
  }, null, { full: true });
  box.oninput = (e) => { if (e.target.id === 'pick-q') { q = e.target.value.trim().toLowerCase(); draw(); } };
  box.onchange = (e) => { if (e.target.id === 'pick-up' && e.target.files[0]) { const file = e.target.files[0]; closeDialog(); o.upload(file); } };
  box.style.width = 'min(860px, 100%)';
  draw();
}
/* In a pane: the chosen material as one field (its picture, name, shop and price) that opens the picker.
   cur: { thumb: the thumb's style, html: inside it, name, sub } (names are untrusted: set as text), or null and empty: [line, small line]. */
function pickField(label, act, attrs, cur, empty) {
  return `<div class="field">${label ? `<span>${label}</span>` : ''}<button type="button" class="pickf" data-act="${act}" ${attrs} aria-haspopup="dialog">
    <span class="thumb" style="${cur && cur.thumb || ''}">${cur && cur.html || ''}</span>
    <span class="tx">${cur ? `<b data-fill="${fills.push(cur.name) - 1}"></b><small data-fill="${fills.push(cur.sub) - 1}"></small>` : `<b>${esc(empty[0])}</b><small>${esc(empty[1])}</small>`}</span>
    <svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div>`;
}
const MIX_SWATCH = 'background:linear-gradient(90deg,#ece6d8 0 20%,#c9d6cf 20% 40%,#e3b9a8 40% 60%,#b4c3d3 60% 80%,#efe0b0 80%)';
const subLine = (...parts) => parts.filter(Boolean).join(' · ');
const priceEach = (price, per) => (price !== null && price !== undefined ? `${euro(price)} ${per}` : '');
const inShops = (n, what) => `${n} ${what} in the shops`;
function addProduct(ref) {
  if (!studio || studio.mode !== 'edit') return;
  const p = allProducts().find(x => x.ref === ref); if (!p) return;
  if (!studio.room) { toast('Pick a room first, then add furniture to it.'); return; }
  const r = studio.room, it = { id: newId('i'), x: 0, z: 0, rot: 0, p: cleanProduct(p) };
  ctx(r);
  const c = freeSpot(r, it); it.x = c.x; it.z = c.z;
  r.items.push(it);
  syncItems(); selectItem(it.id); changed(false);
  if (studio.tab === 'room') renderPane();
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
/* ---------- Measure and Paint (the tool switch beside the view) ---------- */
engineHooks.onToolTap = (t, hit) => {
  if (!studio) return;
  if (t === 'measure') {
    if (!hit) return;
    if (studio.measure.length >= 2) studio.measure = [];          // a third tap starts a new measurement
    studio.measure.push({ point: hit.point, normal: hit.normal, name: faceName(hit) });
    const [a, b] = studio.measure;
    if (!b) drawMeasure([a.point], null, '');
    else { const m = measureBetween(a, b); drawMeasure([a.point, b.point], [m.from, m.to], `${cm(m.d)} cm`); }
    renderProps(); return;
  }
  if (t === 'paint') {
    const s = hit && surfaceOf(hit);
    if (!s) { toast('Tap a wall or a piece of furniture.'); return; }
    const P = studio.paint, i = P.surfaces.findIndex(x => sameSurface(x, s));
    if (i >= 0) P.surfaces.splice(i, 1); else P.surfaces.push(s);
    renderProps();
  }
};
function faceName(hit) {
  if (hit.item) { const f = findItem(hit.item); return f ? f.it.p.name : 'Furniture'; }
  if (hit.wall) return WALL_NAMES[hit.wall];
  return hit.floor ? 'Floor' : 'Surface';
}
/* What a paint tap chose: a whole wall, or the part tapped when the wall is split, or a piece of furniture. */
function surfaceOf(hit) {
  if (hit.item) return { item: hit.item };
  if (!hit.wall) return null;
  const r = roomById(hit.room), cfg = r && r.walls[hit.wall]; if (!cfg) return null;
  return { room: r.id, wid: hit.wall, part: cfg.layout !== 'split' ? 'all' : hit.point.y < Math.min(cfg.split, r.h) ? 'lo' : 'hi' };
}
const sameSurface = (a, b) => a.item ? a.item === b.item : a.room === b.room && a.wid === b.wid && a.part === b.part;
/* Name, room and area of a chosen surface as the home is now; null when it has been removed. */
function surfaceInfo(s) {
  if (s.item) { const f = findItem(s.item); return f && { name: f.it.p.name, where: f.r.name, area: furnitureArea(f.it, f.r), mark: { r: f.r, it: f.it } }; }
  const r = roomById(s.room); if (!r) return null;
  const cfg = r.walls[s.wid], sp = Math.min(cfg.split, r.h), part = cfg.layout === 'split' ? s.part : 'all';
  const [z0, z1] = part === 'lo' ? [0, sp] : part === 'hi' ? [sp, r.h] : [0, r.h];
  return { name: WALL_NAMES[s.wid] + (part === 'hi' ? ', top part' : part === 'lo' ? ', bottom part' : ''), where: r.name, area: wallPartArea(r, s.wid, z0, z1), mark: { r, wid: s.wid, z0, z1 } };
}
/* How much of a piece of furniture you'd paint, in m². The model is the piece's box: p.w and p.d across, p.h high, in metres.
   TODO: this counts the top and all four sides. A back pushed against a wall never gets painted, and open shelves have
   insides that do. Decide which faces count: check whether the piece touches a wall (fp(it) gives its footprint after
   rotation, room.w and room.l the room; it.x and it.z are its centre), and whether p.kind (for example 'shelf') adds more. */
function furnitureArea(it, room) {
  const { w, d, h } = it.p;
  return w * d + 2 * (w + d) * h;
}
/* The surfaces chosen with Paint that still exist, their area in m², the litres for the coats asked and the tins to buy. */
function paintSums() {
  const P = studio.paint, rows = P.surfaces.map(s => ({ s, i: surfaceInfo(s) })).filter(x => x.i);
  const area = rows.reduce((t, x) => t + x.i.area, 0), litres = area * P.coats / P.coverage;
  return { rows, area, litres, tins: area > 0.01 ? Math.ceil(litres / P.tinL - 1e-6) : 0 };
}
function toolPanel(el) {
  const P = studio.paint, head = (t) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><h3>${t}</h3><button type="button" class="btn small" data-tl="close" aria-label="Back to Select">×</button></div>`;
  const names = [];        // untrusted names (furniture, rooms), set as text below
  const fill = (t) => `data-tf="${names.push(t) - 1}"`;
  if (tool === 'measure') {
    const [a, b] = studio.measure, m = b && measureBetween(a, b);
    el.innerHTML = head('Measure') + (!a ? '<p class="note">Tap a face: a wall, the side of a piece of furniture, the floor. Then tap a second face.</p>'
      : `${m ? `<div class="measure">${cm(m.d)} cm</div>` : ''}<dl class="kv"><dt>From</dt><dd ${fill(a.name)}></dd>${b ? `<dt>To</dt><dd ${fill(b.name)}></dd>` : ''}</dl>
        <p class="note">${!b ? 'Now tap the second face.' : m.along ? 'Both points are on the same face, so this is the straight line between them.' : 'Measured straight out from the first face, so for two faces that look at each other it doesn’t matter where on the second you tap.'}</p>
        ${b ? '<p class="note">Tap again to start a new measurement.</p>' : ''}`);
  } else {
    const { rows, area, litres, tins } = paintSums();
    P.surfaces = rows.map(x => x.s);
    markSurfaces(rows.map(x => x.i.mark));
    const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
    const field = (label, k, v, attrs, unit) => `<label class="field"><span>${label}</span><span class="in"><input type="number" inputmode="decimal" data-tl="${k}" value="${v}" ${attrs}><span class="u">${unit}</span></span></label>`;
    el.innerHTML = head('Paint') + (!rows.length ? '<p class="note">Tap walls or furniture to add them. Tap one again to take it off.</p>'
      : `<div class="list">${rows.map((x, n) => `<div class="surf"><span class="tx"><b ${fill(x.i.name)}></b><small ${fill(x.i.where)}></small></span><span class="num">${fmt(x.i.area)} m²</span><button type="button" class="btn small" data-tl="off" data-n="${n}" aria-label="Take off">×</button></div>`).join('')}</div>`)
      + `<div class="fields two">${field('Coats', 'coats', P.coats, 'min="1" max="4" step="1"', '')}${field('Covers', 'coverage', P.coverage, 'min="2" max="25" step="0.5"', 'm²/L')}${field('Tin size', 'tinL', P.tinL, 'min="0.1" max="30" step="0.25"', 'L')}</div>`
      + (rows.length ? `<div class="total"><span>${tins} tin${tins === 1 ? '' : 's'} of ${fmt(P.tinL)} L</span><span class="num">${fmt(litres)} L</span></div>
        <p class="note">${fmt(area)} m² × ${P.coats} coat${P.coats === 1 ? '' : 's'} ÷ ${fmt(P.coverage)} m²/L. Windows and doors left out. The tin says how much it covers: wall paint is often 10–12 m²/L, furniture paint more.</p>` : '');
  }
  for (const n of el.querySelectorAll('[data-tf]')) n.textContent = names[+n.dataset.tf] || '';
}
function toolEvent(e) {
  const t = e.target.closest('[data-tl]'); if (!t) return;
  const k = t.dataset.tl, P = studio.paint;
  if (e.type === 'click' && k === 'close') { useTool('select'); return; }
  if (e.type === 'click' && k === 'off') { P.surfaces.splice(+t.dataset.n, 1); renderProps(); return; }
  if (e.type === 'change' && (k === 'coats' || k === 'coverage' || k === 'tinL')) {
    const lim = { coats: [1, 4, 2], coverage: [2, 25, 10], tinL: [0.1, 30, 4] }[k];
    P[k] = clamp(+t.value || lim[2], lim[0], lim[1]); if (k === 'coats') P.coats = Math.round(P.coats);
    setTimeout(() => {                  // after focus has moved on (change fires first): redraw, and keep the cursor where Tab took it
      const a = document.activeElement, nk = a && $('props').contains(a) && a.dataset.tl;
      renderProps();
      if (nk) $('props').querySelector(`[data-tl="${nk}"]`)?.focus();
    }, 0);
  }
}
/* The piece's or the tool's panel, then where it shows: on phones it takes the sheet's place, and the sheet's line follows it. */
function renderProps() {
  drawProps();
  side.classList.toggle('with-props', !$('props').hidden && $('props').parentNode === side);
  renderPeek();
}
function drawProps() {
  const el = $('props'), toolOn = !!studio && tool !== 'select';
  el.classList.toggle('tool', toolOn);
  if (toolOn) { el.hidden = false; toolPanel(el); return; }
  const found = studio && selId && findItem(selId), it = found && found.it;
  if (!it) { el.hidden = true; return; }
  const edit = studio.mode === 'edit', p = it.p, canSize = edit && p.editable;
  el.hidden = false;
  el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><h3 id="pr-name"></h3><button type="button" class="btn small" data-pr="close" aria-label="Close">×</button></div>
    ${p.photo ? `<img alt="" src="${assetSrc(p.photo)}" style="border-radius:10px;aspect-ratio:4/3;object-fit:cover;width:100%;background:var(--surface-2)" onerror="this.remove()">` : ''}
    ${p.ref.startsWith('shop:') && (allProducts().find(x => x.ref === p.ref) || {}).curated ? '<p class="note">Copied from the shop’s website by Nido. Check the link for today’s price.</p>' : ''}
    <dl class="kv"><dt>Shop</dt><dd id="pr-shop"></dd><dt>Size</dt><dd class="num">${cm(p.w)} × ${cm(p.d)} × ${cm(p.h)} cm</dd>${p.price !== null ? `<dt>Price</dt><dd class="price">${euro(p.price)}</dd>` : ''}</dl>
    ${shopLink(p.url, p.ref, "See it in the shop ↗", " class=\"btn small\"", "")}${linkDisclosure(p.url, p.ref)}
    ${canSize ? `<div class="fields">${numField('Width', 'pw', cm(p.w), 'data-k="w" min="5" max="800"')}${numField('Depth', 'pw', cm(p.d), 'data-k="d" min="5" max="800"')}${numField('Height', 'pw', cm(p.h), 'data-k="h" min="1" max="400"')}</div>
      <div class="swatches">${PRESETS.map(([n, c]) => `<button type="button" class="dot" data-pr="color" data-v="${c}" title="${n}" aria-label="${n}" aria-pressed="${p.color === c}" style="background:${c}"></button>`).join('')}<label class="in" style="width:44px"><input type="color" data-pr="colorpick" value="${p.color}" aria-label="Any colour" style="height:26px;padding:2px;border:0"></label></div>` : ''}
    ${edit ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn small" data-pr="rot">Rotate 90°</button><button type="button" class="btn small" data-pr="dup">Duplicate</button><button type="button" class="btn small danger" data-pr="del">Remove</button></div>` : ''}`;
  $('pr-name').textContent = p.name; $('pr-shop').textContent = p.shop || '—';
}
async function propsEvent(e) {
  if (studio && tool !== 'select') { toolEvent(e); return; }
  const t = e.target.closest('[data-pr], [data-act="pw"]'); if (!t || !studio) return;
  const found = findItem(selId); if (!found) return;
  const it = found.it, room = found.r; ctx(room);
  const k = t.dataset.pr;
  if (e.type === 'click') {
    if (k === 'close') { selectItem(null); return; }
    if (k === 'rot') { it.rot = (it.rot + 1) % 4; const c = clampItem(room, it); it.x = c.x; it.z = c.z; placeItem(it); showSelection(); changed(false); return; }
    if (k === 'dup') { const c2 = JSON.parse(JSON.stringify(it)); c2.id = newId('i'); c2.x += 0.3; c2.z += 0.3; const c = clampItem(room, c2); c2.x = c.x; c2.z = c.z; room.items.push(c2); syncItems(); selectItem(c2.id); changed(false); return; }
    if (k === 'del') { room.items = room.items.filter(i => i !== it); syncItems(); selectItem(null); changed(false); renderPane(); return; }
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
  if (studio && tool !== 'select' && e.key === 'Escape' && $('dlg').hidden) { useTool('select'); return; }
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
