# Fetch a curated set of IKEA Spain products: names, prices, colours and links from the search API,
# exact outer dimensions from each product page. Usage: python3 tools/fetch_ikea.py src/data/ikea-es.json, then npm run build
import json, re, sys, time, html, urllib.request, urllib.parse
OUT = sys.argv[1]
UA = {'User-Agent': 'Mozilla/5.0'}
def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r: return r.read().decode('utf-8', 'ignore')
# (query, kind, how many, words the IKEA type name must contain)
QUERIES = [
  ('cuna', 'cot', 5, ['cuna']),
  ('cambiador', 'dresser', 3, ['cambiador']),
  ('estructura de cama', 'bed', 6, ['estructura cama', 'estructura de cama', 'cama']),
  ('cama infantil', 'bed', 3, ['cama']),
  ('armario ropero', 'wardrobe', 6, ['armario']),
  ('cómoda', 'dresser', 6, ['cómoda', 'cajonera']),
  ('mesita de noche', 'dresser', 4, ['mesita']),
  ('estantería', 'bookcase', 6, ['estantería', 'librería', 'estante']),
  ('trofast', 'bookcase', 2, ['almacenaje', 'estantería', 'combinación']),
  ('sofá 3 plazas', 'sofa', 5, ['sofá']),
  ('sillón', 'sofa', 4, ['sillón', 'butaca']),
  ('mesa de comedor', 'table', 4, ['mesa']),
  ('escritorio', 'table', 4, ['escritorio', 'mesa']),
  ('mesa de centro', 'table', 3, ['mesa']),
  ('silla', 'chair', 4, ['silla']),
  ('lámpara de pie', 'lamp', 4, ['lámpara de pie', 'pie']),
  ('alfombra', 'rug', 6, ['alfombra']),
  ('planta artificial', 'plant', 2, ['planta']),
]
def dims(pip):
    rows = re.findall(r'measurement-name">([^<]+)</span><span class="pipf-measurements-tab__measurement-value">([^<]+)<', pip)
    m = {}
    for k, v in rows:
        k = html.unescape(k).strip().lower(); v = html.unescape(v).strip()
        n = re.match(r'([\d.,]+)\s*cm', v)
        if n and k not in m: m[k] = float(n.group(1).replace(',', '.'))
    return m
# IKEA lists colour families (pure white, beige...). Turn them into believable tones, using the finish name first.
WORDS = [('beis', '#d3c6b0'), ('nogal', '#7a5236'), ('marrón oscuro', '#6e4a33'), ('tinte blanco', '#ece8df'), ('roble', '#cfa77a'), ('pino', '#d8b98c'), ('abedul', '#dcc29b'),
  ('fresno', '#d6bf9a'), ('bambú', '#cfae7c'), ('ratán', '#c99b62'), ('antracita', '#4a4d4f'), ('gris oscuro', '#6a6c6c'), ('gris claro', '#bdbdb8'), ('gris', '#9a9a98'),
  ('verde', '#8a9a7a'), ('rosa', '#d9a195'), ('azul', '#8fa6b8'), ('amarillo', '#e8cf7a'), ('hueso', '#ece6da'), ('natural', '#cdb995'), ('multicolor', '#c9a58f'),
  ('beige', '#d8cbb5'), ('negro', '#2f2f2f'), ('blanco', '#f3f2ed')]
FAM = {'ffffff': '#f3f2ed', 'f4f3d7': '#d8cbb5', '000000': '#2f2f2f', '949494': '#9a9a98', '814820': '#8a5a3a', '3b7d22': '#6f8f5c'}
def tone(design, fam, kind):
    if kind == 'plant': return '#6f8f5c'
    if kind == 'lamp':                      # shades are usually the light part
        for w in ('blanco', 'beige', 'hueso', 'natural'):
            if w in design: return dict(WORDS)[w]
    hits = sorted((design.find(w), -len(w), c) for w, c in WORDS if w in design)
    return hits[0][2] if hits else FAM.get(fam, '#d4dad5')
def pick(m, *keys):
    for k in keys:
        if k in m: return m[k]
    return None
out, seen = [], set()
for q, kind, n, words in QUERIES:
    url = 'https://sik.search.blue.cdtapps.com/es/es/search-result-page?' + urllib.parse.urlencode({'q': q, 'size': 40, 'types': 'PRODUCT'})
    items = json.loads(get(url))['searchResultPage']['products']['main']['items']
    took = 0
    for it in items:
        p = it.get('product') or {}
        if took >= n: break
        t = (p.get('typeName') or '').lower()
        if not any(w in t for w in words) or p.get('id') in seen or not p.get('pipUrl') or not (p.get('salesPrice') or {}).get('numeral'): continue
        if kind == 'bed' and any(x in t for x in ('canapé', 'somier', 'colchón', 'funda', 'cama alta', 'reversible', 'inferior')): continue
        if kind == 'table' and ('patas' in t or 'tablero' in t): continue
        if kind == 'sofa' and ('funda' in t or 'módulo' in t): continue
        if kind == 'bookcase' and ('balda' in t or 'puerta' in t): continue
        try: pip = get(p['pipUrl']); time.sleep(0.4)
        except Exception as e: print('pip fail', p['pipUrl'], e); continue
        m = dims(pip)
        ref = [float(x) for x in re.findall(r'[\d.,]+', (p.get('itemMeasureReferenceText') or '').replace(',', '.'))]
        if 'sillas' in t or 'juego' in t: continue
        w = pick(m, 'ancho', 'anchura', 'anchura máxima', 'ancho de mesa', 'diámetro')
        d = pick(m, 'fondo', 'profundidad', 'largo', 'longitud', 'fondo máximo', 'profundidad máxima', 'longitud de mesa', 'diámetro')
        h = pick(m, 'altura', 'altura total', 'altura incl. cojines del respaldo', 'altura del respaldo', 'altura del cabecero', 'altura máxima', 'altura de mesa')
        if kind in ('table', 'cot', 'dresser') and w and d and d > w: w, d = d, w
        if kind == 'lamp':
            dia = pick(m, 'diámetro de la pantalla', 'anchura de la pantalla', 'diámetro de la base', 'diámetro', 'diámetro del pie', 'ancho')
            w = d = dia
        if kind == 'rug':
            w = pick(m, 'ancho') or (ref[0] if ref else None); d = pick(m, 'largo', 'longitud') or (ref[1] if len(ref) > 1 else None); h = 1
        if kind == 'plant':
            dia = pick(m, 'diámetro de la maceta', 'diámetro máximo de la maceta', 'diámetro'); h = pick(m, 'altura de la planta', 'altura')
            if not h or h < 45: continue
            w = d = max(30, (dia or 15) * 2)
        if w is None and len(ref) >= 1: w = ref[0]
        if d is None and len(ref) >= 2: d = ref[1]
        if h is None and len(ref) >= 3: h = ref[2]
        if not (w and d and h): print('no dims', p['name'], p.get('typeName'), m, ref); continue
        colors = p.get('colors') or []
        fam = (colors[0].get('hex') or '').lower() if colors else ''
        design = (p.get('validDesignText') or '').lower()
        col = tone(design, fam, kind)
        name = f"{p['name']} {p.get('typeName', '').lower()}" + (f", {p['validDesignText']}" if p.get('validDesignText') else '')
        out.append({'id': 'ikea-' + p['id'], 'kind': kind, 'name': name[:80], 'w': round(w / 100, 3), 'd': round(d / 100, 3), 'h': round(h / 100, 3),
                    'color': col.lower(), 'price': float(p['salesPrice']['numeral']), 'url': p['pipUrl'], 'about': (p.get('itemMeasureReferenceText') or '')[:60]})
        seen.add(p['id']); took += 1
        print(kind, '|', name[:60], '|', w, d, h, '|', p['salesPrice']['numeral'], col)
out = [p for p in out if 'litera' not in p['name'].lower()]          # bunk beds don't draw well as beds
doc = {'name': 'IKEA España', 'url': 'https://www.ikea.com/es/es/', 'curated': True, 'logo': None,
       'about': f"Products, sizes and prices copied from ikea.com/es by Nido on {time.strftime('%d %B %Y')}. Not listed by IKEA itself. Prices change: check the link before buying.",
       'products': out, 'updatedAt': int(time.time() * 1000)}
json.dump(doc, open(OUT, 'w'), ensure_ascii=False)
print(len(out), 'products')
