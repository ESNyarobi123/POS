-- Wipe demo/trial transactional data; keep org, users, roles, branches, warehouses, registers.
-- Safe for fresh real-data start after seed bootstrap.

BEGIN;

TRUNCATE TABLE
  return_items,
  returns,
  sale_item_serials,
  payments,
  sale_items,
  sales,
  held_sales,
  fiscal_documents,
  stock_movements,
  stock_counts,
  stock_balances,
  serial_units,
  barcodes,
  price_histories,
  variants,
  products,
  brands,
  categories,
  customers,
  outbox_events,
  audit_logs,
  register_sessions
RESTART IDENTITY CASCADE;

COMMIT;
