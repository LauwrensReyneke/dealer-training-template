# Dealer Templating Engine

Vue 3 + Tailwind front-end with an embedded SQLite (sql.js) template + dealer API.

## Placeholders
Use these in template.txt:
- {{DEALER_NAME}}
- {{ADDRESS}}
- {{NUMBER}}
- {{BRAND}}

Synonyms:
- {{NAME}} (dealer name)
- {{PHONE}} (same as {{NUMBER}})

## Storage
Single file DB: `data/app.sqlite` (sql.js in-memory + file persistence on each write).
Delete the file to reset all data. The initial template seeds from `template.txt` if the DB is empty.

## Features
- Edit and persist the template.
- Dealer CRUD.
- Render + copy populated template per dealer (from Dealers tab or Render tab).
- Copy template button directly on each dealer row.
- Unified dev server: Vite + embedded API (no proxy required).

## API Summary
GET /api/template -> { template }
PUT /api/template { template } -> { ok }
GET /api/dealers -> { dealers }
POST /api/dealers { name, address, number, brand } -> { dealer }
PUT /api/dealers/:id -> { dealer }
DELETE /api/dealers/:id -> { ok }
GET /api/dealers/:id/render -> { rendered, dealer }
GET /api/health -> { ok:true }

## Development
Requires Node 18+ (native fetch, WASM support).

Install deps (root + client handled by scripts when building, but do this once for dev):
```
npm install
npm install --prefix client
```
Run dev (Vite + API):
```
npm run dev
```
Open http://localhost:5173

## Build
Build static client (output: client/dist):
```
npm run build
```
Serve production (Express + built assets + API):
```
npm run serve
```
Then open http://localhost:3000

## Tests
Integration API smoke test:
```
npm test
```
Persistence (verifies data survives restart locally):
```
npm run persistence:test
```

## Vercel Deployment
Two options:
1. Static + Serverless (current repo includes `api/` serverless functions):
   - Vercel runs `npm run build` (builds client) per `vercel.json`.
   - Static front-end served from `client/dist`.
   - API served via serverless functions under `/api/*` (state WILL NOT persist across cold starts because sql.js writes to ephemeral storage). Use this mode for demo only.
2. Single Node / Express (persistent local file not supported on Vercel’s serverless): deploy elsewhere (e.g. Render, Railway, Docker VPS) for real persistence.

If you need persistence on Vercel, switch to an external DB (e.g. PlanetScale / Neon / Turso) and adapt `db.js`.

## Data Persistence Notes
- Local: durable across restarts (app.sqlite updated after each mutation).
- Serverless: ephemeral; treat as volatile cache.

## Extend
Add new placeholders: extend mapping in `sharedApi.js` (renderTemplateForDealer) and `index.js` (if using Express only).

## Future Enhancements
- External DB adapter.
- Import/export JSON snapshots.
- Template version history.
- Placeholder validation/highlighting.

## License
Private / internal tooling (no explicit license set).
