# ADR-001: Technology Stack Selection

| Field | Value |
|-------|-------|
| **Date** | 2026-08-31 |
| **Status** | Accepted |
| **Phase** | 1 — Project Foundation |

---

## Context

We are building a dating application targeting Tamil Nadu, India initially,
with planned expansion to other Indian states and eventually international markets.

The product philosophy is "less swiping, better connections" — optimizing for
quality connections rather than volume.

We needed to select a technology stack that is:
- Capable of producing a production-quality mobile app for Android and iOS
- Maintainable by a small team
- Compatible with future ML/recommendation work
- Scalable without requiring microservices from day one
- Secure by default

---

## Mobile: Expo SDK 57 + React Native 0.86 + Expo Router

**Decision**: Use Expo SDK 57 as the managed mobile development framework.

**Why Expo over bare React Native**:
- Expo SDK simplifies native module management significantly
- Expo EAS provides OTA update capabilities
- Expo Router provides production-ready file-based navigation
- Expo's managed workflow reduces native build complexity for a small team
- The ecosystem is mature enough for production apps

**Why React Native over Flutter/native**:
- JavaScript/TypeScript shared knowledge with backend team
- Largest mobile cross-platform ecosystem
- React Native's architecture (New Architecture in RN 0.74+) is production-ready

**Versions locked**:
- Expo SDK 57 (latest stable at project start)
- React Native 0.86.x (officially supported by Expo SDK 57)
- React 19.2.3 (required by RN 0.86.x)
- Expo Router 5.x (ships with Expo SDK 57)

**Alternatives considered**:
- Flutter: rejected (Dart, smaller ecosystem, different team skills)
- Native Android + iOS: rejected (doubles development effort for small team)
- Expo SDK 52/53: rejected (older, missing features available in SDK 57)

---

## Backend: NestJS 11 + Node.js 24

**Decision**: NestJS 11 on Node.js 24 LTS.

**Why NestJS over plain Express/Fastify**:
- Opinionated module system enforces clean boundaries from day one
- Built-in dependency injection simplifies service architecture
- Decorator-based validation integrates cleanly with class-validator
- Excellent TypeScript support
- Built-in OpenAPI/Swagger generation

**Why Node.js 24 LTS**:
- Active LTS with long-term support
- Full native fetch API
- Latest V8 improvements
- Aligned with team JavaScript/TypeScript skills

**Alternatives considered**:
- Plain Express: rejected (too unstructured for a growing team)
- Go/Gin: rejected (different language skills required)
- Python/FastAPI: rejected for primary API (Python may be introduced later for ML)
- Fastify: rejected (NestJS can use Fastify as transport if needed)

---

## Architecture: Modular Monolith

**Decision**: Start as a modular monolith.

**Why not microservices from day one**:
- Microservices have significant operational overhead (service discovery, distributed tracing, network boundaries)
- The team and user base do not yet justify this complexity
- Premature microservice decomposition causes more problems than it solves
- Clear NestJS module boundaries allow extraction later if genuinely needed

**Future extraction triggers**:
- A specific service requires independent scaling
- A specific domain needs independent deployment
- Team size has grown to support operational overhead

---

## Database: PostgreSQL 18

**Decision**: PostgreSQL 18 as the primary database.

**Why PostgreSQL**:
- Best-in-class relational database for a complex domain with many relationships
- Excellent JSON support for semi-structured data
- Strong indexing capabilities for geo/recommendation queries
- Mature ecosystem, excellent Prisma support
- PostgreSQL 18 confirmed available as Docker image

**Why not MongoDB/other NoSQL**:
- Dating app data is inherently relational (users, matches, messages, preferences)
- ACID guarantees matter for match/like operations
- Complex queries (recommendation filtering) are cleaner in SQL

---

## ORM: Prisma

**Decision**: Prisma (implementation in future phase).

**Why Prisma**:
- Type-safe database access
- Excellent migration tooling
- Great NestJS integration
- Generates TypeScript types from schema

**Alternatives considered**:
- TypeORM: rejected (more complexity, decorator-heavy)
- Drizzle: considered (lighter), Prisma preferred for ecosystem maturity
- Raw SQL: rejected for routine queries (use for performance-critical queries)

---

## Cache / Queue: Redis 7 + BullMQ

**Decision**: Redis 7 for caching and BullMQ for background jobs.

**Why Redis**:
- Industry standard for caching and rate limiting
- BullMQ requires Redis
- Future realtime pub/sub for Socket.IO scaling

**Important**: Redis is never the source of truth for important dating data.
PostgreSQL is the source of truth.

---

## Object Storage: Cloudflare R2

**Decision**: Cloudflare R2 (S3-compatible API).

**Why R2 over S3**:
- Zero egress fees (significant savings for a media-heavy app)
- S3-compatible API (easy migration path if needed)
- Competitive pricing

**Security principle**: Mobile app never receives R2 credentials.
All uploads use server-generated signed URLs.

---

## Mobile State Management

**Decisions** (to be implemented in later phases):
- **Server state**: TanStack Query (react-query) — caching, background refresh, optimistic updates
- **Client state**: Zustand — lightweight, simple, no boilerplate
- **Forms**: React Hook Form + Zod — performant forms with type-safe validation

---

## Admin Dashboard

**Decision**: Next.js + TypeScript (future phase).

**Why Next.js**:
- SSR for data-heavy admin pages
- Same TypeScript/React skills as mobile team
- Excellent ecosystem for internal dashboards

---

## Tradeoffs Accepted

| Tradeoff | Accepted Because |
|----------|-----------------|
| Expo managed workflow constraints | Worth it for OTA, simplified native management |
| Monolith vs microservices | Correct choice at this scale; boundaries allow future extraction |
| PostgreSQL strictness vs NoSQL flexibility | Data integrity > schema flexibility for this domain |
| NestJS boilerplate overhead | Pays off in maintainability as the team grows |
