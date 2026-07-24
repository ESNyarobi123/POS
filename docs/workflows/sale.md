# Workflow: Sale (Phase 1)

**Goal:** Complete an atomic checkout on an open register shift.  
**Owners:** `sales-agent` (orchestration) · `inventory-agent` (ledger/serials) · `frontend-pos-agent` (UI) · `security-agent` (permissions).  
**Related PRD:** `docs/product-requirements.md` §6–7, §11.

```text
Open shift → Scan/Search → Variant → IMEI if required
→ Customer (opt) → Discount (opt) → Payment → Complete sale
→ Ledger ↓ → Receipt → Fiscal pending (mock) → Outbox event
```

## Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Cashier
  participant POS as POS Web
  participant API as NestJS API
  participant Auth as Auth/Permissions
  participant Inv as InventoryService
  participant DB as PostgreSQL
  participant Print as Printing
  participant Fiscal as FiscalProvider (Mock)
  participant Outbox as Outbox/Worker

  Cashier->>POS: Open shift (opening float)
  POS->>API: POST /register-sessions/open
  API->>Auth: require pos.shift.open
  API->>DB: create RegisterSession OPEN
  API-->>POS: session id

  Cashier->>POS: Scan / search (F2)
  POS->>API: GET /catalog/lookup?code=
  API->>DB: resolve barcode/QR → variant (live price)
  API-->>POS: variant (+ tracks_serial)

  alt tracks_serial
    Cashier->>POS: Select IMEI/serial
    POS->>API: GET /inventory/serials?variant&status=IN_STOCK
    API-->>POS: available serials
  end

  opt Customer (F4)
    Cashier->>POS: Attach / create customer
    POS->>API: POST/GET /customers
  end

  opt Discount (F6)
    Cashier->>POS: Apply discount
    POS->>API: validate against caps
    alt over cap
      Cashier->>POS: Manager PIN
      API->>Auth: approve + audit
    end
  end

  Cashier->>POS: Pay (F9) cash and/or manual MM
  POS->>API: POST /pos/checkout (Idempotency-Key)
  API->>Auth: require pos.sell
  API->>DB: BEGIN
  API->>DB: insert Sale + SaleItems + Payments
  API->>Inv: commitSaleMovement(lines, serials)
  Inv->>DB: StockMovement SALE + SerialUnit SOLD + balance ↓
  API->>DB: COMMIT
  API->>DB: enqueue OutboxEvent SALE_COMPLETED
  API->>Fiscal: submit(sale) async / non-blocking
  Fiscal-->>API: FISCAL_PENDING or OK (mock)
  API-->>POS: sale + receipt payload

  POS->>Print: print receipt (IMEIs on lines)
  Print-->>Cashier: paper / PDF

  Note over Outbox: Worker drains outbox; website sync is Phase 2
```

## Rules (short)

1. No open shift → checkout rejected.  
2. Serial-tracked variant → cannot complete without `IN_STOCK` serial per unit.  
3. QR/barcode never supplies authoritative price — API returns live price.  
4. One DB transaction for sale + payments + serials + movements.  
5. Idempotent checkout; money as Decimal.  
6. Fiscal/website failures do not roll back a completed cash/MM sale.

## Offline variant

- Allowed: cash sale queued locally with idempotency key.  
- Blocked: new manual/online MM while offline.  
- On reconnect: flush queue; show **Pending sync** until server ACK.
