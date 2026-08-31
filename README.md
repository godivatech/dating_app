# Dating App

> **Status**: Phase 1 — Project Foundation
>
> Product name is not yet finalized. The technical identifier `dating-app` is used throughout
> the codebase. All user-facing name references are isolated to configuration files
> (`app.json`, environment variables) so the final brand can be applied without
> architectural changes.

---

## Repository Structure

```
dating-app/
├── mobile/           Expo SDK 57 · React Native 0.86 · React 19 · Expo Router 5
├── backend/          NestJS 11 · Node.js 24 · TypeScript · REST API
├── admin/            Next.js (placeholder — future phase)
├── shared/           Shared types/utilities (placeholder — future phase)
├── infrastructure/   Docker Compose (PostgreSQL 18 + Redis 7)
└── docs/             Architecture decisions and documentation
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24 LTS | Use `.nvmrc` with `nvm use` |
| npm | ≥ 10 | Comes with Node 24 |
| Docker Desktop | Latest | Required for local infrastructure |
| Expo CLI | via npx | `npx expo` |

---

## Getting Started

### 1. Install dependencies

```bash
# Mobile
cd mobile && npm install

# Backend
cd backend && npm install
```

### 2. Start local infrastructure

> **Requires Docker Desktop to be installed and running.**

```bash
cd infrastructure
docker compose up -d
```

This starts:
- PostgreSQL 18 on `localhost:5432`
- Redis 7 on `localhost:6379`

### 3. Configure environment variables

```bash
# Mobile
cp mobile/.env.example mobile/.env

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your local values
```

### 4. Start the backend

```bash
cd backend
npm run start:dev
```

Backend runs at: `http://localhost:3000`
Health check: `http://localhost:3000/health`

### 5. Start the mobile app

```bash
cd mobile
npx expo start
```

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Project foundation |
| 2 | Pending | Authentication (OTP) |
| 3 | Pending | User profile model |
| 4+ | Future | Discovery, matching, messaging, ... |

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — System architecture overview
- [`docs/decisions/`](docs/decisions/) — Architecture Decision Records (ADRs)

---

## Security Notes

- Never commit `.env` files — use `.env.example` to document variables
- Never place server secrets in the mobile app
- R2 credentials must only exist in secure server environments (future phase)
