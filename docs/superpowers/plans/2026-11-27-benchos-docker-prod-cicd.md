# BenchOS Docker Multi-Stage, Production Compose & CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform BenchOS into a fully containerized, high-availability production application orchestrated via Docker Compose, validated continuously with GitHub Actions, and safely updated via a zero-downtime server script.

**Architecture:** A multi-stage Docker build bundles the React Vite frontend and Express TypeScript backend into an ultra-lean Alpine runtime. Docker Compose manages isolated internal networking between the app and PostgreSQL 16 (without exposing DB ports externally). A GitHub Actions pipeline guarantees code quality and container buildability on every push, while `atualizar-servidor.sh` automates atomic pull, migrations, healthchecking, and rollback on the local distributor server.

**Tech Stack:** Docker (Multi-stage builds, Alpine Linux), Docker Compose v2, GitHub Actions CI/CD, Node.js 20, TypeScript, Express, Prisma ORM v6, PostgreSQL 16, React 18, Bash.

**Spec:** [docs/superpowers/specs/2026-11-27-benchos-docker-prod-cicd-spec.md](file:///home/dzati/sistema-triagem/docs/superpowers/specs/2026-11-27-benchos-docker-prod-cicd-spec.md)

## Global Constraints
- Base image: `node:20-alpine` for build and runner stages; `postgres:16-alpine` for the database.
- Runner container must run as unprivileged `node` user and include `openssl`, `libc6-compat`, and `curl` for Prisma compatibility and healthchecks on Alpine.
- Zero secrets committed in code, Dockerfiles, compose files or GitHub Action workflows; all configuration passed via environment variables.
- PostgreSQL port `5432` must NOT be exposed to the host in `docker-compose.prod.yml`; communication remains strictly internal on Docker network `benchos_internal`.
- Zero regressions on the 100 existing automated tests (78 backend Vitest + 22 frontend Vitest) and TypeScript static typing (`tsc --noEmit`).
- All shell scripts must start with `#!/bin/bash` and `set -e`, pass `bash -n` syntax check, and be marked executable (`chmod +x`).

## Review Focus
1. **Prisma Engine on Alpine Linux (musl libc):** Prisma requires OpenSSL and `libc6-compat` on Alpine. Without them, `PrismaClient` initialization fails with `Query engine library ... not found`. Tested via `scripts/test-prod-container.sh`.
2. **SPA Asset Resolution inside Container:** The compiled Express backend in `/app/backend/dist` uses `resolveDefaultFrontendDistDir()` (`../../frontend/dist`). The Dockerfile must replicate this directory layout inside `/app`. Tested via HTTP GET `/` and deep route `/admin/usuarios` inside the container.
3. **Database Startup Race Condition:** The application container must not crash if PostgreSQL takes 2-3 seconds to become healthy. Handled via `depends_on.condition: service_healthy` in compose and a database polling retry loop in `scripts/docker-entrypoint.sh`.
4. **Volume Persistence Separation:** Production data must reside in a dedicated volume (`benchos_pgdata_prod`) separate from development (`benchos_pgdata`), preventing development resets from wiping store data.
5. **Safe Server Deployments:** If a pull introduces a runtime regression, `atualizar-servidor.sh` must detect healthcheck failure within 45s and automatically offer or perform rollback to the previous working Git commit and container state.

---

### Task 1: Multi-stage Dockerfile and `.dockerignore`

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`

**Interfaces:**
- Consumes: `frontend/` source, `backend/` source, `package.json` files and Prisma schema.
- Produces: Docker image tagged `benchos:latest` serving both API on `/api` and React SPA on `/` via port 3001.

- [ ] **Step 1: Write `.dockerignore` to exclude local artifacts from build context**

Exclude `node_modules`, `dist`, `.git`, `.env*`, `*.db`, `*.log`, `.superpowers`, and scratch directories so `docker build` runs fast and without leaking local files.

- [ ] **Step 2: Create multi-stage `Dockerfile`**

```dockerfile
# Stage 1: Frontend Build
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend Build
FROM node:20-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma/ ./prisma/
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# Stage 3: Lean Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat curl bash
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --from=backend-builder /build/backend/dist ./backend/dist
COPY --from=backend-builder /build/backend/prisma ./backend/prisma
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

RUN cd backend && npx prisma generate

COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
```

- [ ] **Step 3: Temporarily create minimal placeholder `scripts/docker-entrypoint.sh` for build validation**

Create `scripts/docker-entrypoint.sh` with `#!/bin/bash\nexec node backend/dist/server.js` and `chmod +x` so Docker build succeeds.

- [ ] **Step 4: Build Docker image and verify success**

Run: `docker build -t benchos:build-test -f Dockerfile .`
Expected: Successfully tagged `benchos:build-test`, all 3 stages execute without error.

- [ ] **Step 5: Commit**

```bash
git add .dockerignore Dockerfile scripts/docker-entrypoint.sh
git commit -m "feat(docker): adiciona dockerfile multi-stage e dockerignore para producao"
```

---

### Task 2: Production Container Entrypoint (`scripts/docker-entrypoint.sh`)

**Files:**
- Modify: `scripts/docker-entrypoint.sh`

**Interfaces:**
- Consumes: `DATABASE_URL`, `SEED_ADMIN_*` environment variables passed to the container.
- Produces: Execution of `npx prisma migrate deploy`, `npx prisma db seed`, and handoff to `node backend/dist/server.js`.

- [ ] **Step 1: Write failing verification command for entrypoint features**

Verify that `scripts/docker-entrypoint.sh` contains database connection polling, migrate deploy, seed, and execution of `node backend/dist/server.js`.

- [ ] **Step 2: Implement robust `scripts/docker-entrypoint.sh`**

```bash
#!/bin/bash
set -e

echo "[BenchOS Container] Inicializando aplicação..."

if [ -z "$DATABASE_URL" ]; then
  echo "Erro crítico: Variável DATABASE_URL não definida."
  exit 1
fi

echo "[BenchOS Container] Aguardando conectividade com o banco de dados..."
MAX_TRIES=30
TRIES=0
until node -e "const { PrismaClient } = require('./backend/node_modules/@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "Erro: PostgreSQL não respondeu após $MAX_TRIES tentativas."
    exit 1
  fi
  sleep 1
done

echo "[BenchOS Container] Banco de dados conectado com sucesso!"
echo "[BenchOS Container] Aplicando migrations do Prisma..."
cd /app/backend && npx prisma migrate deploy

echo "[BenchOS Container] Garantindo seed inicial (idempotente)..."
npx prisma db seed

echo "[BenchOS Container] Iniciando servidor BenchOS na porta ${PORT:-3001}..."
exec node dist/server.js
```

- [ ] **Step 3: Validate syntax and permissions**

Run: `bash -n scripts/docker-entrypoint.sh && test -x scripts/docker-entrypoint.sh`
Expected: Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/docker-entrypoint.sh
git commit -m "feat(docker): adiciona entrypoint com espera do postgres, migrations e seed"
```

---

### Task 3: Production Docker Compose (`docker-compose.prod.yml`)

**Files:**
- Create: `docker-compose.prod.yml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Environment variables (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `PORT`, `JWT_SECRET`, `SEED_ADMIN_*`).
- Produces: Production stack with isolated internal network `benchos_internal`, persistent volume `benchos_pgdata_prod`, and container healthchecks.

- [ ] **Step 1: Update `.env.example` to document production compose variables**

Ensure `.env.example` documents `PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `SEED_ADMIN_*`.

- [ ] **Step 2: Implement `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: benchos-postgres-prod
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-benchos}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-benchos_dev_pass}
      POSTGRES_DB: ${POSTGRES_DB:-benchos}
    volumes:
      - benchos_pgdata_prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-benchos} -d ${POSTGRES_DB:-benchos}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - benchos_internal

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: benchos-app-prod
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER:-benchos}:${POSTGRES_PASSWORD:-benchos_dev_pass}@postgres:5432/${POSTGRES_DB:-benchos}?schema=public"
      PORT: ${PORT:-3001}
      JWT_SECRET: ${JWT_SECRET:-troque-esta-chave-secreta-com-pelo-menos-32-caracteres}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
      SEED_ADMIN_NAME: ${SEED_ADMIN_NAME:-Administrador BenchOS}
      SEED_ADMIN_EMAIL: ${SEED_ADMIN_EMAIL:-admin@benchos.local}
      SEED_ADMIN_PASSWORD: ${SEED_ADMIN_PASSWORD:-Admin@123}
    ports:
      - "${PORT:-3001}:${PORT:-3001}"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:${PORT:-3001}/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - benchos_internal

volumes:
  benchos_pgdata_prod:

networks:
  benchos_internal:
    driver: bridge
```

- [ ] **Step 3: Validate compose configuration with Docker Compose CLI**

Run: `docker compose -f docker-compose.prod.yml config`
Expected: Valid YAML output with resolved services `postgres` and `app`, volume `benchos_pgdata_prod`, and network `benchos_internal`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml .env.example
git commit -m "feat(docker): adiciona docker-compose.prod.yml para orquestracao em producao"
```

---

### Task 4: Automated Smoke Test Script (`scripts/test-prod-container.sh`)

**Files:**
- Create: `scripts/test-prod-container.sh`

**Interfaces:**
- Consumes: Built Docker image and `docker-compose.prod.yml`.
- Produces: Zero-exit code if production stack boots, runs migrations, serves `/api/health`, delivers frontend SPA HTML, and shuts down cleanly.

- [ ] **Step 1: Write smoke test script `scripts/test-prod-container.sh`**

Script must:
1. Generate temporary isolated environment variables (custom test port, e.g. 3099, custom test db name).
2. Start the stack with `docker compose -f docker-compose.prod.yml -p benchos-smoke up -d --build`.
3. Wait up to 45 seconds for `curl -s http://localhost:3099/api/health` to return `status: OK`.
4. Verify HTTP GET `/` returns HTML containing `BenchOS` or root div.
5. Tear down test stack with `docker compose -f docker-compose.prod.yml -p benchos-smoke down -v`.

- [ ] **Step 2: Make executable and validate syntax**

Run: `chmod +x scripts/test-prod-container.sh && bash -n scripts/test-prod-container.sh`
Expected: Exit code 0.

- [ ] **Step 3: Execute smoke test against real Docker daemon**

Run: `sg docker -c ./scripts/test-prod-container.sh` (or `./scripts/test-prod-container.sh` if user has docker group)
Expected: Stack boots, migrations apply in container, `/api/health` responds 200 OK, SPA serves, and containers clean up cleanly.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-prod-container.sh
git commit -m "test(infra): adiciona smoke test automatizado para container de producao"
```

---

### Task 5: GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Any `git push` or `pull_request` to `main`.
- Produces: Green GitHub Actions check verifying backend tests (78 tests), frontend tests (22 tests), TypeScript compilation, and multi-stage Docker build.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: BenchOS CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    name: Backend Tests & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install Dependencies
        working-directory: backend
        run: npm ci

      - name: Run Backend Vitest Tests
        working-directory: backend
        run: npm test

      - name: Validate Backend TypeScript Build
        working-directory: backend
        run: npm run build

  test-frontend:
    name: Frontend Tests & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        working-directory: frontend
        run: npm ci

      - name: Run Frontend Vitest Tests
        working-directory: frontend
        run: npm test

      - name: Validate Frontend Vite Build
        working-directory: frontend
        run: npm run build

  docker-build-check:
    name: Docker Multi-Stage Build Check
    runs-on: ubuntu-latest
    needs: [test-backend, test-frontend]
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: actions/setup-buildx-action@v3

      - name: Build BenchOS Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: false
          tags: benchos:ci-check
```

- [ ] **Step 2: Validate GitHub Action YAML syntax with Python**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: Clean load without YAML parsing errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: adiciona pipeline github actions com testes, builds e validacao docker"
```

---

### Task 6: Safe Server Update & Rollback Script (`atualizar-servidor.sh`) & Documentation

**Files:**
- Create: `atualizar-servidor.sh`
- Modify: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Running store server, local Git repo, and `docker-compose.prod.yml`.
- Produces: Atomic update command that pulls `origin main`, rebuilds containers, runs migrations, verifies health, and offers rollback on failure.

- [ ] **Step 1: Implement `atualizar-servidor.sh`**

Features:
- Checks if working tree is clean.
- Records current Git commit hash (`PREV_COMMIT=$(git rev-parse HEAD)`).
- Executes `git pull origin main`.
- Runs `docker compose -f docker-compose.prod.yml up -d --build`.
- Polls `http://localhost:${PORT:-3001}/api/health` up to 45 seconds.
- If healthcheck succeeds: prints green status and LAN IP.
- If healthcheck fails: prints error log, asks or executes rollback:
  `git checkout $PREV_COMMIT && docker compose -f docker-compose.prod.yml up -d --build`.

- [ ] **Step 2: Make executable and validate syntax**

Run: `chmod +x atualizar-servidor.sh && bash -n atualizar-servidor.sh`
Expected: Exit code 0.

- [ ] **Step 3: Update `README.md` and `.gitignore`**

- Add `atualizar-servidor.sh` and `docker-compose.prod.yml` to README file tree and instructions.
- Ensure `*.heapprofile` is added to `.gitignore` so temporary profiling files are ignored.

- [ ] **Step 4: Run full regression checks**

Run: `(cd backend && npm test && npm run build) && (cd frontend && npm test && npm run build)`
Expected: 100/100 tests passing, clean TypeScript builds.

- [ ] **Step 5: Commit**

```bash
git add atualizar-servidor.sh README.md .gitignore
git commit -m "feat(infra): adiciona script de atualizacao com rollback e atualiza documentacao"
```

---

## Plan Self-Review Checklist
- [x] Spec coverage: Docker multi-stage (Task 1), Entrypoint & migrations (Task 2), Compose prod (Task 3), Smoke tests (Task 4), CI/CD (Task 5), Safe deploy script (Task 6).
- [x] Step scan: Every step specifies exact files, actions, commands and expected outputs.
- [x] Type consistency: Ports, service names (`benchos-app-prod`, `benchos-postgres-prod`), and network (`benchos_internal`) match across all files.
- [x] Review Focus: Handled Alpine musl, relative SPA paths, DB race condition, persistence volume isolation, and safe server rollback.
