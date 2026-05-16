# CLAUDE.md — crbox-links

Bookmark manager at `links.crbox.ca`. Mirrors the crbox-fin pattern: FastAPI
backend + React/Vite frontend behind nginx, single Docker Compose stack,
deployed via Portainer git-stack on NAS3.

## Local dev

```bash
cp .env.example .env
docker compose up --build
```

For frontend HMR: `cd frontend && npm install && npm run dev` — proxies
`/api` to `http://localhost:8000`. The backend binds the SQLite DB at
`./data/links.db` via the volume mount.

## Architecture

- **Backend**: FastAPI on port 8000, SQLAlchemy 2.x ORM, Alembic migrations
  applied on container startup. APScheduler runs the nightly link check and
  SQLite `.backup` job. Auth is Cloudflare Access JWT, verified per request
  via the `Cf-Access-Jwt-Assertion` header.
- **Frontend**: nginx on port 80, serves the built React bundle and proxies
  `/api/*` to the backend. The proxy MUST forward the `Cf-Access-Jwt-Assertion`
  header — it's set in `frontend/nginx.conf`.
- **DB**: SQLite at `/data/links.db`. Backups land in `/data/backups/`,
  retained for `BACKUP_KEEP_DAYS` (default 30) days.
- **Favicons**: uploaded files go to `/data/favicons/<bookmark_id>.<ext>`.
  Resolved at serve time from the `favicon_source` + `favicon_ref` columns.

## Rules

- **Money / exact-decimal types** are NOT used here (no financial data) — the
  rule from the parent `CLAUDE.md` doesn't apply.
- **PowerShell** is the parent project's default shell; for THIS project,
  development is on the Mac, so examples use bash. Deployment is on Linux
  (NAS3).
- The two import source files (`URLs.zip`, `booky_backup_2026-05-16.html`)
  live in the repo root during initial setup but are gitignored. After
  importing, delete them.
- **Never commit `.env`** — it carries the CF Access AUD. The AUD isn't a
  secret (it's a public app identifier) but pinning it in source would couple
  the repo to one Cloudflare app.

## Adding a new feature

1. **Backend**: add the route under `backend/app/routers/`, register it in
   `app/main.py`. Add model/schema changes via Alembic
   (`alembic revision --autogenerate -m "..."`). Test with
   `curl http://localhost:8000/api/...` (skip the JWT header in local dev
   if `CF_ACCESS_AUD` is empty — auth is bypassed).
2. **Frontend**: add the component under `src/components/`, hook into the
   tile grid or modals. API calls go through `src/api.ts`. State is
   TanStack Query with a single root key per resource.
3. **DnD**: drag handles are on tiles and category headers. Sort order is
   integer columns (`bookmark.sort_order`, `category.sort_order`) — bump in
   gaps of 100 on insert to avoid renumbering on every reorder.

## Deployment

The stack is a Portainer git-stack on NAS3 endpoint 3, pulling from
`notoriousrig/crbox-links` on the `main` branch. Updates are pushed to
GitHub; Portainer redeploys on webhook or manual "Pull and redeploy".

Cloudflare Tunnel ingress for `links.crbox.ca` points at the shared traefik
on NAS3 (`http://traefik:8443`), and traefik dispatches by Host header to
this stack's `frontend` service.
