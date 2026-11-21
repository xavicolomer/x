# Nido Rooms

Draw a room or a whole flat in 3D from its measurements, furnish it with real products, try paint and wallpaper on the walls, and see what it all costs, including how many tins of paint and rolls of wallpaper to buy.

It runs **offline**: everything is in one HTML file, with nothing loaded from the internet.

## Use it

Open `dist/nido.html` in Chrome, Edge, Firefox or Safari. Double-clicking the file is enough; no server or internet needed.

- **My homes**: start from one room or the example two-bedroom flat. Add rooms next to others, with a door between them. In Plan view, drag rooms to arrange them; they snap together with a 10 cm wall between.
- **Pick a room** from the menu beside the home's name (or tap it) to work on it on its own: size, windows, doors, radiators, wall finishes, mouldings and furniture.
- **Catalogue**: generic pieces plus 74 IKEA España products with their real sizes and prices (copied from ikea.com/es on 20 November 2026; check the links for today's prices).
- **For shops**: add your own products, wallpapers (with repeat and roll size) and paints (with tin size and coverage).
- **Shopping**: furniture, wallpaper rolls and paint tins for the whole home, with links to buy.
- **Download** saves a home as a `.nido.json` file, pictures included. **Open a file** (in My homes) opens one, on this computer or any other. That's how to back up or share a home.

Your homes, products and pictures are kept in this browser's storage on this computer. Clearing the browser's site data deletes them, so download the homes you want to keep. A private window keeps nothing after it closes.

## Build

```bash
npm install
npm run build
```

This writes:

- `dist/nido.html`: the offline app, one file (three.js, fonts and the IKEA catalogue inside).
- `dist/nido-claude.html`: the same app as a claude.ai artifact, where homes and shops are shared with everyone the artifact is shared with.

`npm run serve` serves `dist/` at http://localhost:8080 if you prefer a local server.

## Project layout

| Path | What it is |
| --- | --- |
| `src/index.html` | Page shell and styles |
| `src/engine.js` | 3D engine: rooms, walls, doors through shared walls, furniture models, cameras |
| `src/finish.js` | Wall finishes: paint, patterns, panelling, wallpaper, rails, mouldings |
| `src/app-data.js` | Data model (homes → rooms → walls, openings, items), templates, catalogue, storage calls |
| `src/app-ui.js` | Screens: Explore, My homes, Catalogue, For shops, the 3D studio, paint and wallpaper amounts |
| `src/runtime-local.js` | Offline storage (IndexedDB) used when the app isn't inside claude.ai |
| `src/data/ikea-es.json` | The bundled IKEA España catalogue |
| `src/fonts/` | Bricolage Grotesque, Manrope and JetBrains Mono (Latin subsets) |
| `tools/fetch_ikea.py` | Refreshes the IKEA data from ikea.com/es: `python3 tools/fetch_ikea.py src/data/ikea-es.json`, then `npm run build` |
| `tools/fetch_fonts.py` | Downloads the fonts again |

The source files share one scope: the build joins them in the order above and bundles three.js with esbuild.

## Limits

- Rooms are rectangles placed side by side; L-shaped rooms and angled walls aren't supported yet.
- Furniture can't be moved from one room to another; remove it and add it again.
- Colours on screen are approximations: check paint and wallpaper samples in real light.
