# Especificação Técnica: Dockerização Multi-Stage, Docker Compose de Produção e CI/CD do BenchOS

**Data:** 2026-11-27  
**Status:** Aprovado  
**Objetivo:** Transformar o BenchOS em uma solução conteinerizada de produção de alta disponibilidade e estabilidade para a rede local (LAN) da distribuidora, eliminando dependências manuais do sistema operacional do host e automatizando validações via GitHub Actions.

---

## 1. Contexto e Diagnóstico Atual

Atualmente o BenchOS opera em modo híbrido:
- O PostgreSQL 16 roda em container Docker (`docker-compose.yml`), persistido no volume `benchos_pgdata`.
- O servidor Node.js/Express e o frontend compilado rodam diretamente sobre o Node.js instalado no sistema operacional hospedeiro (`iniciar-producao.sh`).

### Riscos de Estabilidade do Modelo Híbrido:
1. **Dependência de runtime no host:** O servidor físico da loja precisa ter Node.js 20+, npm, bibliotecas de compilação C++ (para bcryptjs e prisma engine) e dependências do sistema operacional. Atualizações no host podem quebrar o sistema.
2. **Ciclo de vida do processo:** Se a máquina for reiniciada após queda de energia na distribuidora, o container do banco sobe automaticamente (`restart: unless-stopped`), mas o processo Node.js não inicia sozinho a menos que o técnico configure manualmente PM2 ou serviço systemd.
3. **Exposição de portas:** O PostgreSQL expõe a porta 5432 diretamente para o host e qualquer PC na rede da loja.
4. **Ausência de esteira automatizada:** Commits manuais no GitHub podem quebrar o build ou testes sem que ninguém perceba antes do deploy na loja.

---

## 2. Decisões Arquiteturais

### A. Dockerfile Multi-Stage (`Dockerfile` e `.dockerignore`)
- **Stage 1 (`frontend-builder`):** Imagem `node:20-alpine`. Executa `npm ci`, compila TypeScript e empacota o SPA React via Vite com Tailwind CSS, gerando `/app/frontend/dist`.
- **Stage 2 (`backend-builder`):** Imagem `node:20-alpine`. Executa `npm ci`, gera o Prisma Client v6 (`npx prisma generate`) e compila o backend TypeScript (`tsc`), gerando `/app/backend/dist`.
- **Stage 3 (`runner` - Produção Final):** Imagem `node:20-alpine` ultra-enxuta:
  - Instala pacotes essenciais do Alpine (`openssl`, `libc6-compat`, `curl` para healthcheck).
  - Copia dependências de produção (`npm ci --omit=dev` no backend).
  - Copia o backend compilado (`/app/backend/dist`), o schema e migrations Prisma (`/app/backend/prisma`) e o frontend compilado (`/app/frontend/dist`).
  - Executa sob usuário não-root `node` para segurança máxima.
  - Exposição de porta única: variável `PORT` (padrão 3001).

### B. Docker Compose de Produção (`docker-compose.prod.yml`)
- Dois serviços orquestrados em rede interna isolada (`benchos_net`):
  1. `postgres`: PostgreSQL 16 Alpine com volume persistente dedicado `benchos_pgdata_prod` e healthcheck nativo com `pg_isready`. Sem portas expostas diretamente para a rede externa da loja.
  2. `app`: Imagem gerada a partir do `Dockerfile`. Depende do `postgres` estar saudável (`condition: service_healthy`).
- Conexão de banco interna: `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public`.
- Apenas a porta HTTP configurada (`${PORT:-3001}`) é mapeada para os computadores da loja.
- Healthcheck ativo no container da aplicação: consulta periódica a `/api/health`.

### C. Entrypoint de Inicialização Seguro (`scripts/docker-entrypoint.sh`)
- Executado ao subir o container da aplicação:
  1. Aguarda a conectividade com o Postgres.
  2. Executa `npx prisma migrate deploy` de forma transacional e idempotente.
  3. Executa `npx prisma db seed` para garantir que o Admin e checklists iniciais existam sem duplicar registros.
  4. Dispara o servidor compilado `node backend/dist/server.js`.

### D. Pipeline de Integração Contínua (`.github/workflows/ci.yml`)
- Dispara automaticamente em `push` e `pull_request` na branch `main`:
  - **Job 1 (Testes e Build do Backend):** Node.js 20, `npm ci`, `npm test` (78 testes Vitest) e `npm run build` (`tsc`).
  - **Job 2 (Testes e Build do Frontend):** Node.js 20, `npm ci`, `npm test` (22 testes Vitest) e `npm run build` (`vite build`).
  - **Job 3 (Verificação do Container Docker):** Validação de build da imagem via `docker build` multi-stage, garantindo que o container compila perfeitamente antes de chegar ao servidor da distribuidora.

### E. Script de Atualização e Rollback no Servidor (`atualizar-servidor.sh`)
- Script executado no servidor local da distribuidora:
  - Valida se o repositório está limpo.
  - Executa `git pull origin main`.
  - Reconstrói e sobe os containers com `docker compose -f docker-compose.prod.yml up -d --build`.
  - Aguarda o healthcheck da aplicação responder `200 OK` em `/api/health`.
  - Se houver falha na inicialização da nova versão: emite alerta sonoro/visual de erro e permite reversão automática (`rollback`) para o commit anterior.
