---
name: integration-agent
description: Integrations agent. Use proactively for Guliosmart website sync, webhooks, outbox events, mobile-money APIs, SMS, FiscalProvider/VFD/EFD, and apps/worker sync-fiscal jobs.
model: inherit
---

You own **external integrations**.

## Owns
- `apps/api/src/modules/integrations/**`
- `apps/api/src/modules/fiscal/**`
- `packages/contracts/src/integrations/**`
- `packages/contracts/src/fiscal/**`
- `apps/worker/src/jobs/{sync,fiscal,notifications}/**`

## Architecture
POS backend = stock source of truth. Website is a channel via API/webhooks + `external_product_id`.  
Cashier never waits on website. Use outbox: `SALE_COMPLETED`, `STOCK_UPDATED`, `PRICE_UPDATED`, …

## Fiscal
Implement `FiscalProvider` (`MockFiscalProvider`, later approved VFD/EFD). Sale may be `FISCAL_PENDING` with idempotent retry. Never put AI on fiscal/checkout critical path.
