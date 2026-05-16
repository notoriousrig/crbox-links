# crbox-links

Self-hosted bookmark manager. Booky.io-style tile/category layout, tags,
search-as-you-type, customizable favicons, PWA. Single user, behind
Cloudflare Tunnel + Access at `links.crbox.ca`.

## Stack

- **FastAPI** — Python backend with APScheduler for nightly jobs
- **SQLite** — one-file DB, nightly `.backup` to `./data/backups`
- **React + Vite + Tailwind** — tile grid with dnd-kit drag-and-drop
- **fuse.js** — client-side fuzzy search (Option B flat-list mode)
- **simple-icons** + **lucide-react** + emoji — favicon library
- **Cloudflare Tunnel** — no exposed ports
- **Cloudflare Access** — edge auth, JWT verified by backend

## Features

- Tile grid grouped by category, drag-and-drop reorder
- Tags (many-to-many), colored chips, click-to-filter
- Search box: empty = tile view; one char typed = flat result list
- Operators: `tag:rust`, `cat:devtools`, `is:broken`
- Favicon: auto-fetch / paste URL / upload PNG-SVG / pick from library (3000+ brand logos + lucide + emoji)
- ⌘K command palette
- PWA with share target — Android: share URL to crbox-links
- Bookmarklet for one-click "add current page"
- Click counts → most-used sort
- Nightly dead-link check, badge on tile
- Bulk select / tag / move / delete
- Notes (markdown) per bookmark
- Light/dark theme
- Import: Netscape HTML (Chrome/Firefox/Safari/Edge), booky.io JSON, ZIP of `.url` files
- Export: Netscape HTML, JSON

## Local dev

```bash
cp .env.example .env       # fill in CF_ACCESS_*  (or leave blank to disable auth locally)
docker compose up --build
```

Frontend is served by nginx on `http://localhost` (port mapping may need to
be added in dev). The vite dev server with HMR can be run via
`cd frontend && npm install && npm run dev` — it proxies `/api` to
`http://localhost:8000` (mapped if you uncomment the ports section).

## Production deployment

See `CLOUDFLARE_SETUP.md` for the one-time tunnel + Access wiring.

The stack is deployed on NAS3 (192.168.2.30) as a Portainer git-stack
pulling from `notoriousrig/crbox-links`.

## Data layout

```
data/
├── links.db              # SQLite — primary DB
├── favicons/             # uploaded favicons (one per bookmark id)
└── backups/              # nightly sqlite3 .backup snapshots
```
