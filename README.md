# Dealer Templating Engine

Vue 3 + Tailwind front-end with an Express backend for editing a text template containing placeholder variables and rendering it with dealer data.

## Placeholders
Use the following placeholders in template.txt:
- {{DEALER_NAME}}
- {{ADDRESS}}
- {{NUMBER}}
- {{BRAND}}

Synonyms also supported:
- {{NAME}} (same as {{DEALER_NAME}})
- {{PHONE}} (same as {{NUMBER}})

## Storage (Lightweight DB)
The app now uses an embedded SQLite database powered by sql.js (pure JS/WASM) stored at:
- data/app.sqlite

Characteristics:
- Zero external service required (file-based, cross-platform).
- Fully in-process; safe for low-concurrency internal tooling.
- Every write (template/dealer CRUD) persists to disk.
- If template.txt or dealers.json exist, they are used once for initial seeding.

To reset data, delete data/app.sqlite and restart the server.

## Features
- Edit and persist the raw template through UI or API.
- Insert placeholder tokens via quick buttons.
- Manage dealers (create, update, delete).
- Render template for a selected dealer and copy the result.
- Simple REST API for integration / automation.

## API Summary
GET /api/template -> { template }
PUT /api/template { template } -> { ok }
GET /api/dealers -> { dealers: [...] }
POST /api/dealers { name, address, number, brand } -> { dealer }
PUT /api/dealers/:id -> { dealer }
DELETE /api/dealers/:id -> { ok }
GET /api/dealers/:id/render -> { rendered, dealer }

## Dev Setup
Requires Node 18+.

Install:
```
npm install
npm install --prefix client
```
Dev (backend + frontend):
```
npm run dev:all
```

Build client & serve via Express:
```
npm run client:build
npm start
```

## Test
```
node serverTest.js
```
(Uses ephemeral port and sql.js backed DB.)

## Data Persistence
- data/app.sqlite (primary storage)
- template.txt / dealers.json (legacy seed sources only if DB empty)

## Notes
- Rendering performs global replacement of the supported tokens.
- Extend tokens by editing renderTemplateForDealer in index.js.
- sql.js keeps DB fully in memory; writes are flushed to data/app.sqlite on each change.

## Future Enhancements
- Search / filter dealers.
- Version history for template edits.
- Import/export dealer lists.
- User-defined dynamic placeholders.
