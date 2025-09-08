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
