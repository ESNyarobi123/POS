# @gulio/web — GulioSmart Retail POS (clickable prototype)

Next.js 15 App Router PWA-ready scaffold with **mock screens** (no real auth/API).

## Run

From repo root:

```bash
pnpm install
pnpm --filter @gulio/web dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login`.

## Routes

| URL | Purpose |
| --- | --- |
| `/` | Redirect → `/login` |
| `/login` | Auth mock |
| `/shift/open` | Open shift + opening cash |
| `/pos` | Main POS (cart right, CASH/MOBILE/SPLIT) |
| `/pos/payment` | Payment mock (`?method=cash\|mobile\|split`) |
| `/pos/receipt` | Receipt mock |
| `/products` | Product list |
| `/products/new` | Create product form mock |
| `/labels` | Barcode / QR label preview |
| `/inventory` | Stock list mock |
| `/purchases/receive` | Receive stock mock |
| `/customers` | Customer list |
| `/returns` | Return / refund flow mock |
| `/reports` | Basic KPI cards |
| `/settings` | Org / tax / discount settings mock |
| `/scan/price` | Mobile scanner price-check stub |

## Route groups

- `(auth)` — login
- `(pos)` — shift, register, payment, receipt
- `(backoffice)` — products, inventory, purchases, customers, returns, reports, settings, labels
- `(scan)` — mobile scanner

Groups do not appear in the URL.

## UX notes

- Palette & Inter font per `AGENTS.md` / PRD §15
- Top bar: `GulioSmart POS | Branch | Cashier | Shift | Online ●`
- POS shortcuts legend (F2/F4/F6/F8/F9/Ctrl+P/Esc) — visual only
- Money displayed as TZS with `tabular-nums`; mock amounts use integer minor units
