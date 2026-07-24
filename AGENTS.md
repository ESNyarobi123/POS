# GulioSmart Retail POS — Agent Memory

> **Product:** GulioSmart Retail POS  
> **Tagline:** Sell smarter. Track everything. Grow everywhere.  
> **Domain:** Electronics retail (phones, computers, accessories) — not a generic supermarket POS.

This file is the persistent source of truth for architecture, workflows, development rules, and **which sub-agent owns what**. Do not drift without an explicit product decision.

---

## Vision

Build a **Retail Operating System**, not just a cashier cart screen.

Must support:

- Standard products + variants (storage, RAM, color)
- IMEI / serial tracking (non-negotiable)
- Warranty
- Online + physical store stock
- Barcode / QR labels
- Returns & exchanges
- Suppliers & purchase orders
- Cash, mobile money, and other payments

### Three interfaces

| Interface | Users | Purpose |
| --- | --- | --- |
| **POS Register** | Cashier | Scan, cart, discount, customer, payment, receipt, return/exchange |
| **Back Office** | Owner / manager | Dashboard, products, stock, suppliers, purchases, employees, reports, customers, expenses, settings, online sync |
| **Mobile Scanner** | Staff on phone | Price check, inventory count, receive stock, transfer, create product, IMEI check, label request |

---

## Stack (final decision)

```text
Frontend:  Next.js PWA + TypeScript + Tailwind + Gulio UI
Backend:   NestJS + Fastify (NOT Next.js API routes as main backend)
Database:  PostgreSQL + Prisma
Jobs:      Redis + BullMQ
Storage:   MinIO (local) / S3-compatible (prod)
Deploy:    Docker Compose + Caddy/Nginx
Shape:     Modular monolith (no microservices at start)
```

---

## Monorepo map

```text
guliosmart-pos/
├── AGENTS.md
├── apps/
│   ├── web/                 # Next.js PWA — (auth) (pos) (backoffice) (scan)
│   ├── api/                 # NestJS modules — auth, catalog, inventory, pos, …
│   └── worker/              # BullMQ — sync, fiscal, receipts, labels, reports
├── packages/
│   ├── ui/ | contracts/ | database/ | auth/ | barcode/ | printing/ | config/
│   ├── eslint-config/ | typescript-config/
├── infra/                   # docker, nginx, caddy, monitoring, backup
├── docs/                    # PRD, architecture, database, security, offline, integrations
├── .cursor/
│   ├── agents/              # 13 domain sub-agents
│   └── rules/               # always-on + path-scoped rules
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

Details: `docs/FOLDER_STRUCTURE.md`.

---

## Sub-agent routing (use these)

Custom agents live in `.cursor/agents/`. Parent agent must route by domain.

| Sub-agent | Responsibility | Primary paths |
| --- | --- | --- |
| `product-architect` | Requirements, workflows, phasing, PRD | `docs/**`, `AGENTS.md` |
| `ui-design-agent` | Design system, POS UX, tokens | `packages/ui/**` |
| `frontend-pos-agent` | Cart, checkout UI, shortcuts, offline UI, scanner pages | `apps/web/src/app/(pos|scan)/**`, `apps/web/src/features/**` |
| `catalog-agent` | Products, variants, brands, pricing | `apps/api/src/modules/catalog/**`, `packages/contracts/src/catalog/**` |
| `inventory-agent` | Stock ledger, transfers, counts, serial status | `apps/api/src/modules/inventory/**`, `packages/contracts/src/inventory/**` |
| `barcode-agent` | Barcode/QR, labels, scan helpers | `packages/barcode/**`, `packages/printing/**` |
| `sales-agent` | Sales, refunds, discounts, shifts, payment records | `apps/api/src/modules/pos/**`, `payments/**` |
| `purchasing-agent` | Suppliers, POs, receiving | `apps/api/src/modules/purchasing/**` |
| `customer-agent` | CRM, loyalty, warranty profiles | `apps/api/src/modules/customers/**`, `warranty/**` |
| `integration-agent` | Guliosmart, VFD/EFD, MM APIs, worker sync | `modules/integrations/**`, `fiscal/**`, `apps/worker/**` |
| `security-agent` | Auth, permissions, audit | `modules/auth/**`, `organization/**`, `audit/**`, `packages/auth/**` |
| `qa-agent` | Unit, integration, E2E | `**/test/**`, e2e specs |
| `devops-agent` | Docker, deploy, backups, monitoring | `infra/**`, `docker-compose.yml` |

### Ownership example

- `inventory-agent` may change `modules/inventory/**` + inventory contracts/tests.  
  May **not** change payment logic, delete ledger rows, or mutate schema without migration.
- `sales-agent` creates sales but **must** call `inventoryService.commitSaleMovement()` — never `product.stock -= n`.

---

## Multi-tenant structure (from day one)

Always use: `organization_id` · `branch_id` · `warehouse_id` · register · register_session · user/role/permission

---

## Core workflows

### Sale

```text
Open Shift → Scan/Search → Variant → IMEI/Serial if required
→ Customer (opt) → Discount (opt) → Payment → Complete Sale
→ Deduct stock via ledger → Receipt → Fiscalize (EFD/VFD) → Sync online stock
```

### Purchase receive

```text
PO → Send → Receive (full/partial) → Scan + record IMEI
→ Stock movements → Print labels → Supplier invoice
```

### Return / exchange

```text
Search receipt → Item → Reason → Inspect → Return/Exchange/Warranty
→ Refund method → Update stock/serial status
```

IMEI returned must match IMEI sold. Large refunds require manager PIN.

### Offline (controlled)

Allowed: product lookup, cart, cash sales, basic customer, pending receipts.  
Blocked: new online/mobile-money payments.  
Reconnect: sync queue; stock may show `Pending sync`.

---

## Non-negotiable domain rules

1. **No direct stock mutation** — only via `StockMovement` ledger.
2. **Financial records immutable** — void / refund / reversal / adjustment only.
3. **Atomic checkout** — sale + items + payments + serials + stock movements in one DB transaction.
4. **Idempotency** on checkout, payment callbacks, VFD, Guliosmart webhooks.
5. **No cross-module DB access** — modules talk via services/interfaces.
6. **Audit privileged actions** — discounts, overrides, refunds, voids, adjustments, permissions, drawer, serial reassignment.
7. **Money is never JS float** — decimal or integer minor units.
8. **Permissions enforced on backend**, not UI only.
9. **Business rules configurable** — discounts, warranty, tax, receipts.
10. **Tests required** per module + E2E for critical flows.

### Serial / IMEI

Sale of serial-tracked device **cannot complete** without selecting IMEI/serial.  
Statuses: `IN_STOCK | RESERVED | SOLD | RETURNED | DAMAGED | IN_REPAIR | SUPPLIER_RETURN | TRANSFERRED`.

### Barcode / QR

- Manufacturer barcode when present.
- Internal Code 128 when missing (e.g. `GUL-A07-128-BLK-0001`).
- QR = product URL / signed id — **never embed price as source of truth**.

### Integrations

- **POS backend = source of truth for stock.**
- Guliosmart website = sales channel via API/webhooks + `external_product_id`.
- Sync via outbox/events; cashier never waits on website.
- **FiscalProvider** ready from start; sale can be `FISCAL_PENDING` with idempotent retry.

---

## UI / UX (POS)

- Cart right; search scanner-ready; large total; few modals; big touch targets.
- Shortcuts: `F2` search, `F4` customer, `F6` discount, `F8` hold, `F9` payment, `Ctrl+P` last receipt, `Esc` close.
- Palette: bg `#F8FAFC`, card `#FFF`, text `#0F172A` / `#64748B`, success `#16A34A`, warn `#F59E0B`, error `#DC2626`, border `#E2E8F0`.
- Font: Inter; cart total 32–40px bold; amounts `tabular-nums`.
- Do **not** copy Guliosmart e-commerce homepage UI into POS.

---

## Phased delivery

| Phase | Focus |
| --- | --- |
| **Before coding** | PRD, clickable UI prototype, ERD approval, integration assessment |
| **MVP (Phase 1)** | Auth/roles/branches, shifts, catalog+variants, barcode/QR/labels, IMEI, POS checkout, cash + manual MM, stock ledger, customers, receipts, returns, basic reports, CSV import, Docker, audit |
| **Phase 2** | Suppliers/PO/receiving, transfers, advanced reports, loyalty, warranty, website sync, MM APIs, VFD/EFD, better offline |
| **Phase 3** | Forecasting, reorder AI, anomaly detection, NL reports — AI **never** on critical checkout path |

---

## First rule when implementing

Prefer modular monolith boundaries, ledger-based inventory, and electronics-retail flows (IMEI/warranty) over generic supermarket shortcuts.  
When unsure which agent owns a change → check the routing table above, then open `.cursor/agents/<name>.md`.
