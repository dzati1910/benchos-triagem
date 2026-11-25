# Guia de Estudos — Task 3: Núcleo Compartilhado do Backend, Autenticação e Tratamento Global de Erros

Este guia explica tudo o que foi construído na **Task 3** do BenchOS (`backend/`). Antes de criar rotas de usuários, clientes ou ordens de serviço, todo backend profissional precisa da sua "infraestrutura invisível": configuração segura de ambiente, conexão controlada com o banco, autenticação, padrão único de erros e base de testes automatizados.

---

## 1. O que foi construído aqui (em linguagem simples)

Imagine abrir uma loja física sem porta com fechadura, sem quadro de energia com disjuntor e sem recepção para orientar quem entra. Se algo der errado, o prédio inteiro para ou clientes entram na área administrativa.

Na **Task 3**, construímos exatamente a fundação de segurança e estabilidade da API do BenchOS:

1. **Validação de ambiente na largada (`env.ts`):** se o servidor tentar subir sem senha do banco ou sem chave secreta de JWT, ele trava imediatamente na inicialização avisando exatamente o que faltou.
2. **Conexão única com o banco (`prisma.ts`):** evita abrir dezenas de conexões duplicadas com o PostgreSQL durante o desenvolvimento.
3. **Erros padronizados e recepção centralizada (`AppError.ts` e `errorHandler.ts`):** garante que qualquer erro — seja um dado inválido enviado pelo frontend, uma tentativa de acesso proibido ou uma falha inesperada — vire uma resposta JSON limpa, sem derrubar o servidor e sem vazar detalhes internos.
4. **Porteiro e crachá da API (`auth.ts`):** valida o token JWT do usuário, consulta o banco para ter certeza de que a conta ainda existe e está ativa, e verifica o perfil (`ADMIN`, `FUNCIONARIO`, etc.).
5. **Aplicação Express testável (`app.ts` + `vitest.config.ts` + `auth.test.ts`):** separa a montagem das rotas da abertura da porta de rede (`server.ts`), permitindo testar requisições HTTP reais em memória com Supertest e Vitest.

---

## 2. Mapa da arquitetura e arquivos

No Express, uma requisição HTTP percorre uma esteira de funções em sequência até virar uma resposta JSON:

```text
Requisição HTTP
   │
   ▼
[ app.ts ] ──► cors() ──► express.json() ──► Rota (ex: /api/health ou rota protegida)
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼ (rota protegida)                                            │ (se der throw ou next(erro))
       [ authenticate ] ──► [ requireRole('ADMIN') ] ──► Controller/Rota       │
                 │ (lê env.ts e consulta prisma.ts)                            ▼
                 └────────────────────────────────────────────────────► [ errorHandler.ts ] ──► Resposta JSON
```

### Para que serve cada arquivo criado na Task 3

| Arquivo | Papel no projeto | Com quem conversa |
| :--- | :--- | :--- |
| `backend/src/config/env.ts` | Carrega `.env`, valida variáveis com Zod e exporta `env` tipado. | Usado por `auth.ts` (e futuros módulos que precisem de `env.PORT`, `env.JWT_SECRET`, etc.). |
| `backend/src/lib/prisma.ts` | Cria e reutiliza uma única instância do `PrismaClient` (padrão *Singleton*). | Usado por `app.ts` (`/api/health`) e `auth.ts` (`prisma.user.findUnique`). |
| `backend/src/shared/errors/AppError.ts` | Classe de erro de negócio com mensagem, código HTTP (`statusCode`) e código opcional (`code`). | Instanciada em `auth.ts` (e futuramente nos *services*) e capturada por `errorHandler.ts`. |
| `backend/src/shared/middlewares/auth.ts` | Contém os middlewares `authenticate` (quem é você?) e `requireRole` (você pode entrar aqui?). | Lê `env.ts`, consulta `prisma.ts` e lança/repassa `AppError`. |
| `backend/src/shared/middlewares/errorHandler.ts` | Middleware global de 4 parâmetros que converte erros do Zod, `AppError` e Prisma em JSON seguro. | Registrado por último em `app.ts`. |
| `backend/src/app.ts` | Monta e exporta o objeto `app` do Express (sem chamar `app.listen`). | Importa `prisma.ts` e `errorHandler.ts`. É importado pelo servidor HTTP real e pelos testes. |
| `backend/vitest.config.ts` | Configura o executor de testes Vitest para rodar em ambiente Node com `vitest.setup.ts`. | Base para todos os arquivos `*.test.ts`. |
| `backend/src/shared/middlewares/auth.test.ts` | Testa `authenticate`, `requireRole` e `errorHandler` via Supertest com banco mockado. | Importa `env.ts`, `auth.ts` e `errorHandler.ts`, substituindo `prisma.ts` por um mock. |

> **Nota sobre organização de pastas:** tudo que pertence à aplicação inteira (e não a um recurso isolado como *clientes* ou *ordens*) mora dentro de `backend/src/shared/` ou `backend/src/config/` e `backend/src/lib/`.

---

## 3. Raio-X das funções e blocos principais

### 3.1. Fail-fast com Zod em `backend/src/config/env.ts`

Em Node.js, variáveis de ambiente vêm de `process.env` como `string | undefined`. Se você esquecer de configurar `JWT_SECRET` e não validar na inicialização, o servidor até liga — mas vai quebrar na mão do primeiro usuário que tentar fazer login. Isso é o oposto de **fail-fast** (falhar rápido e visível na hora de subir).

* **Linha 1 (`env.ts:1`):** `import 'dotenv/config'` lê o arquivo `.env` local automaticamente e popula `process.env`.
* **Linhas 4–9 (`env.ts:4-9`):** define o contrato com `z.object(...)`:
  * `PORT`: `z.coerce.number().int().positive().default(3001)` — o `.coerce` converte a string `"3001"` do sistema operacional para o número `3001`. Se não existir, assume `3001`.
  * `DATABASE_URL`: string com no mínimo 1 caractere (obrigatória).
  * `JWT_SECRET`: string com no mínimo 16 caracteres (evita segredo vazio ou fraco demais).
  * `JWT_EXPIRES_IN`: string não vazia, com padrão `'7d'`.
* **Linha 11 (`env.ts:11`):** `envSchema.safeParse(process.env)` valida sem lançar exceção bruta imediatamente, retornando `{ success: true, data }` ou `{ success: false, error }`.
* **Linhas 13–18 (`env.ts:13-18`):** se `parsed.success` for `false`, imprime `parsed.error.issues` no console e lança um `Error`, interrompendo a subida da API. Se der certo, exporta `env` já com os tipos certos (`env.PORT` já é `number` no TypeScript!).

---

### 3.2. Singleton do banco em `backend/src/lib/prisma.ts`

Cada `new PrismaClient()` abre um *pool* de conexões com o PostgreSQL. Em desenvolvimento, ferramentas de recarregamento automático (*hot reload* / `ts-node-dev` / `tsx watch`) reexecutam módulos várias vezes sem reiniciar o processo Node por completo. Se cada recarga criasse um novo `PrismaClient`, o PostgreSQL logo atingiria o limite máximo de conexões.

* **Linhas 3–5 (`prisma.ts:3-5`):** cria uma referência tipada para `globalThis`, que é o objeto global que sobrevive entre recargas de módulos no mesmo processo Node.
* **Linhas 7–11 (`prisma.ts:7-11`):** usa o operador de coalescência nula (`??`). Se já existir `globalForPrisma.prisma`, reutiliza; caso contrário, instancia `new PrismaClient(...)`, ativando logs de `['error', 'warn']` em desenvolvimento e apenas `['error']` fora dele.
* **Linhas 13–15 (`prisma.ts:13-15`):** guarda a instância em `globalForPrisma.prisma` sempre que `NODE_ENV !== 'production'`. Em produção o servidor sobe uma única vez, então o módulo já fica em cache naturalmente.

---

### 3.3. O que é um Middleware e como funcionam `authenticate` e `requireRole`

No Express, um **middleware** é uma função interceptadora com a assinatura `(req, res, next)`:
* `req` (*Request*): tudo que chegou na requisição (cabeçalhos, URL, corpo JSON, parâmetros).
* `res` (*Response*): o objeto usado para enviar a resposta HTTP de volta ao cliente.
* `next`: a função que passa a bola para o próximo middleware da fila. Se você chamar `next()` vazio, o fluxo segue normal. Se você chamar `next(erro)`, o Express pula todas as rotas comuns e entrega direto para o `errorHandler`.

#### `AppError` (`backend/src/shared/errors/AppError.ts:1-12`)
Antes de olhar o `auth.ts`, vale entender o `AppError`: ele estende a classe nativa `Error` do JavaScript adicionando `statusCode` (padrão `400`) e `code` opcional (`AppError.ts:5-9`). A linha `Object.setPrototypeOf(this, AppError.prototype)` (`AppError.ts:10`) garante que `err instanceof AppError` funcione com segurança após a compilação TypeScript para JavaScript.

#### `authenticate` (`backend/src/shared/middlewares/auth.ts:11-65`)
* **Entrada:** `req`, `_res` (não usado diretamente, por isso o `_`), `next`. Retorna `Promise<void>`.
* **Passo 1 — Ler cabeçalho Bearer (`auth.ts:17-25`):** procura `req.headers.authorization`. Precisa existir e começar com `'Bearer '`. Em seguida, fatia o prefixo com `.slice('Bearer '.length).trim()` e verifica se sobrou um token não vazio. Se falhar, lança `AppError(..., 401)`.
* **Passo 2 — Verificar assinatura JWT (`auth.ts:27-32`):** chama `jwt.verify(token, env.JWT_SECRET)`. Se o token foi adulterado ou expirou, o `jwt.verify` lança erro, que o `try/catch` interno transforma em `AppError('Token inválido ou expirado.', 401)`.
* **Passo 3 — Validar ID do payload (`auth.ts:34-37`):** extrai `payload.sub` (o *subject*, padrão JWT para ID do usuário), converte com `Number(payload.sub)` e exige que seja um inteiro positivo (`Number.isInteger(userId) && userId > 0`).
* **Passo 4 — Conferir no banco se o usuário continua ativo (`auth.ts:39-52`):**
  * **Por que consultar o banco se o JWT já é assinado?** Porque um token JWT continua matematicamente válido até expirar (ex.: 7 dias). Se um administrador demitir um funcionário e marcar `ativo: false` no banco, sem essa consulta o funcionário continuaria entrando na API até o token vencer!
  * A query usa `select: { id: true, nome: true, email: true, role: true, ativo: true }` (`auth.ts:41-47`) para **nunca** trazer a coluna `senhaHash` nem dados desnecessários do banco.
  * Se `!user || !user.ativo` (`auth.ts:50`), lança `AppError('Sessão inválida ou usuário inativo.', 401)`.
* **Passo 5 — Anexar usuário e seguir (`auth.ts:54-64`):** grava `{ id, nome, email, role }` em `req.user` (`auth.ts:54-59`) e chama `next()` (`auth.ts:61`). Qualquer erro lançado dentro do `try` cai no `catch (error) { next(error); }` (`auth.ts:62-64`) — isso é crucial em funções `async` no Express 4 para o erro chegar ao `errorHandler`.

#### `requireRole(...roles)` (`backend/src/shared/middlewares/auth.ts:70-84`)
* **Padrão *Factory* de Middleware:** `requireRole('ADMIN')` não é o middleware em si — ela **retorna** um middleware configurado com a lista de perfis permitidos (`...roles: Role[]`).
* **Passo 1 (`auth.ts:72-75`):** se `req.user` não existir (ou seja, alguém esqueceu de colocar `authenticate` antes), chama `next(new AppError('Usuário não autenticado.', 401))` e dá `return`.
* **Passo 2 (`auth.ts:77-80`):** checa `roles.includes(req.user.role)`. Se o usuário for `FUNCIONARIO` tentando acessar uma rota com `requireRole('ADMIN')`, envia `AppError('Acesso restrito a administradores.', 403)` — atenção à diferença de mercado:
  * **401 (Unauthorized):** não sabemos quem você é / sua sessão é inválida.
  * **403 (Forbidden):** sabemos quem você é, mas você não tem permissão para esta área.
* **Passo 3 (`auth.ts:82`):** se passou, chama `next()`.

---

### 3.4. Centralização de erros em `backend/src/shared/middlewares/errorHandler.ts`

Sem um manipulador global, qualquer `throw` em uma rota poderia devolver HTML com *stack trace* (expondo caminhos de pastas e bibliotecas usadas no servidor) ou até travar o processo.

O Express reconhece um middleware de erro porque ele tem **exatamente 4 parâmetros**: `(err, _req, res, _next)` (`errorHandler.ts:9-14`).

Por dentro, ele funciona como uma peneira de cima para baixo:

1. **Erros de validação do Zod (`errorHandler.ts:15-21`):**
   * Se `err instanceof ZodError`, responde HTTP **`400` (Bad Request)** com `{ error: 'Dados inválidos.', details: err.issues }`, informando exatamente quais campos falharam.
2. **Erros esperados de regra de negócio (`errorHandler.ts:23-29`):**
   * Se `err instanceof AppError`, usa `res.status(err.statusCode)` e retorna `{ error: err.message }` (incluindo `code` apenas se existir, usando *spread* condicional `...(err.code ? { code: err.code } : {})`).
3. **Violação de unicidade do Prisma (`errorHandler.ts:31-37`):**
   * Se for um `Prisma.PrismaClientKnownRequestError` com `err.code === 'P2002'` (por exemplo, tentar cadastrar dois usuários com o mesmo e-mail ou duas peças com o mesmo código único), responde HTTP **`409` (Conflict)** com mensagem amigável, sem expor SQL ou nomes internos de índices.
4. **Fallback para erros desconhecidos (`errorHandler.ts:39-45`):**
   * Qualquer outro bug inesperado (falha de rede, erro de sintaxe em tempo de execução, banco fora do ar) é logado no servidor se `NODE_ENV !== 'test'` (`errorHandler.ts:39-41`) e devolve ao cliente apenas HTTP **`500`** com `{ error: 'Erro interno do servidor.' }`. O cliente nunca vê o *stack trace*.

---

### 3.5. Separação entre `app.ts` e `server.ts` + Testes com Vitest e Supertest

#### Por que `backend/src/app.ts` não tem `app.listen(...)`?
Em `backend/src/app.ts:6-20`, criamos e exportamos `app`, configuramos `cors()` (`app.ts:8`), `express.json()` (`app.ts:9`), a rota `GET /api/health` que testa o banco com `await prisma.$queryRaw\`SELECT 1\`` (`app.ts:11-18`) e registramos `errorHandler` na última linha (`app.ts:20`).

Não colocamos `app.listen(env.PORT)` aqui de propósito! O arquivo `server.ts` fica responsável apenas por importar `app` e abrir a porta TCP quando o servidor for rodar de verdade. Já nos testes automatizados, o **Supertest** recebe o `app` diretamente, simula requisições HTTP na memória e fecha tudo sozinho — sem precisar subir servidor em porta fixa, sem conflito de porta ocupada em CI/CD e rodando em milissegundos.

#### Como funciona o mock e o teste em `backend/src/shared/middlewares/auth.test.ts`
Testar `authenticate` usando PostgreSQL real em todo teste unitário deixaria a suíte lenta e dependente de banco rodando. Por isso usamos **mocks** (dublês) do Prisma no Vitest:

1. **`vi.hoisted` (`auth.test.ts:6-8`):**
   * No JavaScript/Vitest, chamadas `vi.mock(...)` são içadas (*hoisted*) pelo compilador para rodar **antes** de qualquer `import` do arquivo. Se você declarasse `const mockFindUnique = vi.fn()` normalmente fora do `vi.hoisted`, ela ainda não existiria quando o `vi.mock` rodasse!
   * `vi.hoisted(() => ({ mockFindUnique: vi.fn() }))` garante que `mockFindUnique` seja criada antes dos `import`s e possa ser usada dentro do `vi.mock`.
2. **`vi.mock('../../lib/prisma', ...)` (`auth.test.ts:10-16`):**
   * Intercepta toda importação de `../../lib/prisma` (inclusive a importação feita lá dentro de `auth.ts`!). Quando `auth.ts` chama `prisma.user.findUnique(...)`, na verdade está chamando `mockFindUnique(...)`.
3. **Mini app de teste (`auth.test.ts:22-36`):**
   * A função `createTestApp()` cria um Express só para o teste com duas rotas falsas: `/privado` (protegida por `authenticate`) e `/somente-admin` (protegida por `authenticate, requireRole('ADMIN')`), finalizando com `testApp.use(errorHandler)`.
4. **Isolamento entre testes (`auth.test.ts:41-43`):**
   * `beforeEach(() => { mockFindUnique.mockReset(); })` limpa chamadas e respostas simuladas anteriores antes de cada `it(...)`, evitando que um teste contamine o próximo.
5. **Cenários validados (`auth.test.ts:45-135`):**
   * Header ausente ou com `Basic` em vez de `Bearer` -> `401` (`auth.test.ts:45-53`).
   * Token JWT com assinatura inválida -> `401` (`auth.test.ts:55-60`).
   * Token válido, porém banco mockado retorna `{ ..., ativo: false }` -> `401` e verifica se `findUnique` foi chamado com o `select` correto (`auth.test.ts:62-81`).
   * Token válido, porém banco mockado retorna `null` -> `401` (`auth.test.ts:83-92`).
   * Usuário ativo com `role: 'FUNCIONARIO'` tentando acessar `/somente-admin` -> `403` (`auth.test.ts:94-109`).
   * Usuário ativo com `role: 'ADMIN'` -> `200` e `res.body.user` preenchido corretamente (`auth.test.ts:111-135`).

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas presentes nesta tarefa

1. **Autenticação (401) vs. Autorização (403) + Revogação de JWT:**
   * Saber explicar que JWT é *stateless* por natureza, mas consultar `ativo` no banco (ou usar lista de revogação/tokens curtos) resolve o problema de usuários desativados continuarem acessando a API.
2. **Tratamento centralizado de erros e Fail-Fast:**
   * Entrevistadores adoram perguntar: *"Como você garante que sua API não vaze stack trace nem quebre silenciosamente por falta de variável de ambiente?"*. Resposta: validação de schema no startup (`env.ts` com Zod) + classe de erro operacional (`AppError`) + middleware global de 4 argumentos (`errorHandler`).
3. **Separação `app.ts` / `server.ts` para testabilidade:**
   * Mostra maturidade de arquitetura: código desacoplado de efeitos colaterais de rede permite testes de integração HTTP rápidos com Supertest.
4. **Padrão Singleton em Node.js (`globalThis`):**
   * Entender por que instâncias de conexão com banco não devem ser recriadas a cada requisição ou recarga em desenvolvimento.

### Checklist de estudo e ordem recomendada de leitura

Abra e leia os arquivos exatamente nesta sequência para acompanhar o fluxo de dependências de baixo para cima:

1. [ ] `backend/src/config/env.ts` — veja como o sistema valida o ambiente antes de qualquer coisa.
2. [ ] `backend/src/lib/prisma.ts` — entenda o singleton do `PrismaClient`.
3. [ ] `backend/src/shared/errors/AppError.ts` — veja como criamos nosso erro customizado com `statusCode`.
4. [ ] `backend/src/shared/middlewares/errorHandler.ts` — entenda como `ZodError`, `AppError` e Prisma `P2002` viram respostas JSON.
5. [ ] `backend/src/shared/middlewares/auth.ts` — acompanhe passo a passo a leitura do `Bearer`, `jwt.verify`, consulta ao banco e `requireRole`.
6. [ ] `backend/src/app.ts` — observe a ordem exata de registro (`cors`, `json`, rotas, `errorHandler` por último).
7. [ ] `backend/vitest.config.ts` e `backend/src/shared/middlewares/auth.test.ts` — estude como o `vi.hoisted` + `vi.mock` + Supertest testam toda essa cadeia sem precisar de banco nem porta aberta.
