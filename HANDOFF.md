# Where things stand (21 November 2026)

## Done

- **Nido Rooms app**, one codebase for three places:
  - offline: `dist/nido.html`, opened from disk, data kept in the browser;
  - AWS: `dist/web/index.html` plus `infra/`;
  - claude.ai artifact: `dist/nido-claude.html`, published at https://claude.ai/artifact/Y3qeWh5uruX2w4M1PGQdte (private to the owner).
- **Homes:** single rooms or whole flats. Rooms can be added next to others with a door between, dragged in Plan view (they snap with a 10 cm wall), and worked on one at a time. There's an example two-bedroom flat.
- **Walls:** paint (including shop paints with litres and tins), patterns, panelling, wallpaper (rolls worked out, strips shared between narrow frames), split walls, rails (straight, scallops, scallop border, wave), mouldings (frames, arches, padded, painted arches).
- **Catalogue:** generic pieces, 74 IKEA España products (exact sizes and prices from ikea.com/es, labelled "Added by Nido"), and shops' own products. Shops can list paint, wallpaper and 3D models (.glb).
- **Sharing:** publish to Explore, copy someone's home, download a home as `.nido.json` with its pictures and open it anywhere.
- **AWS (`infra/`):** CDK stack with DynamoDB on-demand, HTTP API and an ARM Lambda, S3 and CloudFront, Cognito Lite, a throttle, a budget alert and one-week logs. It compiles to a valid template (`cdk synth`). The API tests and the end-to-end browser tests pass against the local dev server. **It hasn't been deployed yet.**

## Next steps

1. **Deploy to AWS** from a computer whose AWS CLI has credentials:
   ```bash
   aws sts get-caller-identity
   ```
   ```bash
   npm install && npm run build
   ```
   ```bash
   cd infra && npm install && npx cdk bootstrap
   ```
   ```bash
   npx cdk deploy -c budgetEmail=you@example.com
   ```
   Then open `SiteUrl`, sign up, and check: publish a home (cover picture shows in Explore), upload a product photo in For shops, open the site in a second browser and see the home there. To moderate, add yourself to the `admins` group (command in `infra/README.md`).
2. **Push to GitHub.** Pushes from the cloud session were refused (403) because the Claude GitHub App isn't installed on `xavicolomer/x`. From a local clone, push normally.
3. Things worth knowing after deploying:
   - Cognito's built-in email sender is limited to a few dozen emails a day. That's fine for testers; use Amazon SES if more people sign up.
   - The first sign-in redirects to Cognito's hosted page, which can be branded later (managed login).
   - Run `npx cdk destroy` when a PoC is over: it deletes everything unless deployed with `-c keepData=true`.

## Not done yet (ideas, in rough order)

- L-shaped rooms and angled walls; rooms are rectangles placed side by side.
- Moving furniture from one room to another (now: remove and add again).
- Open doors, door swings, and checks that furniture clears them (the earlier single-room planner had these).
- Dragging individual moulding panels (now: set the number of panels).
- A photo-realistic render (the earlier planner had a path-traced Photo mode).
- A paint brand's colour card, imported the way the IKEA catalogue was (`tools/fetch_ikea.py` shows how).
- Search for a bigger catalogue: client-side search is fine for hundreds of products; avoid OpenSearch Serverless (fixed monthly cost).

## Files outside git

The zip from the session also has `room-planner/`: the original single-room planner, with shop wallpaper and rug photos. It's kept out of this public repository on purpose. Open `room-planner/spare-room-planner.html` with a local server, for example `python3 -m http.server` in that folder; its pictures load from relative paths.
