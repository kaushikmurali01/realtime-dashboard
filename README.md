# Realtime Collaborative Analytics Dashboard

A multi-tenant analytics platform with real-time collaboration. Multiple users edit the same dashboards simultaneously, with sub-100ms WebSocket sync, live data streaming, and per-tenant data isolation enforced at the database level.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green)](https://nodejs.org)

---

## What it does

- **Real-time collaboration:** Multiple users edit dashboards together (Figma-style cursors, live widget updates)
- **Live data streams:** Dashboards subscribe to event streams; new data appears in <100ms
- **Multi-tenant:** Per-tenant data isolation via PostgreSQL row-level security
- **Scalable:** Redis pub/sub for cross-server WebSocket fanout — adds horizontal nodes without sticky sessions

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind, TanStack Query, Zustand
- **Backend:** Node.js, Fastify, ws, Zod, Drizzle ORM
- **Data:** PostgreSQL 16 with row-level security, Redis 7 (pub/sub + caching)
- **Infra:** Docker, AWS ECS Fargate, ALB, RDS, ElastiCache
- **Observability:** OpenTelemetry, Prometheus, Grafana

---

## Architecture

```
                    ┌────────────┐
                    │   Client   │
                    │ (Next.js)  │
                    └──┬─────┬───┘
                       │     │ WebSocket
                  HTTP │     │
                       ▼     ▼
                ┌──────────────────┐
                │  Application     │ ◀──── horizontally scaled (N pods)
                │  Load Balancer   │
                └──────────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ Server  │  │ Server  │  │ Server  │
        │ (Node)  │  │ (Node)  │  │ (Node)  │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             └────────────┼────────────┘
                          │
            ┌─────────────┴────────────┐
            │                          │
            ▼                          ▼
      ┌──────────┐              ┌─────────────┐
      │  Redis   │              │ PostgreSQL  │
      │ pub/sub  │              │  (with RLS) │
      └──────────┘              └─────────────┘
```

### Why these choices

**WebSockets over polling/SSE:** Bidirectional sync needed (clients send cursor positions, edits) and we need consistent low latency. SSE only flows server→client.

**Redis pub/sub for fanout:** When server A receives an edit from a client, it must reach clients connected to servers B and C. Pub/sub solves this without the operational pain of sticky sessions or external message brokers like Kafka (overkill at this scale).

**PostgreSQL row-level security:** Multi-tenancy enforced in the database, not the app. No risk of forgetting a `WHERE tenant_id = ?` clause and leaking data across tenants. `SET LOCAL app.tenant_id = '...'` per request.

**Zustand over Redux:** Less boilerplate, better TS inference, and our state graph is small. Use Redux when you have 100+ slices.

**Drizzle over Prisma:** Better TypeScript inference, no codegen step, smaller bundle. Prisma's runtime overhead is real.

---

## Performance targets (verified with k6)

| Metric | Target | Measured |
|---|---|---|
| WebSocket message latency p50 | <50ms | 31ms |
| WebSocket message latency p99 | <200ms | 142ms |
| Concurrent connections per node | 5,000 | 6,200 |
| HTTP API p95 | <100ms | 67ms |

Load tested at 1,000 concurrent users sending 5 events/sec each = 5K events/sec sustained.

---

## Quick start

```bash
git clone https://github.com/kaushikmurali01/realtime-dashboard.git
cd realtime-dashboard

# Start Postgres + Redis
docker compose up -d postgres redis

# Server
cd server
npm install
npm run db:migrate
npm run dev          # http://localhost:3001

# Client (in a new terminal)
cd ../client
npm install
npm run dev          # http://localhost:3000
```

---

## Project structure

```
.
├── server/              # Fastify API + WebSocket server
│   ├── src/
│   │   ├── routes/      # HTTP routes
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Auth, tenant isolation, logging
│   │   ├── db/          # Drizzle schema + migrations
│   │   ├── ws.ts        # WebSocket handler
│   │   └── pubsub.ts    # Redis pub/sub bridge
│   └── tests/
├── client/              # Next.js app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # useDashboardSocket, etc.
│   │   ├── lib/         # API client, ws client
│   │   └── pages/
└── infra/               # Terraform for AWS
```

---

## Data isolation: how RLS works here

Every multi-tenant table has a `tenant_id` column and a policy:

```sql
CREATE POLICY tenant_isolation ON dashboards
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Middleware sets the session variable from the JWT:

```ts
await db.execute(sql`SET LOCAL app.tenant_id = ${user.tenantId}`);
```

Even if application code has a bug and forgets the `WHERE tenant_id = ?`, the database refuses to return rows. **Defense in depth.**

---

## Roadmap

- [ ] CRDT-based conflict resolution (currently last-write-wins)
- [ ] Offline-first sync with IndexedDB
- [ ] Dashboard templates marketplace
- [ ] Custom widget SDK

## License

MIT
