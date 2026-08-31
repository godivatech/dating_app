# Architecture Overview

> **Phase**: 1 — Project Foundation
> **Last updated**: 2026-08-31

---

## System Overview

This is a dating application targeting 18+ users, initially in Tamil Nadu, India.
The product philosophy is **less swiping, better connections** — optimizing for
meaningful mutual connections rather than high-volume swipe mechanics.

The architecture is designed to expand to additional regions, languages, and
markets without requiring core domain rewrites.

---

## Repository Structure

```
dating-app/
├── mobile/           Mobile application
├── backend/          API server
├── admin/            Admin dashboard (future)
├── shared/           Shared types/utilities (future)
├── infrastructure/   Local development infrastructure
└── docs/             Architecture documentation
```

---

## Mobile

| Concern | Choice |
|---------|--------|
| Framework | Expo SDK 57 |
| Runtime | React Native 0.86 |
| UI library | React 19.2.3 |
| Language | TypeScript (strict) |
| Navigation | Expo Router 5 (file-based) |
| State (server) | TanStack Query (future phase) |
| State (client) | Zustand (future phase) |
| Forms | React Hook Form + Zod (future phase) |
| OTA updates | Expo EAS Update (future phase) |

**Platform targets**: Android, iOS (mobile-first).

### OTA Update Philosophy

- JavaScript changes → OTA-eligible
- Native deps / SDK / permissions → requires store release
- Native and JS versions tracked independently

---

## Backend

| Concern | Choice |
|---------|--------|
| Runtime | Node.js 24 LTS |
| Framework | NestJS 11 (modular monolith) |
| Language | TypeScript (strict) |
| API style | REST + OpenAPI/Swagger |
| ORM | Prisma (future phase) |
| Database | PostgreSQL 18 |
| Cache / Queues | Redis 7 |
| Job processing | BullMQ (future phase) |
| Realtime | Socket.IO (future messaging phase) |

### Architecture Pattern: Modular Monolith

The backend starts as a single deployable unit with clear internal module boundaries.
Domain modules can be extracted into independent services later if scale demands it.

Planned future modules:
```
auth · users · profiles · preferences · discovery
recommendations · likes · passes · matches
conversations · messages · verification · moderation
safety · notifications · payments · subscriptions
analytics · experiments · media
```

Only modules required by the current phase are implemented.

---

## Database

**PostgreSQL 18** — primary source of truth for all transactional data.

**Redis 7** — secondary store for:
- Caching frequently accessed data
- Rate limiting
- BullMQ job queues
- Realtime pub/sub (future messaging phase)

Redis is **not** the source of truth for important dating data.

---

## Media Storage — Cloudflare R2

Object storage is **Cloudflare R2** (S3-compatible API).

Design principles:
- Mobile app **never** receives R2 credentials
- Upload flow uses **server-generated short-lived signed URLs**
- PostgreSQL stores object keys, not permanent provider URLs
- R2 stores actual binary objects (images, video)

*Implementation: future phase*

---

## Recommendation System

The recommendation system is the product's most important long-term investment.

Evolution roadmap:
```
Phase 1-2:  Rule-based (hard eligibility filters)
Phase 3-4:  Behavioral signals (views, likes, response rates)
Phase 5+:   Learning-to-rank → Reciprocal recommendation → Advanced ML
```

Key principle: the system optimizes for **reciprocal potential** — not just
"who does this user like?" but "who is likely to like this user back?"

All recommendation events are designed to be traceable with:
- `algorithm_version` — tracks which logic produced the recommendation
- `experiment_id` — supports A/B testing future

*ML components introduced only when sufficient behavioral data exists.*

---

## Security Principles

- All client input validated server-side
- Authorization enforced server-side (never trust client claims)
- Sensitive endpoints rate-limited
- No server secrets in mobile app
- No personal data collected unnecessarily
- HTTPS in production
- Least-privilege access throughout

---

## Admin Dashboard

Future Next.js + TypeScript application.
Not implemented in Phase 1.

---

## Related Documents

- [`docs/decisions/`](decisions/) — Architecture Decision Records
