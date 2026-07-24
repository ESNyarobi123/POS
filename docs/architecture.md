# Architecture

Modular monolith. See root `AGENTS.md` for locked decisions.

```text
Next.js PWA ──REST/WS──► NestJS modules ──► PostgreSQL
                              │
                         Redis / BullMQ worker
                              │
                    Guliosmart / VFD / SMS / S3
```

## Module map (API)

| Module | Owns |
| --- | --- |
| `auth` / `organization` | Users, roles, branches, registers, sessions |
| `catalog` | Products, variants, brands, prices, barcodes |
| `inventory` | Stock ledger, balances, transfers, counts |
| `pos` | Cart/held sales, checkout orchestration, shifts |
| `purchasing` | Suppliers, POs, GRNs |
| `customers` | CRM, loyalty, store credit |
| `payments` | Payment records, split pay |
| `fiscal` | FiscalProvider, VFD/EFD retries |
| `integrations` | Guliosmart sync, webhooks, outbox |
| `warranty` | Device warranty lifecycle |
| `audit` | Privileged action logs |
| `reporting` | Dashboards & exports |
| `printing` | Receipts & labels jobs |

Cross-module DB access is forbidden — use service interfaces.
