# Workflow: Return (Phase 1)

**Goal:** Refund/restock against an original completed sale with IMEI integrity.  
**Owners:** `sales-agent` · `inventory-agent` · `security-agent` (Manager PIN) · `frontend-pos-agent`.  
**Related PRD:** `docs/product-requirements.md` §8.

```text
Search receipt → Item → Reason → Inspect/disposition
→ Refund method → Stock/serial update → Return receipt
```

## Sequence

```mermaid
sequenceDiagram
  autonumber
  actor Cashier
  actor Manager
  participant POS as POS Web
  participant API as NestJS API
  participant Auth as Auth/Permissions
  participant Inv as InventoryService
  participant DB as PostgreSQL
  participant Print as Printing

  Cashier->>POS: Search receipt (number / scan)
  POS->>API: GET /sales/:id
  API->>Auth: require pos.return (or view)
  API->>DB: load Sale + items + serials + prior returns
  API-->>POS: returnable lines

  Cashier->>POS: Select item(s), qty, reason, disposition
  alt serial-tracked line
    Cashier->>POS: Confirm IMEI (must match sold)
    POS->>API: validate serial_unit_id == original
  end

  Cashier->>POS: Choose refund (cash / manual MM)
  POS->>API: POST /pos/returns (Idempotency-Key)

  API->>Auth: require pos.return
  alt refund_total >= large_refund_threshold
    POS->>Manager: request PIN
    Manager->>POS: PIN
    API->>Auth: verify manager PIN + audit
  end

  API->>DB: BEGIN
  API->>DB: insert Return + ReturnItems (immutable sale untouched)
  API->>DB: insert refund Payment rows (or refund records)
  API->>Inv: commitReturnMovement(items, disposition)
  alt disposition restock
    Inv->>DB: StockMovement RETURN + serial RETURNED/IN_STOCK + balance ↑
  else disposition damaged
    Inv->>DB: StockMovement DAMAGE / status DAMAGED
  end
  API->>DB: AuditLog
  API->>DB: OutboxEvent RETURN_COMPLETED
  API->>DB: COMMIT
  API-->>POS: return document

  POS->>Print: return receipt
  Print-->>Cashier: paper / PDF
```

## Rules (short)

1. Original sale remains immutable; return is a new document.  
2. Qty returned ≤ sold − already returned.  
3. **IMEI returned must match IMEI sold** on that line — mismatch → reject.  
4. Large refunds require Manager PIN (threshold in org settings).  
5. Stock only via ledger movements; no direct qty edits.  
6. Phase 1: exchange = return + new sale (first-class exchange is Phase 2).
