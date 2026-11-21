/* =====================================================================
   Nido data: room model, templates, the starter catalogue and the shared store.
   Shared store layout (db):
     homes/<person>                 { rooms: [summary…] }            published homes, one list per person
     homes/<person>/rooms/<home>    full home (one or more rooms)     readable by everyone
     shops/<person>                 { name, url, about, logo, products: […] }
     data/users/<person>/<room>     drafts, private to that person
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cm = (m) => Math.round(m * 100);
const newId = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const HEX = /^#[0-9a-f]{6}$/i, ASSET = /^[0-9a-f]{32}$/, BLOB = /^\/_blob\/[0-9a-f]{32}$/;
const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : d);
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u.slice(0, 300) : null);
const euro = (v) => v.toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const PRESETS = [['White', '#f6f5f1'], ['Marfil', '#eee2d3'], ['Sand', '#e2d1b9'], ['Rosa arcilla', '#d9a195'], ['Terracota', '#c8705d'],
  ['Azul grisáceo', '#9aaeb6'], ['Topo rosado', '#b5968d'], ['Sage', '#bac7b1'], ['Butter', '#f2e3b3'], ['Charcoal', '#4a4d4b']];
const FIN_TYPES = [['paint', 'Paint'], ['pattern', 'Pattern'], ['panel', 'Panelling'], ['image', 'Wallpaper']];
const PATTERNS = { stars: 'Stars', dots: 'Dots', stripes: 'Stripes', gingham: 'Gingham', waves: 'Waves' };
const RAIL_STYLES = [['straight', 'Straight'], ['scallop', 'Scallops'], ['scallop-down', 'Scallop border'], ['wave', 'Wave']];
const FRAME_STYLES = [['mould', 'Frames'], ['arch', 'Arches'], ['soft', 'Padded'], ['tops', 'Painted']];

/* ---------- Wall finishes ---------- */
function defaultFinish(over) {
  return { type: 'paint', color: '#f6f5f1', color2: '#d9a195', pattern: 'stars', tile: 30, board: 12, imgW: 60, img: null, paint: null, ...over };
}
/* A shop's paint chosen for a wall: enough to work out litres and tins. */
function cleanPaint(m) {
  if (!m || typeof m !== 'object' || typeof m.ref !== 'string' || !m.ref) return null;
  return { ref: str(m.ref, 140), name: str(m.name, 80, 'Paint'), shop: str(m.shop, 60), url: safeUrl(m.url), price: num(m.price, 0, 100000, null),
    color: HEX.test(m.color || '') ? m.color : null, code: str(m.code, 40), tinL: num(m.tinL, 0.1, 30, 4), coverage: num(m.coverage, 2, 25, 10), coats: num(m.coats, 1, 4, 2) };
}
const defaultZone = (over) => ({ f: defaultFinish(), frames: false, style: 'mould', inner: null, mould: null, panelW: 0.7, panels: null, ...over });
const defaultWall = () => ({ layout: 'whole', split: 1.0, rail: true, trim: null, railStyle: 'straight', railSize: 0.09, lo: defaultZone(), hi: defaultZone() });
function cleanImg(m) {
  if (!m || typeof m !== 'object' || !BLOB.test(m.src || '')) return null;
  return { src: m.src, aspect: num(m.aspect, 0.05, 20, 1), width: num(m.width, 5, 400, 60), mural: !!m.mural, name: str(m.name, 120, 'Wallpaper'),
    ref: str(m.ref, 120), shop: str(m.shop, 60), url: safeUrl(m.url), price: num(m.price, 0, 100000, null), unit: m.unit === 'm2' ? 'm2' : 'roll',
    rollW: num(m.rollW, 10, 300, 53), rollL: num(m.rollL, 50, 5000, 1005) };
}
function cleanFinish(src, def) {
  const f = { ...def };
  if (!src || typeof src !== 'object') return f;
  if (FIN_TYPES.some(([t]) => t === src.type)) f.type = src.type;
  for (const k of ['color', 'color2']) if (HEX.test(src[k] || '')) f[k] = src[k];
  if (PATTERNS[src.pattern]) f.pattern = src.pattern;
  f.tile = num(src.tile, 5, 300, f.tile); f.board = num(src.board, 3, 60, f.board); f.imgW = num(src.imgW, 5, 400, f.imgW);
  f.img = cleanImg(src.img);
  f.paint = f.type === 'paint' || f.type === 'panel' ? cleanPaint(src.paint) : null;
  if (f.type === 'image' && !f.img) f.type = 'paint';
  return f;
}
const cleanPanels = (ps) => (Array.isArray(ps) ? ps.filter(q => q && typeof q.u === 'number' && typeof q.w === 'number' && q.w > 0.05 && q.u >= 0).slice(0, 24).map(q => ({ u: q.u, w: q.w })) : null);
function cleanZone(z, def) {
  z = z && typeof z === 'object' ? z : {};
  return { f: cleanFinish(z.f, def.f), frames: !!z.frames, style: FRAME_STYLES.some(([k]) => k === z.style) ? z.style : 'mould',
    inner: z.inner ? cleanFinish(z.inner, defaultFinish()) : null, mould: HEX.test(z.mould || '') ? z.mould : null,
    panelW: num(z.panelW, 0.3, 2, 0.7), panels: cleanPanels(z.panels) };
}
function cleanWall(w) {
  const d = defaultWall(); w = w && typeof w === 'object' ? w : {};
  return { layout: w.layout === 'split' ? 'split' : 'whole', split: num(w.split, 0.2, 3, d.split), rail: w.rail !== false,
    trim: HEX.test(w.trim || '') ? w.trim : null, railStyle: RAIL_STYLES.some(([k]) => k === w.railStyle) ? w.railStyle : 'straight',
    railSize: num(w.railSize, 0.04, 0.3, 0.09), lo: cleanZone(w.lo, d.lo), hi: cleanZone(w.hi, d.hi) };
}

/* ---------- Products ---------- */
function cleanProduct(p) {
  p = p && typeof p === 'object' ? p : {};
  const kind = KINDS[p.kind] || p.kind === 'wallpaper' || p.kind === 'paint' ? p.kind : 'box';
  return { kind, name: str(p.name, 80, 'Item'), w: num(p.w, 0.05, 8, 0.6), d: num(p.d, 0.05, 8, 0.6), h: num(p.h, 0.004, 4, 0.6),
    color: HEX.test(p.color || '') ? p.color : '#d4dad5', photo: ASSET.test(p.photo || '') ? p.photo : null, model: ASSET.test(p.model || '') ? p.model : null,
    price: num(p.price, 0, 1000000, null), url: safeUrl(p.url), shop: str(p.shop, 60), shopId: str(p.shopId, 80), ref: str(p.ref, 140),
    editable: !!p.editable };
}
function cleanShopProduct(p) {
  const base = cleanProduct(p);
  base.id = /^[\w-]{1,40}$/.test(p && p.id || '') ? p.id : newId('p');
  if (base.kind === 'wallpaper') {
    const wp = (p && p.wallpaper) || {};
    base.wallpaper = { tile: ASSET.test(wp.tile || '') ? wp.tile : null, width: num(wp.width, 5, 400, 50), aspect: num(wp.aspect, 0.05, 20, 1),
      mural: !!wp.mural, rollW: num(wp.rollW, 10, 300, 53), rollL: num(wp.rollL, 50, 5000, 1005), unit: wp.unit === 'm2' ? 'm2' : 'roll' };
  }
  if (base.kind === 'paint') {
    const pt = (p && p.paint) || {};
    base.paint = { code: str(pt.code, 40), finish: str(pt.finish, 30), tinL: num(pt.tinL, 0.1, 30, 4), coverage: num(pt.coverage, 2, 25, 10), coats: num(pt.coats, 1, 4, 2) };
  }
  base.about = str(p && p.about, 300);
  return base;
}
function cleanShop(s, id) {
  s = s && typeof s === 'object' ? s : {};
  return { id, name: str(s.name, 60, 'Shop'), url: safeUrl(s.url), about: str(s.about, 400), logo: ASSET.test(s.logo || '') ? s.logo : null, curated: !!s.curated,
    products: Array.isArray(s.products) ? s.products.slice(0, 400).map(cleanShopProduct) : [], updatedAt: num(s.updatedAt, 0, 1e14, 0) };
}

/* Starter furniture anyone can place: generic pieces, sizes editable. */
const BASICS = [
  ['sofa3', 'sofa', 'Three-seat sofa', 2.1, 0.95, 0.85, '#d9d0c2'], ['armchair', 'sofa', 'Armchair', 0.85, 0.85, 0.85, '#cfc6b8'],
  ['bed160', 'bed', 'Double bed 160 × 200', 1.68, 2.1, 0.95, '#e5ded3'], ['bed90', 'bed', 'Single bed 90 × 190', 0.98, 2.0, 0.9, '#e5ded3'],
  ['cot', 'cot', 'Cot 60 × 120', 1.26, 0.74, 0.87, '#e6c398'], ['wardrobe', 'wardrobe', 'Wardrobe', 1.5, 0.6, 2.0, '#f3f2ed'],
  ['dresser', 'dresser', 'Chest of drawers', 0.96, 0.5, 0.9, '#c29a6f'], ['night', 'dresser', 'Bedside table', 0.45, 0.4, 0.5, '#c29a6f'],
  ['bookcase', 'bookcase', 'Bookcase', 0.8, 0.3, 1.8, '#f3f2ed'], ['desk', 'table', 'Desk', 1.2, 0.6, 0.75, '#c29a6f'],
  ['dining', 'table', 'Dining table', 1.6, 0.9, 0.75, '#c29a6f'], ['chair', 'chair', 'Chair', 0.45, 0.5, 0.85, '#c29a6f'],
  ['lamp', 'lamp', 'Paper floor lamp', 0.26, 0.26, 1.4, '#f6f2ea'], ['rug', 'rug', 'Rug 120 × 170', 1.2, 1.7, 0.01, '#d9a195'],
  ['rugbig', 'rug', 'Rug 200 × 300', 2.0, 3.0, 0.01, '#cbbfae'], ['plant', 'plant', 'Plant in a pot', 0.45, 0.45, 1.1, '#7d9a6a'],
  ['box', 'box', 'Box, any size', 0.6, 0.6, 0.6, '#d4dad5'],
].map(([id, kind, name, w, d, h, color]) => ({ id, ref: 'basic:' + id, kind, name, w, d, h, color, price: null, url: null, shop: 'Nido basics', shopId: '', photo: null, model: null, editable: true }));

/* ---------- Rooms ---------- */
const OP_KINDS = { window: 'Window', door: 'Door', radiator: 'Radiator' };
function cleanRoom(src) {
  src = src && typeof src === 'object' ? src : {};
  const r = { id: /^[\w-]{1,40}$/.test(src.id || '') ? src.id : newId('room'), x: num(src.x, -80, 80, 0), z: num(src.z, -80, 80, 0), name: str(src.name, 60, 'Untitled room'), notes: str(src.notes, 600), w: num(src.w, 1, 15, 3.5), l: num(src.l, 1, 15, 4), h: num(src.h, 2, 5, 2.5),
    floor: FLOORS[src.floor] ? src.floor : 'oak', evening: !!src.evening, openings: [], walls: {}, items: [],
    updatedAt: num(src.updatedAt, 0, 1e14, 0), published: !!src.published, cover: ASSET.test(src.cover || '') ? src.cover : null,
    from: src.from && typeof src.from === 'object' ? { owner: str(src.from.owner, 80), id: str(src.from.id, 60), name: str(src.from.name, 60) } : null };
  for (const o of Array.isArray(src.openings) ? src.openings.slice(0, 30) : []) {
    if (!o || !OP_KINDS[o.kind] || !WALL_IDS.includes(o.wall)) continue;
    const len = o.wall === 'back' || o.wall === 'front' ? r.w : r.l;
    const w = num(o.w, 0.2, len, 0.9), h = num(o.h, 0.1, r.h, o.kind === 'door' ? 2.03 : 1.2);
    r.openings.push({ id: str(o.id, 40) || newId('o'), kind: o.kind, wall: o.wall, off: Math.min(num(o.off, 0, len, 0.3), Math.max(0, len - w)), w, h,
      y: o.kind === 'door' ? 0 : Math.min(num(o.y, 0, r.h, 0.9), Math.max(0, r.h - h)) });
  }
  for (const wid of WALL_IDS) r.walls[wid] = cleanWall(src.walls && src.walls[wid]);
  for (const it of Array.isArray(src.items) ? src.items.slice(0, 200) : []) {
    if (!it || typeof it !== 'object') continue;
    const p = cleanProduct(it.p);
    if (p.kind === 'wallpaper' || p.kind === 'paint') continue;
    r.items.push({ id: str(it.id, 40) || newId('i'), x: num(it.x, -10, 10, 0), z: num(it.z, -10, 10, 0), rot: [0, 1, 2, 3].includes(it.rot) ? it.rot : 0, p });
  }
  return r;
}
const basic = (id, over = {}) => ({ ...BASICS.find(b => b.id === id), ...over });
const item = (id, x, z, rot = 0, over) => ({ id: newId('i'), x, z, rot, p: basic(id, over) });
/* Starting points. The nursery is laid out like a real 300 × 380 cm room. */
const TEMPLATES = {
  empty: { name: 'Empty room', note: 'Four walls, a window and a door', make: (w, l, h) => ({ w, l, h,
    openings: [{ kind: 'window', wall: 'back', off: Math.max(0, w / 2 - 0.6), w: Math.min(1.2, w - 0.4), h: 1.3, y: 0.9 }, { kind: 'door', wall: 'front', off: Math.max(0, w - 1.2), w: 0.82, h: 2.03 }], items: [] }) },
  nursery: { name: 'Nursery', note: 'Cot, wardrobe, chest, sofa bed, floor lamp', size: [3.0, 3.8, 2.65], make: (w, l, h) => ({ w, l, h,
    openings: [{ kind: 'window', wall: 'back', off: 0.21, w: 1.14, h: 1.65, y: 0.93 }, { kind: 'radiator', wall: 'back', off: 0.43, w: 0.77, h: 0.6, y: 0.12 },
      { kind: 'door', wall: 'front', off: 0.85, w: 0.82, h: 2.03 }],
    walls: { right: { layout: 'split', split: 0.9, rail: true, trim: '#eee2d3', lo: { f: { color: '#eee2d3' }, frames: true }, hi: { f: { color: '#eee2d3' }, frames: true } } },
    items: [item('wardrobe', w / 2 - 0.75, l / 2 - 0.3, 2), item('sofa3', -w / 2 + 0.52, -0.07, 1, { name: 'Sofa bed', w: 2.0, d: 0.95 }), item('cot', w / 2 - 0.37, 0, 3),
      item('dresser', w / 2 - 0.48, -l / 2 + 0.29, 0, { d: 0.58, h: 0.92 }), item('lamp', -w / 2 + 0.18, -l / 2 + 0.28), item('rug', 0.15, -0.25)] }) },
  flat: { name: 'Two-bedroom flat', note: 'Living room, kitchen, hall, bedroom and nursery, with doors between', flat: true },
  bedroom: { name: 'Bedroom', note: 'Double bed, bedside tables, wardrobe', size: [3.6, 4.2, 2.6], make: (w, l, h) => ({ w, l, h,
    openings: [{ kind: 'window', wall: 'left', off: l / 2 - 0.7, w: 1.4, h: 1.4, y: 0.85 }, { kind: 'door', wall: 'front', off: 0.3, w: 0.82, h: 2.03 }],
    walls: { back: { layout: 'split', split: 1.2, rail: true, railStyle: 'scallop', lo: { f: { type: 'panel', color: '#bac7b1' } }, hi: { f: { color: '#f6f5f1' } } } },
    items: [item('bed160', 0, -l / 2 + 1.05), item('night', -1.1, -l / 2 + 0.2), item('night', 1.1, -l / 2 + 0.2), item('wardrobe', w / 2 - 0.3, l / 2 - 1.2, 3, { w: 1.8 }),
      item('rugbig', 0, -0.2, 1), item('lamp', -w / 2 + 0.25, l / 2 - 0.4)] }) },
  living: { name: 'Living room', note: 'Sofa, armchair, dining table, shelves', size: [4.5, 5.2, 2.6], make: (w, l, h) => ({ w, l, h,
    openings: [{ kind: 'window', wall: 'back', off: 0.6, w: 1.6, h: 1.5, y: 0.8 }, { kind: 'window', wall: 'back', off: w - 2.0, w: 1.4, h: 1.5, y: 0.8 },
      { kind: 'radiator', wall: 'back', off: 0.8, w: 1.2, h: 0.6, y: 0.12 }, { kind: 'door', wall: 'right', off: l - 1.2, w: 0.82, h: 2.03 }],
    items: [item('sofa3', -w / 2 + 0.5, -0.6, 1), item('armchair', 0.6, -1.4, 3), item('rugbig', -0.4, -0.8, 1), item('bookcase', -w / 2 + 0.16, 1.4, 1),
      item('dining', 0.6, 1.4), item('chair', 0.25, 0.85), item('chair', 0.95, 0.85), item('chair', 0.25, 1.95, 2), item('chair', 0.95, 1.95, 2),
      item('plant', w / 2 - 0.35, -l / 2 + 0.4), item('lamp', -w / 2 + 0.25, -l / 2 + 0.3)] }) },
};
function roomFrom(tplKey, name, w, l, h, x = 0, z = 0) {
  const r = cleanRoom({ ...TEMPLATES[tplKey].make(w, l, h), name, x, z });
  for (const it of r.items) { const c = clampItem(r, it); it.x = c.x; it.z = c.z; }
  return r;
}
/* An example flat: a hall down the middle, rooms either side, 10 cm walls between. */
function exampleFlat(name, h) {
  const hall = cleanRoom({ name: 'Hall', w: 1.2, l: 7.0, h, x: 0, z: 0, floor: 'oak',
    openings: [{ kind: 'door', wall: 'front', off: 0.19, w: 0.82, h: 2.03 }] });
  const living = roomFrom('living', 'Living room', 4.4, 4.2, h, -2.9, -1.4);
  living.openings = living.openings.filter(o => o.kind !== 'door');
  living.items = living.items.filter(i => !['dining', 'chair'].includes(i.p.ref.split(':')[1]));
  const kitchen = cleanRoom({ name: 'Kitchen', w: 4.4, l: 2.7, h, x: -2.9, z: 2.15, floor: 'tile',
    openings: [{ kind: 'window', wall: 'left', off: 0.7, w: 1.2, h: 1.2, y: 1.0 }],
    items: [{ x: 0.4, z: 0, p: basic('dining', { name: 'Kitchen table', w: 1.2, d: 0.8 }) }, { x: 0.15, z: -0.6, p: basic('chair') }, { x: 0.75, z: -0.6, p: basic('chair') },
      { x: 0.15, z: 0.6, rot: 2, p: basic('chair') }, { x: 0.75, z: 0.6, rot: 2, p: basic('chair') }, { x: -1.9, z: 0, rot: 1, p: basic('box', { name: 'Kitchen units', w: 2.4, d: 0.6, h: 0.9, color: '#e9e6df' }) }] });
  const bed = roomFrom('bedroom', 'Bedroom', 3.6, 3.9, h, 2.5, -1.55);
  bed.openings = bed.openings.filter(o => o.kind !== 'door');
  bed.openings = [{ id: newId('o'), kind: 'window', wall: 'right', off: 0.3, w: 1.3, h: 1.4, y: 0.85 }];
  const nursery = roomFrom('nursery', 'Nursery', 3.0, 3.0, h, 2.2, 2.0);
  nursery.openings = [{ id: newId('o'), kind: 'window', wall: 'right', off: 0.9, w: 1.14, h: 1.4, y: 0.93 }, { id: newId('o'), kind: 'radiator', wall: 'right', off: 1.1, w: 0.77, h: 0.6, y: 0.12 }];
  nursery.items = nursery.items.map(it => { const c = clampItem(nursery, it); return { ...it, ...c }; });
  const rooms = [hall, living, kitchen, bed, nursery];
  for (const [r, side] of [[living, 'left'], [kitchen, 'left'], [bed, 'right'], [nursery, 'right']]) { const d = doorBetween(hall, r, side); if (d) r.openings.push(d); }
  for (const r of rooms) for (const it of r.items) { const c = clampItem(r, it); it.x = c.x; it.z = c.z; }
  return cleanHome({ name, rooms });
}
function makeHome(tplKey, name, w, l, h) {
  if (tplKey === 'flat') return exampleFlat(name, h);
  const t = TEMPLATES[tplKey] || TEMPLATES.empty;
  return cleanHome({ name, rooms: [roomFrom(TEMPLATES[tplKey] ? tplKey : 'empty', tplKey === 'empty' ? name : t.name, w, l, h)] });
}
/* A home: one or more rooms. Older saves were a single room. */
function cleanHome(src) {
  src = src && typeof src === 'object' ? src : {};
  const rooms = Array.isArray(src.rooms) && src.rooms.length ? src.rooms.slice(0, 24).map(cleanRoom) : [cleanRoom({ ...src, x: 0, z: 0 })];
  const ids = new Set();
  for (const r of rooms) { if (ids.has(r.id)) r.id = newId('room'); ids.add(r.id); delete r.evening; delete r.published; delete r.cover; delete r.updatedAt; delete r.from; delete r.notes; }
  return { v: 2, name: str(src.name, 60, rooms[0].name), rooms, evening: !!src.evening, updatedAt: num(src.updatedAt, 0, 1e14, 0), published: !!src.published,
    cover: ASSET.test(src.cover || '') ? src.cover : null,
    from: src.from && typeof src.from === 'object' ? { owner: str(src.from.owner, 80), id: str(src.from.id, 60), name: str(src.from.name, 60) } : null };
}
function homeArea(h) { return h.rooms.reduce((t, r) => t + r.w * r.l, 0); }
function homeBox(h) {
  const x0 = Math.min(...h.rooms.map(r => r.x - r.w / 2)), x1 = Math.max(...h.rooms.map(r => r.x + r.w / 2));
  const z0 = Math.min(...h.rooms.map(r => r.z - r.l / 2)), z1 = Math.max(...h.rooms.map(r => r.z + r.l / 2));
  return { x0, x1, z0, z1, w: x1 - x0, l: z1 - z0 };
}
/* Where a new room goes when it's placed against a side of another, edges lined up, a 10 cm wall between. */
const FACING = { right: 'left', left: 'right', back: 'front', front: 'back' };
function placeBeside(o, r, side) {
  const gap = 0.1;
  if (side === 'right' || side === 'left') { r.x = o.x + (side === 'right' ? 1 : -1) * (o.w / 2 + gap + r.w / 2); r.z = o.z - o.l / 2 + r.l / 2; }
  else { r.z = o.z + (side === 'front' ? 1 : -1) * (o.l / 2 + gap + r.l / 2); r.x = o.x - o.w / 2 + r.w / 2; }
  r.x = Math.round(r.x * 100) / 100; r.z = Math.round(r.z * 100) / 100;
}
/* A door in the new room's wall that faces its neighbour, in the middle of the stretch they share. */
function doorBetween(o, r, side) {
  const wall = FACING[side], horiz = side === 'back' || side === 'front';
  const a0 = horiz ? Math.max(o.x - o.w / 2, r.x - r.w / 2) : Math.max(o.z - o.l / 2, r.z - r.l / 2);
  const a1 = horiz ? Math.min(o.x + o.w / 2, r.x + r.w / 2) : Math.min(o.z + o.l / 2, r.z + r.l / 2);
  if (a1 - a0 < 0.95) return null;
  const c = (a0 + a1) / 2, P = horiz ? new THREE.Vector3(c, 0, wall === 'back' ? r.z - r.l / 2 : r.z + r.l / 2) : new THREE.Vector3(wall === 'left' ? r.x - r.w / 2 : r.x + r.w / 2, 0, c);
  const f = frameOf(r, wall), u = P.sub(new THREE.Vector3(r.x, 0, r.z).add(f.o)).dot(uDirOf(f.rot));
  return { id: newId('o'), kind: 'door', wall, off: Math.round((u - 0.41) * 100) / 100, w: 0.82, h: 2.03, y: 0 };
}
function clampItem(r, it) {
  const f = it.rot % 2 ? { w: it.p.d, d: it.p.w } : { w: it.p.w, d: it.p.d };
  const lx = -r.w / 2 + f.w / 2, hx = r.w / 2 - f.w / 2, lz = -r.l / 2 + f.d / 2, hz = r.l / 2 - f.d / 2;
  return { x: lx > hx ? 0 : clamp(it.x, lx, hx), z: lz > hz ? 0 : clamp(it.z, lz, hz) };
}
/* A layout file downloaded from the earlier Room Planner (or a Nido room file). */
function fromPlannerFile(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return null; }
  if (j && j.app === 'nido-room' && j.room) return cleanHome(j.room);
  const s = j && j.layout && typeof j.layout === 'object' ? j.layout : j;
  if (!s || typeof s.roomW !== 'number' || typeof s.roomL !== 'number' || !s.fix || !s.items) return null;
  const w = s.roomW, l = s.roomL, h = s.ceil || 2.5, f = s.fix;
  const openings = [];
  if (f.window) openings.push({ kind: 'window', wall: 'back', off: f.window.off, w: f.window.w, h: f.window.h, y: f.window.sill });
  if (f.radiator) openings.push({ kind: 'radiator', wall: 'back', off: f.radiator.off, w: f.radiator.w, h: f.radiator.h, y: f.radiator.y0 });
  if (f.door) openings.push({ kind: 'door', wall: 'front', off: f.door.off, w: f.door.w, h: f.door.h });
  const walls = {};
  for (const wid of WALL_IDS) {
    const ow = s.walls && s.walls[wid]; if (!ow) continue;
    const z = (zz) => zz && { ...zz, f: zz.f && zz.f.type === 'image' ? { color: '#eee2d3' } : zz.f, inner: zz.inner && zz.inner.type === 'image' ? null : zz.inner };
    walls[wid] = ow.lo ? { ...ow, lo: z(ow.lo), hi: z(ow.hi) } : { layout: ow.layout === 'split' ? 'split' : 'whole', split: ow.split, lo: { f: ow.a && ow.a.type !== 'image' ? ow.a : {} }, hi: { f: ow.b && ow.b.type !== 'image' ? ow.b : {} } };
  }
  const map = { wardrobe: ['wardrobe', 'Wardrobe'], sofa: ['sofa3', 'Sofa'], cot: ['cot', 'Cot'], dresser: ['dresser', 'Chest of drawers'], lamp: ['lamp', 'Paper floor lamp'], rug: ['rug', 'Rug'] };
  const items = [];
  for (const [k, [bid, name]] of Object.entries(map)) {
    const it = s.items[k]; if (!it) continue;
    items.push({ x: it.x, z: it.z, rot: it.rot || 0, p: basic(bid, { name, w: it.w, d: it.d, h: it.h }) });
  }
  return cleanHome({ name: 'Imported room', rooms: [{ name: 'Imported room', w, l, h, openings, walls, items }] });
}
function roomSummary(home, id) {
  const all = home.rooms.flatMap(r => r.items), b = homeBox(home);
  return { id, name: home.name, w: b.w, l: b.l, h: home.rooms[0].h, rooms: home.rooms.length, area: homeArea(home), cover: home.cover, items: all.length,
    shops: [...new Set(all.map(i => i.p.shop).filter(s => s && s !== 'Nido basics'))].slice(0, 6), total: shopping(home).total, updatedAt: home.updatedAt };
}

/* ---------- Shared store ---------- */
const S = { db: null, user: null, assets: null, uid: null, canWrite: null, isAdmin: false, local: false,
  homes: new Map(), shops: new Map(), drafts: new Map(), ready: { homes: false, shops: false, drafts: false }, profiles: {} };
const LOCAL_KEY = 'nido-drafts-v1';
function localDrafts() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveLocalDrafts() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(S.drafts))); } catch (e) {} }
async function connect() {
  // inside claude.ai the platform provides these; on a site with a config.json naming an API, the AWS runtime;
  // anywhere else (opened from disk, no API), the offline runtime keeps everything in this browser
  let rt = window.claude && window.claude.use ? window.claude : null;
  if (!rt && typeof awsRuntime !== 'undefined' && /^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch('config.json', { cache: 'no-store' });
      const cfg = r.ok ? await r.json() : null;
      if (cfg && cfg.apiBase) { rt = awsRuntime(cfg); await rt.ready(); S.cloud = rt; }
    } catch (e) {}
  }
  if (!rt && typeof localRuntime !== 'undefined') rt = localRuntime;
  S.offline = typeof localRuntime !== 'undefined' && rt === localRuntime;
  if (S.offline) { await localRuntime.ready(); blobResolver = localRuntime.urlFor; }
  const use = (n) => (rt ? rt.use(n).catch(() => null) : Promise.resolve(null));
  [S.db, S.user, S.assets, S.downloads] = await Promise.all([use('db'), use('user'), use('assets'), use('downloads')]);
  if (S.user) {
    const me = await S.user.me();
    S.uid = me.id; S.isAdmin = !!me.canEdit; S.me = me;
    S.canWrite = await S.user.can('data.write');
  }
  S.local = !S.db || !S.uid || S.canWrite === false;
  if (S.local) { for (const [k, v] of Object.entries(localDrafts())) S.drafts.set(k, cleanHome(v)); S.ready.drafts = true; }
  else if (S.cloud) {                    // homes made in this browser before signing in move into the account
    const waiting = Object.entries(localDrafts());
    if (waiting.length) {
      for (const [k, v] of waiting) await saveDraft(k, cleanHome(v));
      try { localStorage.removeItem(LOCAL_KEY); } catch (e) {}
      setTimeout(() => toast(`Moved ${waiting.length} home${waiting.length === 1 ? '' : 's'} from this browser into your account.`), 500);
    }
  }
  if (!S.db) { S.ready.homes = S.ready.shops = true; return; }
  const timer = setTimeout(() => { S.slow = true; render(); }, 10000);
  S.db.collection('homes').onSnapshot((snap) => {
    clearTimeout(timer);
    S.homes.clear();
    for (const d of snap.docs) {
      const v = d.data() || {};
      S.homes.set(d.id, Array.isArray(v.rooms) ? v.rooms.slice(0, 100).filter(x => x && typeof x === 'object' && typeof x.id === 'string') : []);
    }
    S.ready.homes = true; render();
  }, () => { S.ready.homes = true; render(); });
  S.db.collection('shops').onSnapshot((snap) => {
    S.shops.clear();
    for (const d of snap.docs) S.shops.set(d.id, cleanShop(d.data(), d.id));
    S.ready.shops = true; render();
  }, () => { S.ready.shops = true; render(); });
  if (!S.local) S.db.collection('data/users/' + S.uid).onSnapshot((snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') S.drafts.delete(ch.doc.id);
      else if (!pending.has(ch.doc.id)) S.drafts.set(ch.doc.id, cleanHome(ch.doc.data()));
    }
    S.ready.drafts = true; render();
  }, () => { S.ready.drafts = true; render(); });
}
/* Drafts: one write at a time per room, the latest state wins. */
const pending = new Map();
function saveDraft(id, room) {
  room.updatedAt = Date.now();
  S.drafts.set(id, room);
  if (S.local) { saveLocalDrafts(); return Promise.resolve(); }
  const job = { room };
  const prev = pending.get(id);
  pending.set(id, job);
  if (prev) { prev.next = job; return prev.done; }
  const run = async () => {
    let j = job;
    while (j) {
      try { await S.db.collection('data/users/' + S.uid).doc(id).set(JSON.parse(JSON.stringify(j.room))); }
      catch (e) { if (e && e.code === 'invalid_argument') { S.local = true; saveLocalDrafts(); toast('Saving in this browser only: your access here is view-only.'); } else toast('Couldn’t save just now. Your changes are kept on this page; they’ll save with the next change.'); }
      j = j.next;
    }
    pending.delete(id);
  };
  job.done = run();
  return job.done;
}
async function deleteDraft(id) {
  const r = S.drafts.get(id);
  if (r && r.published) await unpublish(id);
  S.drafts.delete(id);
  if (S.local) saveLocalDrafts(); else await S.db.collection('data/users/' + S.uid).doc(id).delete();
}
async function publish(id, room, coverBlob) {
  if (S.local || !S.db) throw new Error('local');
  let cover = room.cover;
  if (coverBlob && S.assets) {
    try { const up = await S.assets.upload(coverBlob, { type: 'image/jpeg' }); cover = up.id; } catch (e) { /* keep the old picture */ }
  }
  const pub = JSON.parse(JSON.stringify({ ...room, cover, published: true, updatedAt: Date.now() }));
  await S.db.doc(`homes/${S.uid}/rooms/${id}`).set(pub);
  const list = (S.homes.get(S.uid) || []).filter(x => x.id !== id).map(({ owner, ...x }) => x);
  list.unshift(roomSummary(cleanHome(pub), id));
  await S.db.doc(`homes/${S.uid}`).set({ rooms: list.slice(0, 100) });
  room.cover = cover; room.published = true;
  await saveDraft(id, room);
}
async function unpublish(id, owner = S.uid) {
  await S.db.doc(`homes/${owner}/rooms/${id}`).delete();
  const list = (S.homes.get(owner) || []).filter(x => x.id !== id).map(({ owner: o, ...x }) => x);
  await S.db.doc(`homes/${owner}`).set({ rooms: list });
  if (owner === S.uid) { const r = S.drafts.get(id); if (r) { r.published = false; await saveDraft(id, r); } }
}
async function fetchPublished(owner, id) {
  const snap = await S.db.doc(`homes/${owner}/rooms/${id}`).get();
  return snap.exists ? cleanHome(snap.data()) : null;
}
const myShop = () => S.shops.get(S.uid) || null;
async function saveShop(shop) {
  const body = JSON.parse(JSON.stringify({ name: shop.name, url: shop.url, about: shop.about, logo: shop.logo, products: shop.products.map(({ editable, shop: _s, shopId, ref, curated, shopUrl, ...p }) => p), updatedAt: Date.now() }));
  await S.db.doc('shops/' + S.uid).set(body);
}
/* Every product anyone can place, with its shop attached. */
function allProducts() {
  const out = BASICS.map(b => ({ ...b }));
  for (const [sid, shop] of S.shops) for (const p of shop.products) out.push({ ...p, shop: shop.name, shopId: sid, ref: `shop:${sid}:${p.id}`, editable: false, shopUrl: shop.url, curated: shop.curated });
  return out;
}
async function profilesFor(ids) {
  if (!S.user || !ids.length) return {};
  try { const ps = await S.user.profiles(ids); Object.assign(S.profiles, ps); return ps; } catch (e) { return {}; }
}
/* glTF binary (.glb) to a self-contained .gltf JSON text, which the asset store accepts. */
async function glbToGltfText(buf) {
  const dv = new DataView(buf);
  if (dv.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67) throw new Error('not-glb');
  let off = 12, json = null, bin = null;
  while (off + 8 <= dv.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), chunk = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk)); else if (type === 0x004E4942) bin = chunk;
    off += 8 + len;
  }
  if (!json) throw new Error('not-glb');
  if (bin && json.buffers && json.buffers[0]) {
    const bytes = new Uint8Array(bin); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + btoa(s);
  }
  return JSON.stringify(json);
}
function selfContainedGltf(text) {
  const j = JSON.parse(text);
  const ext = [...(j.buffers || []), ...(j.images || [])].some(b => b.uri && !b.uri.startsWith('data:'));
  if (ext) throw new Error('external');
  return text;
}
