# Nido Rooms

A 3D home planner: draw rooms or a whole flat from measurements, decorate walls (paint, patterns, panelling, wallpaper, rails, mouldings), furnish with generic pieces, IKEA España products or shops' own products, and work out the shopping list, wallpaper rolls and paint tins. Proofs of concept: keep costs and complexity low.

## Commands

```bash
npm install && npm run build        # builds dist/nido.html (offline), dist/web/index.html (AWS), dist/nido-claude.html (claude.ai)
npm test                            # API unit tests (infra/test)
npm run test:e2e                    # browser tests; first run: npx playwright install chromium
cd infra && npm install && npm run dev   # local server with the real API code, on 8080 or the next free port
cd infra && npx cdk deploy          # AWS; see infra/README.md
```

Always run `npm run build` after editing `src/`: `dist/` is committed and is what people open.

## How it fits together

- `src/*.js` are not ES modules. `build.mjs` concatenates them into one scope in this order: `engine.js` (with `finish.js` inserted at `/*@@FINISH@@*/`), `runtime-local.js`, `runtime-aws.js`, `app-data.js`, `app-ui.js`. Then it bundles three.js with esbuild and inlines fonts and `src/data/ikea-es.json`. Top-level names are shared across files, so check for clashes when adding them.
- The app talks to storage only through a "runtime" with the calls `db`, `user`, `assets`, `downloads` (shaped like the claude.ai artifact platform). `connect()` in `app-data.js` picks one:
  - inside claude.ai: `window.claude`;
  - served with a `config.json` naming an API: `awsRuntime(cfg)` (Cognito sign-in, the Lambda API, S3 uploads);
  - otherwise (opened from disk): `localRuntime` (IndexedDB).
- Data paths the app uses: `data/users/<id>/<homeId>` (drafts), `homes/<owner>/rooms/<homeId>` (published), `homes/<owner>` (published list), `shops/<id>`. `runtime-aws.js` maps these onto API routes.
- Pictures and models are stored as `/_blob/<32-hex id>`. On AWS, CloudFront serves them from S3; offline, `blobSrc()` maps them to object URLs.
- Model: a home has `rooms[]`. Each room has `x`, `z` (its centre in the home's plan), `w`, `l`, `h`, `openings[]` (window, door, radiator on a wall, `off` measured from the left facing the wall), `walls{back,front,left,right}` (layout whole or split, `lo`/`hi` zones with finish, frames, inner finish), and `items[]` (`x`, `z` in room coordinates, `rot` in quarter turns, `p` a copy of the product).
- Engine: `buildRoom()` rebuilds the whole home. Doors in a shared wall cut through both rooms (`passOps`). The wall helpers work on the room set by `ctx(room)`.

## Rules

- Everything read from storage is untrusted (other people's homes and shops): pass it through the cleaners (`cleanHome`, `cleanShop`, `cleanProduct`, `cleanImg`, `cleanPaint`) and put names into the page with `textContent` (see the `fills` / `data-fill` pattern), never as HTML.
- AWS: pay per use only. No VPC, NAT, provisioned capacity, OpenSearch, WAF or custom domain without asking. Keep the API throttle and the budget alert.
- The repository is public: no personal names, keys or third-party photos in it.
- UI copy: plain, active voice, written from the user's side; British/Spanish units (cm, m², €).
