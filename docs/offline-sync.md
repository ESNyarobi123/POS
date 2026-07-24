# Offline Sync

Controlled offline — not full database.

## Allowed offline

Product lookup · cart · cash sales · basic customer · pending receipts

## Blocked offline

New online / mobile-money payments

## Sync

Queue mutations locally → on reconnect flush with idempotency → stock may show `Pending sync` until confirmed.
