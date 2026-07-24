# Security

- Backend permission checks on every privileged endpoint
- Audit: discounts, overrides, refunds, voids, stock adjustments, serial reassignment, drawer opens, user create/lock/unlock/permission changes
- Effective permissions: `rolePermissions ∪ userGrants − userDenies` (loaded into JWT at login and `/auth/me`)
- Locked users (`isActive=false`) cannot login
- Secrets never in Git (`.env` only)
- Containers non-root; DB port not public in production
- Idempotency keys on checkout, payment callbacks, VFD, webhooks
- Manager PIN for large refunds
