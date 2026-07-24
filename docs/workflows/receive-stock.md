# Workflow: Receive stock

**Goal:** Increase warehouse stock (and capture IMEIs) so devices can be sold.  
**Owners:** `purchasing-agent` (PO/GRN, Phase 2) · `inventory-agent` (ledger/serials) · `barcode-agent` (labels) · Mobile UI: `frontend-pos-agent`.  
**Related PRD:** `docs/product-requirements.md` §5.3, §9, §14.

## Phasing

| Path | Phase | When to use |
| --- | --- | --- |
| **A. Adjustment / CSV serial intake** | **Phase 1 MVP** | Pilot stocking without suppliers module |
| **B. PO → Goods receipt** | **Phase 2** | Full purchasing: PO, partial receive, supplier invoice |

Both paths **must** create `StockMovement` rows (`ADJUSTMENT` or `PURCHASE_RECEIPT`) and never mutate balances directly.

---

## Path A — Phase 1 intake (MVP)

```text
Select variant / warehouse → Enter qty and/or scan IMEIs
→ Confirm reason → Ledger ↑ → Optional label print
```

```mermaid
sequenceDiagram
  autonumber
  actor Staff as Inventory/Manager
  participant UI as Back Office / Scan
  participant API as NestJS API
  participant Auth as Auth/Permissions
  participant Inv as InventoryService
  participant DB as PostgreSQL
  participant Labels as Label printing

  Staff->>UI: Start stock intake / adjustment
  UI->>API: POST /inventory/adjustments (or serial-intake)
  API->>Auth: require inventory.adjust
  API->>DB: BEGIN
  loop each serial (if tracks_serial)
    API->>DB: insert SerialUnit IN_STOCK (unique per org)
  end
  API->>Inv: commitAdjustment(+qty, serials, reason)
  Inv->>DB: StockMovement ADJUSTMENT + balance ↑
  API->>DB: AuditLog
  API->>DB: COMMIT
  API-->>UI: result

  opt Labels
    Staff->>UI: Request labels
    UI->>Labels: print barcode/QR (no price as truth)
  end
```

---

## Path B — Phase 2 purchase receive (target)

```text
PO → Send → Receive (full/partial) → Scan IMEI
→ Stock movements PURCHASE_RECEIPT → Labels → Supplier invoice
```

```mermaid
sequenceDiagram
  autonumber
  actor Buyer as Purchasing/Inventory
  participant BO as Back Office / Scan
  participant API as NestJS API
  participant Auth as Auth/Permissions
  participant Pur as PurchasingService
  participant Inv as InventoryService
  participant DB as PostgreSQL
  participant Labels as Label printing

  Buyer->>BO: Create PO (supplier, lines, costs)
  BO->>API: POST /purchasing/purchase-orders
  API->>Auth: require purchasing.po
  API->>DB: insert PurchaseOrder + lines (status DRAFT/SENT)

  Buyer->>BO: Receive against PO (full or partial)
  BO->>API: POST /purchasing/goods-receipts
  API->>Pur: validate qty ≤ open qty

  loop each received line
    alt tracks_serial
      Buyer->>BO: Scan IMEI(s) for qty
      BO->>API: attach serials to GR line
    end
  end

  API->>DB: BEGIN
  API->>DB: insert GoodsReceipt + lines
  API->>Inv: commitPurchaseReceipt(movements, serials)
  Inv->>DB: StockMovement PURCHASE_RECEIPT + SerialUnit IN_STOCK + balance ↑
  API->>DB: update PO line qty_received
  API->>DB: OutboxEvent STOCK_UPDATED
  API->>DB: COMMIT
  API-->>BO: GRN complete

  opt Labels
    Buyer->>BO: Print labels for received variants/serials
    BO->>Labels: Code 128 + QR (URL/id only)
  end

  opt Supplier invoice (P2)
    Buyer->>BO: Record supplier invoice
    BO->>API: POST /purchasing/supplier-invoices
  end
```

## Rules (short)

1. Serial/IMEI unique per organization; status starts `IN_STOCK`.  
2. Partial receive allowed on Path B; over-receive rejected unless policy says otherwise.  
3. Labels: manufacturer or internal barcode; QR never authoritative for price.  
4. Phase 1 MVP acceptance uses Path A (or CSV) plus later sell → return E2E.  
5. Path B UI/API is out of Phase 1 scope but ERD-marked in `docs/database.md`.
