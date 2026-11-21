/* =====================================================================
   Nido 3D engine: one renderer shared by the editor and the room viewer.
   Room coordinates in metres: x across the window wall (W), z along the side walls (L),
   origin at the floor centre, the "back" wall at z = -L/2.
   ===================================================================== */
const T = 0.10;      // wall thickness
const CUT = 0.12;    // height of walls cut away for the view
const WALL_IDS = ['back', 'front', 'left', 'right'];
const WALL_NAMES = { back: 'Back wall', front: 'Front wall', left: 'Left wall', right: 'Right wall' };
let R = null;                       // the room being built or edited (see ctx)
let W = 3, L = 4, H = 2.5;
let editable = false;

/* ---------- Renderer, scene, cameras ---------- */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
stage.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const scene = new THREE.Scene();
scene.environment = envTex;
scene.environmentIntensity = 0.35;
const persp = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
const ortho = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 40);
ortho.up.set(0, 0, -1);
ortho.position.set(0, 14, 0);
ortho.lookAt(0, 0, 0);
let mode = '3d', cam = persp;
const hemi = new THREE.HemisphereLight(0xffffff, 0xcdbfa8, 1.4);
const amb = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(hemi, amb);
const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun, sun.target);

/* ---------- Materials and geometry helpers ---------- */
const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const own = (m) => { m.userData.own = true; return m; };
function boxUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  return geo;
}
const ghost = (o) => { o.userData.noAO = true; return o; };
function box(w, h, d, mat, shadow = true) {
  const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001))), mat);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
function rbox(w, h, d, r, mat) {
  const rr = Math.max(0.002, Math.min(r, Math.min(w, h, d) / 2 - 0.002));
  const m = new THREE.Mesh(boxUV(new RoundedBoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01), 3, rr)), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function put(parent, mesh, x, y, z) { mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* Stored images and models are '/_blob/<id>' paths: claude.ai serves them; offline they come from this browser's storage. */
let blobResolver = null;
const blobSrc = (u) => (blobResolver && typeof u === 'string' && u.startsWith('/_blob/') ? blobResolver(u.slice(7)) || u : u);

/*@@FINISH@@*/

const M = {
  wall: std(0xf6f5f1, 0.95), cut: std(0xbfc5bf, 0.9), base: std(0xfbfbf9, 0.6), frame: std(0xfdfdfc, 0.45),
  glass: new THREE.MeshStandardMaterial({ color: 0x9cc3ea, roughness: 0.1, transparent: true, opacity: 0.45, emissive: 0x5b8fcf, emissiveIntensity: 0.3 }),
  winPlan: std(0x8dbbe8, 0.4, { emissive: 0x4a86cc, emissiveIntensity: 0.25 }),
  doorPlan: std(0xa6ada7, 0.6),
  radiator: std(0xf4f4f2, 0.4), doorLeaf: std(0xf7f6f2, 0.45), steel: std(0xb8b8b4, 0.3, { metalness: 0.8 }),
  ceiling: std(0xf7f6f3, 0.95, { normalMap: wallNormal, normalScale: new THREE.Vector2(0.5, 0.5) }),
  plinth: std(0x3f3a34, 0.7), mattress: cloth(0xf5f2ec, { sheen: 0.3 }), sheet: cloth(0xf1ece6), pillow: cloth(0xf4f1ec),
  pick: new THREE.MeshBasicMaterial({ visible: false }), caster: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  lampFoot: std(0xf2f0eb, 0.4, { metalness: 0.2 }), pot: std(0xd8cbbb, 0.7), soil: std(0x4a3a2c, 1),
};

/* ---------- Floors ---------- */
const FLOORS = {
  oak: ['Pale oak', [30, 18, 75]], honey: ['Honey oak', [32, 38, 62]], walnut: ['Walnut', [24, 28, 38]],
  grey: ['Grey wash', [40, 6, 70]], tile: ['Stone tiles', null], carpet: ['Carpet', null],
};
function floorTexture(kind) {
  const key = 'floor:' + kind;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d'), rnd = seeded(11);
  if (kind === 'tile') {
    x.fillStyle = '#d8d3cb'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      x.fillStyle = `hsl(35, 8%, ${78 + rnd() * 6}%)`; x.fillRect(i * 256 + 3, j * 256 + 3, 250, 250);
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(90,80,70,${rnd() * 0.06})`; x.fillRect(i * 256 + rnd() * 250, j * 256 + rnd() * 250, 2 + rnd() * 6, 2 + rnd() * 6); }
    }
  } else if (kind === 'carpet') {
    x.fillStyle = '#cfc7bb'; x.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 40000; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '80,70,60'},${rnd() * 0.12})`; x.fillRect(rnd() * 1024, rnd() * 1024, 2, 2); }
  } else {
    const [hue, sat, lig] = (FLOORS[kind] || FLOORS.oak)[1];
    const cols = 10, pw = 1024 / cols;
    x.fillStyle = `hsl(${hue},${sat}%,${lig}%)`; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < cols; i++) {
      let y = -rnd() * 700;
      while (y < 1024) {
        const len = 420 + rnd() * 320;
        x.save(); x.beginPath(); x.rect(i * pw, y, pw, len); x.clip();
        x.fillStyle = `hsl(${hue + rnd() * 5},${sat + rnd() * 6}%,${lig - 2 + rnd() * 4}%)`; x.fillRect(i * pw, y, pw, len);
        for (let g = 0; g < 16; g++) {
          x.strokeStyle = `rgba(80, 60, 40, ${0.035 + rnd() * 0.07})`; x.lineWidth = 0.8 + rnd() * 1.6;
          const gx = i * pw + rnd() * pw;
          x.beginPath(); x.moveTo(gx, y);
          x.bezierCurveTo(gx + rnd() * 10 - 5, y + len * 0.33, gx + rnd() * 10 - 5, y + len * 0.66, gx + rnd() * 8 - 4, y + len);
          x.stroke();
        }
        x.restore();
        x.fillStyle = 'rgba(60, 45, 30, 0.28)'; x.fillRect(i * pw, y, pw, 2);
        y += len;
      }
      x.fillStyle = 'rgba(60, 45, 30, 0.24)'; x.fillRect(i * pw, 0, 2, 1024);
    }
  }
  const t = canvasTex(c); texCache.set(key, t); return t;
}

/* ---------- Homes and rooms ----------
   A home is several rectangular rooms, each placed by its centre (x, z) in the home's plan.
   While a room is built, R/W/L/H hold it, so every wall helper works in that room's own coordinates. */
let HOME = null, focus = null;
const homeGroup = new THREE.Group();
scene.add(homeGroup);
const views = new Map();          // room id -> { group, items, walls: [...] }
let walls = [];
const ctx = (r) => { R = r; W = r.w; L = r.l; H = r.h; };
const roomById = (id) => (HOME ? HOME.rooms.find(r => r.id === id) : null);
const wallLen = (wid) => (wid === 'back' || wid === 'front' ? W : L);
function frameOf(r, wid) {
  const w = r.w, l = r.l;
  return {
    back: { o: new THREE.Vector3(-w / 2, 0, -l / 2), rot: 0, n: new THREE.Vector3(0, 0, 1), ext: T },
    front: { o: new THREE.Vector3(w / 2, 0, l / 2), rot: Math.PI, n: new THREE.Vector3(0, 0, -1), ext: T },
    left: { o: new THREE.Vector3(-w / 2, 0, l / 2), rot: Math.PI / 2, n: new THREE.Vector3(1, 0, 0), ext: 0 },
    right: { o: new THREE.Vector3(w / 2, 0, -l / 2), rot: -Math.PI / 2, n: new THREE.Vector3(-1, 0, 0), ext: 0 },
  }[wid];
}
const WALL_FRAME = new Proxy({}, { get: (_, wid) => () => frameOf(R, wid) });
const uDirOf = (rot) => new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
function wallPointOf(r, wid, u, v, z = 0) {
  const f = frameOf(r, wid);
  return f.o.clone().addScaledVector(uDirOf(f.rot), u).add(new THREE.Vector3(0, v, 0)).addScaledVector(f.n, z);
}
const wallPoint = (wid, u, v, z = 0) => wallPointOf(R, wid, u, v, z);
const roomOffset = (r) => new THREE.Vector3(r.x || 0, 0, r.z || 0);
const opV = (o) => (o.kind === 'door' ? 0 : o.y);
/* Doors and windows of the neighbouring rooms that sit in the same wall: cut through here too. */
function passOps(wid) {
  if (!HOME || HOME.rooms.length < 2) return [];
  const f = frameOf(R, wid), org = roomOffset(R).add(f.o), ud = uDirOf(f.rot), len = wallLen(wid), out = [];
  for (const o2 of HOME.rooms) {
    if (o2 === R) continue;
    for (const op of o2.openings || []) {
      if (op.kind === 'radiator') continue;
      const f2 = frameOf(o2, op.wall);
      if (Math.abs(f2.n.dot(f.n)) < 0.99) continue;
      const a = roomOffset(o2).add(wallPointOf(o2, op.wall, op.off, 0)), b = roomOffset(o2).add(wallPointOf(o2, op.wall, op.off + op.w, 0));
      if (Math.abs(a.clone().sub(org).dot(f.n)) > 0.26) continue;
      const ua = a.clone().sub(org).dot(ud), ub = b.clone().sub(org).dot(ud);
      const u0 = Math.max(0, Math.min(ua, ub)), u1 = Math.min(len, Math.max(ua, ub));
      if (u1 - u0 < 0.1) continue;
      out.push({ u0, u1, v0: opV(op), v1: Math.min(opV(op) + op.h, H - 0.02), o: { ...op, pass: true } });
    }
  }
  return out;
}
function wallOps(wid) {
  return (R.openings || []).filter(o => o.wall === wid && o.kind !== 'radiator')
    .map(o => ({ u0: o.off, u1: o.off + o.w, v0: opV(o), v1: Math.min(opV(o) + o.h, H - 0.02), o })).concat(passOps(wid));
}
function wallBlocks(wid) {
  return (R.openings || []).filter(o => o.wall === wid).map(o => ({ u0: o.off, u1: o.off + o.w, v0: opV(o), v1: opV(o) + o.h }))
    .concat(passOps(wid).map(({ u0, u1, v0, v1 }) => ({ u0, u1, v0, v1 })));
}
function wallPieces(uStart, uEnd, h, ops, mat) {
  const g = new THREE.Group();
  const cuts = ops.filter(o => o.v0 < h).map(o => ({ ...o, v1: Math.min(o.v1, h) })).sort((a, b) => a.u0 - b.u0);
  const piece = (u0, u1, v0, v1) => { if (u1 - u0 > 0.001 && v1 - v0 > 0.001) put(g, box(u1 - u0, v1 - v0, T, mat, false), (u0 + u1) / 2, (v0 + v1) / 2, -T / 2); };
  let cur = uStart;
  for (const o of cuts) { piece(cur, o.u0, 0, h); piece(o.u0, o.u1, 0, o.v0); piece(o.u0, o.u1, o.v1, h); cur = Math.max(cur, o.u1); }
  piece(cur, uEnd, 0, h);
  return g;
}
function buildWindow(g, op) {
  const u0 = op.u0, u1 = op.u1, cx = (u0 + u1) / 2, ww = u1 - u0, sill = op.v0, top = op.v1, wh = top - sill, f = 0.055, z = -T / 2;
  if (!op.o.pass) {
    put(g, box(ww, f, 0.07, M.frame, false), cx, sill + f / 2, z);
    put(g, box(ww, f, 0.07, M.frame, false), cx, top - f / 2, z);
    put(g, box(f, wh, 0.07, M.frame, false), u0 + f / 2, sill + wh / 2, z);
    put(g, box(f, wh, 0.07, M.frame, false), u1 - f / 2, sill + wh / 2, z);
    if (ww > 0.7) put(g, box(f * 0.9, wh, 0.07, M.frame, false), cx, sill + wh / 2, z);
    put(g, ghost(box(ww - 2 * f, wh - 2 * f, 0.006, M.glass, false)), cx, sill + wh / 2, z);
  }
  if (sill > 0.05) put(g, box(ww + 0.08, 0.025, T + 0.05, M.frame, false), cx, sill - 0.0125, -T / 2 + 0.025);
  const c = 0.045;
  put(g, box(c, wh + c, 0.015, M.frame, false), u0 - c / 2, sill + (wh + c) / 2, 0.0075);
  put(g, box(c, wh + c, 0.015, M.frame, false), u1 + c / 2, sill + (wh + c) / 2, 0.0075);
  put(g, box(ww + 2 * c, c, 0.015, M.frame, false), cx, top + c / 2, 0.0075);
}
function buildDoor(g, op) {
  const c = 0.07, dh = op.v1, w = op.u1 - op.u0, cx = (op.u0 + op.u1) / 2;
  put(g, box(c, dh + c, 0.015, M.frame, false), op.u0 - c / 2, (dh + c) / 2, 0.0075);
  put(g, box(c, dh + c, 0.015, M.frame, false), op.u1 + c / 2, (dh + c) / 2, 0.0075);
  put(g, box(w + 2 * c, c, 0.015, M.frame, false), cx, dh + c / 2, 0.0075);
  if (op.o.pass) return;                       // the leaf belongs to the room that owns the door
  put(g, box(w - 0.01, dh - 0.01, 0.04, M.doorLeaf), cx, dh / 2, -0.03);
  put(g, box(0.12, 0.016, 0.016, M.steel), op.u1 - 0.12, 1.0, 0.0);
}
function makeWall(parent, wid) {
  const len = wallLen(wid), F = WALL_FRAME[wid](), ops = wallOps(wid), blocks = wallBlocks(wid);
  const full = new THREE.Group(), cut = new THREE.Group();
  full.add(wallPieces(-F.ext, len + F.ext, H, ops, M.wall));
  cut.add(wallPieces(-F.ext, len + F.ext, CUT, ops, M.cut));
  let cur = 0;
  const skirt = (u0, u1) => { if (u1 - u0 > 0.01) for (const grp of [full, cut]) put(grp, box(u1 - u0, 0.07, 0.012, M.base, false), (u0 + u1) / 2, 0.035, 0.006); };
  for (const o of ops.filter(o => o.v0 < 0.08).sort((a, b) => a.u0 - b.u0)) { skirt(cur, o.u0); cur = Math.max(cur, o.u1); }
  skirt(cur, len);
  full.add(finishGroup(R.walls[wid], len, H, ops, blocks));
  cut.add(finishGroup(R.walls[wid], len, CUT, ops, blocks));
  for (const op of ops) {
    if (op.o.kind === 'window') { buildWindow(full, op); if (!op.o.pass) put(cut, box(op.u1 - op.u0, CUT + 0.006, T * 0.5, M.winPlan, false), (op.u0 + op.u1) / 2, (CUT + 0.006) / 2, -T / 2); }
    else { buildDoor(full, op); put(cut, box(op.u1 - op.u0, 0.02, T, M.doorPlan, false), (op.u0 + op.u1) / 2, 0.01, -T / 2); }
  }
  const wrap = new THREE.Group();
  wrap.userData.wallId = wid; wrap.userData.roomId = R.id;
  wrap.add(full, cut);
  wrap.position.copy(F.o);
  wrap.rotation.y = F.rot;
  parent.add(wrap);
  walls.push({ id: wid, roomId: R.id, full, cut, normal: F.n, point: roomOffset(R).add(F.o) });
}
function disposeTree(o) {
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.userData && c.material.userData.own) c.material.dispose(); });
}
function buildOneRoom(r) {
  ctx(r);
  const g = new THREE.Group();
  g.position.set(r.x || 0, 0, r.z || 0);
  g.userData.roomGroup = r.id;
  const ft = floorTexture(r.floor || 'oak');
  const floorMat = own(new THREE.MeshPhysicalMaterial({ map: ft, bumpMap: ft, bumpScale: 1.2, roughness: r.floor === 'carpet' ? 1 : 0.6, clearcoat: r.floor === 'carpet' ? 0 : 0.2, clearcoatRoughness: 0.4 }));
  const fgeo = new THREE.PlaneGeometry(W, L), fuv = fgeo.attributes.uv, fpos = fgeo.attributes.position;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fpos.getX(i) + (r.x || 0)) / 2, (fpos.getY(i) - (r.z || 0)) / 2);   // planks run on across rooms
  const floor = new THREE.Mesh(fgeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.floor = r.id;
  g.add(floor);
  for (const wid of WALL_IDS) makeWall(g, wid);
  for (const o of r.openings || []) if (o.kind === 'radiator') {
    const rg = new THREE.Group(), fins = Math.max(3, Math.round(o.w / 0.08)), finW = o.w / fins, d = 0.08;
    for (let i = 0; i < fins; i++) put(rg, rbox(finW - 0.006, o.h, d, 0.012, M.radiator), -o.w / 2 + finW / 2 + i * finW, o.y + o.h / 2, 0);
    rg.position.copy(wallPoint(o.wall, o.off + o.w / 2, 0, d / 2 + 0.03)); rg.rotation.y = WALL_FRAME[o.wall]().rot;
    g.add(rg);
  }
  const cgeo = new THREE.PlaneGeometry(W, L), cp = cgeo.attributes.position, cuv1 = new Float32Array(cp.count * 2);
  for (let i = 0; i < cp.count; i++) { cuv1[i * 2] = cp.getX(i); cuv1[i * 2 + 1] = cp.getY(i); }
  cgeo.setAttribute('uv1', new THREE.BufferAttribute(cuv1, 2));
  const ceil = new THREE.Mesh(cgeo, M.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.castShadow = true; ceil.receiveShadow = true;
  g.add(ceil);
  for (const wid of WALL_IDS) {                 // invisible full-height walls: daylight comes in through the windows only
    const F = WALL_FRAME[wid](), cw = wallPieces(-F.ext, wallLen(wid) + F.ext, H, wallOps(wid), M.caster);
    cw.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.raycast = () => {}; } });
    cw.position.copy(F.o); cw.rotation.y = F.rot;
    g.add(cw);
  }
  const items = new THREE.Group();
  g.add(items);
  homeGroup.add(g);
  views.set(r.id, { group: g, items });
}
function homeBounds(onlyFocus = true) {
  const rs = HOME ? HOME.rooms.filter(r => !onlyFocus || !focus || r.id === focus) : [];
  if (!rs.length) return { x0: -2, x1: 2, z0: -2, z1: 2, cx: 0, cz: 0, w: 4, l: 4, h: 2.5 };
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, h: 0 };
  for (const r of rs) { b.x0 = Math.min(b.x0, r.x - r.w / 2); b.x1 = Math.max(b.x1, r.x + r.w / 2); b.z0 = Math.min(b.z0, r.z - r.l / 2); b.z1 = Math.max(b.z1, r.z + r.l / 2); b.h = Math.max(b.h, r.h); }
  return { ...b, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, w: b.x1 - b.x0, l: b.z1 - b.z0 };
}
function buildRoom() {                         // rebuild the whole home (doors between rooms depend on neighbours)
  if (!HOME) return;
  disposeTree(homeGroup);
  pruneTextures();
  homeGroup.clear(); views.clear(); walls = []; meshes.clear();
  for (const r of HOME.rooms) buildOneRoom(r);
  const fr = roomById(focus) || HOME.rooms[0];
  if (fr) ctx(fr);
  // sun through the first window of the home, from outside
  const wr = HOME.rooms.find(r => (r.openings || []).some(o => o.kind === 'window')), win = wr && wr.openings.find(o => o.kind === 'window');
  const sp = win ? roomOffset(wr).add(wallPointOf(wr, win.wall, win.off + win.w / 2, 0)) : new THREE.Vector3(0, 0, -3);
  const n = win ? frameOf(wr, win.wall).n : new THREE.Vector3(0, 0, 1);
  sun.position.copy(sp).addScaledVector(n, -4.5).add(new THREE.Vector3(n.z * 1.5, 5, -n.x * 1.5));
  const b = homeBounds(false);
  sun.target.position.set(b.cx, 0, b.cz);
  const ext = Math.max(b.w, b.l) / 2 + 2;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.5, far: 30 });
  sun.shadow.camera.updateProjectionMatrix();
  syncItems();
  applyFocus();
  layout();
}
function applyFocus() {
  for (const [id, v] of views) v.group.visible = !focus || id === focus;
  showSelection();
  syncLamps();
}

/* ---------- Furniture: one builder per kind, origin at the floor centre, front facing +z ---------- */
const KINDS = {
  sofa: 'Sofa or armchair', bed: 'Bed', cot: 'Cot', wardrobe: 'Wardrobe', dresser: 'Chest of drawers',
  bookcase: 'Shelves or bookcase', table: 'Table or desk', chair: 'Chair', lamp: 'Floor lamp', rug: 'Rug',
  plant: 'Plant', box: 'Other (box shape)',
};
const wood = (c) => own(oakLike(c));
const paintM = (c, r = 0.55) => own(std(c, r));
const fabricM = (c) => own(cloth(c));
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
function buildSofa(p) {
  const { w, d, h } = p, g = new THREE.Group(), fab = fabricM(p.color), dark = fabricM(shade(p.color, 0.92));
  const leg = 0.07, armW = Math.min(0.17, w * 0.12), armH = Math.min(0.64, h * 0.76), seatTop = Math.min(0.46, h * 0.56), backD = Math.min(0.24, d * 0.26);
  put(g, box(w - 0.1, leg, d - 0.1, M.plinth), 0, leg / 2, 0);
  for (const s of [-1, 1]) put(g, rbox(armW, armH - leg, d, 0.06, fab), s * (w / 2 - armW / 2), leg + (armH - leg) / 2, 0);
  const iw = w - 2 * armW, baseH = seatTop - 0.14 - leg;
  put(g, rbox(iw, baseH, d - 0.01, 0.03, dark), 0, leg + baseH / 2, 0);
  put(g, rbox(iw, h - leg, backD, 0.06, fab), 0, leg + (h - leg) / 2, -d / 2 + backD / 2);
  const n = iw > 1.25 ? 2 : 1, cw = (iw - 0.012 * (n + 1)) / n, cd = d - backD - 0.02;
  for (let i = 0; i < n; i++) put(g, rbox(cw, 0.16, cd, 0.07, fab), -iw / 2 + 0.012 + cw / 2 + i * (cw + 0.012), seatTop - 0.06, -d / 2 + backD + cd / 2 + 0.01);
  return g;
}
function buildBed(p) {
  const { w, d, h } = p, g = new THREE.Group(), fab = fabricM(p.color), duvet = fabricM('#f3efe8');
  const baseH = 0.32, mat = 0.2, head = Math.max(h, baseH + mat + 0.2);
  put(g, rbox(w, baseH, d, 0.03, fab), 0, baseH / 2, 0);
  put(g, rbox(w - 0.06, mat, d - 0.12, 0.06, M.mattress), 0, baseH + mat / 2, 0.03);
  put(g, rbox(w + 0.04, head, 0.1, 0.04, fab), 0, head / 2, -d / 2 + 0.05);
  put(g, rbox(w - 0.02, 0.07, d * 0.62, 0.035, duvet), 0, baseH + mat + 0.03, d / 2 - d * 0.31 - 0.02);
  const np = w > 1.2 ? 2 : 1, pw = (w - 0.2) / np;
  for (let i = 0; i < np; i++) put(g, rbox(pw - 0.06, 0.13, 0.4, 0.06, M.pillow), -w / 2 + 0.1 + pw / 2 + i * pw, baseH + mat + 0.06, -d / 2 + 0.33);
  return g;
}
function buildCot(p) {
  const { w, d, h } = p, g = new THREE.Group(), oak = wood(p.color), curve = own(oakLike(p.color, { side: THREE.DoubleSide }));
  const rx = Math.min(0.15, w * 0.12), px = w / 2 - rx, ps = 0.045, yb = 0.16;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(ps, h, ps, oak), sx * px, h / 2, sz * (d / 2 - ps / 2));
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h - yb, 28, 1, true, sx > 0 ? 0 : Math.PI, Math.PI), curve);
    m.scale.set(rx, 1, d / 2); m.position.set(sx * px, yb + (h - yb) / 2, 0); m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const span = 2 * px - ps;
  for (const sz of [-1, 1]) {
    const z = sz * (d / 2 - 0.015);
    put(g, box(span, 0.06, 0.03, oak), 0, yb + 0.03, z);
    put(g, box(span, 0.05, 0.03, oak), 0, h - 0.025, z);
    const n = Math.max(2, Math.round(span / 0.08)), sh = h - 0.05 - (yb + 0.06);
    for (let i = 1; i < n; i++) put(g, box(0.026, sh, 0.026, oak), -span / 2 + i * span / n, yb + 0.06 + sh / 2, z);
  }
  put(g, rbox(2 * px + rx * 0.8, 0.10, d - 0.08, 0.05, M.mattress), 0, yb + 0.13, 0);
  return g;
}
function buildWardrobe(p) {
  const { w, d, h } = p, g = new THREE.Group(), m = paintM(p.color), line = paintM(shade(p.color, 0.7), 0.8);
  put(g, rbox(w, h - 0.06, d - 0.02, 0.01, m), 0, 0.06 + (h - 0.06) / 2, -0.01);
  put(g, box(w - 0.04, 0.06, d - 0.06, M.plinth), 0, 0.03, -0.02);
  const n = Math.max(1, Math.round(w / 0.5)), dw = w / n;
  for (let i = 1; i < n; i++) put(g, box(0.004, h - 0.08, 0.004, line, false), -w / 2 + i * dw, 0.06 + (h - 0.06) / 2, d / 2 - 0.018);
  for (let i = 0; i < n; i++) {
    const hx = -w / 2 + i * dw + (i % 2 ? 0.04 : dw - 0.04);
    put(g, box(0.014, 0.18, 0.025, M.steel), hx, Math.min(1.05, h * 0.55), d / 2 - 0.005);
  }
  return g;
}
function buildDresser(p) {
  const { w, d, h } = p, g = new THREE.Group(), m = wood(p.color), groove = paintM(shade(p.color, 0.45), 0.8);
  const legH = Math.min(0.14, h * 0.15);
  put(g, rbox(w, h - legH, d, 0.02, m), 0, legH + (h - legH) / 2, 0);
  const n = Math.max(1, Math.min(5, Math.round((h - legH) / 0.25))), bot = legH + 0.02, top = h - 0.03, fh = (top - bot) / n;
  for (let i = 1; i < n; i++) put(g, box(w - 0.05, 0.006, 0.004, groove, false), 0, bot + i * fh, d / 2 + 0.001);
  for (let i = 0; i < n; i++) put(g, box(Math.min(0.12, w * 0.3), 0.012, 0.004, groove, false), 0, bot + (i + 1) * fh - 0.03, d / 2 + 0.001);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, legH, 14), m);
    leg.castShadow = true; put(g, leg, sx * (w / 2 - 0.05), legH / 2, sz * (d / 2 - 0.05));
  }
  return g;
}
function buildBookcase(p) {
  const { w, d, h } = p, g = new THREE.Group(), m = paintM(p.color), t = 0.02, rnd = seeded(Math.round(w * 1000 + h * 10));
  for (const s of [-1, 1]) put(g, box(t, h, d, m), s * (w / 2 - t / 2), h / 2, 0);
  put(g, box(w, t, d, m), 0, h - t / 2, 0);
  put(g, box(w - 2 * t, h - t, 0.008, m), 0, (h - t) / 2, -d / 2 + 0.004);
  const n = Math.max(1, Math.round(h / 0.36)), sp = (h - t) / n;
  const colours = ['#c8705d', '#9aaeb6', '#e2d1b9', '#b5968d', '#7d8f6c', '#eee2d3', '#3d3833'];
  for (let i = 0; i < n; i++) {
    const y = i * sp;
    put(g, box(w - 2 * t, t, d, m), 0, y + t / 2, 0);
    let x = -w / 2 + t + 0.02;
    while (x < w / 2 - t - 0.12 && rnd() < 0.93) {
      const bw = 0.02 + rnd() * 0.035, bh = Math.min(sp - 0.06, 0.18 + rnd() * 0.12);
      if (rnd() < 0.2) { x += 0.08; continue; }
      put(g, box(bw, bh, Math.min(d - 0.04, 0.2), own(std(colours[Math.floor(rnd() * colours.length)], 0.8))), x + bw / 2, y + t + bh / 2, 0);
      x += bw + 0.002;
    }
  }
  return g;
}
function buildTable(p) {
  const { w, d, h } = p, g = new THREE.Group(), m = wood(p.color), t = 0.035;
  put(g, rbox(w, t, d, 0.01, m), 0, h - t / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.045, h - t, 0.045, m), sx * (w / 2 - 0.06), (h - t) / 2, sz * (d / 2 - 0.06));
  return g;
}
function buildChair(p) {
  const { w, d, h } = p, g = new THREE.Group(), m = wood(p.color), seat = Math.min(0.46, h * 0.55);
  put(g, rbox(w, 0.03, d, 0.01, m), 0, seat, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, box(0.03, seat, 0.03, m), sx * (w / 2 - 0.03), seat / 2, sz * (d / 2 - 0.03));
  for (const sx of [-1, 1]) put(g, box(0.03, h - seat, 0.03, m), sx * (w / 2 - 0.03), seat + (h - seat) / 2, -d / 2 + 0.03);
  put(g, rbox(w - 0.02, Math.min(0.2, (h - seat) * 0.5), 0.025, 0.01, m), 0, h - Math.min(0.1, (h - seat) * 0.25), -d / 2 + 0.03);
  return g;
}
const ribTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 4, 32);
  x.fillStyle = 'rgba(120,108,92,0.35)'; x.fillRect(0, 0, 4, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function buildLamp(p) {
  const { w, h } = p, r = w / 2, g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.78, 0.022, 32), M.lampFoot);
  foot.castShadow = true; put(g, foot, 0, 0.011, 0);
  const sh = Math.max(0.2, h - 0.04), geo = new THREE.CylinderGeometry(r, r, sh, 40, 1, true), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * sh / 0.028);
  const mat = own(new THREE.MeshStandardMaterial({ color: p.color, map: ribTex, emissiveMap: ribTex, emissive: 0x000000, roughness: 1, side: THREE.DoubleSide }));
  const s = new THREE.Mesh(geo, mat); s.castShadow = false;
  put(g, s, 0, 0.04 + sh / 2, 0);
  g.userData.lamp = { mat, y: 0.04 + sh * 0.55 };
  return g;
}
function buildRug(p) {
  const g = new THREE.Group();
  let mat;
  if (p.photo) {
    const tex = imageTexture(assetUrl(p.photo), true);
    mat = own(new THREE.MeshPhysicalMaterial({ map: tex, bumpMap: tex, bumpScale: 2, roughness: 1, sheen: 0.7, sheenRoughness: 0.85, sheenColor: 0xffffff, alphaTest: 0.5 }));
  } else mat = own(new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 1, sheen: 0.7, sheenRoughness: 0.85, sheenColor: 0xffffff, normalMap: weaveNormal, normalScale: new THREE.Vector2(0.8, 0.8) }));
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), mat);
  plane.rotation.x = -Math.PI / 2; plane.position.y = 0.008; plane.receiveShadow = true;
  g.add(plane);
  return g;
}
function buildPlant(p) {
  const { w, h } = p, g = new THREE.Group(), r = w / 2, potH = Math.min(0.35, h * 0.3);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.5, potH, 28), M.pot); pot.castShadow = true;
  put(g, pot, 0, potH / 2, 0);
  const leaf = own(std(p.color, 0.7)), rnd = seeded(Math.round(h * 1000));
  for (let i = 0; i < 14; i++) {
    const s = r * (0.35 + rnd() * 0.3), a = rnd() * Math.PI * 2, rr = rnd() * r * 0.55;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), leaf); m.castShadow = true;
    m.scale.y = 0.75;
    put(g, m, Math.cos(a) * rr, potH + (h - potH) * (0.3 + rnd() * 0.6), Math.sin(a) * rr);
  }
  return g;
}
function buildBox(p) { const g = new THREE.Group(); put(g, rbox(p.w, p.h, p.d, 0.015, paintM(p.color)), 0, p.h / 2, 0); return g; }
const BUILD = { sofa: buildSofa, bed: buildBed, cot: buildCot, wardrobe: buildWardrobe, dresser: buildDresser, bookcase: buildBookcase,
  table: buildTable, chair: buildChair, lamp: buildLamp, rug: buildRug, plant: buildPlant, box: buildBox };
const assetUrl = (id) => blobSrc('/_blob/' + id);

/* Shop 3D models (glTF), scaled to the product's measured size and stood on the floor. */
const gltfCache = new Map();
function loadModel(id) {
  if (!gltfCache.has(id)) gltfCache.set(id, fetch(assetUrl(id)).then(r => { if (!r.ok) throw new Error('missing'); return r.text(); })
    .then(text => new Promise((res, rej) => new GLTFLoader().parse(text, '', (g) => res(g.scene), rej))));
  return gltfCache.get(id);
}
function fitModel(src, p) {
  const m = src.clone(true);
  const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
  m.scale.set(p.w / (s.x || 1), p.h / (s.y || 1), p.d / (s.z || 1));
  const b2 = new THREE.Box3().setFromObject(m), c = b2.getCenter(new THREE.Vector3());
  m.position.set(-c.x, -b2.min.y, -c.z);
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(m); return g;
}

/* ---------- Placed items (positions are in their room's own coordinates) ---------- */
const meshes = new Map();       // item id -> group
const fp = (it) => (it.rot % 2 ? { w: it.p.d, d: it.p.w } : { w: it.p.w, d: it.p.d });
function clampIn(it, x, z) {
  const f = fp(it), lx = -W / 2 + f.w / 2, hx = W / 2 - f.w / 2, lz = -L / 2 + f.d / 2, hz = L / 2 - f.d / 2;
  return { x: lx > hx ? 0 : clamp(x, lx, hx), z: lz > hz ? 0 : clamp(z, lz, hz) };
}
function snapWalls(it, x, z) {
  const S = 0.05, f = fp(it);
  if (x - f.w / 2 + W / 2 < S) x = -W / 2 + f.w / 2;
  if (W / 2 - x - f.w / 2 < S) x = W / 2 - f.w / 2;
  if (z - f.d / 2 + L / 2 < S) z = -L / 2 + f.d / 2;
  if (L / 2 - z - f.d / 2 < S) z = L / 2 - f.d / 2;
  return { x, z };
}
function findItem(id) {
  if (!HOME) return null;
  for (const r of HOME.rooms) { const it = r.items.find(i => i.id === id); if (it) return { r, it }; }
  return null;
}
function buildItem(it, room) {
  room = room || (findItem(it.id) || {}).r;
  const v = room && views.get(room.id); if (!v) return;
  const old = meshes.get(it.id);
  if (old) { disposeTree(old); old.parent && old.parent.remove(old); }
  const g = new THREE.Group();
  g.userData.itemId = it.id;
  const p = it.p;
  g.add((BUILD[p.kind] || buildBox)(p));
  if (p.model) loadModel(p.model).then(src => {
    if (meshes.get(it.id) !== g) return;
    disposeTree(g); g.clear(); g.add(fitModel(src, p));
  }).catch(() => {});
  g.position.set(it.x, 0, it.z);
  g.rotation.y = it.rot * Math.PI / 2;
  v.items.add(g);
  meshes.set(it.id, g);
}
function syncItems() {
  if (!HOME) return;
  const ids = new Set();
  for (const r of HOME.rooms) for (const it of r.items) {
    ids.add(it.id);
    const g = meshes.get(it.id), v = views.get(r.id);
    if (!g || g.parent !== (v && v.items)) buildItem(it, r); else placeItem(it);
  }
  for (const [id, g] of meshes) if (!ids.has(id)) { disposeTree(g); g.parent && g.parent.remove(g); meshes.delete(id); }
  syncLamps();
}
function placeItem(it) { const g = meshes.get(it.id); if (g) { g.position.set(it.x, 0, it.z); g.rotation.y = it.rot * Math.PI / 2; } }

/* ---------- Day and evening ---------- */
const lampLights = new THREE.Group();
scene.add(lampLights);
function syncLamps() {
  if (!HOME) return;
  const ev = !!HOME.evening;
  disposeTree(lampLights); lampLights.clear();
  hemi.intensity = ev ? 0.08 : 1.4; amb.intensity = ev ? 0.03 : 0.3; sun.intensity = ev ? 0 : 2.6;
  scene.environmentIntensity = ev ? 0.05 : 0.35;
  renderer.toneMappingExposure = ev ? 1.3 : 1;
  const warm = new THREE.Color(1, 0.78, 0.55);
  let n = 0;
  for (const r of HOME.rooms) {
    const visible = !focus || r.id === focus;
    let inRoom = 0;
    for (const it of r.items) {
      const g = meshes.get(it.id); if (!g || it.p.kind !== 'lamp') continue;
      let info = null; g.traverse(o => { if (o.userData.lamp) info = o.userData.lamp; });
      if (!info) continue;
      info.mat.emissive.copy(ev ? warm : new THREE.Color(0)); info.mat.emissiveIntensity = ev ? 1.1 : 0;
      if (ev && visible && n < 8) {
        const pl = new THREE.PointLight(warm, 6, 0, 2);
        pl.position.set(r.x + it.x, info.y, r.z + it.z);
        pl.userData.item = it.id;
        if (n < 2) { pl.castShadow = true; pl.shadow.mapSize.set(512, 512); pl.shadow.camera.near = 0.04; pl.shadow.camera.far = 8; pl.shadow.bias = -0.0012; pl.shadow.normalBias = 0.02; pl.shadow.camera.updateProjectionMatrix(); }
        lampLights.add(pl); n++; inRoom++;
      }
    }
    if (ev && visible && !inRoom && n < 8) {      // a room without lamps still gets a soft ceiling light
      const pl = new THREE.PointLight(warm, 4, 0, 2); pl.position.set(r.x, r.h - 0.3, r.z); lampLights.add(pl); n++;
    }
  }
  applyTheme();
}
function syncLampPositions() {
  for (const pl of lampLights.children) {
    const f = pl.userData.item && findItem(pl.userData.item); if (!f) continue;
    pl.position.x = f.r.x + f.it.x; pl.position.z = f.r.z + f.it.z;
  }
}

/* ---------- Selection highlight ---------- */
const hlMat = new THREE.LineBasicMaterial({ color: 0x2c6b58 });
const selBox = ghost(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hlMat));
selBox.visible = false; scene.add(selBox);
let selId = null;
function showSelection() {
  const f = selId && findItem(selId);
  if (!f || (focus && f.r.id !== focus)) { selBox.visible = false; return; }
  const it = f.it, d = fp(it);
  selBox.visible = true;
  selBox.position.set(f.r.x + it.x, it.p.h / 2 + 0.005, f.r.z + it.z);
  selBox.scale.set(d.w + 0.02, Math.max(0.02, it.p.h + 0.01), d.d + 0.02);
}
function selectItem(id) { selId = id; showSelection(); engineHooks.onSelect(id); }

/* ---------- Picking and dragging: furniture inside its room; whole rooms in the plan ---------- */
const canvas = renderer.domElement;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let drag = null, down = null;
const engineHooks = { onSelect: () => {}, onWall: () => {}, onChange: () => {}, onRoomTap: () => {}, onRoomMoved: () => {} };
function aim(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam);
}
const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function pick() {
  for (const h of ray.intersectObjects([homeGroup], true)) {
    if (!shown(h.object)) continue;
    let o = h.object;
    while (o && !o.userData.itemId && !o.userData.wallId && !o.userData.floor) o = o.parent;
    if (!o) continue;
    if (o.userData.itemId) return { item: o.userData.itemId, point: h.point };
    if (o.userData.wallId) return { wall: o.userData.wallId, room: o.userData.roomId };
    return { floor: o.userData.floor, point: h.point };
  }
  return null;
}
/* Snap a room's edges to its neighbours': flush with a 10 cm wall between, or lined up. */
function snapRoom(r, x, z) {
  const S = 0.18, gap = 0.1;
  let bx = null, bz = null;
  for (const o of HOME.rooms) {
    if (o === r) continue;
    const xs = [o.x + o.w / 2 + gap + r.w / 2, o.x - o.w / 2 - gap - r.w / 2, o.x - o.w / 2 + r.w / 2, o.x + o.w / 2 - r.w / 2];
    const zs = [o.z + o.l / 2 + gap + r.l / 2, o.z - o.l / 2 - gap - r.l / 2, o.z - o.l / 2 + r.l / 2, o.z + o.l / 2 - r.l / 2];
    for (const c of xs) if (Math.abs(c - x) < S && (bx === null || Math.abs(c - x) < Math.abs(bx - x))) bx = c;
    for (const c of zs) if (Math.abs(c - z) < S && (bz === null || Math.abs(c - z) < Math.abs(bz - z))) bz = c;
  }
  return { x: Math.round((bx ?? x) * 100) / 100, z: Math.round((bz ?? z) * 100) / 100 };
}
canvas.addEventListener('pointerdown', (e) => {
  if (!HOME || (e.pointerType === 'mouse' && e.button !== 0)) return;
  aim(e);
  down = { x: e.clientX, y: e.clientY };
  tween = null;
  const p = pick();
  if (!p) return;
  const arranging = editable && mode === 'plan' && !focus && HOME.rooms.length > 1;
  if (p.item && arranging) p.floor = findItem(p.item).r.id;      // in the whole-home plan, anything in a room moves the room
  if (p.item && !arranging) {
    selectItem(p.item);
    if (!editable) return;
    const f = findItem(p.item);
    drag = { id: p.item, pid: e.pointerId, ox: f.r.x + f.it.x - p.point.x, oz: f.r.z + f.it.z - p.point.z };
    floorPlane.constant = -p.point.y;
  } else if (p.floor && arranging) {
    const r = roomById(p.floor);
    drag = { room: r.id, pid: e.pointerId, ox: r.x - p.point.x, oz: r.z - p.point.z };
    floorPlane.constant = 0;
  } else return;
  controls().enabled = false;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  aim(e);
  if (drag && e.pointerId === drag.pid) {
    if (!ray.ray.intersectPlane(floorPlane, hit)) return;
    if (drag.room) {
      const r = roomById(drag.room), s = snapRoom(r, hit.x + drag.ox, hit.z + drag.oz);
      r.x = s.x; r.z = s.z; views.get(r.id).group.position.set(r.x, 0, r.z);
      drag.moved = true; showSelection(); engineHooks.onRoomMoved(r.id, false);
      return;
    }
    const f = findItem(drag.id); if (!f) return;
    ctx(f.r);
    let c = clampIn(f.it, hit.x + drag.ox - f.r.x, hit.z + drag.oz - f.r.z);
    c = snapWalls(f.it, c.x, c.z);
    f.it.x = Math.round(c.x * 100) / 100; f.it.z = Math.round(c.z * 100) / 100;
    drag.moved = true;
    placeItem(f.it); showSelection(); syncLampPositions();
    return;
  }
  if (e.pointerType !== 'mouse') return;
  const p = pick();
  canvas.style.cursor = p && (p.item || (editable && p.wall)) ? 'pointer' : p && p.floor && editable && mode === 'plan' && !focus && HOME && HOME.rooms.length > 1 ? 'move' : 'grab';
});
function endDrag(e) {
  if (drag && e.pointerId === drag.pid) {
    const d = drag; drag = null; controls().enabled = true;
    try { canvas.releasePointerCapture(e.pointerId); } catch (er) {}
    if (d.moved && d.room) { buildRoom(); engineHooks.onRoomMoved(d.room, true); }
    else if (d.moved) engineHooks.onChange();
    if (d.moved) { down = null; return; }
  }
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {       // a tap, not an orbit
    aim(e);
    const p = pick();
    if (p && p.wall) engineHooks.onWall(p.room, p.wall);
    else if (p && p.floor && !focus) { selectItem(null); engineHooks.onRoomTap(p.floor); }
    else if (!p || p.floor) selectItem(null);
  }
  down = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- Cameras, controls, cut-away walls ---------- */
const orbit = new OrbitControls(persp, canvas);
orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.maxPolarAngle = Math.PI / 2 - 0.05; orbit.minDistance = 1.2; orbit.maxDistance = 40;
const pan = new OrbitControls(ortho, canvas);
pan.enableRotate = false; pan.screenSpacePanning = true;
pan.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
pan.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
pan.minZoom = 0.3; pan.maxZoom = 6; pan.enabled = false;
const controls = () => (mode === '3d' ? orbit : pan);
let tween = null;
function resetView() {
  const b = homeBounds(), k = Math.max(b.w, b.l) / 3.4 * (stage.clientWidth / Math.max(1, stage.clientHeight) < 0.9 ? 1.5 : 1);
  orbit.target.set(b.cx, 0.45, b.cz + 0.1);
  persp.position.set(b.cx - 2.3 * k, 5.2 * k, b.cz + 4.3 * k);      // high, from the front left corner, looking over the furniture
  orbit.update();
  ortho.zoom = 1; ortho.position.set(b.cx, 14, b.cz); pan.target.set(b.cx, 0, b.cz);
  ortho.updateProjectionMatrix(); pan.update();
  layout();
}
function setMode(m) {
  mode = m; cam = m === '3d' ? persp : ortho;
  orbit.enabled = m === '3d'; pan.enabled = m === 'plan';
  engineHooks.onMode && engineHooks.onMode(m);
}
function setFocus(id) {
  focus = id && roomById(id) ? id : null;
  if (focus) ctx(roomById(focus));
  applyFocus();
  resetView();
}
function flyTo(wid) {
  if (mode !== '3d') setMode('3d');
  const r = roomById(focus); if (!r) return;
  ctx(r);
  const F = WALL_FRAME[wid](), len = wallLen(wid), c = roomOffset(r).add(wallPoint(wid, len / 2, 0));
  const tanH = Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2);
  const dist = Math.max((H + 0.5) / (2 * tanH), (len + 0.7) / (2 * tanH * viewAspect));
  tween = { start: performance.now(), dur: 650, p0: persp.position.clone(), t0: orbit.target.clone(),
    p1: c.clone().addScaledVector(F.n, dist).setY(H * 0.85), t1: c.clone().setY(H * 0.42) };
}
let viewAspect = 1.6, padLeft = 0, padBottom = 0;
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  const ox = -padLeft / 2, oy = padBottom / 2, vw = w - padLeft, vh = h - padBottom, b = homeBounds();
  viewAspect = Math.max(0.3, vw / Math.max(1, vh));
  persp.aspect = w / h;
  persp.setViewOffset(w, h, ox, oy, w, h);
  persp.updateProjectionMatrix();
  const ppm = Math.min(vw / (b.w + 1.0), vh / (b.l + 1.0));
  ortho.left = -w / 2 / ppm; ortho.right = w / 2 / ppm; ortho.top = h / 2 / ppm; ortho.bottom = -h / 2 / ppm;
  ortho.setViewOffset(w, h, ox, oy, w, h);
  ortho.updateProjectionMatrix();
}
new ResizeObserver(layout).observe(stage);
const tmpV = new THREE.Vector3();
function updateWalls() {
  for (const w of walls) {
    const full = mode === '3d' && tmpV.copy(persp.position).sub(w.point).dot(w.normal) > 0;
    w.full.visible = full; w.cut.visible = !full;
  }
}
function applyTheme() {
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(HOME && HOME.evening ? '#1b201e' : (cs.getPropertyValue('--scene').trim() || '#e4e8e3'));
  hlMat.color.set(cs.getPropertyValue('--accent').trim() || '#2c6b58');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
let running = false;
renderer.setAnimationLoop(() => {
  if (!running || !HOME) return;
  if (tween && mode === '3d') {
    const t = Math.min(1, (performance.now() - tween.start) / tween.dur), e = 1 - Math.pow(1 - t, 3);
    persp.position.lerpVectors(tween.p0, tween.p1, e); orbit.target.lerpVectors(tween.t0, tween.t1, e);
    if (t >= 1) tween = null;
  }
  if (mode === '3d') orbit.update(); else pan.update();
  updateWalls();
  renderer.render(scene, cam);
});

/* Show a home. editable: furniture (and rooms, in the plan) can be dragged. */
function showHome(home, opts = {}) {
  HOME = home; editable = !!opts.editable;
  focus = opts.focus && home.rooms.some(r => r.id === opts.focus) ? opts.focus : null;
  selId = null; selBox.visible = false;
  buildRoom();
  running = true;
  setMode('3d');
  resetView();
}
function hideRoom() { running = false; }
/* A cover picture of the current view: a 16:10 JPEG, 960 px wide. */
function captureCover() {
  return new Promise((res) => {
    const prevSel = selBox.visible; selBox.visible = false;
    updateWalls();
    renderer.render(scene, cam);
    const src = renderer.domElement, sw = src.width, sh = src.height;
    const out = document.createElement('canvas'); out.width = 960; out.height = 600;
    const ar = 960 / 600; let cw = sw, ch = sw / ar;
    if (ch > sh) { ch = sh; cw = sh * ar; }
    out.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 960, 600);
    selBox.visible = prevSel;
    out.toBlob(b => res(b), 'image/jpeg', 0.86);
  });
}
