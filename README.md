# URL Shortener

A bit.ly-style URL shortener built as a portfolio infrastructure project. Two independent projects, no monorepo tooling:

- `backend/` — Node.js + Express + TypeScript REST API, Prisma ORM, PostgreSQL, Redis cache
- `frontend/` — React + Vite + TypeScript single-page client

This repo intentionally does **not** include Dockerfiles, docker-compose, CI/CD, or IaC for the app itself — those are left as a separate learning exercise. The commands below only use `docker run` to stand up the two local dependencies (Postgres, Redis).

## Prerequisites

- Node.js 20+
- npm
- Docker (only to run local Postgres/Redis containers — not the app)

## 1. Start local dependencies

```bash
docker run --name url-shortener-postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=url_shortener \
  -p 5432:5432 \
  -d postgres:16

docker run --name url-shortener-redis \
  -p 6379:6379 \
  -d redis:7
```

## 2. Backend setup

```bash
cd backend
npm install

# rename env.example.txt to .env and adjust values if needed
# (the defaults already match the docker run commands above)
cp env.example.txt .env

npm run prisma:generate
npx prisma migrate deploy   # applies the committed migration in prisma/migrations
npm run seed                # inserts 5-10 example links
npm run dev                 # starts the API on http://localhost:3000
```

Backend scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Start the API in watch mode |
| `npm run build` / `npm start` | Compile and run the production build |
| `npm run typecheck` | Type-check without emitting |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create a new migration in development (needs a reachable DB) |
| `npm run prisma:deploy` | Apply committed migrations (safe for a fresh DB) |
| `npm run seed` | Run `prisma/seed.ts` |

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL, defaults to http://localhost:3000
npm run dev             # starts the client on http://localhost:5173
```

## API overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/links` | Create a short link (`{ url, alias?, expiresAt? }`) — 409 if alias is taken |
| `GET` | `/:code` | 302 redirect to the original URL; 404 if unknown, 410 if expired |
| `GET` | `/api/links/:code/stats` | Total clicks + last 20 clicks for a code |
| `GET` | `/health` | 200 if the process, Postgres, and Redis are all reachable |

## Notes

- All configuration (ports, connection strings, cache origin) is read from environment variables — see `backend/env.example.txt` and `frontend/.env.example`.
- The initial Prisma migration was hand-written (no live Postgres was available while scaffolding this project) — review `backend/prisma/migrations/*/migration.sql` before relying on it in a new environment.
