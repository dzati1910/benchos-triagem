# Guia de Estudos — Task 6: Módulo `triagens` Completo (Ciclo de Vida, Bancada e Auditoria)

---

## 1. O que foi construído aqui (em linguagem simples)

Imagine o dia a dia de uma assistência técnica usando o **BenchOS**:
1. Um atendente recebe o equipamento no balcão, registra o cliente, o modelo, o número de série/MAC, o estado do selo de garantia e o defeito reclamado (**Recebimento** -> status `PENDENTE`).
2. Mais tarde, um técnico pega essa Ordem de Serviço (OS) para testar na bancada (**Início da análise** -> status `EM_ANALISE`).
3. Durante os testes, o técnico pode preencher parte do checklist de testes e salvar um rascunho para continuar depois — ou outro colega do próximo turno pode assumir a bancada (**Progresso parcial**).
4. Ao terminar, o técnico emite o diagnóstico final (`OPERACIONAL`, `DEFEITO_FABRICA`, `ENCAMINHAR_ESPECIALISTA` ou `SEM_GARANTIA`), gera um resumo amigável para o cliente no WhatsApp/balcão e finaliza a OS (**Conclusão** -> status `CONCLUIDA`), ou cancela o atendimento caso o cliente desista (`CANCELADA`).
5. Se uma OS já concluída precisar de correção excepcional, apenas um administrador (`ADMIN`) pode reabri-la para `EM_ANALISE`.

Na Task 6, foi construído **todo o backend desse coração operacional do BenchOS** no módulo `triagens`, substituindo os antigos controllers do legado SQLite por uma arquitetura em camadas sobre **Express + TypeScript + Zod + Prisma + PostgreSQL**.

---

## 2. Mapa da arquitetura e arquivos

No fluxo de uma requisição HTTP dentro do módulo `backend/src/modules/triagens/`, os arquivos se organizam em camadas com responsabilidades bem separadas:

```text
Requisição HTTP
   │
   ▼
triagens.routes.ts       (define URLs, métodos HTTP e middlewares authenticate / requireRole)
   │
   ▼
triagens.controller.ts   (lê req.params/req.query/req.body, valida com Zod e responde JSON/status HTTP)
   │   └── usa triagens.schema.ts (contratos Zod + tipos TypeScript inferidos)
   ▼
triagens.service.ts      (regras de negócio, máquina de estados, autoria, validações de domínio)
   │   ├── usa triagem.utils.ts     (funções puras: normalização de serial e texto de sugestão)
   │   └── usa triagens.repository.ts (queries e transações ACID via Prisma no PostgreSQL)
   ▼
PostgreSQL (via Prisma Client)
```

### Papel de cada arquivo da Task 6

- **`backend/src/modules/triagens/triagem.utils.ts`**: guarda funções puras de transformação e formatação de texto (`normalizarSerial` e `gerarResumoClienteSugestao`), totalmente desacopladas de banco de dados e HTTP.
- **`backend/src/modules/triagens/triagens.schema.ts`**: define os schemas de validação com **Zod** para parâmetros de rota, query strings e corpos JSON (`POST`/`PATCH`), além de exportar os tipos TypeScript via `z.infer`.
- **`backend/src/modules/triagens/triagens.repository.ts`**: centraliza todas as consultas, inclusões de relacionamentos (`include`), projeções seguras de usuário (`select`) e transações (`prisma.$transaction`) no PostgreSQL.
- **`backend/src/modules/triagens/triagens.service.ts`**: implementa o cérebro do módulo — controla transições válidas de status, garante autoria de cada etapa, verifica pertencimento de itens ao checklist da categoria e coordena salvamento parcial e conclusão.
- **`backend/src/modules/triagens/triagens.controller.ts`**: adapta o mundo HTTP (Express `Request`/`Response`/`NextFunction`) para o serviço de domínio, extraindo `req.user.id` (`requireActorId`, linhas `14-19`), validando entradas e encaminhando erros com `next(error)`.
- **`backend/src/modules/triagens/triagens.routes.ts`**: registra os 10 endpoints do módulo no Express Router, aplicando autenticação global e restrição de perfil na rota de reabertura.
- **Limpeza do legado e entrypoint** (conforme `task-6-brief.md`, linhas `10-16` e `55-56`): remoção dos antigos arquivos `backend/src/controllers/triagemController.ts`, `clienteController.ts`, `categoriaController.ts` e `backend/src/types/index.ts`, além da ligação final em `backend/src/app.ts` e `backend/src/server.ts`.

---

## 3. Raio-X das funções e blocos principais

### 3.1. Funções puras em `triagem.utils.ts`

Uma **função pura** é uma função que:
1. Para os mesmos argumentos de entrada, **sempre retorna o mesmo resultado**.
2. **Não produz efeitos colaterais** (não consulta o PostgreSQL, não lê `req`/`res`, não altera variáveis globais nem grava arquivos).

Por que isso é valioso aqui? Porque você consegue testar regras de texto e normalização em milissegundos, sem subir servidor Express nem banco de dados, e reutilizar a mesma lógica em criação, edição e busca de reincidência.

- **`normalizarSerial(raw: string): string`** (`triagem.utils.ts:16-18`)
  - **Entrada:** uma string bruta digitada ou bipada no leitor (ex.: `"  ab12-cd34  "`).
  - **Por dentro:** executa `raw.trim().toUpperCase()`.
  - **Saída:** `"AB12-CD34"`.
  - **Onde é usada:** em `triagensService.createTriagem` (`triagens.service.ts:130`), `triagensService.updateTriagem` (`triagens.service.ts:179`) e `triagensService.buscarReincidencia` (`triagens.service.ts:104`). Como tanto a gravação quanto a consulta passam por `normalizarSerial`, buscar por `"ab12-cd34"` encontra o equipamento salvo como `"AB12-CD34"`.

- **`gerarResumoClienteSugestao(params: GerarResumoClienteParams): string`** (`triagem.utils.ts:38-72`)
  - **Entrada:** objeto tipado pela interface `GerarResumoClienteParams` (`triagem.utils.ts:3-11`) com `diagnosticoFinal`, `modelo`, `fabricante`, `statusSelo`, `observacaoSelo`, `parecerTecnico` e `itensReprovados`.
  - **Por dentro:**
    - Usa o helper interno `formatarEquipamento` (`triagem.utils.ts:20-23`), que junta `[fabricante?.trim(), modelo?.trim()].filter(Boolean).join(' ')` — o `.filter(Boolean)` remove strings vazias ou `undefined` antes de juntar com espaço, caindo em `'equipamento'` se ambos faltarem.
    - Faz um `switch (params.diagnosticoFinal)` (`triagem.utils.ts:41-71`) para os 4 casos possíveis do enum `DiagnosticoFinal`:
      - `'OPERACIONAL'`: orienta conferir fonte, conectores e cabeamento.
      - `'DEFEITO_FABRICA'`: limpa `itensReprovados` e, se houver falhas, lista no texto (`falhas.join('; ')`).
      - `'ENCAMINHAR_ESPECIALISTA'`: informa encaminhamento para avaliação aprofundada.
      - `'SEM_GARANTIA'`: chama `descreverMotivoSelo(params.statusSelo)` (`triagem.utils.ts:25-33`) para explicar se o selo estava `VIOLADO`, `SEM_SELO` ou outra condição.
  - **Saída:** string pronta para atendimento no balcão ou WhatsApp, usada como fallback automático em `concluirTriagem` (`triagens.service.ts:363-374`) quando o técnico não preencheu um `resumoCliente` customizado.

---

### 3.2. Validação na borda com Zod (`triagens.schema.ts`)

Antes de qualquer dado chegar ao `service`, o `controller` executa `.parse(...)` usando os schemas de `triagens.schema.ts`:

- **Coerção e limpeza de query strings (`emptyToUndefined`, linha `13`)**: na URL, um parâmetro vazio como `?status=` chega no Express como `""` (string vazia), e não `undefined`. O helper `emptyToUndefined` junto com `z.preprocess(...)` converte `""` para `undefined` antes de validar o enum em `listTriagensQuerySchema` (`triagens.schema.ts:19-25`) e `reincidenciaQuerySchema` (`triagens.schema.ts:27-33`).
- **`z.coerce.number()` (`triagens.schema.ts:16` e `31`)**: parâmetros de URL (`req.params.id`) sempre chegam como texto (`"42"`). O `coerce.number().int().positive(...)` converte `"42"` para o número `42` e rejeita textos inválidos, zeros ou negativos.
- **`.refine(...)` para atualização não vazia (`updateTriagemSchema` linhas `60-72` e `salvarProgressoSchema` linhas `87-94`)**: impede requisições `PATCH` completamente vazias. No `salvarProgressoSchema`, garante que o técnico enviou ao menos `respostas`, `diagnosticoFinal`, `parecerTecnico` ou `resumoCliente`.
- **`z.infer<typeof ...>` (`triagens.schema.ts:103-109`)**: gera os tipos TypeScript automaticamente a partir das regras do Zod — se você muda uma regra no schema, o tipo muda junto sem precisar manter duas definições sincronizadas.

---

### 3.3. Máquina de estados e trilha tripla de autoria (`triagens.service.ts`)

#### Como funciona a máquina de estados na prática

Uma **máquina de estados** define em quais situações (`status`) uma OS pode estar e quais transições são permitidas. No módulo `triagens`, os status possíveis são `PENDENTE`, `EM_ANALISE`, `CONCLUIDA` e `CANCELADA`:

```text
               iniciar / salvarProgresso
  [PENDENTE] ─────────────────────────────► [EM_ANALISE] ◄─── reabrir (somente ADMIN)
      │                                         │     ▲            │
      │ cancelar                                │     └─ progresso │
      ▼                                         │                  │
 [CANCELADA]                              concluir                 │
      ▲                                         ▼                  │
      └────────────── cancelar ─────────── [CONCLUIDA] ────────────┘
```

Veja como o código aplica essas travas em `triagens.service.ts`:
1. **`isStatusAberto` e `ensureTriagemAberta` (`triagens.service.ts:27-29` e `44-48`)**: apenas `PENDENTE` e `EM_ANALISE` são considerados abertos. Os métodos `updateTriagem` (linha `145`), `cancelarTriagem` (linha `203`), `iniciarAnalise` (linha `215`), `salvarProgresso` (linha `237`) e `concluirTriagem` (linha `281`) chamam `ensureTriagemAberta`. Se a OS já estiver `CONCLUIDA` ou `CANCELADA`, o sistema lança `AppError(..., 409)` (HTTP `409 Conflict`).
2. **Transições dedicadas em vez de `status` livre no `PATCH /:id`**: o schema `updateTriagemSchema` (`triagens.schema.ts:47-59`) **não aceita** o campo `status`. Isso impede que alguém mude o status na marra via edição comum; cada transição passa pelo seu endpoint específico (`/iniciar`, `/progresso`, `/concluir`, `/cancelar`, `/reabrir`).
3. **Reabertura restrita (`reabrirTriagem`, `triagens.service.ts:396-408`)**:
   - Na rota (`triagens.routes.ts:19`), o middleware `requireRole('ADMIN')` bloqueia qualquer `FUNCIONARIO` com HTTP `403`.
   - No serviço (`triagens.service.ts:398-400`), se a OS não estiver `CONCLUIDA` (ex.: `CANCELADA` ou já `EM_ANALISE`), lança `409`.
   - Ao reabrir (`triagens.service.ts:402-407`), volta para `EM_ANALISE`, limpa `concluidoPorId: null` e `concluidoEm: null`, e registra `ultimaAtualizacaoPorId: actorId`.

#### A trilha tripla de autoria (passagem de bastão entre funcionários)

Em uma bancada real, quem recebe o aparelho no balcão nem sempre é quem abre a análise, e quem inicia os testes no turno da manhã pode não ser quem conclui o laudo à tarde. Por isso, a `Triagem` mantém **três campos principais de autoria** (mais cancelamento e última edição):

1. **`recebidoPorId`**: gravado em `createTriagem` (`triagens.service.ts:127`) com o `actorId` de quem cadastrou a OS como `PENDENTE`. Nunca é sobrescrito depois.
2. **`analiseIniciadaPorId` (e `analiseIniciadaEm`)**: gravado pelo helper `buildInicioCampos` (`triagens.service.ts:84-89`):
   ```typescript
   analiseIniciadaPorId: existing.analiseIniciadaPorId ?? actorId,
   analiseIniciadaEm: existing.analiseIniciadaEm ?? now,
   ```
   O operador `??` (nullish coalescing) só usa `actorId` e `now` se os campos ainda estiverem `null`/`undefined`.
   - Em `iniciarAnalise` (`triagens.service.ts:220-228`): se já está `EM_ANALISE` e `analiseIniciadaPorId !== null`, retorna `existing` sem alterar o autor original.
   - Em `salvarProgresso` (`triagens.service.ts:254-256`) e `concluirTriagem` (`triagens.service.ts:384`): também usa `buildInicioCampos`, garantindo que se alguém pular direto de `PENDENTE` para progresso ou conclusão, o início é registrado, mas se outro técnico já tinha iniciado antes, o autor original do início é **preservado**.
3. **`concluidoPorId` (e `concluidoEm`)**: gravado em `concluirTriagem` (`triagens.service.ts:382-383`) com o `actorId` de quem finalizou o laudo.
4. **Rastro complementar**: `canceladoPorId` (`triagens.service.ts:207`) e `ultimaAtualizacaoPorId` (gravado em `updateTriagem`, `cancelarTriagem`, `salvarProgresso`, `concluirTriagem` e `reabrirTriagem`), além de `respondidoPorId` em cada resposta de checklist (`triagens.repository.ts:249` e `254`).

---

### 3.4. Transações atômicas no Prisma (`prisma.$transaction`)

Em banco de dados, uma **transação atômica (ACID)** garante o princípio do "tudo ou nada": se você precisa fazer várias operações seguidas (ex.: apagar respostas antigas e atualizar a triagem, ou salvar 10 respostas e mudar o status para `CONCLUIDA`) e a última falhar, o PostgreSQL desfaz tudo automaticamente para não deixar dados quebrados pela metade.

No Prisma, isso é feito com `prisma.$transaction(async (tx) => { ... })`, usando sempre o cliente transacional **`tx`** (e não o `prisma` global) dentro do callback.

#### Caso 1: Troca de categoria com confirmação e limpeza (`updateTriagem` + `updateClearingRespostas`)
- **No service (`triagens.service.ts:155-171`)**:
  - Detecta se `categoriaId` mudou (`input.categoriaId !== undefined && input.categoriaId !== existing.categoriaId`).
  - Se mudou, conta quantas respostas já existem via `countRespostasByTriagemId(id)` (`triagens.service.ts:160`).
  - Se houver respostas salvas (`respostasSalvas > 0`) e o cliente HTTP **não** enviou `limparRespostasAnteriores: true`, lança `AppError(..., 409, 'CHECKLIST_CONFIRM_CLEAR_REQUIRED')` (`triagens.service.ts:162-168`). Assim o frontend pode exibir um modal de confirmação antes de apagar o trabalho feito na bancada.
  - Se confirmou (`deveLimparRespostas = true`), chama `triagensRepository.updateClearingRespostas(id, updateData)` (`triagens.service.ts:194-196`).
- **No repository (`triagens.repository.ts:212-227`)**:
  - Dentro de `prisma.$transaction(async (tx) => ...)`, primeiro apaga todas as respostas da triagem (`tx.triagemResposta.deleteMany({ where: { triagemId: id } })`) e, em seguida, atualiza a triagem (`tx.triagem.update(...)`). Nunca fica uma triagem na categoria nova com respostas órfãs da categoria antiga.

#### Caso 2: Salvamento parcial (`salvarProgresso` + `persistRespostasAndUpdateTriagem`)
- **No service (`triagens.service.ts:231-273`)**:
  - Valida se a OS está aberta (`ensureTriagemAberta`) e se todos os `itemChecklistId` enviados pertencem à `categoriaId` da triagem (`validateRespostasBelongToCategoria`, linhas `64-82`, que também barra IDs duplicados na requisição).
  - Permite salvar respostas ainda com resultado `PENDENTE` e rascunho de `diagnosticoFinal`, `parecerTecnico` e `resumoCliente`, promovendo o status para `EM_ANALISE` (`triagens.service.ts:253`).
- **No repository (`triagens.repository.ts:229-271`)**:
  - `persistRespostasAndUpdateTriagem` abre `prisma.$transaction(async (tx) => ...)`.
  - Para cada resposta no array, executa `tx.triagemResposta.upsert(...)` usando a chave composta `triagemId_itemChecklistId` (linhas `237-256`): se a resposta daquele item já existia, atualiza (`update`); se não existia, cria (`create`), gravando `respondidoPorId: params.actorId`.
  - Por fim, atualiza a `triagem` (linhas `259-269`) e já retorna o objeto completo com `respostas` ordenadas por `itemChecklist.ordem`.

#### Caso 3: Conclusão com regra de `SEM_GARANTIA` e conversão para `NAO_TESTADO` (`concluirTriagem`)
- **No service (`triagens.service.ts:275-394`)**:
  1. Busca em paralelo com `Promise.all` (`triagens.service.ts:286-289`) todos os itens ativos do checklist da categoria (`activeItems`) e as respostas já salvas no banco (`existingRespostas`).
  2. Combina em memória (`effectiveResultadoByItemId`, linhas `294-300`) o estado salvo anteriormente com o que veio agora no payload da conclusão.
  3. Verifica quais itens ativos ainda **não** estão `APROVADO` nem `REPROVADO` (`incompleteActiveItems`, linhas `302-305`).
  4. Aplica a regra de negócio (`triagens.service.ts:307-321`):
     - Se houver itens incompletos e `diagnosticoFinal !== 'SEM_GARANTIA'`, rejeita com `400` (`AppError` na linha `309`).
     - Mesmo se for `SEM_GARANTIA`, se o selo estiver `'INTEGRO'`, rejeita com `400` (linha `316`) — ou seja, só é permitido pular testes de bancada quando o selo estiver violado ou ausente (`statusSelo !== 'INTEGRO'`).
  5. **Conversão automática para `NAO_TESTADO` (`triagens.service.ts:323-349`)**:
     - Quando `converterPendentesParaNaoTestado` é `true` (`SEM_GARANTIA` e `statusSelo !== 'INTEGRO'`):
       - Itens enviados no payload com resultado `'PENDENTE'` viram `'NAO_TESTADO'` (linhas `328-331`).
       - Itens ativos da categoria que **nem foram enviados** no payload e estão sem resposta ou com resposta `'PENDENTE'` no banco também são adicionados em `respostasToUpsert` com `resultado: 'NAO_TESTADO'` (linhas `335-349`), preservando qualquer observação prévia (`existingRow?.observacao ?? null`).
  6. Calcula `resumoFinal` (usa o enviado, ou o rascunho anterior se `resumoCliente` veio `undefined`, ou chama `gerarResumoClienteSugestao`, linhas `360-374`).
  7. Grava tudo em uma única transação atômica via `persistRespostasAndUpdateTriagem` (`triagens.service.ts:388-393`) com `status: 'CONCLUIDA'`, `concluidoPorId` e `concluidoEm`.

---

### 3.5. Ordem de rotas no Express e projeção segura de usuários

#### Por que `GET /reincidencia` vem antes de `GET /:id` (`triagens.routes.ts:9-12`)
O Express avalia as rotas **de cima para baixo, na ordem em que foram registradas**:
```typescript
triagensRouter.get('/', triagensController.list);
// Rota /reincidencia registrada antes de /:id para evitar colisão de parâmetro numérico.
triagensRouter.get('/reincidencia', triagensController.reincidencia);
triagensRouter.get('/:id', triagensController.getById);
```
Se `GET /:id` estivesse antes de `GET /reincidencia`, quando o frontend chamasse `GET /api/triagens/reincidencia?serial=ABC`, o Express bateria primeiro em `/:id`, interpretaria a palavra `"reincidencia"` como o parâmetro `id`, e o `triagemIdParamSchema` falharia retornando erro `400` (`"ID de triagem inválido."`). Colocando a rota estática `/reincidencia` antes da rota dinâmica `/:id`, o roteamento funciona sem colisão.

#### Projeção segura (`triagemUserSelect`) evitando vazar `senhaHash` (`triagens.repository.ts:21-36`)
No Prisma, quando você faz `include: { recebidoPor: true }`, ele traz **todas** as colunas da tabela de usuários — incluindo `senhaHash`! Para evitar vazamento de credenciais na API, o repositório define uma projeção explícita usando `select`:

```typescript
export const triagemUserSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;
```
(`triagens.repository.ts:21-26`)

Esse objeto é reutilizado em **todos** os relacionamentos de usuário em `triagemRelationsInclude` (`recebidoPor`, `analiseIniciadaPor`, `concluidoPor`, `canceladoPor`, `ultimaAtualizacaoPor`, linhas `28-36`), em `findRespostasByTriagemId` (linha `144`) e em `persistRespostasAndUpdateTriagem` (linha `265`). O operador `satisfies Prisma.UserSelect` do TypeScript garante que você só coloque campos válidos do modelo `User`, mantendo o tipo exato inferido (`TriagemPublicUser`, linhas `14-19`).

*(Bônus de atenção no repositório: em `buildBuscaFilter`, `triagens.repository.ts:62-87`, quando o usuário busca por um número como `"42"` ou `"#42"`, o código verifica `idNum <= PG_MAX_INT32` (`2147483647`) antes de adicionar `{ id: idNum }` no filtro `OR`. Isso evita que uma busca por um número de série puramente numérico gigante estoure o limite de inteiro de 32 bits do PostgreSQL!)*

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas presentes nesta Task

1. **Funções puras e separação de responsabilidades (Service / Repository / Utils):** saber explicar por que regras de negócio não ficam no `controller` nem misturadas com SQL/Prisma, e como isolar funções puras (`normalizarSerial`, `gerarResumoClienteSugestao`) facilita testes unitários rápidos e sem mocks pesados.
2. **Transações ACID (`prisma.$transaction`) e `upsert` idempotente:** saber quando usar transações (ex.: apagar respostas antigas ao trocar categoria ou salvar N respostas + concluir OS atomicamente) e como o `upsert` com chave única composta (`triagemId_itemChecklistId`) evita duplicidade ao salvar rascunhos repetidas vezes.
3. **Máquina de estados + Trilha de auditoria:** proteger transições de status no backend (retornando `409 Conflict` para estados inválidos e `403 Forbidden` via RBAC `requireRole('ADMIN')` para reabertura) em vez de confiar apenas em botões escondidos no frontend.
4. **Segurança na camada de dados (Projeção/`select` explícito) e Roteamento Express:** nunca retornar entidades de usuário inteiras (`include: { user: true }`) para não vazar `senhaHash`, e lembrar sempre que rotas literais (`/reincidencia`) devem vir antes de rotas parametrizadas (`/:id`).

### Ordem recomendada de leitura dos arquivos

Para estudar esta etapa sem se perder, abra os arquivos nesta sequência (do mais simples/isolado para o mais integrado):

1. [`triagem.utils.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagem.utils.ts) — funções puras fáceis de ler de cima a baixo.
2. [`triagens.schema.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.schema.ts) — contratos de entrada/saída e regras Zod.
3. [`triagens.routes.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.routes.ts) — mapa rápido de todos os endpoints e permissões.
4. [`triagens.controller.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.controller.ts) — ponte fina entre Express e service.
5. [`triagens.repository.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.repository.ts) — queries Prisma, `triagemUserSelect`, filtro de busca e `$transaction`.
6. [`triagens.service.ts`](file:///home/dzati/sistema-triagem/backend/src/modules/triagens/triagens.service.ts) — por último, com todo o vocabulário em mente, leia o fluxo completo de `createTriagem`, `updateTriagem`, `salvarProgresso`, `concluirTriagem` e `reabrirTriagem`.
