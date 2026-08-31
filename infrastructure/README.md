# infrastructure/

This directory contains local development infrastructure configuration.

## Requirements

> **Docker Desktop must be installed and running before using these files.**
>
> Download: https://www.docker.com/products/docker-desktop/

## Starting local services

```bash
# From this directory:
docker compose up -d

# View running services:
docker compose ps

# View logs:
docker compose logs -f

# Stop services:
docker compose down

# Stop and remove volumes (DELETES all local data):
docker compose down -v
```

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:18` | `5432` | Primary database (local dev only) |
| `redis` | `redis:7-alpine` | `6379` | Cache, rate limiting, queues (local dev only) |

## Notes

- Data is persisted in named Docker volumes (`postgres_data`, `redis_data`).
- These services are for **local development only**.
- Production environments use managed cloud services, not Docker Compose.
- PostgreSQL 18 is the target version. Verified available on Docker Hub (stable, August 2026).
