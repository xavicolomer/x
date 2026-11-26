/* ---------- Procedural surface detail ---------- */
function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
/* Tileable height field from periodic value noise: [cells, amplitude] per octave. */
function heightField(N, octaves, seed) {
  const h = new Float32Array(N * N), rnd = seeded(seed);
  for (const [cells, amp] of octaves) {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd() * 2 - 1;
    for (let y = 0; y < N; y++) {
      const fy = y / N * cells, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % cells, y1 = (iy + 1) % cells;
      for (let x = 0; x < N; x++) {
        const fx = x / N * cells, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % cells, x1 = (ix + 1) % cells;
        const a = g[y0 * cells + x0] + (g[y0 * cells + x1] - g[y0 * cells + x0]) * sx;
        const b = g[y1 * cells + x0] + (g[y1 * cells + x1] - g[y1 * cells + x0]) * sx;
        h[y * N + x] += amp * (a + (b - a) * sy);
      }
    }
  }
  return h;
}
function normalTexture(N, h, strength) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h[y * N + (x + 1) % N] - h[y * N + (x - 1 + N) % N]) * strength;
    const dy = (h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    data[i] = (-dx / l * 0.5 + 0.5) * 255; data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; data[i + 2] = (1 / l * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
/* Plaster: a gentle wave across the metre (walls are never quite flat) plus a fine grain. One repeat = 1 m. */
const wallNormal = normalTexture(512, heightField(512, [[2, 4], [4, 2], [128, 0.16], [256, 0.06]], 5), 0.5);
wallNormal.channel = 1;          // uses the metre-scaled uv1 set, so the grain is the same size on every finish
/* Woven fabric: a fine basket weave. One repeat = 3 cm. */
const weaveNormal = (() => {
  const N = 128, h = new Float32Array(N * N), k = 16;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = Math.floor(x / N * k), cy = Math.floor(y / N * k);
    const u = (x / N * k) % 1, v = (y / N * k) % 1;
    h[y * N + x] = (cx + cy) % 2 ? Math.sin(Math.PI * u) * 0.6 + 0.2 * Math.sin(Math.PI * v) : Math.sin(Math.PI * v) * 0.6 + 0.2 * Math.sin(Math.PI * u);
  }
  const t = normalTexture(N, h, 1.2);
  t.repeat.set(33, 33);
  return t;
})();
/* Oak grain: soft streaks along the board, used as colour and as a light bump. One repeat = 50 cm. */
const woodGrain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'), rnd = seeded(21);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const y0 = rnd() * 512, a = 0.03 + rnd() * 0.08, w = 0.6 + rnd() * 2.4;
    x.strokeStyle = `rgba(120, 82, 45, ${a})`; x.lineWidth = w;
    x.beginPath();
    for (let px = -10; px <= 522; px += 16) x.lineTo(px, y0 + Math.sin(px / 90 + i) * 3 + Math.sin(px / 23 + i * 3) * 1.2);
    x.stroke();
    if (y0 + 512 > 512) { x.save(); x.translate(0, -512); x.stroke(); x.restore(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(2, 2);
  return t;
})();
/* Rattan weave for the basket. */
const rattanTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c99b62'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? 'rgba(90,55,20,0.35)' : 'rgba(255,230,190,0.25)';
    x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(12, 12);
  return t;
})();
/* Fabric with a soft sheen, the way cotton and boucle catch light at grazing angles. */
const cloth = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.7, sheenColor: 0xffffff,
  normalMap: weaveNormal, normalScale: new THREE.Vector2(0.55, 0.55), ...extra });
const oakLike = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, map: woodGrain, bumpMap: woodGrain, bumpScale: 0.5, roughness: 0.62, ...extra });

/* ---------- Wall finish textures and surfaces ---------- */
const texCache = new Map();
function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function patternTexture(kind, c1, c2) {
  const key = `pat:${kind}:${c1}:${c2}`;
  if (texCache.has(key)) return texCache.get(key);
  const sz = 512, c = document.createElement('canvas'); c.width = c.height = sz;
  const x = c.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, sz, sz);
  x.fillStyle = c2; x.strokeStyle = c2;
  const star = (cx, cy, r) => {
    x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
    x.closePath(); x.fill();
  };
  const dot = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  if (kind === 'stars') { star(sz * .25, sz * .27, sz * .085); star(sz * .75, sz * .77, sz * .085); dot(sz * .75, sz * .25, sz * .016); dot(sz * .25, sz * .75, sz * .016); }
  else if (kind === 'dots') { dot(sz * .25, sz * .25, sz * .065); dot(sz * .75, sz * .75, sz * .065); }
  else if (kind === 'stripes') { x.fillRect(sz * .15, 0, sz * .2, sz); x.fillRect(sz * .65, 0, sz * .2, sz); }
  else if (kind === 'gingham') { x.globalAlpha = .5; x.fillRect(0, 0, sz / 2, sz); x.fillRect(0, 0, sz, sz / 2); x.globalAlpha = 1; }
  else if (kind === 'waves') {
    x.lineWidth = sz * .04; x.lineCap = 'round';
    for (const row of [.25, .75]) {
      x.beginPath();
      for (let px = -8; px <= sz + 8; px += 4) x.lineTo(px, row * sz + sz * .06 * Math.sin(px / sz * Math.PI * 4));
      x.stroke();
    }
  }
  const t = canvasTex(c); texCache.set(key, t); return t;
}
function panelTexture(c1) {
  const key = `panel:${c1}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = c1; x.fillRect(0, 0, 256, 32);
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.05)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 32);
  x.fillStyle = 'rgba(55,45,35,0.30)'; x.fillRect(0, 0, 7, 32);
  x.fillStyle = 'rgba(255,255,255,0.40)'; x.fillRect(7, 0, 3, 32);
  const t = canvasTex(c); texCache.set(key, t); return t;
}
function imageTexture(src, mural) {
  const key = `img:${src}${mural ? ':mural' : ''}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = mural ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const img = new Image();
  img.onload = () => { t.image = img; t.needsUpdate = true; };
  img.src = blobSrc(src);
  texCache.set(key, t); return t;
}
function pruneTextures() {
  if (texCache.size < 60) return;
  for (const [k, t] of texCache) if (!k.startsWith('img:') && !k.startsWith('rug:')) { t.dispose(); texCache.delete(k); }
}
/* Material plus the size (m) of one texture repeat. */
function finishMaterial(f) {
  const n = f.type === 'paint' ? 1 : f.type === 'panel' ? 0.35 : 0.55;
  const own = (m) => { m.userData.own = true; m.normalMap = wallNormal; m.normalScale = new THREE.Vector2(n, n); return m; };
  if (f.type === 'pattern') return { mat: own(std(0xffffff, 0.9, { map: patternTexture(f.pattern, f.color, f.color2) })), tw: f.tile / 100, th: f.tile / 100 };
  if (f.type === 'panel') return { mat: own(std(0xffffff, 0.55, { map: panelTexture(f.color) })), tw: f.board / 100, th: 1 };
  if (f.type === 'image' && f.img && f.img.src) {
    const im = f.img;
    if (im.mural) return { mat: own(std(0xffffff, 0.9, { map: imageTexture(im.src, true) })), mural: im.aspect || 1 };
    return { mat: own(std(0xffffff, 0.9, { map: imageTexture(im.src) })), tw: f.imgW / 100, th: f.imgW / 100 * (im.aspect || 1) };
  }
  return { mat: own(std(f.color, 0.92)), tw: 1, th: 1 };
}
/* Rectangles of the wall face between v0 and v1, minus the openings. */
function faceRects(len, v0, v1, ops) {
  const out = [];
  const add = (a, b, c, d) => { if (b - a > 0.001 && d - c > 0.001) out.push([a, b, c, d]); };
  const cuts = ops.map(o => ({ u0: Math.max(0, o.u0), u1: Math.min(len, o.u1), v0: Math.max(v0, o.v0), v1: Math.min(v1, o.v1) }))
    .filter(o => o.u1 > o.u0 && o.v1 > o.v0).sort((a, b) => a.u0 - b.u0);
  let cur = 0;
  for (const o of cuts) { add(cur, o.u0, v0, v1); add(o.u0, o.u1, v0, o.v0); add(o.u0, o.u1, o.v1, v1); cur = Math.max(cur, o.u1); }
  add(cur, len, v0, v1);
  return out;
}
/* Moulding panels that fit the stretches of wall between openings. With count, that many panels shared between
   the stretches by length; otherwise as many as the target panel width allows.
   opt.pad: the space kept at the ends of the wall and around openings (12 cm); opt.gap: between panels (10 cm).
   opt.w fixes the panels' width instead: each stretch's panels are centred in it, so the padding is what's left over. */
function autoColumns(len, blocks, v0, v1, panelW, count, opt = {}) {
  const fixed = opt.w > 0, edge = fixed ? 0.03 : opt.pad ?? 0.12, gap = opt.gap ?? 0.1, free = [];
  const bl = blocks.filter(o => o.v0 < v1 && o.v1 > v0).map(o => [o.u0 - edge, o.u1 + edge]).sort((a, b) => a[0] - b[0]);
  let cur = edge;
  for (const [b0, b1] of bl) { if (b0 - cur > 0.25) free.push([cur, b0]); cur = Math.max(cur, b1); }
  if (len - edge - cur > 0.25) free.push([cur, len - edge]);
  let counts;
  if (count) {
    const tot = free.reduce((t, [a, b]) => t + b - a, 0) || 1, raw = free.map(([a, b]) => count * (b - a) / tot);
    counts = raw.map(Math.floor);
    let left = count - counts.reduce((t, n) => t + n, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (left > 0) { counts[i]++; left--; } });
  } else counts = free.map(([a, b]) => Math.max(1, Math.round((b - a + gap) / (panelW + gap))));
  const out = [];
  free.forEach(([f0, f1], i) => {
    const n = counts[i]; if (!n) return;
    const fill = (f1 - f0 - gap * (n - 1)) / n, pw = fixed ? Math.min(opt.w, fill) : fill;
    const start = f0 + (f1 - f0 - n * pw - gap * (n - 1)) / 2;          // f0 when the panels fill the stretch
    for (let k = 0; k < n; k++) out.push({ u: start + k * (pw + gap), w: pw });
  });
  return out;
}
/* A tap inside a frame (where the wall shows through) picks the frame: an unseen surface across it. */
const pickMat = new THREE.MeshBasicMaterial({ visible: false });
/* A wall's finishes (and its rail), and the room's mouldings on it (frames: room.frames on this wall). */
function finishGroup(cfg, len, hMax, ops, blocks, frames = []) {
  const g = new THREE.Group();
  const mats = new Map();
  const matFor = (f) => { if (!mats.has(f)) mats.set(f, finishMaterial(f)); return mats.get(f); };
  // zb: the area a mural covers (scaled to fill it, centred); repeating finishes tile in wall metres
  const rect = (u0, u1, v0, v1, f, z, parent = g, zb = { u0: 0, u1: len, v0, v1 }) => {
    if (u1 - u0 < 0.001 || v1 - v0 < 0.001) return;
    const { mat, tw, th, mural } = matFor(f);
    let mx = null;
    if (mural) {
      const ZW = zb.u1 - zb.u0, ZH = zb.v1 - zb.v0, dw = Math.max(ZW, ZH / mural), dh = dw * mural;
      mx = { ox: zb.u0 + (ZW - dw) / 2, oy: zb.v0 + (ZH - dh) / 2, dw, dh };
    }
    const geo = new THREE.PlaneGeometry(u1 - u0, v1 - v0);
    const pos = geo.attributes.position, uv = geo.attributes.uv, cx = (u0 + u1) / 2, cy = (v0 + v1) / 2;
    const uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      if (mx) uv.setXY(i, (cx + pos.getX(i) - mx.ox) / mx.dw, (cy + pos.getY(i) - mx.oy) / mx.dh);
      else uv.setXY(i, (cx + pos.getX(i)) / tw, (cy + pos.getY(i)) / th);
      uv1[i * 2] = cx + pos.getX(i); uv1[i * 2 + 1] = cy + pos.getY(i);
    }
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, cy, z);
    m.receiveShadow = true;
    parent.add(m);
  };
  const zone = (v0, v1, f) => { for (const [u0, u1, a, b] of faceRects(len, v0, v1, ops)) rect(u0, u1, a, b, f, 0.0015, g, { u0: 0, u1: len, v0, v1 }); };
  // a flat shape in wall coordinates, finished like the wall (wallpaper and patterns line up with the rest)
  const shapeFill = (shape, f, z, parent, zb) => {
    const { mat, tw, th, mural } = matFor(f);
    const geo = new THREE.ShapeGeometry(shape, 24), pos = geo.attributes.position, uv = geo.attributes.uv;
    let mx = null;
    if (mural) { const ZW = zb.u1 - zb.u0, ZH = zb.v1 - zb.v0, dw = Math.max(ZW, ZH / mural); mx = { ox: zb.u0 + (ZW - dw) / 2, oy: zb.v0 + (ZH - dw * mural) / 2, dw, dh: dw * mural }; }
    const uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      if (mx) uv.setXY(i, (x - mx.ox) / mx.dw, (y - mx.oy) / mx.dh); else uv.setXY(i, x / tw, y / th);
      uv1[i * 2] = x; uv1[i * 2 + 1] = y;
    }
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z; m.receiveShadow = true;
    parent.add(m);
  };
  const solid = (shape, mat, depth, z, parent) => {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 }), mat);
    m.position.z = z; m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
  };
  const railAt = (y, mat) => {
    const bl = ops.filter(o => o.v0 < y + 0.03 && o.v1 > y - 0.03).sort((a, b) => a.u0 - b.u0);
    let cur = 0;
    const seg = (u0, u1) => {
      if (u1 - u0 < 0.01) return;
      if (cfg.railStyle === 'straight') { const rm = cfg.railM, rf = rm ? rm.face : 0.045, rd = rm ? rm.depth : 0.022; put(g, box(u1 - u0, rf, rd, mat, false), (u0 + u1) / 2, y, rd / 2); }
      else solid(railShape(u0, u1, y, cfg.railStyle, cfg.railSize), mat, 0.014, 0.002, g);
    };
    for (const o of bl) { seg(cur, o.u0 - 0.045); cur = o.u1 + 0.045; }
    seg(cur, len);
  };
  const split = Math.min(cfg.split, hMax);
  const parts = cfg.layout === 'split' ? [['lo', 0, split], ['hi', split, hMax]] : [['lo', 0, hMax]];
  for (const [key, z0, z1] of parts) zone(z0, z1, cfg[key].f);
  // the mouldings: each in its own group, picked and dragged on its own; it takes the colour of the part of the wall it sits on
  for (const fr of frames) {
    const z = cfg[parts.length > 1 && fr.v + fr.h / 2 > split ? 'hi' : 'lo'], style = fr.style, col = frameColor(fr, z);
    const mould = std(col, style === 'soft' ? 0.95 : 0.5);
    mould.userData.own = true;
    const plain = defaultFinish({ color: col });
    const shopM = style === 'mould' && fr.moulding, mw = shopM ? shopM.face : 0.035, md = shopM ? shopM.depth : 0.016;   // a shop's moulding at its own size
    const pg = new THREE.Group();
    pg.userData.frameId = fr.id; pg.userData.roomId = R.id;
    g.add(pg);
    const u0 = fr.u, u1 = fr.u + fr.w, v0 = fr.v, v1 = fr.v + fr.h, zz = 0.001 + md / 2, zb = { u0: 0, u1: len, v0, v1 };
    const ry = Math.min(fr.w / 2, fr.h * 0.45);
    put(pg, new THREE.Mesh(new THREE.PlaneGeometry(fr.w, fr.h), pickMat), (u0 + u1) / 2, (v0 + v1) / 2, 0.004);
    if (style === 'soft') {                 // upholstered pads with rounded corners
      const pad = new THREE.Mesh(new RoundedBoxGeometry(fr.w, fr.h, 0.032, 4, Math.min(0.05, fr.w / 2 - 0.001)), fr.inner && fr.inner.type === 'paint' ? std(fr.inner.color, 0.95) : mould);
      pad.position.set((u0 + u1) / 2, (v0 + v1) / 2, 0.016); pad.castShadow = true; pad.receiveShadow = true;
      pg.add(pad); continue;
    }
    if (style === 'tops') { shapeFill(archShape(u0, u1, v0, v1, ry), fr.inner || plain, 0.003, pg, zb); continue; }
    if (style === 'arch') {                 // moulding that follows a round-topped frame
      if (fr.inner) shapeFill(archShape(u0, u1, v0, v1, ry), fr.inner, 0.003, pg, zb);
      const outer = archShape(u0 - mw / 2, u1 + mw / 2, v0 - mw / 2, v1 + mw / 2, ry + mw / 2);
      outer.holes.push(archShape(u0 + mw / 2, u1 - mw / 2, v0 + mw / 2, v1 - mw / 2, Math.max(0.01, ry - mw / 2)));
      solid(outer, mould, 0.016, 0.001, pg); continue;
    }
    if (fr.inner) rect(u0, u1, v0, v1, fr.inner, 0.003, pg, zb);
    put(pg, box(fr.w + mw, mw, md, mould), (u0 + u1) / 2, v1, zz);
    put(pg, box(fr.w + mw, mw, md, mould), (u0 + u1) / 2, v0, zz);
    put(pg, box(mw, fr.h, md, mould), u0, (v0 + v1) / 2, zz);
    put(pg, box(mw, fr.h, md, mould), u1, (v0 + v1) / 2, zz);
  }
  if (cfg.layout === 'split' && cfg.rail && cfg.split < hMax - 0.03)
    railAt(cfg.split, cfg.trim ? (() => { const m = std(cfg.trim, 0.5); m.userData.own = true; return m; })() : M.base);
  return g;
}
/* Where a part's frames go: inside the part, clear of the skirting, the rail and the ceiling. */
function frameSpan(cfg, key, hMax) {
  const sp = cfg.layout === 'split', z = cfg[key];
  const def = key === 'lo' ? [0.17, sp ? Math.min(cfg.split, hMax) - 0.09 : hMax - 0.16] : [cfg.split + 0.1, hMax - 0.16];
  if (!z || !z.panelH) return def;
  // a height of the user's own: centred where the panels would sit, kept between the skirting, the rail and the ceiling
  const r = sp && cfg.rail ? 0.03 : 0, e0 = key === 'lo' ? 0.07 : cfg.split + r, e1 = key === 'lo' && sp ? Math.min(cfg.split, hMax) - r : hMax;
  const h = Math.min(z.panelH, e1 - e0), m = Math.min(Math.max((def[0] + def[1]) / 2, e0 + h / 2), e1 - h / 2);
  return [m - h / 2, m + h / 2];
}
/* A moulding's colour: its own, or the wall's where it sits (z: that part of the wall); padded and painted panels a shade darker so they show. */
function frameColor(fr, z) {
  if (fr.mould) return fr.mould;
  const base = z.f.type === 'paint' || z.f.type === 'panel' ? z.f.color : '#f6f5f1';
  return fr.style === 'soft' || fr.style === 'tops' ? '#' + new THREE.Color(base).multiplyScalar(0.84).getHexString() : base;
}
/* Round-topped panel outline (a rectangle with a half ellipse on top). */
function archShape(u0, u1, v0, v1, ry) {
  const rx = (u1 - u0) / 2, sh = new THREE.Shape();
  sh.moveTo(u0, v0); sh.lineTo(u1, v0); sh.lineTo(u1, v1 - ry);
  sh.absellipse(u0 + rx, v1 - ry, rx, ry, 0, Math.PI, false);
  sh.lineTo(u0, v0);
  return sh;
}
/* Rail profiles: scallops standing on the rail, a scalloped border hanging from it, or a wave. */
function railShape(u0, u1, y, style, size) {
  const n = Math.max(1, Math.round((u1 - u0) / size)), sp = (u1 - u0) / n, rx = sp / 2, ry = rx * 0.9, sh = new THREE.Shape();
  if (style === 'scallop') {
    const lo = y - 0.015, top = y + 0.008;
    sh.moveTo(u0, lo); sh.lineTo(u1, lo); sh.lineTo(u1, top);
    for (let k = n - 1; k >= 0; k--) sh.absellipse(u0 + k * sp + rx, top, rx, ry, 0, Math.PI, false);
    sh.lineTo(u0, lo);
  } else if (style === 'scallop-down') {
    const hi = y + 0.015, bot = y - 0.008;
    sh.moveTo(u0, hi); sh.lineTo(u0, bot);
    for (let k = 0; k < n; k++) sh.absellipse(u0 + k * sp + rx, bot, rx, ry, Math.PI, 2 * Math.PI, false);
    sh.lineTo(u1, hi); sh.lineTo(u0, hi);
  } else {
    const a = sp * 0.16, t = 0.026, N = n * 16, wave = (i) => y + a * Math.sin(i / N * n * Math.PI * 2);
    sh.moveTo(u0, wave(0) + t / 2);
    for (let i = 1; i <= N; i++) sh.lineTo(u0 + (u1 - u0) * i / N, wave(i) + t / 2);
    for (let i = N; i >= 0; i--) sh.lineTo(u0 + (u1 - u0) * i / N, wave(i) - t / 2);
  }
  return sh;
}