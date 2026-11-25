# BenchOS — Sistema de Triagem Técnica & Bancada de Testes

Sistema web fullstack desenvolvido para distribuidoras de segurança eletrônica e redes (HDs CFTV, câmeras Hikvision/HiLook, gravadores DVR/NVR e controles de acesso AGL).

O sistema padroniza a triagem de equipamentos devolvidos por instaladores e clientes, registrando trilha completa de auditoria por funcionário (recebimento no balcão, início de análise na bancada e conclusão do laudo), inspeção de selo/lacre, detecção de reincidência por número de série/MAC e checklists guiados passo a passo.

---

## Arquitetura do Projeto

O sistema segue **Monólito Modular** no backend e **SPA por features** no frontend:

```text
sistema-triagem/
├── docker-compose.yml            # PostgreSQL 16 (container benchos-postgres)
├── .env.example                  # Variáveis de ambiente de referência (DB, JWT, Seed Admin)
├── iniciar.sh                    # Modo desenvolvimento: Docker + Postgres + Prisma + Backend + Vite Dev
├── iniciar-producao.sh           # Modo produção: Docker + Postgres + Prisma + Builds + servidor único
├── scripts/                      # Funções auxiliares compartilhadas dos scripts de inicialização
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

As credenciais do administrador inicial são lidas do arquivo `backend/.env` pelo `prisma/seed.ts`:

- `SEED_ADMIN_EMAIL` (padrão no `.env.example`: `admin@benchos.local`)
- `SEED_ADMIN_PASSWORD` (padrão no `.env.example`: `Admin@123`)
- `JWT_SECRET` (segredo de assinatura JWT com mínimo de 16 caracteres)

> **Aviso de Segurança:** Antes de colocar em produção na loja, **troque obrigatoriamente** `JWT_SECRET` e `SEED_ADMIN_PASSWORD` em `backend/.env` (ou redefina a senha do administrador após o primeiro login).

---

## Como Iniciar o Sistema na Loja

### 1. Pré-requisitos (primeira execução)

```bash
cd backend && npm install
cd ../frontend && npm install
```

Configure `backend/.env` (caso não exista, os scripts copiam o `.env.example` automaticamente). Para rodar em produção na loja, defina um `JWT_SECRET` forte e troque a senha do administrador padrão.

### 2. Modo Produção (Recomendado para testar liso ou rodar na loja)

Em produção, o frontend é compilado em arquivos estáticos (`frontend/dist`) e servido diretamente pelo próprio backend Node.js em uma única porta (padrão `3001`, configurável via `PORT` no `backend/.env`), sem peso de hot-reload:

```bash
./iniciar-producao.sh
```

Para manter o servidor ativo em segundo plano mesmo após fechar o terminal (usando PM2):

```bash
# Após rodar os builds e migrations uma vez:
cd backend
NODE_ENV=production pm2 start dist/server.js --name benchos
pm2 save
pm2 startup
```

Acesse:
- **No servidor:** `http://localhost:3001` (ou na `PORT` configurada no `backend/.env`)
- **De outros PCs na rede local:** `http://[IP_DO_SERVIDOR]:3001`

### 3. Modo Desenvolvimento (Para programar com recarga automática)

```bash
./iniciar.sh
```

O script valida o Docker, sobe o PostgreSQL 16, aplica migrations/seed e inicia Backend (`:3001`) e Vite Dev Server (`:3000` em `0.0.0.0`). Acesse em `http://localhost:3000`.

---

## Comandos Úteis de Banco, Testes e Build

### Testes e Builds

```bash
# Backend (Vitest + build TypeScript)
cd backend && npm test && npm run build

# Frontend (Vitest + build Vite)
cd frontend && npm test && npm run build
```

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
