# URL Shortener

A bit.ly-style URL shortener built as a portfolio infrastructure project. Two independent projects, no monorepo tooling:

- `backend/` — Node.js + Express + TypeScript REST API, Prisma ORM, PostgreSQL, Redis cache
- `frontend/` — React + Vite + TypeScript single-page client

Beyond the app itself, this repo is also an infrastructure learning exercise: Dockerfiles, docker-compose, Kubernetes manifests, Terraform IaC for AWS, and GitHub Actions CI/CD all live here — see [Docker](#docker), [Kubernetes](#kubernetes), [AWS infrastructure (Terraform)](#aws-infrastructure-terraform), and [CI/CD](#cicd) below. The quickstart below only uses `docker run` to stand up the two local dependencies (Postgres, Redis) for running the app directly with `npm run dev`.

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

On Windows (PowerShell), requires Docker Desktop running first:

```powershell
docker run --name url-shortener-postgres -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=url_shortener -p 5432:5432 -d postgres:16

docker run --name url-shortener-redis -p 6379:6379 -d redis:7
```

## 2. Backend setup

```bash
cd backend
npm install

# copy .env.example to .env and adjust values if needed
# (the defaults already match the docker run commands above)
cp .env.example .env

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

## Docker

Two Dockerfiles, both multi-stage (`node:20-alpine` builder → slim runtime):

- `backend/Dockerfile` — builds with `npm run build`, then a runtime stage that runs `npx prisma generate` against production deps only and starts `node dist/server.js` on port 3000.
- `frontend/Dockerfile` — builds the Vite app (`VITE_API_URL` passed as a build arg, baked into the static bundle) and serves it from `nginx:alpine` on port 80.

### Local full stack — `docker-compose.yml`

Builds both images from source and runs the whole stack, including a one-shot `migrate` service that applies Prisma migrations before `backend` starts:

```bash
docker compose up --build
```

- frontend → http://localhost:8080
- backend → http://localhost:3000
- Postgres/Redis credentials are hardcoded dev-only values in the compose file itself (`shortener` / `shortener`).

### Production compose — `docker-compose.prod.yml`

Same topology, but pulls pre-built images instead of building, and reads everything from environment variables — no source checkout needed on the host:

```bash
BACKEND_IMAGE=<ecr-url>/url-shortener-backend:<tag> \
FRONTEND_IMAGE=<ecr-url>/url-shortener-frontend:<tag> \
POSTGRES_USER=... POSTGRES_PASSWORD=... POSTGRES_DB=... \
CORS_ORIGIN=... \
docker compose -f docker-compose.prod.yml up -d
```

This is the file meant to run on the EC2 instance provisioned by Terraform (see below) — image URLs come from the ECR repos it creates.

## Kubernetes

Manifests in `k8s/` assume a local cluster (e.g. `kind`) with images loaded directly — they are **not** pulled from a registry (`imagePullPolicy: IfNotPresent` + `url-shortener-backend:latest` / `url-shortener-frontend:latest`):

```bash
docker build -t url-shortener-backend:latest ./backend
docker build -t url-shortener-frontend:latest ./frontend
kind load docker-image url-shortener-backend:latest
kind load docker-image url-shortener-frontend:latest

kubectl apply -f k8s/namespace.yaml
cp k8s/secret.example.yaml k8s/secret.yaml   # fill in real values first — gitignored, never commit it
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/migrate-job.yaml        # after the postgres pod is Ready
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml            # requires the ingress-nginx controller installed
```

- `postgres.yaml` is a `StatefulSet` with a `1Gi` PVC — the only stateful piece of the cluster.
- `backend.yaml` / `frontend.yaml` are stateless `Deployment`s (2 and 1 replicas) with readiness/liveness probes on `/health` and CPU/memory requests+limits.
- `ingress.yaml` routes a single host (`url-shortener.local`) with path-based rules: `/api`, `/health` → backend; `/assets` and exact `/` → frontend; everything else (short codes like `/aB3dE9`) falls through to the backend's redirect handler.
- `migrate-job.yaml` is a one-shot `Job` (same backend image, `prisma migrate deploy` as the command) — applied manually, not part of the backend `Deployment`'s lifecycle.

## AWS infrastructure (Terraform)

`terraform/` provisions the AWS side of a real deployment target — one VPC, one EC2 host, no managed database (Postgres/Redis run as containers on the instance via `docker-compose.prod.yml`):

- **Networking** (`network.tf`) — a VPC with a single public subnet, internet gateway, and route table.
- **Compute** (`ec2.tf`) — one `t3.micro` Amazon Linux 2023 instance; `user_data` installs Docker + the `docker compose` CLI plugin and the SSM agent on boot.
- **Security** (`security.tf`) — a security group open only on 80/443 (no SSH ingress at all — admin access goes through SSM Session Manager); an IAM instance role with `AmazonSSMManagedInstanceCore` and `AmazonEC2ContainerRegistryReadOnly` attached.
- **Registries** (`ecr.tf`) — one ECR repo per image (`backend`, `frontend`), scan-on-push enabled, lifecycle policy keeps the last 5 images.
- **CI identity** (`oidc.tf`) — a GitHub Actions OIDC provider plus an IAM role GitHub can assume via `AssumeRoleWithWebIdentity`, restricted by the token's `sub` claim to this repo's `main` branch and pull requests. The attached policy is scoped to `ec2:*`, project-prefixed `ecr:*`/`iam:*` resources, and the Terraform state bucket only — not `AdministratorAccess`.

### Remote state

State lives in S3, not locally. Because Terraform can't create the bucket it's about to use as its own backend, bootstrapping is a separate root module with local state:

```bash
cd terraform/bootstrap
terraform init
terraform apply                 # one-time: creates the S3 state bucket

cd ../
terraform init -migrate-state   # moves local state into the new bucket
terraform apply                 # creates the VPC/EC2/ECR/OIDC resources
terraform output github_actions_role_arn
```

State locking uses S3's native lockfile support (`use_lockfile = true`, Terraform ≥ 1.10) — no DynamoDB table needed.

## CI/CD

Two independent GitHub Actions workflows in `.github/workflows/`:

- **`ci.yml`** — on every push and PR: installs and builds `backend/` and `frontend/` (matrix job, so a broken `npm run build` in either one fails the pipeline), then does a no-push `docker build` of both Dockerfiles to catch breakage there too. This is the required status check for branch protection on `main`.
- **`terraform.yml`** — on changes under `terraform/`: authenticates to AWS via the OIDC role above (no static access keys stored as GitHub secrets), runs `fmt -check` / `validate` / `plan` on every PR, and `apply`s automatically on push to `main`. Runs are serialized with a `concurrency` group so two runs never race for the same state lock.

## Notes

- All configuration (ports, connection strings, cache origin) is read from environment variables — see `backend/env.example.txt` and `frontend/.env.example`.
- The initial Prisma migration was hand-written (no live Postgres was available while scaffolding this project) — review `backend/prisma/migrations/*/migration.sql` before relying on it in a new environment.
