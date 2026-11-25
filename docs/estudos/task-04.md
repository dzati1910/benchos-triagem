# Guia de Estudos — Task 4: Módulos `auth` e `users` (Login Controlado e Gestão Admin)

## 1. O que foi construído aqui (em linguagem simples)

No **BenchOS**, nem qualquer pessoa da internet pode criar uma conta sozinha (`POST /api/auth/register` simplesmente **não existe**). Como o sistema é uma ferramenta interna de triagem e bancada, apenas um administrador (`ADMIN`) cadastra novos funcionários, define quem tem acesso e pode redefinir senhas ou desativar contas.

A **Task 4** resolve dois problemas centrais no backend:
1. **Autenticação controlada (`auth`):** permite que um colaborador já cadastrado faça login com e-mail e senha (`POST /api/auth/login`), receba um token **JWT** (*JSON Web Token*) e consiga consultar seus próprios dados enquanto estiver logado (`GET /api/auth/me`).
2. **Gestão de usuários (`users`):** cria um painel administrativo via API (`GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` e `PATCH /api/users/:id/senha`) restrito exclusivamente a usuários com papel `ADMIN`.

Na arquitetura do projeto, esta tarefa se conecta diretamente à fundação da Task 3 (`prisma`, `env`, `AppError` e os middlewares `authenticate` e `requireRole`), inaugurando os dois primeiros módulos de negócio em `backend/src/modules/`.

---

## 2. Mapa da arquitetura e arquivos

O projeto adota um **Monólito Modular em Camadas**: tudo roda em uma única aplicação Node.js/Express (monólito), mas o código é fatiado por domínio de negócio (`modules/auth` e `modules/users`), e cada módulo separa responsabilidades em camadas bem definidas.

### O caminho exato da requisição

```text
Cliente HTTP (Frontend)
  │
  ▼  1. Rota + Middlewares (Express Router)
routes (auth.routes.ts / users.routes.ts)
  │  Verifica autenticação (authenticate) e papel (requireRole)
  ▼  2. Controlador HTTP
controller (auth.controller.ts)
  │  Valida req.body com Zod, chama o service dentro de try/catch
  │  Se der erro (validação ou regra de negócio), envia para next(error)
  ▼  3. Regras de Negócio
service (auth.service.ts / users.service.ts)
  │  Normaliza dados, compara/gera hash bcrypt, assina JWT, aplica regras de segurança
  ▼  4. Acesso a Dados
repository (users.repository.ts)
  │  Define exatamente quais colunas buscar/salvar com Prisma
  ▼  5. Banco de Dados
Prisma Client -> PostgreSQL
```

### Por que cada arquivo existe

- **Módulo `auth`** (`backend/src/modules/auth/`):
  - `auth.schema.ts`: contrato de entrada do login usando **Zod** (valida formato de e-mail, normaliza para minúsculas e exige senha preenchida).
  - `auth.routes.ts`: mapeia os endpoints `/login` e `/me`, decidindo quais rotas são públicas e quais exigem o middleware `authenticate`.
  - `auth.controller.ts`: traduz a requisição HTTP (`req`, `res`, `next`) para chamadas de negócio e garante que qualquer exceção vá para o tratador global de erros via `next(error)`.
  - `auth.service.ts`: concentra toda a lógica de verificação de senha, bloqueio de conta desativada e geração do token JWT.
- **Módulo `users`** (`backend/src/modules/users/`):
  - `users.repository.ts`: única camada que conversa com `prisma.user`, centralizando os tipos seguros (`PublicUserDTO`) e o filtro de colunas (`publicUserSelect`).
  - `users.service.ts`: implementa regras administrativas (impedir e-mail duplicado, gerar hash da senha com `bcryptjs`, bloquear auto-desativação/auto-rebaixamento e redefinir senha).
  - `users.routes.ts`: protege **todas** as rotas de gestão de usuários com `authenticate` e `requireRole('ADMIN')`.
  - *(Conforme `task-4-brief.md`, a tarefa também inclui `users.schema.ts`, `users.controller.ts`, a montagem das rotas em `src/app.ts` e as suítes `auth.test.ts` e `users.test.ts`.)*

### Por que separar em camadas facilita testar e evoluir?

1. **Testabilidade isolada:** como o `service` não conhece `req` nem `res` do Express, é possível testar regras como "bloquear auto-rebaixamento" ou "usuário desativado retorna 401" chamando funções TypeScript puras ou mockando apenas o `repository`.
2. **Troca sem efeito dominó:** se amanhã você mudar a biblioteca de validação (de Zod para outra) ou ajustar uma query no Prisma, a alteração fica contida no `schema`/`controller` ou no `repository`, sem quebrar as regras de negócio no `service`.
3. **Reuso limpo entre módulos:** o módulo `auth` precisa buscar usuários no banco, mas em vez de importar o `prisma` diretamente, ele importa `usersRepository` (`auth.service.ts:5`). Assim, a regra de quais campos podem ser selecionados fica em um único lugar.

---

## 3. Raio-X das funções e blocos principais

### A. Validação e normalização na entrada (`auth.schema.ts`)

- **`loginSchema` (`auth.schema.ts:3-6`):**
  - **O que entra:** `req.body` vindo do HTTP (que em runtime pode ter qualquer formato ou tipo).
  - **O que faz por dentro:**
    - `email`: `z.string().trim().email('E-mail inválido.').transform((val) => val.toLowerCase())` (`auth.schema.ts:4`) remove espaços nas pontas, valida formato de e-mail e já transforma em letras minúsculas.
    - `senha`: `z.string().min(1, 'Senha é obrigatória.')` (`auth.schema.ts:5`) garante que a senha seja uma string não vazia.
  - **O que sai:** um objeto fortemente tipado como `LoginInput` (`auth.schema.ts:8`), inferido automaticamente pelo TypeScript com `z.infer<typeof loginSchema>`.

### B. O papel do Controller e o fluxo `try/catch -> next` (`auth.controller.ts`)

- **`authController.login` (`auth.controller.ts:10-18`):**
  - Recebe `req`, `res` e `next` do Express.
  - Executa `loginSchema.parse(req.body)` (`auth.controller.ts:12`). Se os dados estiverem inválidos, o Zod lança um erro imediatamente.
  - Chama `await authService.login(payload)` (`auth.controller.ts:13`) e responde com JSON via `res.json(result)` (`auth.controller.ts:14`).
  - Se qualquer erro acontecer (erro do Zod ou `AppError` lançado pelo service), o bloco `catch (error)` (`auth.controller.ts:15-17`) repassa o erro para `next(error)`. No Express, chamar `next(erro)` pula os próximos middlewares normais e entrega o erro diretamente ao middleware global de tratamento de erros.
- **`authController.me` (`auth.controller.ts:20-31`):**
  - Verifica se `req.user` foi preenchido pelo middleware `authenticate` (`auth.controller.ts:22-24`); se não, lança `AppError('Usuário não autenticado.', 401)`.
  - Busca o perfil atualizado no banco via `authService.getMe(req.user.id)` (`auth.controller.ts:26`) e retorna `{ user }`.

### C. Segurança no fluxo de login (`auth.service.ts`)

O método **`authService.login` (`auth.service.ts:28-55`)** aplica quatro defesas importantes em sequência:

1. **Normalização dupla de e-mail (`auth.service.ts:29`):**
   - Faz `const email = input.email.trim().toLowerCase();` mesmo o `loginSchema` já tendo normalizado. Por quê? Porque o `authService.login` pode ser chamado diretamente por testes ou outros serviços sem passar pelo controller/Zod. Normalizar garante que `Admin@BenchOS.com` e `admin@benchos.com` encontrem sempre o mesmo registro no PostgreSQL.
2. **Busca específica para autenticação (`auth.service.ts:30-34`):**
   - Chama `usersRepository.findAuthByEmail(email)` — único método do repositório que traz `senhaHash`. Se `!user`, lança `AppError('E-mail ou senha inválidos.', 401)` — mensagem genérica para não confirmar a um atacante se aquele e-mail existe no banco.
3. **Verificação da senha com `bcrypt.compare` ANTES de checar `user.ativo` (`auth.service.ts:36-43`):**
   - Primeiro compara a senha digitada com o hash salvo: `await bcrypt.compare(input.senha, user.senhaHash)` (`auth.service.ts:36`). Se não bater, retorna o mesmo erro genérico `'E-mail ou senha inválidos.'` (`401`).
   - **Somente depois** que a senha foi provada válida é que verifica `if (!user.ativo)` (`auth.service.ts:41-43`), lançando `AppError('Usuário desativado. Contate o administrador.', 401)`.
   - **Por que essa ordem importa?** Se checássemos `user.ativo` *antes* da senha, qualquer pessoa na internet poderia testar e-mails com uma senha aleatória e descobrir quais funcionários foram desligados ou têm contas inativas (vazamento de estado da conta / enumeração). Validando a senha primeiro, a mensagem específica só aparece para quem realmente possui a senha correta.
4. **Emissão do JWT com `sub` e `role` (`auth.service.ts:45-49`):**
   - Gera o token com `jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] })`.
   - `sub` (*subject*) é a claim padrão do JWT para identificar o dono do token (o `id` do usuário).
   - `role` carrega o papel (`ADMIN` ou `FUNCIONARIO`) para autorizações rápidas, assinado criptograficamente com `env.JWT_SECRET` (logo, o cliente não consegue adulterar seu próprio papel sem invalidar a assinatura).
5. **Blindagem contra vazamento de `senhaHash` (`auth.service.ts:13-22` e `users.repository.ts:4-24`):**
   - No `users.repository.ts`, `publicUserSelect` (`users.repository.ts:17-24`) usa `satisfies Prisma.UserSelect` para listar explicitamente apenas os campos públicos (`id`, `nome`, `email`, `role`, `ativo`, `criadoEm`). Todos os métodos de consulta pública (`findAllPublic`, `findPublicById`, `create`, `updatePublic`) usam esse `select`, impedindo que o Prisma sequer traga `senhaHash` do PostgreSQL.
   - Além disso, no retorno do login — onde `user` veio de `findAuthByEmail` (que tem `senhaHash` no tipo `AuthUserRecord`, `users.repository.ts:13-15`) —, `auth.service.ts` passa o objeto por `toPublicUser(user)` (`auth.service.ts:13-22`, chamada na linha `53`), construindo um novo objeto apenas com os campos de `PublicUserDTO`. Assim, mesmo em runtime, a propriedade `senhaHash` é descartada antes de ir para a resposta JSON.

### D. Rotas de Autenticação (`auth.routes.ts`)

- `authRouter.post('/login', authController.login)` (`auth.routes.ts:7`): rota aberta (sem `authenticate`), pois é onde o usuário obtém o token.
- `authRouter.get('/me', authenticate, authController.me)` (`auth.routes.ts:8`): rota protegida; o middleware `authenticate` roda antes do controller, valida o header `Authorization: Bearer <token>` e injeta `req.user`.

### E. Controle de acesso (RBAC) e regras de proteção (`users.routes.ts` e `users.service.ts`)

- **RBAC centralizado no roteador (`users.routes.ts:7-12`):**
  - A linha `usersRouter.use(authenticate, requireRole('ADMIN'))` (`users.routes.ts:7`) aplica dois middlewares em **todas** as rotas declaradas abaixo (`GET /`, `POST /`, `PATCH /:id`, `PATCH /:id/senha`):
    1. `authenticate`: garante que existe um usuário autenticado (caso contrário, `401`).
    2. `requireRole('ADMIN')`: verifica se `req.user.role === 'ADMIN'` (caso contrário, retorna `403 Forbidden`, bloqueando um `FUNCIONARIO` de listar, criar, editar ou resetar senhas).
  - Colocar `router.use(...)` no topo do arquivo evita esquecer a proteção ao adicionar uma nova rota no futuro.

- **Criação segura de usuário (`usersService.createUser`, `users.service.ts:16-32`):**
  - Normaliza e-mail e verifica duplicidade com `findAuthByEmail(email)` (`users.service.ts:17-22`), lançando `409` se já existir.
  - Gera o hash da senha com `await bcrypt.hash(input.senha, BCRYPT_SALT_ROUNDS)` (`users.service.ts:24`, com `BCRYPT_SALT_ROUNDS = 10` na linha `6`) — nunca armazena senha em texto puro.
  - Salva com `nome.trim()` e retorna um `PublicUserDTO` (sem `senhaHash`).

- **Proteção contra auto-bloqueio do administrador (`usersService.updateUser`, `users.service.ts:34-59`):**
  - Recebe `targetId` (quem está sendo editado na URL `:id`) e `actorId` (o `ADMIN` logado que fez a requisição).
  - Calcula duas flags (`users.service.ts:39-40`):
    - `isSelfDisabling = input.ativo === false`
    - `isSelfDemoting = input.role !== undefined && input.role !== 'ADMIN'`
  - Se `targetId === actorId && (isSelfDisabling || isSelfDemoting)` (`users.service.ts:42-47`), lança `AppError('Não é permitido desativar ou remover privilégios da própria conta.', 409)`.
  - **Por que essa regra existe?** Para evitar o cenário clássico em que o único administrador do sistema se desativa ou rebaixa seu próprio papel para `FUNCIONARIO` por acidente, trancando o painel administrativo sem ninguém capaz de reverter.
  - Em seguida, valida se o usuário alvo existe (`users.service.ts:49-52`, retornando `404` se não existir) e atualiza apenas os campos enviados usando spread condicional (`users.service.ts:54-58`), evitando sobrescrever campos omitidos com `undefined`.

- **Redefinição administrativa de senha (`usersService.resetPassword`, `users.service.ts:61-71`):**
  - Confirma que o usuário existe (`404` se não encontrado), gera um novo hash bcrypt da `novaSenha` e chama `usersRepository.updatePasswordHash(targetId, senhaHash)` (`users.repository.ts:77-83`), retornando `{ message: 'Senha redefinida com sucesso.' }`.

---

## 4. O que absorver para o mercado + ordem de leitura

### 4 conceitos muito cobrados em entrevistas presentes nesta Task

1. **Arquitetura em Camadas (`Routes -> Controller -> Service -> Repository`):** saber explicar qual responsabilidade pertence a cada camada (HTTP e validação no Controller, regra de negócio no Service, queries no Repository) e por que o `Service` não deve manipular `req`/`res`.
2. **Autenticação JWT + Hashing com `bcrypt`:** entender que senhas nunca são descriptografadas (comparamos hashes via `bcrypt.compare`), por que o salt cost (`BCRYPT_SALT_ROUNDS = 10`) existe e como o JWT transporta identidade (`sub`) e autorização (`role`) assinados por segredo no servidor.
3. **Prevenção de vazamento de dados (DTO / Select explícito + Enumeração de contas):** usar `publicUserSelect` no ORM + `toPublicUser` garante que campos sensíveis (`senhaHash`) nunca escapem na resposta JSON; validar a senha antes de checar `ativo` evita vazar o status da conta para terceiros.
4. **RBAC (*Role-Based Access Control*) e invariantes de negócio:** distinguir `401 Unauthorized` (não autenticado / credencial inválida) de `403 Forbidden` (autenticado, mas sem permissão de papel `ADMIN`), além de proteger invariantes críticas como impedir auto-rebaixamento/auto-desativação (`409 Conflict`).

### Ordem recomendada de leitura para estudar esta etapa

1. [`backend/src/modules/users/users.repository.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/users/users.repository.ts) — comece pelos tipos (`PublicUserDTO`, `AuthUserRecord`) e pelo `publicUserSelect` para entender o formato dos dados que trafegam no sistema.
2. [`backend/src/modules/auth/auth.schema.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/auth/auth.schema.ts) — veja como o Zod valida e já transforma o e-mail na entrada.
3. [`backend/src/modules/auth/auth.service.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/auth/auth.service.ts) — acompanhe passo a passo o fluxo de login, `bcrypt.compare`, verificação de `ativo`, geração do JWT e `toPublicUser`.
4. [`backend/src/modules/auth/auth.controller.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/auth/auth.controller.ts) e [`backend/src/modules/auth/auth.routes.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/auth/auth.routes.ts) — entenda como o Express conecta rotas, `authenticate`, validação Zod e repasse de erros via `next(error)`.
5. [`backend/src/modules/users/users.service.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/users/users.service.ts) e [`backend/src/modules/users/users.routes.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/users/users.routes.ts) — feche estudando como o RBAC protege todas as rotas administrativas e como as regras de unicidade de e-mail e bloqueio de auto-rebaixamento funcionam.
