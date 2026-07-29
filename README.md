# Set Point — Frontend (FE-SetPoint)

Organizer dashboard for the **Set Point** padel tournament platform.

Companion backend: [BE-SetPoint](https://github.com/febrianrachmat/BE-SetPoint)  
API contract: `BE/docs/22-api-consumption-guide.md`

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- TanStack Query
- React Hook Form + Zod
- Axios (envelope unwrap + `ApiError`)
- Lucide icons

Single app at repo root (not a monorepo yet). Features grow with the organizer flow — no empty Drawing/Playoff folders until those screens exist.

## Quick start

```bash
# Backend on :3000 (seeded)
cd ../BE && npm run start:dev

# Frontend on :3001
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3001/login  
Demo: `admin@setpoint.local` / `Password123!`

## Structure

```text
src/
  app/
    login/
    (organizer)/tournaments/...
  components/ui/          # shadcn
  features/
    auth/
    tournament/
    category/
    team/
    court/
  lib/api/                # Axios client + domain API helpers
```

## Definition of Done — Vertical Slice #1

A feature is done only when it runs **end-to-end against the live backend**, not when the page renders.

Checklist (verified 2026-07-29 via `npx tsx scripts/dod-slice1.ts`):

- [x] Login succeeds
- [x] Create Tournament from UI
- [x] Move tournament to Setup
- [x] Create Category
- [x] Register Team(s)
- [x] Create Court
- [x] Refresh keeps correct data
- [x] Backend errors (`400` / `404` / `409`) surface via Axios wrapper messages
- [x] Logout / expired token returns to login without stale data

Re-run: `npx tsx scripts/dod-slice1.ts` (BE `:3000`, FE `:3001`).

Do not start Drawing until this checklist is green.

## Development status

**Phase:** Organizer Vertical Slice #1 ✅ · Drawing ✅ · Schedule ✅

Next: Match monitor / scoring after Schedule is Live Ready (and tournament go-live).

## License

MIT — see [LICENSE](./LICENSE).
