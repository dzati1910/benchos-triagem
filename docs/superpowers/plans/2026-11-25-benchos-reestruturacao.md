# BenchOS Reestruturação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o sistema de triagem BenchOS com PostgreSQL em Docker, Prisma ORM, backend em Monólito Modular com autenticação controlada e testes automatizados, frontend SPA por features com React Router, checklists guiados para a filial e repositório Git organizado.

**Architecture:** Aplicação cliente-servidor desacoplada no mesmo repositório Git (`/backend` e `/frontend`). O backend segue **Monólito Modular** (`src/modules/{auth,users,clientes,categorias,triagens}`) separando `schema -> repository -> service -> controller -> routes`, com Prisma ORM apontando para PostgreSQL 16 em Docker Compose e testes Vitest + Supertest. O frontend é uma **SPA React por features** com `react-router-dom` e proxy `/api` no Vite para operação transparente em qualquer PC da rede local da filial.

**Tech Stack:** Node.js `v24.21.0`, TypeScript `5.7+`, Express, Prisma ORM, PostgreSQL 16 (Docker Compose), Zod, `jsonwebtoken`, `bcryptjs`, Vitest, Supertest, React 18, `react-router-dom`, Vite 6, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-25-benchos-reestruturacao-design.md`

---

## Global Constraints

- Sistema operacional de desenvolvimento verificado: Pop!_OS 24.04 LTS (`noble`), Node `v24.21.0`, `npm 11.19.0`, `git 2.43.0`; Docker ainda não instalado (Task 1 conduz instalação passo a passo no terminal com o usuário).
- Escopo travado em uma única filial (sem tabela/campo `filial` no banco nem fluxo entre filiais).
- Sem suporte ou texto de interface para leitor USB de código de barras; `numeroSerieMac` é digitado manualmente e salvo em `trim().toUpperCase()`.
- Login controlado sem rota ou tela pública de cadastro; apenas `ADMIN` cria/gerencia usuários e checklists.
- Operação 100% local (LAN) sem banco em nuvem e sem `localhost` hardcoded no cliente HTTP do frontend.
- Enums do banco/domínio: `Role` (`ADMIN | FUNCIONARIO`), `StatusSelo` (`INTEGRO | VIOLADO | SEM_SELO`), `StatusTriagem` (`PENDENTE | EM_ANALISE | CONCLUIDA | CANCELADA`), `DiagnosticoFinal` (`OPERACIONAL | DEFEITO_FABRICA | ENCAMINHAR_ESPECIALISTA | SEM_GARANTIA`), `ResultadoItemChecklist` (`PENDENTE | APROVADO | REPROVADO | NAO_TESTADO`).
- Trilha de auditoria em `Triagem`: `recebidoPorId`, `analiseIniciadaPorId`, `concluidoPorId`, `canceladoPorId`, `ultimaAtualizacaoPorId` preenchidos pelo `req.user.id` autenticado.

## Review Focus

1. **Serial/MAC com espaços/minúsculas e OS canceladas na busca de reincidência:** `" 4k08a-370 "` deve normalizar para `"4K08A-370"` no recebimento, edição e em `GET /api/triagens/reincidencia`, e triagens `CANCELADA` não devem disparar alerta de reincidência (coberto na **Task 6**).
2. **Usuário desativado (`ativo = false`) com JWT antigo ainda válido e auto-desativação de `ADMIN`:** middleware `authenticate` consulta o usuário ativo no banco e rejeita contas desativadas com `401`; `ADMIN` tentando desativar a própria conta recebe `409` (coberto nas **Tasks 3 e 4**).
3. **Troca de categoria em OS `EM_ANALISE` que já possui respostas parciais:** `PATCH /api/triagens/:id` deve rejeitar com `409` quando `categoriaId` muda havendo `TriagemResposta` salva sem `limparRespostasAnteriores: true`, e limpar respostas antigas na transação quando confirmado (coberto na **Task 6**).
4. **Conclusão incompleta vs `SEM_GARANTIA` e bloqueio de OS fechada (`CONCLUIDA` / `CANCELADA`):** `concluirTriagem` rejeita com `400` itens `PENDENTE` para diagnósticos técnicos, só aceita encerrar com itens não avaliados quando `diagnosticoFinal === 'SEM_GARANTIA'` e `statusSelo !== 'INTEGRO'` (convertendo itens `PENDENTE` em `NAO_TESTADO`), e impede `FUNCIONARIO` de alterar OS `CONCLUIDA`/`CANCELADA` retornando `403`/`409` (coberto na **Task 6**).
5. **Falha de autenticação (`401`) / permissão (`403`) e acesso em rede local sem `localhost`:** API sem token válido retorna JSON `401`; `FUNCIONARIO` em rota admin retorna `403`; cliente HTTP do frontend usa `/api` relativo e limpa sessão ao receber `401` fora de `/auth/login` (coberto nas **Tasks 3, 4 e 7**).

---

## File Structure Overview

- **Raiz (`/home/dzati/sistema-triagem`):** `.gitignore`, `.env.example`, `docker-compose.yml`, `iniciar.sh`, `README.md`.
- **Backend (`/home/dzati/sistema-triagem/backend`):**
  - `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`
  - `vitest.config.ts`, `.env`, `package.json`, `tsconfig.json`
  - `src/config/env.ts`, `src/lib/prisma.ts`
  - `src/shared/errors/AppError.ts`, `src/shared/middlewares/{auth.ts,errorHandler.ts}` + `auth.test.ts`
  - `src/modules/auth/auth.{schema,service,controller,routes,test}.ts`
  - `src/modules/users/users.{schema,repository,service,controller,routes,test}.ts`
  - `src/modules/clientes/clientes.{schema,repository,service,controller,routes,test}.ts`
  - `src/modules/categorias/categorias.{schema,repository,service,controller,routes,test}.ts`
  - `src/modules/triagens/{triagem.utils,triagens.schema,triagens.repository,triagens.service,triagens.controller,triagens.routes,triagens.test}.ts`
  - `src/app.ts`, `src/server.ts`
  - **Remover legado:** `src/database/db.ts`, `src/controllers/*`, `src/types/index.ts`, `triagem.db`
- **Frontend (`/home/dzati/sistema-triagem/frontend`):**
  - `vite.config.ts`, `package.json`, `tsconfig.json`, `src/index.css`
  - `src/types/index.ts`, `src/services/{api.ts,api.test.ts}`
  - `src/contexts/AuthContext.tsx`, `src/routes/ProtectedRoute.tsx`, `src/components/Layout.tsx`
  - `src/features/auth/LoginPage.tsx`
  - `src/features/triagens/{triagemHelpers.ts,triagemHelpers.test.ts,TriagensDashboardPage.tsx}`
  - `src/features/triagens/components/{StatusBadge.tsx,SeloBadge.tsx,NovaOuEditarTriagemModal.tsx,BancadaChecklistModal.tsx,ProntuarioResumoModal.tsx}`
  - `src/features/admin/{UsuariosAdminPage.tsx,ChecklistsAdminPage.tsx}`
  - `src/App.tsx`
  - **Remover legado:** `src/types.ts`, `src/components/{StatusBadge.tsx,NovaTriagemModal.tsx,ChecklistModal.tsx,DetalhesModal.tsx}`

---

### Task 1: Instalação Guiada do Docker no Pop!_OS 24.04, Inicialização do Git e PostgreSQL via Compose

**Files:**
- Create: `/home/dzati/sistema-triagem/.gitignore`
- Create: `/home/dzati/sistema-triagem/.env.example`
- Create: `/home/dzati/sistema-triagem/backend/.env`
- Create: `/home/dzati/sistema-triagem/docker-compose.yml`

**Interfaces:**
- Produces: PostgreSQL 16 em `localhost:5432` com banco `benchos`, usuário `benchos`, senha definida em `.env` e `DATABASE_URL` configurada em `backend/.env`.

- [ ] **Step 1: Guiar e executar instalação do Docker Engine + Compose Plugin no Pop!_OS 24.04 (`noble`)**

Explicar ao usuário cada comando antes de solicitar execução (ou orientar digitação da senha `sudo` no terminal caso não haja permissão direta):

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Após adicionar o usuário ao grupo `docker`, abrir nova sessão de grupo (`newgrp docker`) ou reiniciar sessão para evitar precisar de `sudo` em cada comando Docker.

- [ ] **Step 2: Verificar instalação do Docker Engine e Compose v2**

Run: `docker --version && docker compose version && docker ps`  
Expected: saída mostrando `Docker version ...`, `Docker Compose version v2...` e tabela vazia de containers sem erro de permissão de socket.

- [ ] **Step 3: Criar `.gitignore`, `.env.example`, `backend/.env` e `docker-compose.yml`**

- `.gitignore`: ignorar `node_modules/`, `dist/`, `.env`, `backend/.env`, `*.db`, `postgres-data/`, `coverage/`, `.DS_Store`.
- `.env.example` na raiz e `backend/.env` contendo: `POSTGRES_USER=benchos`, `POSTGRES_PASSWORD=benchos_dev_pass`, `POSTGRES_DB=benchos`, `DATABASE_URL="postgresql://benchos:benchos_dev_pass@localhost:5432/benchos?schema=public"`, `PORT=3001`, `JWT_SECRET="benchos-dev-secret-min-32-caracteres-aqui"`, `JWT_EXPIRES_IN="7d"`, `SEED_ADMIN_NAME="Administrador BenchOS"`, `SEED_ADMIN_EMAIL="admin@benchos.local"`, `SEED_ADMIN_PASSWORD="Admin@123"`.
- `docker-compose.yml` com serviço `postgres` usando imagem `postgres:16-alpine`, `container_name: benchos-postgres`, `restart: unless-stopped`, porta `5432:5432`, volume nomeado `benchos_pgdata:/var/lib/postgresql/data` e `healthcheck` com `pg_isready -U benchos -d benchos`.

- [ ] **Step 4: Subir container PostgreSQL e validar saúde**

Run: `cd /home/dzati/sistema-triagem && docker compose up -d && docker compose ps`  
Expected: container `benchos-postgres` com status `Up ... (healthy)`.

- [ ] **Step 5: Inicializar repositório Git e registrar marco inicial**

```bash
cd /home/dzati/sistema-triagem
git init -b main
git add .gitignore .env.example docker-compose.yml docs/
git commit -m "chore: setup git repo, docker-compose postgres e docs de design"
```

Run: `git -C /home/dzati/sistema-triagem status && git -C /home/dzati/sistema-triagem log --oneline -n 1`  
Expected: commit registrado na branch `main` sem rastrear `node_modules` ou `backend/.env`.

---

### Task 2: Modelagem Prisma ORM, Migrations PostgreSQL e Seed Realista da Filial

**Files:**
- Remove: `/home/dzati/sistema-triagem/backend/src/database/db.ts`
- Remove: `/home/dzati/sistema-triagem/backend/triagem.db`
- Modify: `/home/dzati/sistema-triagem/backend/package.json`
- Create: `/home/dzati/sistema-triagem/backend/prisma/schema.prisma`
- Create: `/home/dzati/sistema-triagem/backend/prisma/seed.ts`

**Interfaces:**
- Produces: modelos Prisma `User`, `Cliente`, `Categoria`, `ItemChecklist`, `Triagem`, `TriagemResposta` + enums `Role`, `StatusSelo`, `StatusTriagem`, `DiagnosticoFinal`, `ResultadoItemChecklist` com tipos gerados em `@prisma/client`.

- [ ] **Step 1: Atualizar dependências em `backend/package.json` (remover `better-sqlite3` e instalar Prisma + stack de produção/testes)**

```bash
cd /home/dzati/sistema-triagem/backend
npm uninstall better-sqlite3 @types/better-sqlite3
npm install @prisma/client zod jsonwebtoken bcryptjs dotenv
npm install -D prisma vitest supertest @types/jsonwebtoken @types/bcryptjs @types/supertest
```

Atualizar `scripts` de `backend/package.json` com `"test": "vitest run"`, `"test:watch": "vitest"`, `"prisma:generate": "prisma generate"`, `"prisma:migrate": "prisma migrate dev"`, `"prisma:seed": "tsx prisma/seed.ts"`, e configurar bloco `"prisma": { "seed": "tsx prisma/seed.ts" }`.

- [ ] **Step 2: Escrever `backend/prisma/schema.prisma` fiel à Seção 5.1 da Spec**

Definir datasource `postgresql` (`env("DATABASE_URL")`), generator `prisma-client-js`, todos os 5 enums da spec e os 6 modelos com FKs explícitas nomeadas para a trilha tripla de usuário em `Triagem`:
- `recebidoPor User @relation("TriagensRecebidas", fields: [recebidoPorId], references: [id])`
- `analiseIniciadaPor User? @relation("TriagensIniciadas", fields: [analiseIniciadaPorId], references: [id])`
- `concluidoPor User? @relation("TriagensConcluidas", fields: [concluidoPorId], references: [id])`
- `canceladoPor User? @relation("TriagensCanceladas", fields: [canceladoPorId], references: [id])`
- `ultimaAtualizacaoPor User? @relation("TriagensAtualizadas", fields: [ultimaAtualizacaoPorId], references: [id])`
- Índice em `Triagem(numeroSerieMac)` e índice composto `@@unique([triagemId, itemChecklistId])` em `TriagemResposta` (com `onDelete: Cascade` na relação `triagem`).

- [ ] **Step 3: Remover artefatos SQLite antigos e rodar primeira migration no PostgreSQL**

```bash
rm -f /home/dzati/sistema-triagem/backend/src/database/db.ts /home/dzati/sistema-triagem/backend/triagem.db
cd /home/dzati/sistema-triagem/backend
npx prisma migrate dev --name init
```

Expected: pasta `backend/prisma/migrations/..._init` criada e `Generated Prisma Client` sem erros.

- [ ] **Step 4: Implementar `backend/prisma/seed.ts` idempotente (Admin + 4 checklists reais da filial)**

- Ler `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` de `process.env` (via `dotenv/config`), fazer hash com `bcryptjs` (`salt = 10`) e usar `prisma.user.upsert` com `role: 'ADMIN'`.
- Popular via `upsert` as 4 categorias reais da Spec Seção 5.2 (exatamente com descrições e instruções `comoTestar`):
  1. `HD (Disco Rígido CFTV)` (`icone: 'HardDrive'`) — 4 itens (Inspeção física/SATA, Reconhecimento/ruído mecânico, Leitura S.M.A.R.T. no PC com saúde/horas/setores na observação, Formatação/gravação 10+ min).
  2. `Câmera Hikvision / HiLook` (`icone: 'Camera'`) — 4 itens (Inspeção física/lacre/cabo, Alimentação 12V/PoE e IR, Vídeo e foco em DVR/SADP, Corte ICR dia/noite e Reset).
  3. `Gravador DVR / NVR Hikvision / HiLook` (`icone: 'Server'`) — 5 itens (Inspeção/fonte 12V, Boot HDMI/VGA e bip, SATA/HD bancada, Canais vídeo e rede/PoE/Hik-Connect, Ventoinha/temperatura).
  4. `Controle de Acesso AGL` (`icone: 'KeyRound'`) — 5 itens (Inspeção física/bornes/selo, Alimentação 12V controlada, Leitura TAG/biometria/senha, Saída relé/fechadura e botoeira, Reset de fábrica).

- [ ] **Step 5: Executar seed e validar registros direto no PostgreSQL**

Run: `cd /home/dzati/sistema-triagem/backend && npx prisma db seed && docker compose -f ../docker-compose.yml exec -T postgres psql -U benchos -d benchos -c "SELECT count(*) AS categorias FROM \"Categoria\"; SELECT count(*) AS itens FROM \"ItemChecklist\"; SELECT email, role FROM \"User\";"`  
Expected: `categorias = 4`, `itens = 18`, usuário `admin@benchos.local` com role `ADMIN`.

- [ ] **Step 6: Commit**

```bash
cd /home/dzati/sistema-triagem
git add backend/package.json backend/package-lock.json backend/prisma/
git commit -m "feat(db): configura schema prisma, migrations postgres e seed real da filial"
```

---

### Task 3: Núcleo Backend Compartilhado (`env`, `prisma`, `AppError`, `auth` middleware, `errorHandler`) e Setup Vitest

**Files:**
- Create: `/home/dzati/sistema-triagem/backend/vitest.config.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/config/env.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/lib/prisma.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/shared/errors/AppError.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/shared/middlewares/auth.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/shared/middlewares/errorHandler.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/app.ts`
- Test: `/home/dzati/sistema-triagem/backend/src/shared/middlewares/auth.test.ts`

**Interfaces:**
- Produces:
  - `env: { PORT: number; DATABASE_URL: string; JWT_SECRET: string; JWT_EXPIRES_IN: string }`
  - `class AppError extends Error { constructor(message: string, statusCode?: number, code?: string) }`
  - `authenticate(req: Request, res: Response, next: NextFunction): Promise<void>` (anexa `req.user: { id: number; nome: string; email: string; role: Role }`)
  - `requireRole(...roles: Role[]): RequestHandler`
  - `errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void`
  - `export const app: Express` (sem `app.listen`) em `src/app.ts`, já com `GET /api/health`.

- [ ] **Step 1: Escrever testes que falham em `backend/src/shared/middlewares/auth.test.ts` (TDD + Review Focus #2 e #5)**

Mockar `src/lib/prisma` com `vi.mock` e testar via Supertest em mini app Express usando `authenticate`, `requireRole` e `errorHandler`:

```typescript
it('retorna 401 quando Authorization Bearer está ausente ou malformado', async () => {
  const res = await request(testApp).get('/privado');
  expect(res.status).toBe(401);
});

it('retorna 401 quando usuário do token foi desativado no banco (ativo: false)', async () => {
  mockFindUnique.mockResolvedValue({ id: 2, nome: 'Joao', email: 'j@loja.com', role: 'FUNCIONARIO', ativo: false });
  const token = jwt.sign({ sub: 2, role: 'FUNCIONARIO' }, env.JWT_SECRET);
  const res = await request(testApp).get('/privado').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(401);
});

it('retorna 403 quando FUNCIONARIO tenta acessar rota restrita a ADMIN', async () => {
  mockFindUnique.mockResolvedValue({ id: 2, nome: 'Joao', email: 'j@loja.com', role: 'FUNCIONARIO', ativo: true });
  const token = jwt.sign({ sub: 2, role: 'FUNCIONARIO' }, env.JWT_SECRET);
  const res = await request(testApp).get('/somente-admin').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Rodar teste e confirmar falha esperada**

Run: `cd /home/dzati/sistema-triagem/backend && npm test -- src/shared/middlewares/auth.test.ts`  
Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 3: Implementar `vitest.config.ts`, `env.ts`, `prisma.ts`, `AppError.ts`, `auth.ts`, `errorHandler.ts` e `app.ts`**

- `vitest.config.ts`: definir `environment: 'node'`, `globals: true`, `setupFiles` garantindo variáveis de ambiente padrão para testes (`JWT_SECRET` de teste, `PORT`, `DATABASE_URL` dummy caso rodando unitário sem banco).
- `env.ts`: validar `process.env` com Zod (`DATABASE_URL`, `JWT_SECRET` min 16 chars, `JWT_EXPIRES_IN` default `'7d'`, `PORT` coerce default `3001`).
- `AppError.ts`: erro operacional com `statusCode` (default `400`) e `code` opcional.
- `auth.ts` + declaração de módulo `Express.Request.user`: verificar header `Bearer <token>`, decodificar JWT com `env.JWT_SECRET`, converter `const userId = Number(payload.sub)` validando inteiro positivo, buscar `prisma.user.findUnique({ where: { id: userId }, select: { id, nome, email, role, ativo } })`; se não existir ou `!user.ativo`, lançar `new AppError('Sessão inválida ou usuário inativo.', 401)`. Em `requireRole`, checar `roles.includes(req.user.role)` ou lançar `new AppError('Acesso restrito a administradores.', 403)`.
- `errorHandler.ts`: tratar `ZodError` (400 + `details`), `AppError` (`err.statusCode` + `{ error, code }`), Prisma `P2002` (409) e fallback `500`.
- `app.ts`: configurar `cors()`, `express.json()`, rota `GET /api/health` verificando conexão `prisma.$queryRaw\`SELECT 1\``, e registrar `errorHandler` ao final. (Atualizar também `backend/tsconfig.json` para excluir `**/*.test.ts` de `dist` ou manter `exclude: ["**/*.test.ts", "vitest.config.ts"]`).

- [ ] **Step 4: Rodar testes e TypeScript check**

Run: `cd /home/dzati/sistema-triagem/backend && npm test -- src/shared/middlewares/auth.test.ts && npx tsc --noEmit`  
Expected: 3+ testes passando e `tsc --noEmit` exit code 0.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add backend/vitest.config.ts backend/tsconfig.json backend/src/
git commit -m "feat(core): configura vitest, env zod, prisma singleton e middlewares auth/errorHandler"
```

---

### Task 4: Módulos `auth` e `users` (Login Controlado sem Auto-Cadastro + Gestão Admin)

**Files:**
- Create: `/home/dzati/sistema-triagem/backend/src/modules/auth/auth.schema.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/auth/auth.service.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/auth/auth.controller.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/auth/auth.routes.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/users/users.schema.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/users/users.repository.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/users/users.service.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/users/users.controller.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/users/users.routes.ts`
- Modify: `/home/dzati/sistema-triagem/backend/src/app.ts`
- Test: `/home/dzati/sistema-triagem/backend/src/modules/auth/auth.test.ts`
- Test: `/home/dzati/sistema-triagem/backend/src/modules/users/users.test.ts`

**Interfaces:**
- Consumes: `prisma`, `env`, `AppError`, `authenticate`, `requireRole` (Task 3).
- Produces:
  - `POST /api/auth/login` (`{ email, senha } -> { token, user: PublicUserDTO }`)
  - `GET /api/auth/me` (Bearer JWT -> `{ user: PublicUserDTO }`)
  - `GET /api/users` (`ADMIN` -> `PublicUserDTO[]`)
  - `POST /api/users` (`ADMIN`, `{ nome, email, senha, role }` -> `201 PublicUserDTO`)
  - `PATCH /api/users/:id` (`ADMIN`, `{ nome?, role?, ativo? }` -> `PublicUserDTO`)
  - `PATCH /api/users/:id/senha` (`ADMIN`, `{ novaSenha }` -> `{ message }`)
  - Tipo compartilhado `PublicUserDTO = { id: number; nome: string; email: string; role: Role; ativo: boolean; criadoEm: Date }` (nunca inclui `senhaHash`).

- [ ] **Step 1: Escrever testes que falham em `auth.test.ts` e `users.test.ts` (TDD + Review Focus #2 e #5)**

- Em `auth.test.ts`:
  - `login` retorna `{ token, user }` sem `senhaHash` quando credenciais válidas e `ativo: true`.
  - `login` com senha incorreta ou email inexistente retorna `401`.
  - `login` com usuário `ativo: false` retorna `401` (`'Usuário desativado. Contate o administrador.'`).
  - `POST /api/auth/register` (rota pública) não existe e retorna `404`.
- Em `users.test.ts`:
  - `ADMIN` cria usuário (`201`), gera hash bcrypt e não retorna `senhaHash`; e-mail duplicado retorna `409`.
  - `ADMIN` tentando desativar (`ativo: false`) ou rebaixar a si mesmo (`targetId === actorId`) recebe `409` (`'Não é permitido desativar ou remover privilégios da própria conta.'`).
  - `FUNCIONARIO` tentando `GET/POST/PATCH /api/users` recebe `403`.

- [ ] **Step 2: Rodar testes e confirmar falha**

Run: `cd /home/dzati/sistema-triagem/backend && npm test -- src/modules/auth/auth.test.ts src/modules/users/users.test.ts`  
Expected: FAIL por ausência dos arquivos.

- [ ] **Step 3: Implementar módulos `auth` e `users` e montar em `src/app.ts`**

- `users.repository.ts`: queries Prisma com `select` seguro sem `senhaHash` para listagem/retorno, e busca completa apenas para autenticação por e-mail.
- `auth.service.ts`: validar `email.trim().toLowerCase()`, comparar `bcryptjs.compare`, verificar `user.ativo`, assinar JWT `{ sub: user.id, role: user.role }` com `{ expiresIn: env.JWT_EXPIRES_IN }`.
- `users.service.ts`: criar com hash `bcryptjs.hash(senha, 10)`, bloquear auto-desativação/auto-rebaixamento quando `targetId === actor.id`, permitir reset de senha pelo `ADMIN`.
- Montar `/api/auth` e `/api/users` em `src/app.ts` garantindo ausência total de rota de auto-cadastro público.

- [ ] **Step 4: Rodar testes e verificação TypeScript**

Run: `cd /home/dzati/sistema-triagem/backend && npm test && npx tsc --noEmit`  
Expected: todos os testes (`auth`, `users`, `middlewares`) passando e zero erros de compilação.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add backend/src/modules/auth backend/src/modules/users backend/src/app.ts
git commit -m "feat(auth,users): implementa login jwt controlado e gestao de usuarios admin"
```

---

### Task 5: Módulos `clientes` e `categorias` (Clientes e Checklists Guiados Editáveis)

**Files:**
- Create: `/home/dzati/sistema-triagem/backend/src/modules/clientes/{clientes.schema,clientes.repository,clientes.service,clientes.controller,clientes.routes,clientes.test}.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/categorias/{categorias.schema,categorias.repository,categorias.service,categorias.controller,categorias.routes,categorias.test}.ts`
- Modify: `/home/dzati/sistema-triagem/backend/src/app.ts`

**Interfaces:**
- Consumes: `prisma`, `AppError`, `authenticate`, `requireRole` (Task 3).
- Produces:
  - `GET /api/clientes` (`?busca=` -> `Cliente[]`) e `POST /api/clientes` (`{ nome, telefone?, documento? }` -> `201 Cliente`)
  - `GET /api/categorias` (`?incluirInativos=true` somente quando `ADMIN`, padrão retorna apenas categorias e itens com `ativo: true` ordenados por `ordem ASC`)
  - `POST /api/categorias` (`ADMIN`, `{ nome, icone, instrucaoGeral? }` -> `201 Categoria`)
  - `PATCH /api/categorias/:id` (`ADMIN`, `{ nome?, icone?, instrucaoGeral?, ativo? }` -> `Categoria`)
  - `POST /api/categorias/:id/itens` (`ADMIN`, `{ descricao, comoTestar, ordem? }` -> `201 ItemChecklist`)
  - `PATCH /api/categorias/itens/:itemId` (`ADMIN`, `{ descricao?, comoTestar?, ordem?, ativo? }` -> `ItemChecklist`)

- [ ] **Step 1: Escrever testes que falham em `clientes.test.ts` e `categorias.test.ts`**

- `clientes.test.ts`:
  - Usuário autenticado lista clientes e cria cliente com `nome` normalizado (`trim()`).
  - `POST /api/clientes` com `nome` vazio retorna `400` Zod error.
- `categorias.test.ts`:
  - Usuário `FUNCIONARIO` obtém categorias ativas com itens ativos em ordem crescente; ao pedir `?incluirInativos=true` como `FUNCIONARIO`, recebe apenas ativos (ou `403` — optar explicitamente por ignorar flag para não-admin ou exigir `ADMIN`; aqui exigimos `ADMIN` para `incluirInativos=true` retornando `403` para não-admin).
  - `ADMIN` cria categoria (`201`), edita categoria, cria item com `comoTestar` (`201`), reordena/desativa item (`PATCH /api/categorias/itens/:itemId`).
  - `FUNCIONARIO` tentando `POST /api/categorias` ou `PATCH /api/categorias/itens/:itemId` recebe `403`.

- [ ] **Step 2: Rodar testes e confirmar falha**

Run: `cd /home/dzati/sistema-triagem/backend && npm test -- src/modules/clientes/clientes.test.ts src/modules/categorias/categorias.test.ts`  
Expected: FAIL por ausência dos módulos.

- [ ] **Step 3: Implementar módulos `clientes` e `categorias` e montar em `src/app.ts`**

- Proteger todas as rotas com `authenticate`.
- Aplicar `requireRole('ADMIN')` nas mutações de categorias/itens.
- Em `POST /api/categorias/:id/itens`, calcular próxima `ordem` automaticamente caso não informada (`max(ordem) + 1`).

- [ ] **Step 4: Rodar testes e TypeScript check**

Run: `cd /home/dzati/sistema-triagem/backend && npm test && npx tsc --noEmit`  
Expected: todos os testes passando e `tsc --noEmit` exit code 0.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add backend/src/modules/clientes backend/src/modules/categorias backend/src/app.ts
git commit -m "feat(clientes,categorias): adiciona modulos de clientes e checklists editaveis por admin"
```

---

### Task 6: Módulo `triagens` Completo, Remoção do Legado SQLite e Entrypoint `server.ts`

**Files:**
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagem.utils.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.schema.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.repository.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.service.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.controller.ts`
- Create: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.routes.ts`
- Modify: `/home/dzati/sistema-triagem/backend/src/app.ts`
- Modify: `/home/dzati/sistema-triagem/backend/src/server.ts`
- Remove: `/home/dzati/sistema-triagem/backend/src/controllers/triagemController.ts`
- Remove: `/home/dzati/sistema-triagem/backend/src/controllers/clienteController.ts`
- Remove: `/home/dzati/sistema-triagem/backend/src/controllers/categoriaController.ts`
- Remove: `/home/dzati/sistema-triagem/backend/src/types/index.ts`
- Test: `/home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.test.ts`

**Interfaces:**
- Consumes: `prisma`, `AppError`, `authenticate`, `requireRole` (Task 3).
- Produces:
  - `normalizarSerial(raw: string): string` e `gerarResumoClienteSugestao(params): string` em `triagem.utils.ts`
  - `GET /api/triagens` (`?status=&busca=&incluirCanceladas=`) -> lista com dados de cliente, categoria e responsáveis (`recebidoPor`, `analiseIniciadaPor`, `concluidoPor`, `canceladoPor`)
  - `GET /api/triagens/reincidencia` (`?serial=&excluirTriagemId=`) -> histórico ordenado por data desc de triagens com `status !== 'CANCELADA'`
  - `GET /api/triagens/:id` -> `{ triagem, itensChecklist, respostas }` (itens ativos da categoria + quaisquer itens já respondidos na OS)
  - `POST /api/triagens` -> `201 Triagem` (`status: 'PENDENTE'`, `recebidoPorId: req.user.id`)
  - `PATCH /api/triagens/:id` -> edita dados de entrada de OS `PENDENTE` ou `EM_ANALISE` (`limparRespostasAnteriores?: boolean`)
  - `PATCH /api/triagens/:id/cancelar` -> muda para `CANCELADA`, grava `canceladoPorId` e `canceladoEm` (somente `PENDENTE` ou `EM_ANALISE`)
  - `PATCH /api/triagens/:id/iniciar` -> se `PENDENTE`, muda para `EM_ANALISE` e grava `analiseIniciadaPorId`/`analiseIniciadaEm`; se já `EM_ANALISE`, preserva `analiseIniciadaPorId`
  - `PATCH /api/triagens/:id/progresso` -> salva parcial `respostas[]`, `diagnosticoFinal?`, `parecerTecnico?`, `resumoCliente?`, `ultimaAtualizacaoPorId`
  - `PATCH /api/triagens/:id/concluir` -> valida conclusão e grava respostas + `CONCLUIDA` + `concluidoPorId` + `concluidoEm` em transação ACID
  - `PATCH /api/triagens/:id/reabrir` (`ADMIN`) -> retorna `CONCLUIDA -> EM_ANALISE` gravando `ultimaAtualizacaoPorId`

- [ ] **Step 1: Escrever testes que falham em `triagens.test.ts` (cobrindo Review Focus #1, #3 e #4)**

```typescript
it('normaliza numeroSerieMac em criarTriagem e exclui CANCELADA da busca de reincidencia', async () => { ... });
it('preserva analiseIniciadaPorId original quando outro funcionario conclui a OS em EM_ANALISE', async () => { ... });
it('salva progresso parcial em EM_ANALISE permitindo respostas PENDENTE e observacoes S.M.A.R.T.', async () => { ... });
it('retorna 409 ao tentar alterar categoriaId em EM_ANALISE com respostas parciais sem confirmar limpeza', async () => { ... });
it('limpa respostas anteriores na transacao ao alterar categoriaId com limparRespostasAnteriores=true', async () => { ... });
it('rejeita 400 concluirTriagem com itens PENDENTE para OPERACIONAL ou DEFEITO_FABRICA', async () => { ... });
it('aceita concluirTriagem como SEM_GARANTIA sem todos os itens testados apenas quando statusSelo != INTEGRO, convertendo PENDENTE em NAO_TESTADO', async () => { ... });
it('retorna 409 quando qualquer usuario tenta editar, salvar progresso, cancelar ou concluir OS ja CONCLUIDA ou CANCELADA, e 403 quando FUNCIONARIO tenta reabrir', async () => { ... });
it('permite somente ADMIN reabrir OS CONCLUIDA para EM_ANALISE', async () => { ... });
```

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd /home/dzati/sistema-triagem/backend && npm test -- src/modules/triagens/triagens.test.ts`  
Expected: FAIL porque os arquivos do módulo não existem.

- [ ] **Step 3: Implementar módulo `triagens`, remover legado SQLite e atualizar `app.ts` / `server.ts`**

- Garantir que `GET /api/triagens/reincidencia` seja registrado **antes** de `GET /api/triagens/:id` em `triagens.routes.ts` para evitar conflito de parâmetro `:id`.
- Remover `backend/src/controllers/` antigos e `backend/src/types/index.ts`.
- Atualizar `backend/src/server.ts` para importar `app` de `./app` e `env` de `./config/env`, escutando em `0.0.0.0:${env.PORT}`.

- [ ] **Step 4: Rodar toda suíte de testes backend e verificar build TypeScript (`npm run build`)**

Run: `cd /home/dzati/sistema-triagem/backend && npm test && npx tsc --noEmit && npm run build`  
Expected: 100% dos testes backend passando e `dist/server.js` compilado sem erros.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add -A backend/
git commit -m "feat(triagens): implementa ciclo completo de recebimento, bancada parcial, auditoria e laudo"
```

---

### Task 7: Frontend Infraestrutura — Rotas (`react-router-dom`), Proxy LAN, `AuthContext` e Tela de Login

**Files:**
- Modify: `/home/dzati/sistema-triagem/frontend/package.json`
- Modify: `/home/dzati/sistema-triagem/frontend/vite.config.ts`
- Modify: `/home/dzati/sistema-triagem/frontend/tsconfig.json`
- Create: `/home/dzati/sistema-triagem/frontend/vitest.config.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/types/index.ts`
- Rewrite: `/home/dzati/sistema-triagem/frontend/src/services/api.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/services/api.test.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/contexts/AuthContext.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/routes/ProtectedRoute.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/components/Layout.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/auth/LoginPage.tsx`
- Modify: `/home/dzati/sistema-triagem/frontend/src/App.tsx`
- Remove: `/home/dzati/sistema-triagem/frontend/src/types.ts`

**Interfaces:**
- Consumes: `PublicUserDTO`, endpoints `/api/auth/login`, `/api/auth/me` (Task 4).
- Produces:
  - Proxy Vite em `server.proxy` e `preview.proxy` (`/api` -> `http://127.0.0.1:3001`, `changeOrigin: true`) e cliente `apiFetch<T>(path, options)` usando `API_BASE = '/api'` (sem `localhost`), disparando callback `onUnauthorized` somente em `401` fora de `/auth/login`.
  - `PublicUser` (alias front de `PublicUserDTO` com `criadoEm: string`) e `useAuth(): { user: PublicUser | null; token: string | null; loading: boolean; login(email: string, senha: string): Promise<void>; logout(): void }`
  - Rotas protegidas: `/login`, `/triagens`, `/admin/usuarios`, `/admin/checklists`.

- [ ] **Step 1: Instalar `react-router-dom` e dependências de teste no frontend**

```bash
cd /home/dzati/sistema-triagem/frontend
npm install react-router-dom
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Adicionar `"test": "vitest run"` em `frontend/package.json` e excluir `**/*.test.ts*` de `frontend/tsconfig.json`.

- [ ] **Step 2: Escrever teste que falha em `frontend/src/services/api.test.ts` (Review Focus #5)**

Testar com `vi.fn()` no `fetch` global:
- Que chamadas usam caminho relativo `/api/triagens` (nunca `http://localhost:3001`).
- Que o header `Authorization: Bearer <token>` é anexado automaticamente quando há token no `localStorage`.
- Que resposta `401` em rotas fora de `/auth/login` invoca o callback registrado `onUnauthorized` (limpando sessão).

- [ ] **Step 3: Rodar teste para confirmar falha**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test -- src/services/api.test.ts`  
Expected: FAIL porque o novo `api.ts` ainda não implementa `apiFetch` nem `registerUnauthorizedHandler`.

- [ ] **Step 4: Implementar `vite.config.ts`, `types/index.ts`, `api.ts`, `AuthContext.tsx`, `ProtectedRoute.tsx`, `Layout.tsx`, `LoginPage.tsx` e rotas base em `App.tsx`**

- `Layout.tsx`: navbar com marca BenchOS, links condicionais (`Triagens` para todos; `Equipe` e `Checklists` apenas quando `user.role === 'ADMIN'`), identificação do funcionário logado e botão Sair.
- `LoginPage.tsx`: formulário limpo (sem link de cadastro público, aviso discreto *"Acesso restrito a funcionários cadastrados pelo administrador"*).
- `App.tsx`: configurar `BrowserRouter`, `AuthProvider` e rotas (usando placeholders temporários simples para `/triagens` e `/admin/*` que serão substituídos nas Tasks 8 e 10, mantendo build verde nesta etapa).

- [ ] **Step 5: Rodar testes frontend e build (`tsc && vite build`)**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test && npm run build`  
Expected: `api.test.ts` passando e `vite build` concluído com zero erros.

- [ ] **Step 6: Commit**

```bash
cd /home/dzati/sistema-triagem
git add frontend/
git commit -m "feat(frontend): adiciona router, proxy lan /api, AuthContext e tela de login"
```

---

### Task 8: Frontend Triagens — Dashboard, Recebimento com Selo, Reincidência e Edição/Cancelamento Aberto

**Files:**
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/triagemHelpers.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/triagemHelpers.test.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/components/StatusBadge.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/components/SeloBadge.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/components/NovaOuEditarTriagemModal.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/TriagensDashboardPage.tsx`
- Modify: `/home/dzati/sistema-triagem/frontend/src/App.tsx`
- Remove: `/home/dzati/sistema-triagem/frontend/src/components/StatusBadge.tsx`
- Remove: `/home/dzati/sistema-triagem/frontend/src/components/NovaTriagemModal.tsx`

**Interfaces:**
- Consumes: endpoints `/api/triagens`, `/api/triagens/reincidencia`, `/api/clientes`, `/api/categorias` via `src/services/api.ts` (Task 7).
- Produces: página `TriagensDashboardPage` com filtros `PENDENTE | EM_ANALISE | CONCLUIDA` (+ toggle/filtro `CANCELADA`), cards de métrica, `NovaOuEditarTriagemModal` (recebimento, edição aberta com confirmação de troca de categoria em `EM_ANALISE`, e cancelamento lógico), e helpers puros em `triagemHelpers.ts`.

- [ ] **Step 1: Escrever teste que falha em `triagemHelpers.test.ts`**

Testar helpers compartilhados por entrada e bancada:
- Normalização visual/envio de serial (`" 4k08a "` -> `"4K08A"`).
- Formatação de rótulos para `StatusSelo`, `StatusTriagem` e `DiagnosticoFinal` (incluindo `ENCAMINHAR_ESPECIALISTA` e `SEM_GARANTIA`).
- Regra que detecta se troca de categoria no modal de edição requer confirmação (`status === 'EM_ANALISE' && categoriaId !== originalCategoriaId`).

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test -- src/features/triagens/triagemHelpers.test.ts`  
Expected: FAIL porque `triagemHelpers.ts` ainda não existe.

- [ ] **Step 3: Implementar helpers, badges, `NovaOuEditarTriagemModal.tsx`, `TriagensDashboardPage.tsx` e ligar rota `/triagens`**

- Em `NovaOuEditarTriagemModal.tsx`:
  - Campo de Serial/MAC com placeholder e texto orientando **digitação manual** (sem nenhuma menção a leitor USB).
  - Ao sair do campo (`onBlur`) ou após pausa rápida de digitação, consultar `fetchReincidenciaSerial(serial, triagemEdicao?.id)` e mostrar banner de alerta listando OS anteriores encontradas.
  - Seleção obrigatória de `statusSelo` (`INTEGRO | VIOLADO | SEM_SELO`) e campo opcional `observacaoSelo`.
  - No modo edição (quando `triagem` aberta): permitir editar campos e cancelar a OS (com confirmação simples), avisando antes se alterar categoria de uma OS já `EM_ANALISE` que respostas parciais serão limpas.
- Em `TriagensDashboardPage.tsx`:
  - Tabela mostrando OS, Equipamento, Serial/MAC, Selo (`SeloBadge`), Cliente, Trilha resumida (`Recebido por ...`, `Iniciado por ...`, `Concluído por ...`), Status/Diagnóstico (`StatusBadge`) e ações contextuais (`Iniciar/Continuar Teste`, `Editar`, `Ver Laudo/Resumo`).

- [ ] **Step 4: Rodar testes frontend e build**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test && npm run build`  
Expected: testes passando e `vite build` verde.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add frontend/
git commit -m "feat(frontend): implementa dashboard de triagens, recebimento com selo e alerta de reincidencia"
```

---

### Task 9: Frontend Bancada Guiada (Salvamento Parcial) e Prontuário com Resumo para Cliente

**Files:**
- Modify: `/home/dzati/sistema-triagem/frontend/src/features/triagens/triagemHelpers.ts`
- Modify: `/home/dzati/sistema-triagem/frontend/src/features/triagens/triagemHelpers.test.ts`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/components/BancadaChecklistModal.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/triagens/components/ProntuarioResumoModal.tsx`
- Modify: `/home/dzati/sistema-triagem/frontend/src/features/triagens/TriagensDashboardPage.tsx`
- Modify: `/home/dzati/sistema-triagem/frontend/src/index.css`
- Remove: `/home/dzati/sistema-triagem/frontend/src/components/ChecklistModal.tsx`
- Remove: `/home/dzati/sistema-triagem/frontend/src/components/DetalhesModal.tsx`

**Interfaces:**
- Consumes: `iniciarAnaliseTriagem`, `salvarProgressoTriagem`, `concluirTriagem`, `reabrirTriagem` (Task 7 `api.ts`).
- Produces:
  - `sugerirDiagnosticoEResumo(params)` testado em `triagemHelpers.ts` (gera sugestão de `diagnosticoFinal`, `parecerTecnico` e texto limpo `resumoCliente` pronto para balcão/WhatsApp).
  - `BancadaChecklistModal` (inicia `EM_ANALISE` se ainda `PENDENTE`, exibe `comoTestar` por item, 3 botões `OK | Falhou | Pendente`, campo `observacao` por item com dica de S.M.A.R.T. para HD, botão **"Salvar Progresso"** e **"Concluir Laudo"**).
  - `ProntuarioResumoModal` (trilha completa de responsáveis `recebidoPor` / `analiseIniciadaPor` / `concluidoPor`, respostas + observações, bloco **"Resumo para Atendimento ao Cliente"** com **"Copiar para WhatsApp"** e **"Imprimir"** via CSS `@media print`, e botão **"Reabrir OS"** visível apenas para `ADMIN`).

- [ ] **Step 1: Adicionar testes falhando em `triagemHelpers.test.ts` para `sugerirDiagnosticoEResumo` e formatação WhatsApp**

Testar:
- Todos itens `APROVADO` sugere `OPERACIONAL` e texto educativo sobre checar fonte/cabeamento no local.
- Algum item `REPROVADO` sugere `DEFEITO_FABRICA`.
- Diagnóstico `ENCAMINHAR_ESPECIALISTA` gera resumo explicando encaminhamento para análise técnica avançada.
- Função `formatarResumoWhatsApp(triagem)` inclui modelo, serial, selo e resumo claro para cliente sem jargão interno.

- [ ] **Step 2: Rodar teste e confirmar falha**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test -- src/features/triagens/triagemHelpers.test.ts`  
Expected: FAIL por ausência das funções novas.

- [ ] **Step 3: Implementar `BancadaChecklistModal.tsx`, `ProntuarioResumoModal.tsx`, `@media print` em `index.css` e conectar em `TriagensDashboardPage.tsx`**

- Garantir que `BancadaChecklistModal` carregue `respostas` já salvas (quando reaberto por outro colega durante `EM_ANALISE`), exiba quem iniciou a análise no topo, permita salvar parcialmente sem bloquear por itens `PENDENTE`, e bloqueie botão de concluir se houver itens `PENDENTE` (a menos que `diagnostico === 'SEM_GARANTIA'` com selo não íntegro).
- Em `index.css`, adicionar regras `@media print` que ocultam elementos `.no-print` (dashboard atrás do modal e botões de ação) e imprimem apenas `.print-summary` com fundo claro e fonte legível para entrega ao cliente.

- [ ] **Step 4: Rodar testes frontend e build**

Run: `cd /home/dzati/sistema-triagem/frontend && npm test && npm run build`  
Expected: todos os testes passando e `vite build` sem erros.

- [ ] **Step 5: Commit**

```bash
cd /home/dzati/sistema-triagem
git add frontend/
git commit -m "feat(frontend): implementa bancada guiada parcial, resumo whatsapp/impressao e auditoria"
```

---

### Task 10: Telas Admin (`ADMIN`), Script `./iniciar.sh`, `README.md` e Verificação E2E Completa

**Files:**
- Create: `/home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx`
- Create: `/home/dzati/sistema-triagem/frontend/src/features/admin/ChecklistsAdminPage.tsx`
- Modify: `/home/dzati/sistema-triagem/frontend/src/App.tsx`
- Modify: `/home/dzati/sistema-triagem/iniciar.sh`
- Modify: `/home/dzati/sistema-triagem/README.md`

**Interfaces:**
- Consumes: endpoints `/api/users` e `/api/categorias` mutáveis (`ADMIN` only via Task 7 `api.ts`).
- Produces: gestão visual completa de equipe e roteiros de bancada para `ADMIN`, script `./iniciar.sh` com subida automática do PostgreSQL em Docker + migrations + seed + servidores em rede local (`0.0.0.0`), e documentação atualizada.

- [ ] **Step 1: Implementar `UsuariosAdminPage.tsx` e `ChecklistsAdminPage.tsx` e conectar nas rotas `/admin/*` em `App.tsx`**

- `UsuariosAdminPage`: tabela de funcionários (nome, email, papel, status ativo/inativo), modal/formulário de novo funcionário, botão ativar/desativar (desabilitado na linha do próprio usuário logado) e botão redefinir senha.
- `ChecklistsAdminPage`: lista de categorias da filial com painel lateral/expansível de itens do checklist, edição de `descricao`, `comoTestar`, `ordem`, ativação/desativação de item ou categoria, e criação de nova categoria ou novo item de teste.

- [ ] **Step 2: Atualizar `iniciar.sh` e `README.md`**

- `iniciar.sh`: checar se `docker` responde; executar `docker compose up -d`; aguardar PostgreSQL saudável (`docker compose exec -T postgres pg_isready -U benchos -d benchos`); garantir `.env` existente no backend; rodar `npx prisma migrate deploy && npx prisma db seed` no backend; subir backend (`:3001`) e frontend (`:3000 --host 0.0.0.0`) com `trap` limpo encerrando os processos.
- `README.md`: documentar arquitetura em Monólito Modular + React SPA, pré-requisitos Docker/Node, instruções de instalação no Pop!_OS/Linux, acesso na LAN por outros PCs via `/api` proxy, credenciais iniciais configuradas no `.env` (alertando para troca em produção), e comandos de teste.

- [ ] **Step 3: Verificação completa de builds, testes automatizados e fluxo real E2E com PostgreSQL**

1. Rodar testes e builds completos de backend e frontend:
```bash
cd /home/dzati/sistema-triagem/backend && npm test && npm run build && cd ../frontend && npm test && npm run build
```
2. Subir PostgreSQL via Docker Compose, rodar migration + seed, iniciar API temporária e validar fluxo real via `curl`:
   - `GET /api/health` -> `200 OK`
   - `POST /api/auth/login` com admin seed -> retorna JWT
   - `POST /api/users` criando funcionário teste -> `201`
   - `POST /api/clientes` + `POST /api/triagens` com serial minúsculo + `statusSelo: 'INTEGRO'` -> `201`, serial salvo em maiúsculas
   - `GET /api/triagens/reincidencia?serial=...` -> encontra OS criada
   - Login com funcionário criado -> `PATCH /api/triagens/:id/iniciar` -> `PATCH /api/triagens/:id/progresso` (parcial) -> `PATCH /api/triagens/:id/concluir` -> `GET /api/triagens/:id` verifica `recebidoPor`, `analiseIniciadaPor`, `concluidoPor` distintos e respostas persistidas no PostgreSQL.
   - Limpar dados de teste extras ou resetar banco limpo com `npx prisma migrate reset --force` (reaplicando migrations e seed inicial limpo para a loja!).

- [ ] **Step 4: Commit final e verificação do repositório Git**

```bash
cd /home/dzati/sistema-triagem
git status
git add frontend/ iniciar.sh README.md
git commit -m "feat(admin,infra): adiciona telas admin, atualiza iniciar.sh com docker e README"
git log --oneline -n 12
```

Expected: working tree limpo (`nothing to commit, working tree clean`), todos os commits organizados por marco lógico, testes backend/frontend 100% verdes e Docker + Postgres prontos para uso na filial.
