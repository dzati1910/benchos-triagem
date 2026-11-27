# BenchOS — Sistema de Triagem Técnica & Bancada de Testes

Sistema web fullstack desenvolvido para distribuidoras de segurança eletrônica e redes (HDs CFTV, câmeras Hikvision/HiLook, gravadores DVR/NVR e controles de acesso AGL).

O sistema padroniza a triagem de equipamentos devolvidos por instaladores e clientes, registrando trilha completa de auditoria por funcionário (recebimento no balcão, início de análise na bancada e conclusão do laudo), inspeção de selo/lacre, detecção de reincidência por número de série/MAC e checklists guiados passo a passo.

---

## Arquitetura do Projeto

O sistema segue **Monólito Modular** no backend e **SPA por features** no frontend:

```text
sistema-triagem/
├── .github/workflows/ci.yml      # CI/CD: testes e builds (backend/frontend) + Docker build check
├── Dockerfile                    # Build multi-stage (Frontend Vite + Backend TS/Prisma + Runner Alpine)
├── .dockerignore                 # Exclusões do contexto de build Docker
├── docker-compose.yml            # PostgreSQL 16 para desenvolvimento local (container benchos-postgres)
├── docker-compose.prod.yml       # Orquestração de produção isolada (benchos-postgres-prod + benchos-app-prod)
├── .env.example                  # Variáveis de ambiente de referência (DB, JWT, Seed Admin, Porta)
├── iniciar.sh                    # Modo desenvolvimento: Docker + Postgres + Prisma + Backend + Vite Dev
├── iniciar-producao.sh           # Modo produção híbrido (host): Postgres Docker + Builds + servidor único
├── atualizar-servidor.sh         # Atualização segura em produção (git pull + rebuild + healthcheck + rollback)
├── scripts/
│   ├── benchos-common.sh         # Funções auxiliares compartilhadas dos scripts de inicialização local
│   ├── docker-entrypoint.sh      # Entrypoint do container: aguarda Postgres, aplica migrations/seed e inicia API
│   └── test-prod-container.sh    # Smoke test E2E isolado da stack Docker de produção (porta 3099)
├── backend/                      # API REST (Node.js + TypeScript + Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma         # Modelos PostgreSQL (User, Cliente, Categoria, ItemChecklist, Triagem, TriagemResposta)
│   │   ├── migrations/           # Histórico versionado de migrations
│   │   └── seed.ts               # Admin inicial + 4 categorias e 18 itens de bancada
│   └── src/
│       ├── app.ts                # Configuração Express, CORS, /api/health, rotas da API e SPA estática (prod)
│       ├── server.ts             # Inicialização HTTP na porta PORT (padrão 3001)
│       ├── config/env.ts         # Validação de variáveis de ambiente com Zod
│       ├── lib/prisma.ts         # Instância singleton do PrismaClient
│       ├── shared/               # AppError, middlewares auth (JWT/RBAC) e errorHandler
│       └── modules/              # Módulos independentes (routes / controller / service / repository / schema)
│           ├── auth/             # Login JWT e consulta /api/auth/me
│           ├── users/            # Gestão de funcionários (ADMIN) e bloqueio de auto-desativação
│           ├── clientes/         # Cadastro e busca rápida de clientes
│           ├── categorias/       # Categorias de equipamento e itens de checklist com "comoTestar"
│           └── triagens/         # Fluxo de OS, reincidência por serial, progresso parcial e conclusão transacional
│
├── frontend/                     # SPA React + Vite + TypeScript + Tailwind CSS
│   ├── vite.config.ts            # Bind 0.0.0.0:3000 + proxy /api -> http://127.0.0.1:3001
│   └── src/
│       ├── services/api.ts       # Cliente HTTP relativo (/api) com token Bearer e wrappers tipados
│       ├── contexts/AuthContext.tsx
│       ├── routes/ProtectedRoute.tsx
│       ├── components/Layout.tsx
│       └── features/
│           ├── auth/             # LoginPage
│           ├── triagens/         # Dashboard, Nova/Editar OS, Checklist de Bancada e Prontuário/WhatsApp
│           └── admin/            # UsuariosAdminPage e ChecklistsAdminPage (ADMIN)
│
└── docs/estudos/                 # Guias de estudo técnicos gerados ao longo da evolução do projeto
```

### Acesso na Rede Local (LAN) sem `localhost` hardcoded

O frontend **nunca** chama `http://localhost:3001` diretamente. Todas as chamadas em [`frontend/src/services/api.ts`](frontend/src/services/api.ts) usam caminho relativo `/api`, e o [`frontend/vite.config.ts`](frontend/vite.config.ts) faz proxy transparente de `/api` para `http://127.0.0.1:3001` enquanto escuta em `0.0.0.0:3000`. Assim, qualquer computador da loja (balcão ou bancada) acessa o sistema via `http://[IP_DO_SERVIDOR]:3000` sem problemas de CORS ou endereço inválido.

---

## Pré-requisitos e Setup no Pop!_OS / Ubuntu

- **Node.js 20+** e npm
- **Docker** e **Docker Compose** (plugin `docker compose`)

### Nota para Pop!_OS / Ubuntu (permissão do Docker)

Caso ainda não tenha configurado o Docker para seu usuário sem `sudo`:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Após adicionar o usuário ao grupo `docker`, **encerre a sessão e faça login novamente** (ou execute `newgrp docker`) antes de rodar `./iniciar.sh`.

---

## Autenticação Fechada e Credenciais Iniciais

O sistema opera com **login fechado**: não existe auto-cadastro público. Apenas usuários com papel `ADMIN` podem cadastrar novos funcionários, alterar papéis (`ADMIN` / `FUNCIONARIO`), ativar/desativar contas e redefinir senhas em `/admin/usuarios` (com proteção contra auto-desativação ou auto-rebaixamento da própria conta logada).

As credenciais do administrador inicial são lidas pelo `prisma/seed.ts` a partir das variáveis de ambiente (`.env` na raiz para Docker em produção, ou `backend/.env` nos modos híbrido/desenvolvimento):

- `SEED_ADMIN_EMAIL` (padrão no `.env.example`: `admin@benchos.local`)
- `SEED_ADMIN_PASSWORD` (padrão no `.env.example`: `Admin@123`)
- `JWT_SECRET` (segredo de assinatura JWT com mínimo de 16 caracteres)

> **Aviso de Segurança:** Antes de colocar em produção na loja, **troque obrigatoriamente** `JWT_SECRET`, `POSTGRES_PASSWORD` e `SEED_ADMIN_PASSWORD` no `.env` (ou `backend/.env`), ou redefina a senha do administrador após o primeiro login.

---

## Como Iniciar o Sistema na Loja

### 1. Modo Produção Containerizada (Docker Compose — Recomendado para o Servidor)

A stack de produção executa a aplicação (`benchos-app-prod`) e o banco PostgreSQL 16 (`benchos-postgres-prod`) totalmente containerizados via `docker-compose.prod.yml`:

- **Isolamento do banco de dados:** O PostgreSQL roda apenas na rede interna Docker `benchos_internal`, **sem expor a porta `5432` para o host ou para a LAN**, persistindo os dados no volume `benchos_pgdata_prod`.
- **Migrations e seed automáticos:** O `scripts/docker-entrypoint.sh` aguarda o PostgreSQL ficar acessível, executa `prisma migrate deploy` e garante o `prisma db seed` idempotente antes de subir o servidor Node.js (API + SPA estática do frontend em uma única porta).

1. Configure o arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
# Edite .env e defina senhas fortes para POSTGRES_PASSWORD, JWT_SECRET e SEED_ADMIN_PASSWORD
# (Opcional) Ajuste PORT=3001 caso deseje publicar em outra porta no servidor
```

2. Suba a stack de produção (build multi-stage + containers em segundo plano):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Acesse o sistema:
- **No servidor:** `http://localhost:3001` (ou na `PORT` configurada no `.env`)
- **De outros PCs na rede local:** `http://[IP_DO_SERVIDOR]:3001`

#### Atualização Segura e Rollback no Servidor

Para atualizar o servidor da loja com segurança a partir de `origin/main`:

```bash
./atualizar-servidor.sh
```

O script verifica se o repositório está limpo e na branch `main`, salva o commit atual (`PREV_COMMIT`), executa `git pull origin main`, reconstroi os containers com `docker compose -f docker-compose.prod.yml up -d --build` e monitora `http://localhost:${PORT}/api/health` por até 45 segundos. Se o build ou o healthcheck falhar, ele exibe os logs do container `app` e oferece (ou executa automaticamente com `--auto-rollback` ou `AUTO_ROLLBACK=1`) o rollback para `PREV_COMMIT`.

#### Smoke Test Isolado do Container de Produção

Para validar a imagem Docker de produção ponta a ponta sem afetar o banco principal:

```bash
./scripts/test-prod-container.sh
```

O script sobe um projeto Compose isolado (`benchos-smoke`) na porta `3099` (configurável via `SMOKE_PORT`) com banco descartável, valida `/api/health`, rotas da SPA (`/` e `/admin/usuarios`) e erro `404` da API, removendo todos os containers e volumes temporários ao final.

### 2. Modo Produção Híbrido (Host Node.js + Postgres Docker)

Caso prefira rodar o Node.js diretamente no host (sem container para a aplicação):

```bash
cd backend && npm install
cd ../frontend && npm install
./iniciar-producao.sh
```

O script prepara `backend/.env`, sobe o PostgreSQL de `docker-compose.yml`, compila `frontend/dist` e `backend/dist` e inicia o servidor único na porta configurada (`3001` por padrão). Para manter ativo em segundo plano com PM2:

```bash
cd backend
NODE_ENV=production pm2 start dist/server.js --name benchos
pm2 save
pm2 startup
```

### 3. Modo Desenvolvimento (Para programar com recarga automática)

```bash
cd backend && npm install
cd ../frontend && npm install
./iniciar.sh
```

O script valida o Docker, sobe o PostgreSQL 16, aplica migrations/seed e inicia Backend (`:3001`) e Vite Dev Server (`:3000` em `0.0.0.0`). Acesse em `http://localhost:3000`.

---

## Comandos Úteis de Banco, Testes e Build

### Testes, Builds e CI/CD

```bash
# Backend (Vitest + build TypeScript)
cd backend && npm test && npm run build

# Frontend (Vitest + build Vite)
cd frontend && npm test && npm run build
```

O pipeline em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa automaticamente os testes e builds do backend e do frontend e valida o build multi-stage da imagem Docker (`Dockerfile`) em cada `push` ou `pull_request` para `main`.

### Banco de Dados (Prisma + Docker)

```bash
# Subir apenas o PostgreSQL
docker compose up -d

# Aplicar migrations e rodar seed manualmente
cd backend && npx prisma migrate deploy && npx prisma db seed

# Reset completo do banco de desenvolvimento (apaga dados e reaplica migrations + seed)
cd backend && npx prisma migrate reset --force
```

---

## Documentação e Estudos

- Guias de estudo detalhados sobre arquitetura, Prisma, JWT/RBAC, transações ACID e frontend React estão disponíveis em [`docs/estudos/`](docs/estudos/).

## Procedimento de Segurança na Bancada de Testes

Para evitar conflitos de rede na loja durante testes de câmeras IP e gravadores:
1. Conecte o computador da bancada a um switch isolado dedicado aos testes.
2. Evite ligar câmeras com IP padrão de fábrica (`192.168.1.108`) diretamente na rede principal da empresa.
3. Utilize fonte 12V protegida/conhecida de bancada e multímetro para conferir polaridade e tensão antes de energizar equipamentos devolvidos.
