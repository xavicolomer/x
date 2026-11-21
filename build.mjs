// Builds two pages from src/:
//   dist/nido.html         the offline app: one self-contained file (three.js, fonts and the IKEA catalogue inside)
//   dist/nido-claude.html  the same app for claude.ai artifacts, loading three.js from a CDN and using the platform's shared store
// Usage: npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('./src/', import.meta.url).pathname, DIST = new URL('./dist/', import.meta.url).pathname;
const read = (f) => readFileSync(join(SRC, f), 'utf8');
mkdirSync(DIST, { recursive: true });

// The app is written as one shared scope: the finish engine sits inside the 3D engine, then the data layer and the screens.
const imports = `import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
`;
const seed = `const IKEA_SEED = ${read('data/ikea-es.json').trim()};\n`;
const app = read('engine.js').replace('/*@@FINISH@@*/', read('finish.js')) + '\n' + read('runtime-local.js') + '\n' + read('app-data.js') + '\n' + read('app-ui.js');
const source = imports + seed + app;

// index.html: everything before <header> belongs in <head>; the rest is the body. Drop its CDN import map and module script.
const page = read('index.html');
const cut = page.indexOf('<header');
let head = page.slice(0, cut), body = page.slice(cut);
const scriptsAt = body.indexOf('<script type="importmap">');
body = body.slice(0, scriptsAt);
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
const shell = (headExtra, bodyEnd) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${headExtra}
</head>
<body>
${body}${bodyEnd}
</body>
</html>
`;

// 1. Offline: bundle three.js in, inline the fonts as data URIs.
const out = await build({ stdin: { contents: source, resolveDir: SRC, loader: 'js', sourcefile: 'nido.js' }, bundle: true, format: 'esm', minify: true, write: false, target: 'es2020', legalComments: 'eof' });
let fonts = read('fonts/fonts.css');
for (const f of readdirSync(join(SRC, 'fonts')).filter(f => f.endsWith('.woff2'))) fonts = fonts.split(`url(${f})`).join(`url(data:font/woff2;base64,${readFileSync(join(SRC, 'fonts', f)).toString('base64')})`);
const offlineHead = head.replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n?/g, '').replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '') + `<style>\n${fonts}</style>\n<style>[hidden]{display:none!important}body{margin:0}</style>`;
writeFileSync(join(DIST, 'nido.html'), shell(offlineHead, `<script type="module">\n${safe(out.outputFiles[0].text)}</script>`));

// 2. claude.ai artifact: the page content only (the platform adds the document shell), three.js from the CDN.
const artifactScript = `<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
<script type="module">
${safe(source)}</script>
`;
writeFileSync(join(DIST, 'nido-claude.html'), head + body + artifactScript);
const kb = (f) => Math.round(readFileSync(join(DIST, f)).length / 1024);
console.log(`dist/nido.html ${kb('nido.html')} KB · dist/nido-claude.html ${kb('nido-claude.html')} KB`);
