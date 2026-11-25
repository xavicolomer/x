/* =====================================================================
   Catalogue: vendors, the products they sell and their offers (docs/CATALOG.md).
   One document per vendor, shops/<id>: { name, url, about, logo, locations[], products[], offers[] }.
   TYPES is the only place that knows what a product type is; the rest of the app reads allProducts().
   ===================================================================== */

/* Units a spec or a price can be in. Units of the same dim convert into each other (to: its size in the base unit). */
const UNITS = {
  mm: { dim: 'length', to: 0.001, label: 'mm' }, cm: { dim: 'length', to: 0.01, label: 'cm' }, m: { dim: 'length', to: 1, label: 'm' },
  m2: { dim: 'area', to: 1, label: 'm²' },
  ml: { dim: 'volume', to: 0.001, label: 'ml' }, L: { dim: 'volume', to: 1, label: 'L' },
  g: { dim: 'mass', to: 0.001, label: 'g' }, kg: { dim: 'mass', to: 1, label: 'kg' },
  'm2/L': { dim: 'coverage', to: 1, label: 'm²/L' },
  piece: { dim: 'count', to: 1, label: 'piece' }, strip: { dim: 'count', to: 1, label: 'strip' }, tin: { dim: 'count', to: 1, label: 'tin' },
  roll: { dim: 'count', to: 1, label: 'roll' }, pack: { dim: 'count', to: 1, label: 'pack' },
};
const CURRENCIES = { EUR: '€', GBP: '£', USD: '$' };
const unitLabel = (u) => (UNITS[u] ? UNITS[u].label : u || '');
const convert = (v, from, to) => (from === to ? v : UNITS[from] && UNITS[to] && UNITS[from].dim === UNITS[to].dim ? v * UNITS[from].to / UNITS[to].to : null);

/* A spec's value in the unit asked for, or the fallback when the product doesn't have it (or has it in a unit that won't convert). */
function specOf(p, key, unit, fallback) {
  const r = p.specs.find(s => s.key === key);
  if (!r || r.value === '' || r.value === null) return fallback;
  if (unit === undefined) return r.value;
  if (typeof r.value !== 'number') return fallback;
  const v = convert(r.value, r.unit, unit);
  return v === null ? fallback : v;
}

/* Spec rows each type starts with. need: the editor won't save without it. */
const dimSpecs = (h = 'Height') => [{ key: 'width', label: 'Width', unit: 'cm', need: true }, { key: 'depth', label: 'Depth', unit: 'cm', need: true }, { key: 'height', label: h, unit: 'cm', need: true }];
const FURNITURE_VIEW = (p) => ({ w: num(specOf(p, 'width', 'm', 0.6), 0.05, 8, 0.6), d: num(specOf(p, 'depth', 'm', 0.6), 0.05, 8, 0.6), h: num(specOf(p, 'height', 'm', 0.6), 0.004, 4, 0.6) });

/* Every type of product. group: furniture is placed in rooms, wall goes on walls, floor is laid in a room. sold: units it can be sold by (first is the default).
   view(p, perUnit): what the app needs from it; perUnit(u) gives the price for one u (or null). */
const TYPES = {
  ...Object.fromEntries(Object.entries(KINDS).map(([k, label]) => [k, { label, group: 'furniture', sold: ['piece'], specs: dimSpecs(k === 'rug' ? 'Thickness' : 'Height'), view: (p, per) => ({ ...FURNITURE_VIEW(p), price: per('piece') }) }])),
  wallpaper: { label: 'Wallpaper', group: 'wall', sold: ['roll', 'm2'],
    specs: [{ key: 'repeat', label: 'Pattern repeat (width)', unit: 'cm', need: true }, { key: 'rollWidth', label: 'Roll width', unit: 'cm' }, { key: 'rollLength', label: 'Roll length', unit: 'm' },
      { key: 'mural', label: 'Mural, made to measure', options: { no: 'No', yes: 'Yes' } }],
    view: (p, per) => {
      const mural = specOf(p, 'mural') === 'yes';
      return { price: mural ? per('m2') : per('roll'), wallpaper: { tile: p.image, aspect: p.imageAspect, mural, unit: mural ? 'm2' : 'roll',
        width: num(specOf(p, 'repeat', 'cm', 50), 5, 400, 50), rollW: num(specOf(p, 'rollWidth', 'cm', 53), 10, 300, 53), rollL: num(specOf(p, 'rollLength', 'cm', 1005), 50, 5000, 1005) } };
    } },
  paint: { label: 'Paint', group: 'wall', sold: ['tin', 'L'],
    specs: [{ key: 'tin', label: 'Tin size', unit: 'L', need: true }, { key: 'coverage', label: 'Covers', unit: 'm2/L', need: true }, { key: 'coats', label: 'Coats', unit: '' },
      { key: 'code', label: 'Colour code', unit: '' }, { key: 'finish', label: 'Finish', unit: '' },
      { key: 'mix', label: 'Colours', options: { no: 'One colour', yes: 'Any colour, mixed in the shop' } }],
    view: (p, per) => {
      const tinL = num(specOf(p, 'tin', 'L', 4), 0.1, 30, 4), perL = per('L');
      return { price: per('tin') ?? (perL !== null ? perL * tinL : null),
        paint: { tinL, coverage: num(specOf(p, 'coverage', 'm2/L', 10), 2, 25, 10), coats: num(Math.round(specOf(p, 'coats', '', 2)), 1, 4, 2),
          code: str(String(specOf(p, 'code', undefined, '')), 40), finish: str(String(specOf(p, 'finish', undefined, '')), 30), mix: specOf(p, 'mix') === 'yes' } };
    } },
  moulding: { label: 'Moulding', group: 'wall', sold: ['strip', 'm'],
    specs: [{ key: 'width', label: 'Face width', unit: 'mm', need: true }, { key: 'thickness', label: 'Thickness', unit: 'mm', need: true }, { key: 'length', label: 'Strip length', unit: 'm', need: true },
      { key: 'shape', label: 'Shape', options: MOULD_SHAPES }],
    view: (p, per) => {
      const len = specOf(p, 'length', 'm', 2.4), perM = per('m');
      return { price: per('strip') ?? (perM !== null ? perM * len : null),
        moulding: mouldSize({ face: specOf(p, 'width', 'm', 0.02), depth: specOf(p, 'thickness', 'm', 0.01), len, shape: specOf(p, 'shape') }) };
    } },
  /* Laminate, parquet, tiles, vinyl, carpet. The picture is a straight-down photo cut so it tiles; "repeat" is the width of floor it shows.
     With a pack size it's bought in whole packs (priced per pack); without, by the m². */
  flooring: { label: 'Flooring', group: 'floor', sold: ['pack', 'm2'],
    specs: [{ key: 'pack', label: 'One pack covers', unit: 'm2' }, { key: 'repeat', label: 'Width the picture shows', unit: 'cm', need: true },
      { key: 'surface', label: 'Surface', options: FLOOR_SURFACES }],
    view: (p, per) => {
      const pack = num(specOf(p, 'pack', 'm2', null), 0.05, 100, null), perM2 = per('m2'), s = specOf(p, 'surface');
      return { price: pack ? per('pack') ?? (perM2 !== null ? perM2 * pack : null) : perM2,
        flooring: { tile: p.image, aspect: p.imageAspect, width: num(specOf(p, 'repeat', 'cm', 100), 10, 1000, 100), pack, unit: pack ? 'pack' : 'm2', surface: FLOOR_SURFACES[s] ? s : 'wood' } };
    } },
};

/* ---------- Cleaning what comes from storage (other people's shops: untrusted) ---------- */
const SPEC_KEY = /^[a-z][\w-]{0,30}$/;
function cleanSpec(r) {
  if (!r || typeof r !== 'object' || !SPEC_KEY.test(r.key || '')) return null;
  const value = typeof r.value === 'number' && isFinite(r.value) ? Math.round(r.value * 1e6) / 1e6 : str(r.value, 60);
  return { key: r.key, label: str(r.label, 40, r.key), value, unit: str(r.unit, 12), price: num(r.price, 0, 1e6, null), currency: CURRENCIES[r.currency] ? r.currency : 'EUR' };
}
function cleanCatalogProduct(p) {
  p = p && typeof p === 'object' ? p : {};
  const type = TYPES[p.type] ? p.type : 'box', T = TYPES[type];
  const specs = (Array.isArray(p.specs) ? p.specs.slice(0, 30) : []).map(cleanSpec).filter(Boolean).filter((s, i, a) => a.findIndex(x => x.key === s.key) === i);
  return { id: /^[\w-]{1,40}$/.test(p.id || '') ? p.id : newId('p'), type, name: str(p.name, 80, 'Product'), about: str(p.about, 600), material: str(p.material, 60),
    unit: T.sold.includes(p.unit) ? p.unit : T.sold[0], price: num(p.price, 0, 1e6, null), currency: CURRENCIES[p.currency] ? p.currency : 'EUR',
    color: HEX.test(p.color || '') ? p.color : '#d4dad5', image: ASSET.test(p.image || '') ? p.image : null, imageAspect: num(p.imageAspect, 0.05, 20, 1),
    model: ASSET.test(p.model || '') ? p.model : null, specs };
}
function cleanOffer(o) {
  if (!o || typeof o !== 'object' || !/^[\w-]{1,40}$/.test(o.productId || '')) return null;
  return { id: /^[\w-]{1,40}$/.test(o.id || '') ? o.id : newId('o'), productId: o.productId, url: safeUrl(o.url), sku: str(o.sku, 40),
    price: num(o.price, 0, 1e6, null), currency: CURRENCIES[o.currency] ? o.currency : null, unit: UNITS[o.unit] ? o.unit : null };
}
/* Affiliate tracking Nido adds to a vendor's links (docs/CATALOG.md): wrap the link in a network's deep link
   (Awin, CJ, Impact, Tradedoubler: a template with {url}), or add a parameter (Amazon: tag=yourtag-21). */
const LINK = /^https:\/\/[^\s"'<>]+$/;
function cleanAffiliate(a) {
  if (!a || typeof a !== 'object') return null;
  const disclosure = str(a.disclosure, 300);
  if (a.mode === 'wrap' && typeof a.template === 'string' && LINK.test(a.template) && a.template.includes('{url}') && a.template.length <= 400) return { mode: 'wrap', template: a.template, disclosure };
  if (a.mode === 'param' && /^[\w-]{1,30}$/.test(a.param || '') && /^[\w.-]{1,60}$/.test(a.value || '')) return { mode: 'param', param: a.param, value: a.value, disclosure };
  return null;
}
function affiliateUrl(v, url) {
  const a = v && v.affiliate;
  if (!url || !a) return url;
  let out = url;
  if (a.mode === 'wrap') out = a.template.split('{url}').join(encodeURIComponent(url));
  else { try { const u = new URL(url); u.searchParams.set(a.param, a.value); out = u.toString(); } catch (e) { return url; } }
  return LINK.test(out) ? out : url;
}
/* Where a "Shop" link really goes. Rooms keep the plain link; the vendor's tracking is added when the link is drawn,
   so a new affiliate ID reaches every room already made. ref is a product's "shop:<vendor>:<product>". */
const vendorOf = (ref) => (typeof ref === 'string' && ref.startsWith('shop:') ? S.shops.get(ref.split(':')[1]) || null : null);
const priceOnSite = (ref) => !!(vendorOf(ref) || {}).priceOnSite;
function buyLink(url, ref) {
  const v = vendorOf(ref), href = affiliateUrl(v, url);
  return { href, sponsored: !!href && href !== url, vendor: v };
}
const cleanLocation = (l) => (l && typeof l === 'object' && (l.name || l.address) ? { name: str(l.name, 60), address: str(l.address, 160), map: safeUrl(l.map) } : null);

/* A product as old shops saved it (kind, sizes in metres, paint / wallpaper / moulding blocks, its own price and link): product + offer. */
function legacyProduct(p) {
  p = p && typeof p === 'object' ? p : {};
  const row = (key, label, value, unit) => ({ key, label, value, unit });
  let type = KINDS[p.kind] || MATERIALS[p.kind] ? p.kind : 'box', specs = [], unit, image = p.photo, aspect = 1;
  if (type === 'paint') { const t = p.paint || {}; specs = [row('tin', 'Tin size', t.tinL, 'L'), row('coverage', 'Covers', t.coverage, 'm2/L'), row('coats', 'Coats', t.coats, ''), row('code', 'Colour code', t.code, ''), row('finish', 'Finish', t.finish, '')]; unit = 'tin'; }
  else if (type === 'wallpaper') { const t = p.wallpaper || {}; specs = [row('repeat', 'Pattern repeat (width)', t.width, 'cm'), row('rollWidth', 'Roll width', t.rollW, 'cm'), row('rollLength', 'Roll length', typeof t.rollL === 'number' ? t.rollL / 100 : t.rollL, 'm'), row('mural', 'Mural, made to measure', t.mural ? 'yes' : 'no', '')]; unit = t.unit === 'm2' ? 'm2' : 'roll'; image = t.tile; aspect = t.aspect; }
  else if (type === 'moulding') { const t = p.moulding || {}; specs = [row('width', 'Face width', typeof t.face === 'number' ? t.face * 1000 : t.face, 'mm'), row('thickness', 'Thickness', typeof t.depth === 'number' ? t.depth * 1000 : t.depth, 'mm'), row('length', 'Strip length', t.len, 'm'), row('shape', 'Shape', t.shape, '')]; unit = 'strip'; }
  else specs = [row('width', 'Width', p.w * 100, 'cm'), row('depth', 'Depth', p.d * 100, 'cm'), row('height', type === 'rug' ? 'Thickness' : 'Height', p.h * 100, 'cm')];
  const product = cleanCatalogProduct({ id: p.id, type, name: p.name, about: p.about, unit, price: p.price, color: p.color, image, imageAspect: aspect, model: p.model, specs: specs.filter(s => s.value !== undefined && s.value !== null && !(typeof s.value === 'number' && !isFinite(s.value))) });
  return { product, offer: cleanOffer({ id: 'o-' + product.id, productId: product.id, url: p.url }) };
}

function cleanVendor(s, id) {
  s = s && typeof s === 'object' ? s : {};
  let products, offers;
  if (Array.isArray(s.offers)) {
    products = (Array.isArray(s.products) ? s.products.slice(0, 400) : []).map(cleanCatalogProduct);
    offers = s.offers.slice(0, 800).map(cleanOffer).filter(o => o && products.some(p => p.id === o.productId));
  } else {                                // an old shop: one offer per product, with the product's link
    const old = (Array.isArray(s.products) ? s.products.slice(0, 400) : []).map(legacyProduct);
    products = old.map(x => x.product); offers = old.map(x => x.offer);
  }
  return { id, name: str(s.name, 60, 'Shop'), url: safeUrl(s.url), about: str(s.about, 400), logo: ASSET.test(s.logo || '') ? s.logo : null, curated: !!s.curated,
    locations: (Array.isArray(s.locations) ? s.locations.slice(0, 20) : []).map(cleanLocation).filter(Boolean), products, offers, updatedAt: num(s.updatedAt, 0, 1e14, 0),
    affiliate: cleanAffiliate(s.affiliate), priceOnSite: !!s.priceOnSite };     // priceOnSite: the shop's rules keep prices on its own site (Amazon)
}
const cleanShop = cleanVendor;

/* ---------- Prices ---------- */
/* The price of one `unit` of a product at an offer: the offer's own, else the product's, else the first spec row with a price.
   A spec row's price is for one of what the product is sold by (a strip, a metre), whatever unit the row's value is in. */
function priceOf(p, o, unit) {
  const from = (amount, u) => { if (amount === null || amount === undefined) return null; const k = convert(1, unit, u); return k === null ? null : amount * k; };
  const own = o && o.price !== null ? from(o.price, o.unit || p.unit) : null;
  if (own !== null) return own;
  const base = p.price !== null ? from(p.price, p.unit) : null;
  if (base !== null) return base;
  const row = p.specs.find(s => s.price !== null);
  return row ? from(row.price, p.unit) : null;
}

/* ---------- What the rest of the app reads ---------- */
/* One product at one offer, in the shape rooms, walls and the shopping list use (and copy into homes). */
function productView(v, p, o) {
  const T = TYPES[p.type], per = (u) => priceOf(p, o, u), out = T.view(p, per);
  return { ref: `shop:${v.id}:${p.id}`, id: p.id, kind: p.type, name: p.name, about: p.about, material: p.material, color: p.color, photo: p.type === 'wallpaper' || p.type === 'paint' || p.type === 'flooring' ? null : p.image,
    image: p.image, model: p.model, w: 0.6, d: 0.6, h: 0.6, ...out, price: v.priceOnSite ? null : out.price ?? null, priceOnSite: v.priceOnSite, currency: (o && o.currency) || p.currency,
    url: (o && o.url) || null, sku: (o && o.sku) || '', shop: v.name, shopId: v.id, shopUrl: v.url, curated: v.curated, editable: false };
}
/* Every product anyone can use: Nido's basics, then each vendor's offers. */
function allProducts() {
  const out = BASICS.map(b => ({ ...b })), seen = new Set();
  for (const [, v] of S.shops) {
    const byId = new Map(v.products.map(p => [p.id, p]));
    for (const o of v.offers) { const p = byId.get(o.productId), ref = p && `shop:${v.id}:${p.id}`; if (p && !seen.has(ref)) { seen.add(ref); out.push(productView(v, p, o)); } }
  }
  return out;
}

/* ---------- Saving a vendor ---------- */
const myShop = () => S.shops.get(S.uid) || null;
/* The vendors this person can edit: their own shop, and any vendor at all for Nido's admins. */
const editableVendors = () => [...S.shops.values()].filter(v => v.id === S.uid || S.isAdmin);
async function saveVendor(v) {
  const body = JSON.parse(JSON.stringify({ name: v.name, url: v.url, about: v.about, logo: v.logo, curated: !!v.curated && S.isAdmin, locations: v.locations,
    products: v.products, offers: v.offers, affiliate: v.affiliate || null, priceOnSite: !!v.priceOnSite, updatedAt: Date.now() }));
  await S.db.doc('shops/' + (v.id || S.uid)).set(body);
}
const saveShop = saveVendor;
