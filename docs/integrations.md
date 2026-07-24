# GulioSmart Retail POS — Integration Assessment Checklist

| Field | Value |
| --- | --- |
| **Purpose** | Client / ops checklist before and during Phase 1; readiness for Phase 2 adapters |
| **Stock truth** | **POS backend** is source of truth; Guliosmart website is a sales channel |
| **Related** | `docs/product-requirements.md` · `AGENTS.md` · `docs/offline-sync.md` |

Use this document in kickoff workshops. Mark each item: ✅ Ready · 🟡 Partial · ❌ Missing · ⬜ N/A.

---

## 1. Summary: Phase 1 mock vs real

| Integration | Phase 1 | Phase 2+ |
| --- | --- | --- |
| Guliosmart website catalog/stock sync | **Mock / outbox only** (events written, no live consumer required) | Real API + webhooks + `external_product_id` map |
| Receipt printing | **Real** (ESC-POS / PDF path) | Same + templates polish |
| Label printing | **Real** (or file/PDF preview if printer pending) | Same |
| Barcode / USB scanners | **Real** (HID keyboard wedge preferred) | Camera scan polish |
| Fiscal VFD/EFD | **MockFiscalProvider** interface only | Approved provider adapter + retry worker |
| Mobile money | **Manual record** (provider + reference) | Live MM APIs + callbacks |
| Card / other tenders | Out of scope unless cash-equivalent manual | Provider-specific |
| SMS / WhatsApp receipts | Not required | Optional |
| Object storage (images) | MinIO local / S3-compatible when needed | Prod S3 |

Cashier must **never** wait on website or fiscal success to finish a sale.

---

## 2. Guliosmart website access (needed for Phase 2; assess now)

### 2.1 Access checklist

| # | Item | Owner | Status | Notes |
| --- | --- | --- | --- | --- |
| G1 | Staging website URL | Client | ⬜ | |
| G2 | Production website URL | Client | ⬜ | |
| G3 | API docs or OpenAPI for products/stock/orders | Client / Guliosmart | ⬜ | |
| G4 | Auth method (API key, OAuth, HMAC) | Client | ⬜ | |
| G5 | Sandbox credentials for POS team | Client | ⬜ | Store in secret manager — never Git |
| G6 | Permission to create webhooks toward POS | Client | ⬜ | |
| G7 | Product identifier strategy (`external_product_id` ↔ variant) | Both | ⬜ | |
| G8 | Who wins on price conflict? (POS recommended as retail price master for store) | Product | ⬜ | |
| G9 | Who wins on stock conflict? (**POS is master**) | Product | ⬜ | Confirm in writing |
| G10 | Rate limits / IP allowlisting | Client | ⬜ | |
| G11 | Sample payload for product upsert + stock adjust | Client | ⬜ | |
| G12 | Contact for integration incidents | Client | ⬜ | Name + phone/email |

### 2.2 Events POS will emit (outbox) — Phase 1 writes, Phase 2 consumes

- `SALE_COMPLETED`
- `SALE_VOIDED`
- `RETURN_COMPLETED`
- `STOCK_UPDATED`
- `PRICE_UPDATED`
- `SERIAL_STATUS_CHANGED` (optional)

### 2.3 Phase 1 expectation

- Schema: `OutboxEvent`, optional `ExternalProductMap` stub (P2).
- Worker may no-op or log-drain events.
- No blocker for MVP acceptance if website credentials are late — **track as Phase 2 dependency**.

---

## 3. Printers

### 3.1 Receipt printers

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| P1 | Model per register (e.g. Epson TM-T20, Xprinter) | ⬜ | |
| P2 | Connection: USB / Ethernet / Bluetooth | ⬜ | |
| P3 | ESC-POS confirmed | ⬜ | |
| P4 | Paper width (58mm / 80mm) | ⬜ | |
| P5 | Auto-cutter present | ⬜ | |
| P6 | Test page from POS machine OS works | ⬜ | |
| P7 | Culinary/logo bitmap needed on receipt? | ⬜ | Provide PNG |

**Phase 1:** Real print path required for acceptance; if hardware delayed, PDF/browser print is interim **with written exception**.

### 3.2 Label printers

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| L1 | Model (e.g. Brother QL, Zebra GC/ZD) | ⬜ | |
| L2 | Label size(s) | ⬜ | |
| L3 | Barcode + QR on same label? | ⬜ | |
| L4 | Include shelf price on label? (display only) | ⬜ | Price never authoritative in QR |

Agent: `barcode-agent` / `devops-agent` for device networking.

---

## 4. Scanners

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| S1 | Counter scanner type (USB HID wedge recommended) | ⬜ | |
| S2 | Scans Code 128 + EAN/UPC + QR | ⬜ | |
| S3 | Suffix (Enter) after scan configured | ⬜ | |
| S4 | Mobile camera scan needed for MVP Scanner app? | ⬜ | |
| S5 | IMEI scan vs manual entry tolerance | ⬜ | |

**Phase 1:** HID wedge treated as keyboard input into POS search — **real**.  
Camera QR in PWA — nice-to-have if time permits; not a substitute for counter scanners.

---

## 5. Fiscal / VFD / EFD (TRA Tanzania and equivalents)

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| F1 | Is fiscalization legally required at pilot stores? | ⬜ | |
| F2 | Device type: VFD vs EFD printer vs cloud fiscal | ⬜ | |
| F3 | Vendor / approved solution name | ⬜ | |
| F4 | SDK / API docs available to POS team | ⬜ | |
| F5 | Sandbox device or simulator | ⬜ | |
| F6 | TIN / business registration details for fiscal payload | ⬜ | |
| F7 | Accept **MockFiscalProvider** for pilot go-live? | ⬜ | Required answer for Phase 1 |
| F8 | Idempotent retry SLA if device offline | ⬜ | Sale → `FISCAL_PENDING` |

**Phase 1:** Implement `FiscalProvider` + `FiscalDocument` + worker retry; ship **Mock** only unless F7 = No and F3–F5 are ready.

Agent: `integration-agent`.

---

## 6. Payment providers

### 6.1 Phase 1 (manual)

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| M1 | List of MM brands to show in UI dropdown | ⬜ | e.g. M-Pesa, Tigo Pesa, Airtel Money, HaloPesa |
| M2 | Reference format guidance for cashiers | ⬜ | |
| M3 | Require phone field on manual MM? | ⬜ | |
| M4 | Cash denominations / float policy | ⬜ | |
| M5 | Split tender allowed (cash + MM)? | ⬜ | PRD default: yes |

**Phase 1 behavior:** store `Payment.method = MOBILE_MONEY_MANUAL` + provider + reference. No payout API.

### 6.2 Phase 2 (automated) — gather early

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| A1 | Provider(s) for STK / USSD push | ⬜ | |
| A2 | Merchant / till numbers per branch | ⬜ | |
| A3 | Callback URL allowlist + signing secret | ⬜ | |
| A4 | Reconciliation file format | ⬜ | |
| A5 | Card / NAPS / bank POS needed? | ⬜ | |
| A6 | Refunds via API vs manual only | ⬜ | |

---

## 7. Network, devices, and deploy

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| D1 | POS terminals OS (Windows / Android / browser kiosk) | ⬜ | |
| D2 | Always-on LAN to local server vs cloud API | ⬜ | Affects offline design |
| D3 | Min bandwidth / power backup expectations | ⬜ | |
| D4 | Who hosts Docker stack (on-prem vs VPS)? | ⬜ | `devops-agent` |
| D5 | TLS certificates / domain for API & PWA | ⬜ | |
| D6 | Backup RPO/RTO targets | ⬜ | |
| D7 | Branch count at MVP pilot | ⬜ | |
| D8 | Registers per pilot branch | ⬜ | |

---

## 8. Business configuration inputs (non-hardware)

| # | Item | Default suggestion | Client answer |
| --- | --- | --- | --- |
| B1 | Currency | `TZS` | |
| B2 | Tax inclusive vs exclusive shelf prices | TBD | |
| B3 | Standard VAT rate(s) | TBD | |
| B4 | Max cashier discount % without PIN | e.g. 5% | |
| B5 | Large refund threshold (Manager PIN) | e.g. 100,000 TZS | |
| B6 | Void window | Same shift / same day | |
| B7 | Receipt footer / return policy text | TBD | |
| B8 | Warranty default months by category | Phase 2 heavy | |
| B9 | Low-stock default threshold | e.g. 3 | |

---

## 9. Security & compliance handoff

| # | Item | Status |
| --- | --- | --- |
| C1 | Owner admin email for first user | ⬜ |
| C2 | Manager PIN policy (length, rotation) | ⬜ |
| C3 | Data residency requirements | ⬜ |
| C4 | PII retention for customers/receipts | ⬜ |
| C5 | Who may export audit CSV | ⬜ |

See `docs/security.md`. Agent: `security-agent`.

---

## 10. Sign-off

| Role | Name | Date | Sign-off |
| --- | --- | --- | --- |
| Client product owner | | | ☐ PRD + mock/real matrix accepted |
| Client IT / store ops | | | ☐ Hardware list complete |
| GulioSmart technical | | | ☐ Website access path agreed (or deferred P2) |
| POS tech lead | | | ☐ Phase 1 build can proceed |

---

## 11. Open questions (roll-up)

1. Can pilot stores sell with **Mock fiscal**?
2. Exact MM brands and whether phone/reference are mandatory?
3. Receipt + label printer models and who supplies them?
4. When will Guliosmart API credentials exist for Phase 2?
5. On-prem vs cloud hosting for the Docker stack?
6. Tax inclusive pricing and discount/refund thresholds?

---

*End of integration assessment checklist.*
