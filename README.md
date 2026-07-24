# GulioSmart Retail POS

> **Sell smarter. Track everything. Grow everywhere.**

Electronics retail operating system for GulioSmart — POS register, back office, and mobile scanner.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js PWA + TypeScript + Tailwind + Gulio UI |
| Backend | NestJS + Fastify |
| Database | PostgreSQL + Prisma |
| Jobs | Redis + BullMQ |
| Storage | MinIO / S3 |
| Deploy | Docker Compose |

## Monorepo

```text
apps/web       → Next.js PWA (POS + Back Office + Mobile Scanner)
apps/api       → NestJS modular monolith
apps/worker    → Background jobs (sync, fiscal, labels, reports)
packages/*     → Shared UI, contracts, database, auth, barcode, printing
infra/         → Docker, reverse proxy, monitoring, backup
docs/          → Product & architecture docs
.cursor/       → Rules + sub-agents
```

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio mailpit

# Clickable UI prototype
pnpm --filter @gulio/web dev
# → http://localhost:3000

# API (NestJS + Fastify)
API_PORT=4010 pnpm --filter @gulio/api dev
# → http://localhost:4010/health
```

## Current milestone

| Deliverable | Status |
| --- | --- |
| PRD | `docs/product-requirements.md` |
| ERD + Prisma Phase 1 | `docs/database.md` · `packages/database` |
| Integration checklist | `docs/integrations.md` |
| Workflow diagrams | `docs/workflows/` |
| UI prototype (mock) | `apps/web` — 15 screens |
| API scaffold | `apps/api` — modules + `/health` |
| Next engineering steps | `docs/NEXT_STEPS.md` |

**Gate:** client approve PRD + ERD before production migrations / vertical slice.

## Agents & ownership

See [`AGENTS.md`](./AGENTS.md) and [`.cursor/agents/`](./.cursor/agents/).  
Route work by domain — never bypass module boundaries.
