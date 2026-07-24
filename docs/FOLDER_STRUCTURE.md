# Folder structure map

```text
guliosmart-pos/
├── AGENTS.md                 # Persistent product + engineering memory
├── README.md
├── package.json              # pnpm + turbo root
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── .env.example
│
├── .cursor/
│   ├── agents/               # Domain sub-agents (delegate here)
│   └── rules/                # Always-on + path-scoped rules
│
├── apps/
│   ├── web/                  # Next.js PWA
│   │   └── src/app/
│   │       ├── (auth)/       # Login
│   │       ├── (pos)/        # Cashier register
│   │       ├── (backoffice)/ # Manager dashboards
│   │       └── (scan)/       # Mobile scanner routes
│   ├── api/                  # NestJS + Fastify modules
│   │   └── src/modules/      # auth, catalog, inventory, pos, …
│   └── worker/               # BullMQ jobs
│
├── packages/
│   ├── ui/                   # Gulio design system
│   ├── contracts/            # Shared DTOs / Zod schemas
│   ├── database/             # Prisma schema + client
│   ├── auth/                 # Shared auth helpers
│   ├── barcode/              # Barcode/QR generation helpers
│   ├── printing/             # Label/receipt templates
│   ├── config/               # Shared env/config
│   ├── eslint-config/
│   └── typescript-config/
│
├── infra/                    # docker, nginx, caddy, monitoring, backup
├── docs/                     # PRD, architecture, DB, security, …
└── scripts/
```

Which sub-agent owns which path → see `AGENTS.md` § Sub-agent routing.
