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

Checklist:

- [ ] Login succeeds
- [ ] Create Tournament from UI
- [ ] Move tournament to Setup
- [ ] Create Category
- [ ] Register Team(s)
- [ ] Create Court
- [ ] Refresh keeps correct data
- [ ] Backend errors (`400` / `404` / `409`) surface via Axios wrapper messages
- [ ] Logout / expired token returns to login without stale data

Do not start Drawing until this checklist is green.

## Development status

**Phase:** Organizer Vertical Slice #1 (in progress)

Next after DoD: Drawing → Schedule → Match monitor → Standing → Playoff → Champion.

## License

MIT — see [LICENSE](./LICENSE).
