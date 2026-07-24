# GulioSmart Retail POS — Product Requirements (Phase 1 MVP)

| Field | Value |
| --- | --- |
| **Product** | GulioSmart Retail POS |
| **Tagline** | Sell smarter. Track everything. Grow everywhere. |
| **Domain** | Electronics retail (phones, computers, accessories) — not a generic supermarket POS |
| **Document status** | Phase 1 MVP PRD — approved for ERD + prototype alignment |
| **Source of truth** | This file + root `AGENTS.md` (architecture / agent routing) |
| **Stack (locked)** | Next.js PWA · NestJS + Fastify · PostgreSQL + Prisma · Redis + BullMQ · Docker |

---

## 1. Product vision

Build a **Retail Operating System** for electronics stores — not only a cashier cart.

The system must support:

- Products with variants (storage, RAM, color, etc.)
- **IMEI / serial tracking** (non-negotiable for tracked devices)
- Physical-store stock as ledger truth (online channel later)
- Barcode / QR labels
- Returns (exchanges and warranty lifecycle expand in Phase 2)
- Cash and mobile-money payment recording
- Multi-branch, multi-register operation with shifts and audit

### 1.1 Three interfaces

| Interface | Primary users | Purpose (Phase 1) |
| --- | --- | --- |
| **POS Register** | Cashier, Manager | Open/close shift · scan/search · cart · discount · customer · pay · receipt · return |
| **Back Office** | Owner, Manager, Inventory, Viewer | Dashboard · catalog · stock · customers · employees/roles · basic reports · CSV import · settings · audit |
| **Mobile Scanner** | Inventory, Cashier, Manager | Price check · IMEI lookup · inventory count assist · label request · quick product lookup |

Phase 1 Mobile Scanner does **not** include full PO receiving or warehouse transfers (Phase 2).

---

## 2. Goals & non-goals

### 2.1 Phase 1 goals

1. A cashier can complete a shift → sell → pay (cash / manual MM) → receipt → close shift loop reliably.
2. Serial-tracked devices cannot be sold without a valid `IN_STOCK` IMEI/serial.
3. Stock quantity changes only through an append-only `StockMovement` ledger.
4. Completed sales are immutable; corrections use void / refund / reversal / adjustment.
5. Permissions are enforced on the **backend**; UI gating is convenience only.
6. Money is never represented as JS `number` float — `Decimal` (or integer minor units) end-to-end.
7. Deployable via Docker Compose for a single organization with one or more branches.

### 2.2 Non-goals (Phase 1)

See [§14 Explicitly out of Phase 1](#14-explicitly-out-of-phase-1-phase-23).

---

## 3. Roles & permissions matrix

### 3.1 Roles

| Role | Intent |
| --- | --- |
| **Owner** | Full org control; billing/settings; cannot be locked out of own org |
| **Manager** | Store operations: discounts, voids, refunds, adjustments, staff day-to-day |
| **Cashier** | POS sell / return within limits; open/close own shift |
| **Inventory** | Catalog assist, stock counts, adjustments (policy-limited), labels, IMEI ops |
| **Viewer** | Read-only reports and catalog/stock visibility |

Permissions are assigned via role → permission codes. Custom role packs may be added later; MVP ships the five roles above.

### 3.2 Permission matrix

Legend: ✅ allow · ⚠️ allow with limit / manager PIN or Owner override · ❌ deny · ◐ read-only

| Capability | Owner | Manager | Cashier | Inventory | Viewer |
| --- | --- | --- | --- | --- | --- |
| Manage organization / branches / warehouses | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage registers & devices | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage users & roles | ✅ | ⚠️¹ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ◐² |
| Open / close **own** register shift | ✅ | ✅ | ✅ | ❌ | ❌ |
| Open / close **any** shift (override) | ✅ | ✅ | ❌ | ❌ | ❌ |
| POS sell (cash / manual MM) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Apply line/cart discount within policy | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Price override | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Hold / resume sale | ✅ | ✅ | ✅ | ❌ | ❌ |
| Void sale (same day / policy window) | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Process return / refund | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Large refund (above threshold) | ✅ | ✅ | ⚠️ PIN | ❌ | ❌ |
| Open cash drawer (no sale) | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Manage catalog (products/variants/prices) | ✅ | ✅ | ❌ | ✅ | ◐ |
| CSV product import | ✅ | ✅ | ❌ | ✅ | ❌ |
| Print / request labels | ✅ | ✅ | ✅ | ✅ | ❌ |
| View stock balances | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stock adjustment | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| Serial reassignment / status fix | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| Inventory count (MVP assist) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage customers | ✅ | ✅ | ✅³ | ❌ | ◐ |
| Basic reports | ✅ | ✅ | ◐⁴ | ◐⁵ | ✅ |
| Org settings (tax, receipt, discount caps) | ✅ | ⚠️ | ❌ | ❌ | ❌ |

¹ Manager may invite/edit Cashiers and Inventory at their branch; cannot change Owner or elevate to Owner.  
² Viewer: aggregated audit summaries only if enabled; no PII dump by default.  
³ Cashier: create/attach customer on sale; limited edit (phone/name).  
⁴ Cashier: own-shift sales summary only.  
⁵ Inventory: stock movement and low-stock views only.

### 3.3 Privileged actions (always audited)

Discounts above soft limit · price overrides · refunds · voids · stock adjustments · permission/role changes · drawer opens without sale · serial reassignment · manager PIN approvals.

---

## 4. Organization / branch / register / shift model

### 4.1 Hierarchy

```text
Organization
  └── Branch (store)
        ├── Warehouse (default one per branch in MVP; more later)
        ├── Register (physical till / device binding)
        │     └── RegisterSession (shift)
        └── Users (scoped by org; optional branch assignment)
```

| Entity | Rules |
| --- | --- |
| **Organization** | Tenant root. All rows carry `organization_id`. |
| **Branch** | Physical store. Sales and stock are branch-scoped. |
| **Warehouse** | Stock bucket. MVP: one primary warehouse per branch. Movements reference `warehouse_id`. |
| **Register** | Named till (e.g. “Counter 1”). Bound to a branch. |
| **RegisterSession (shift)** | Opened by a user on a register with opening float. Closed with counted cash + expected vs variance. |
| **User** | Belongs to org; has one primary role (MVP). May be restricted to one or more branches. |

### 4.2 Shift rules

1. A register may have at most **one OPEN** session at a time.
2. Cashier must open a shift before checkout is allowed on that register.
3. Opening float and closing counts are recorded; variance is visible to Manager/Owner.
4. Sales during a session are attributed to `register_session_id`, `register_id`, `branch_id`, `user_id`.
5. Closing a shift does not mutate historical sales; it seals the session for reporting.

### 4.3 Multi-tenant invariants

Every transactional and master-data row that is tenant-owned includes:

- `organization_id` (required)
- `branch_id` and/or `warehouse_id` where operationally scoped

API requests resolve tenant context from auth token + selected branch/register — never from untrusted client-only fields without server verification.

---

## 5. Product / variant / IMEI rules

### 5.1 Catalog model

| Concept | Description |
| --- | --- |
| **Brand** | Optional manufacturer brand |
| **Category** | Navigation / reporting grouping |
| **Product** | Sellable parent (e.g. “iPhone 15”) |
| **Variant** | SKU-level unit of sale (storage/RAM/color). **Price and barcode live on variant** |
| **SerialUnit** | Individual IMEI/serial instance for tracked variants |

### 5.2 Variant rules

- Every sellable line on a receipt references a **variant** (not only a product).
- Variants have: SKU, sell price, cost (optional visibility), tax class, `tracks_serial` flag, active flag.
- Price changes create an auditable price history (or versioned price fields); POS always fetches **live** price at scan/add time.
- CSV import upserts products/variants for MVP onboarding.

### 5.3 IMEI / serial rules

Statuses:

`IN_STOCK` · `RESERVED` · `SOLD` · `RETURNED` · `DAMAGED` · `IN_REPAIR` · `SUPPLIER_RETURN` · `TRANSFERRED`

| Rule | Detail |
| --- | --- |
| Required on sale | If `variant.tracks_serial = true`, checkout **cannot** complete without selecting a serial in `IN_STOCK` (or allowed sellable status) for each unit quantity. |
| Uniqueness | Serial/IMEI unique per organization (normalized). |
| Sale effect | Serial → `SOLD`; linked to sale line; stock movement `SALE` decrements warehouse balance. |
| Return effect | Returned serial must **match** serial sold on the original line; status → `RETURNED` (or back to `IN_STOCK` per return disposition policy). |
| Quantity products | Accessories with `tracks_serial = false` use quantity only (no SerialUnit). |
| Reassignment | Privileged + audited; never silent overwrite. |

Phase 1 intake paths for serials: **stock adjustment + CSV/manual serial intake** (and Mobile Scanner IMEI check). Full PO receive → label print loop is Phase 2 (schema reserved).

---

## 6. Sales

### 6.1 Happy path

```text
Open shift → Scan/Search → Resolve variant → Select IMEI if required
→ Optional customer → Optional discount → Payment → Complete sale
→ Ledger stock ↓ → Receipt → Fiscal status (interface; may be PENDING)
```

### 6.2 Cart & checkout rules

1. **Atomic checkout**: sale header + lines + payments + serial assignments + stock movements in **one DB transaction**.
2. **Idempotency**: client sends `Idempotency-Key`; duplicate submit returns the original sale.
3. Held sales: park cart on register; resume later; expire per policy (configurable).
4. Discounts: percent or amount within org caps; over-cap requires Manager PIN.
5. Tax: configurable tax classes; amounts stored as Decimal lines (not recomputed from float).
6. Split tender: multiple payment rows totaling sale total (cash + manual MM allowed).
7. Completing a sale emits domain outbox events for future sync/fiscal workers (cashier does not wait on external systems).

### 6.3 Immutability

After `COMPLETED`:

- No silent edit of lines, totals, or payments.
- Corrections: **void** (policy window), **refund/return**, or compensating **adjustment** documents.
- Every correction audited with actor, reason, and manager approval when required.

### 6.4 Voids

- Same-session / same-day void per org policy.
- Restores stock via reversing movements; serials return to sellable status per rules.
- Requires reason; Manager for cashier-initiated voids outside soft limits.

---

## 7. Payments (Phase 1)

| Method | Behavior |
| --- | --- |
| **CASH** | Recorded amount; change calculated server-side with Decimal math. |
| **MOBILE_MONEY_MANUAL** | Cashier records provider (M-Pesa, Tigo Pesa, Airtel Money, etc.), reference/phone, amount. **No live provider API** in Phase 1. |

Rules:

- Payment rows are immutable after sale completion.
- Sale total must equal sum of payments (within configured rounding rules).
- Offline: **cash only**; manual MM blocked while offline (see §10).
- Phase 2: automated MM APIs, webhooks, settlement reconciliation.

---

## 8. Returns

### 8.1 Happy path

```text
Search receipt → Select item(s) → Reason → Inspect/disposition
→ Refund method → Stock/serial update → Return receipt
```

### 8.2 Rules

1. Return references original `sale_id` / `sale_item_id`.
2. Quantity returned ≤ quantity sold minus prior returns.
3. **IMEI returned must match IMEI sold** on that line.
4. Refund methods: cash and/or manual MM record (mirrors original tender policy where possible).
5. Large refunds (threshold in org settings) require **Manager PIN**.
6. Stock: `RETURN` (or equivalent) movement increases sellable stock when disposition = restock; damaged path uses `DAMAGE` / status `DAMAGED`.
7. Exchange as a first-class document is Phase 2; MVP may model exchange as return + new sale.

---

## 9. Inventory ledger rules

### 9.1 Non-negotiable

**Never** mutate `product.stock` / `variant.qty` directly.  
Balances are derived (or maintained as projections) from **`StockMovement`** rows.

### 9.2 Movement types (Phase 1 core)

| Type | Direction | Typical trigger |
| --- | --- | --- |
| `SALE` | ↓ | Checkout |
| `RETURN` | ↑ | Customer return restock |
| `DAMAGE` | ↓ or status-only | Damaged disposition |
| `ADJUSTMENT` | ↑/↓ | Inventory correction (audited) |
| `PURCHASE_RECEIPT` | ↑ | Reserved; full PO UI Phase 2 |
| `TRANSFER_OUT` / `TRANSFER_IN` | ↓/↑ | Reserved; Phase 2 |
| `COUNT_VARIANCE` | ↑/↓ | Optional MVP count close |

### 9.3 Balance

- Unique balance key: `(organization_id, warehouse_id, variant_id)`.
- Serial-tracked units: quantity of `IN_STOCK` serials must reconcile with ledger for that variant/warehouse (enforced by service rules).
- Cross-module callers (e.g. POS) must use `inventoryService.commitSaleMovement()` (and siblings) — never inventory tables from other modules.

---

## 10. Offline rules (controlled)

Phase 1 offline is **limited**, not a full local database replica.

| Allowed offline | Blocked offline |
| --- | --- |
| Cached product/variant lookup | New online / automated MM payments |
| Cart build & hold locally | Stock transfers, PO receive |
| **Cash** sales queued for sync | Price sync from website |
| Basic customer attach (local/pending) | Role/permission changes |
| Pending receipts (local print queue) | Large privileged ops if policy requires online PIN server |

On reconnect:

1. Flush mutation queue with **idempotency keys**.
2. Server is source of truth for conflicts.
3. UI may show stock as **Pending sync** until confirmed.
4. Failed sync items surface for Manager resolution.

Details: `docs/offline-sync.md`.

---

## 11. Receipt & fiscal readiness

### 11.1 Receipts (Phase 1 — real)

- Printable / printable-PDF or ESC-POS path via printing package.
- Contents: org/branch, receipt number, datetime, cashier, lines (SKU, name, qty, price, discount), tax, total, payments, IMEI per line when present, return policy blurb (configurable).
- Reprint last receipt (`Ctrl+P` shortcut on POS).
- Receipt numbering unique per org (or per branch — configurable).

### 11.2 Fiscal (Phase 1 — interface only)

- Introduce `FiscalProvider` port in API/worker.
- Sale fiscal status: `NOT_REQUIRED` | `FISCAL_PENDING` | `FISCAL_OK` | `FISCAL_FAILED`.
- Phase 1 default provider: **MockFiscalProvider** (no TRA device required to sell).
- Sale **must not block** cashier on fiscal success; worker retries idempotently.
- Real VFD/EFD adapter = Phase 2 after client provider selection.

---

## 12. Barcode / QR / label rules

| Topic | Rule |
| --- | --- |
| Manufacturer barcode | Prefer when present on variant |
| Internal barcode | Generate Code 128 when missing (e.g. `GUL-A07-128-BLK-0001`) |
| QR payload | Product/variant URL or signed id **only** |
| **Price in QR** | **Never** treat embedded price as source of truth. Scan → fetch live price from API/cache |
| Labels | Name, variant attributes, barcode/QR, optional SKU; price on label is display-only snapshot |
| Scan path | POS and Mobile Scanner resolve barcode/QR → variant; then apply serial rules |

Owning packages: `packages/barcode`, `packages/printing`. Agent: `barcode-agent`.

---

## 13. Reports in MVP

Phase 1 reports (Back Office; role-filtered):

| Report | Description |
| --- | --- |
| **Daily sales** | Gross, discounts, net, tax, by register/cashier |
| **Shift Z-style summary** | Opening float, cash sales, MM manual, refunds, expected cash, variance |
| **Product / variant sales** | Units and revenue; top sellers |
| **Stock on hand** | Balances by warehouse/variant; low-stock filter |
| **Serial status** | Counts by status; sold/returned lookup |
| **Returns** | Returns by reason, value, cashier |
| **Payments mix** | Cash vs manual MM totals |
| **Audit extract** | Privileged actions for a date range (Owner/Manager) |

Exports: on-screen + CSV. Advanced analytics, forecasting, NL reports = Phase 2/3.

---

## 14. Explicitly out of Phase 1 (Phase 2/3)

### Phase 2

- Suppliers, purchase orders, goods receipt (full/partial), supplier invoices
- Inter-branch / warehouse **transfers**
- Automated **mobile money APIs** + settlement
- **VFD/EFD** production fiscalization
- Guliosmart **website stock/price sync** (outbox consumers live)
- Loyalty points, store credit automation
- Warranty lifecycle module (beyond serial status notes)
- First-class **exchange** documents
- Advanced reports / multi-branch consolidated BI
- Richer offline (broader mutation set, conflict UI)

### Phase 3

- Demand forecasting / reorder suggestions
- Anomaly detection (shrink, discount abuse)
- Natural-language reports for owners
- **AI never on the critical checkout path**

---

## 15. UX constraints (POS Register)

- Cart on the right; scanner-ready search; large total (32–40px, `tabular-nums`).
- Few modals; large touch targets.
- Shortcuts: `F2` search · `F4` customer · `F6` discount · `F8` hold · `F9` payment · `Ctrl+P` last receipt · `Esc` close.
- Palette: bg `#F8FAFC`, card `#FFF`, text `#0F172A` / `#64748B`, success `#16A34A`, warn `#F59E0B`, error `#DC2626`, border `#E2E8F0`.
- Font: Inter for POS operational UI.
- Do **not** copy Guliosmart e-commerce homepage into POS.

Agent: `ui-design-agent` + `frontend-pos-agent`.

---

## 16. Acceptance criteria for MVP

MVP is accepted when **all** of the following pass in a Dockerized environment for a demo org with ≥1 branch, ≥1 register, seeded catalog including serial-tracked and quantity SKUs.

### 16.1 Auth & org

- [ ] Owner can create/manage branches, registers, users, and assign the five roles.
- [ ] Backend rejects privileged actions without permission (UI bypass fails).
- [ ] Audit log records privileged actions listed in §3.3.

### 16.2 Shift → sell → pay → close

- [ ] Cashier cannot checkout without an open shift.
- [ ] Scan/search adds correct variant at **live** price.
- [ ] Serial-tracked line blocks pay until IMEI selected; quantity SKU does not.
- [ ] Cash and manual MM (incl. split) complete atomically; duplicate idempotency key does not double-sell.
- [ ] Stock ledger decreases; serial status `SOLD`.
- [ ] Receipt prints/shows with IMEIs; reprint works.
- [ ] Shift close records float/variance; sales attributed to session.

### 16.3 Returns

- [ ] Return from original receipt; IMEI mismatch rejected.
- [ ] Refund under threshold by Cashier; over threshold requires Manager PIN.
- [ ] Restock path increases ledger and sets serial appropriately.

### 16.4 Inventory & catalog

- [ ] No API path mutates stock without a `StockMovement`.
- [ ] Adjustment requires permission + audit reason.
- [ ] CSV import creates/updates variants; barcodes generate when missing.
- [ ] QR/barcode scan never trusts embedded price.

### 16.5 Offline & fiscal readiness

- [ ] Offline cash sale queues and syncs once with idempotency; MM blocked offline.
- [ ] `FiscalProvider` mock runs; sale can be `FISCAL_PENDING` without blocking checkout.

### 16.6 Reports & ops

- [ ] Daily sales, shift summary, stock on hand, returns, payments mix available to authorized roles.
- [ ] App runs via documented Docker Compose path; secrets via `.env` not Git.

### 16.7 E2E suites (required)

- [ ] `shift → sell → pay → close`
- [ ] `receive/intake IMEI → sell → return` (Phase 1 intake + return)
- [ ] Offline cash sale sync

---

## 17. Module ownership (implementation routing)

| Area | Module / path | Implement via |
| --- | --- | --- |
| Requirements / PRD | `docs/**` | `product-architect` |
| Auth, roles, audit | `auth`, `organization`, `audit` | `security-agent` |
| Catalog, prices, CSV | `catalog` | `catalog-agent` |
| Ledger, serials, counts | `inventory` | `inventory-agent` |
| Checkout, shifts, returns | `pos`, `payments` | `sales-agent` |
| Customers | `customers` | `customer-agent` |
| Barcode/labels | `packages/barcode`, `printing` | `barcode-agent` |
| POS/Scanner UI | `apps/web` `(pos)` `(scan)` | `frontend-pos-agent` |
| Design system | `packages/ui` | `ui-design-agent` |
| Fiscal/sync ports | `fiscal`, `integrations`, worker | `integration-agent` |
| PO/receive (Phase 2) | `purchasing` | `purchasing-agent` |
| Tests | `**/test/**`, e2e | `qa-agent` |
| Docker/deploy | `infra/**` | `devops-agent` |

---

## 18. Open client questions

See also `docs/integrations.md`. Blocking for production go-live (not necessarily for coding start):

1. TRA / fiscal device vendor and whether Mock is acceptable for pilot stores.
2. Mobile money providers to record in Phase 1 vs automate in Phase 2.
3. Receipt printer models (ESC-POS) and label printer models.
4. Scanner types (USB HID wedge vs camera) per counter.
5. Guliosmart website API access timeline for Phase 2 sync.
6. Discount caps, large-refund threshold, and tax inclusive vs exclusive defaults.
7. Single-warehouse-per-branch confirmation for MVP.

---

## 19. Recommended next steps (before heavy coding)

1. Approve this PRD + `docs/database.md` ERD.
2. Complete client checklist in `docs/integrations.md`.
3. Clickable UI prototype (POS + key Back Office screens) — `ui-design-agent` / `frontend-pos-agent`.
4. Scaffold modular monolith per `docs/FOLDER_STRUCTURE.md` / `docs/architecture.md`.
5. Implement vertical slice: auth → shift → sell → ledger → receipt (domain agents as routed).

---

*End of Phase 1 MVP PRD.*
