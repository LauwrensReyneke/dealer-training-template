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
Three persistence modes (auto-selected):
1. Vercel Blob (if BLOB_READ_WRITE_TOKEN set) -> persisted across deployments in a single sqlite file blob.
2. Local file (fallback) -> data/app.sqlite (persists locally, ephemeral on serverless cold starts without blob token).
3. (Optional) Remote Turso/libSQL (if you wire remoteDb.js manually in sharedApi.js – currently disabled by default).

Environment variables:
- BLOB_READ_WRITE_TOKEN: enables blob mode.
- BLOB_DB_KEY (optional): filename/key in blob storage (default: app.sqlite).
- BLOB_ACCESS (public|private): blob access level (default public; private will auto-fallback to public if unsupported).

On each write the DB is uploaded (immediately on Vercel, debounced locally) so template + dealers survive rebuilds/redeploys.

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
POST /api/dealer { name, address, number, brand } -> { dealer }
PUT /api/dealer?id=ID -> { dealer }
DELETE /api/dealer?id=ID -> { ok }
GET /api/render?id=ID -> { rendered, dealer }
POST /api/populate -> { inserted, total }

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
