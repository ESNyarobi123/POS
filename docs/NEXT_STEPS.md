# Next steps

## Done — vertical slice (auth → shift → sell → ledger → receipt)

- [x] Postgres migrate + seed (port **5434**)
- [x] Auth JWT + roles + org context (`security-agent`)
- [x] Inventory ledger `commitSaleMovement` (`inventory-agent`)
- [x] Catalog lookup / barcode (`catalog-agent`)
- [x] Shift open/close + atomic checkout + receipt (`sales-agent`)
- [x] Web wired to API (`frontend-pos-agent`)
- [x] Smoke verified: cash accessory sale + IMEI phone sale (reject without serial)

## Demo credentials

| User | Password | Role |
| --- | --- | --- |
| `cashier@guliosmart.local` | `Password123!` | CASHIER |
| `owner@guliosmart.local` | `Password123!` | OWNER |

## Run

```bash
docker compose up -d postgres redis

pnpm --filter @gulio/database db:seed

API_PORT=4010 pnpm --filter @gulio/api dev
# → http://localhost:4010/health

pnpm --filter @gulio/web exec next dev --port 3010
# → http://localhost:3010/login
# (use 3010 if 3000 is busy; set NEXT_PUBLIC_API_URL=http://localhost:4010)
```

### Happy path in UI

1. Login as cashier  
2. Open shift (REG-1, float e.g. 50000)  
3. Sell **USB-C Cable** (no IMEI) → CASH → receipt `RCP-…`  
4. Sell **Samsung Galaxy A07** → pick IMEI → pay → receipt  

Barcode scan codes: `GUL-USBC-CABLE-0001`, `GUL-A07-128-BLK-0001`

## Done — Back Office UI shell

- [x] Collapsible ChatGPT-style sidebar (`BackOfficeSidebar`)
- [x] Colored nav icon tiles per menu
- [x] Dashboard + polished products/inventory/labels/receive/customers/returns/reports/settings
- [x] Products & inventory wired to live catalog/balances APIs

## Next engineering (Phase 1 continue)

1. Close shift UI + variance (`sales-agent` + `frontend-pos-agent`)
2. Returns / refunds API with IMEI match (`sales-agent` + `inventory-agent`)
3. Product create API + CSV import (`catalog-agent`)
4. Customers CRUD beyond list (`customer-agent`)
5. Label print → real templates (`barcode-agent`)
6. Manager PIN for large refunds (`security-agent`)
7. E2E test suite shift→sell→pay→close (`qa-agent`)
8. Full Docker app containers (`devops-agent`)
