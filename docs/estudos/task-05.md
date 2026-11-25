# Guia de Estudo — Task 5: Módulos `clientes` e `categorias` (Clientes e Checklists Guiados Editáveis)

---

## 1. O que foi construído aqui (em linguagem simples)

No dia a dia de uma assistência técnica usando o **BenchOS**, antes de iniciar a triagem de um aparelho, o técnico precisa de duas coisas funcionando na ponta dos dedos:

1. **Encontrar ou cadastrar rapidamente o cliente** (buscando pelo nome, telefone ou CPF/CNPJ, sem se importar se digitou em maiúsculas ou minúsculas).
2. **Consultar os checklists guiados por categoria de equipamento** (ex.: Smartphone, Notebook), vendo exatamente **o que verificar** (`descricao`) e **como testar** (`comoTestar`) na ordem certa — enquanto administradores (`ADMIN`) conseguem criar categorias, editar instruções, adicionar novos itens, reordená-los ou desativá-los sem apagar o histórico do banco.

Essa tarefa entrega exatamente esses dois módulos completos no backend:
- **Módulo `clientes`**: listagem com busca flexível (`GET /api/clientes?busca=...`) e cadastro rápido (`POST /api/clientes`).
- **Módulo `categorias`**: listagem de categorias com seus itens de checklist (`GET /api/categorias`) e um conjunto de endpoints administrativos (`POST` e `PATCH`) para gerenciar categorias e itens de checklist.

---

## 2. Mapa da arquitetura e arquivos

Ambos os módulos seguem a arquitetura em camadas do BenchOS:

```text
Requisição HTTP
   │
   ▼
app.ts (registra os prefixos /api/clientes e /api/categorias)
   │
   ▼
*.routes.ts (aplica middlewares authenticate / requireRole e aponta o endpoint)
   │
   ▼
*.controller.ts (valida req.params / req.query / req.body com Zod e devolve HTTP)
   │
   ▼
*.service.ts (aplica regras de negócio, permissões extras e normalizações)
   │
   ▼
*.repository.ts (executa queries no PostgreSQL via Prisma)
```

### Arquivos envolvidos

- **`backend/src/app.ts`**: conecta `clientesRouter` em `/api/clientes` (`app.ts:27`) e `categoriasRouter` em `/api/categorias` (`app.ts:28`), antes do middleware global `errorHandler` (`app.ts:30`).
- **Módulo `clientes` (`backend/src/modules/clientes/`)**:
  - `clientes.routes.ts`: exige autenticação em todas as rotas (`clientes.routes.ts:7`) e expõe `GET /` e `POST /`.
  - `clientes.schema.ts`: define os formatos aceitos na query `?busca=` e no corpo JSON de criação de cliente.
  - `clientes.controller.ts`: faz o `parse` dos dados recebidos com Zod, chama o `clientesService` e responde `200` ou `201`.
  - `clientes.service.ts`: normaliza campos opcionais vazios para `null` antes de salvar.
  - `clientes.repository.ts`: implementa a busca flexível no Prisma e a inserção no banco.
  - `clientes.test.ts`: testes automatizados que garantem busca, normalização e erro `400` para `nome` vazio.
- **Módulo `categorias` (`backend/src/modules/categorias/`)**:
  - `categorias.routes.ts`: exige autenticação em tudo (`categorias.routes.ts:7`), libera `GET /` para qualquer usuário autenticado (`FUNCIONARIO` ou `ADMIN`) e restringe criação/edição ao perfil `ADMIN` com `requireRole('ADMIN')`.
  - `categorias.schema.ts`: valida IDs da URL, flag `incluirInativos`, payloads de criação e payloads parciais (`PATCH`) usando `.refine()`.
  - `categorias.controller.ts`: extrai `req.user`, `req.params`, `req.query` e `req.body`, valida via Zod e delega para `categoriasService`.
  - `categorias.service.ts`: bloqueia `incluirInativos=true` para não-admins (`403`), garante unicidade de nome (`409`), verifica existência (`404`) e calcula a próxima `ordem` automática ao criar um item.
  - `categorias.repository.ts`: faz consultas aninhadas (`categoria` + `itens`), agregação `_max` e atualizações no Prisma.
  - `categorias.test.ts`: testes automatizados cobrindo permissões (`FUNCIONARIO` vs `ADMIN`), listagem ordenada, criação e edição.

---

## 3. Raio-X das funções e blocos principais

### A. Buscas flexíveis no Prisma (`OR` + `contains` + `mode: 'insensitive'`)

Arquivo: `clientes.repository.ts:8-23`

```ts
findMany(busca?: string): Promise<Cliente[]> {
  const termo = busca?.trim();

  return prisma.cliente.findMany({
    where: termo
      ? {
          OR: [
            { nome: { contains: termo, mode: 'insensitive' } },
            { telefone: { contains: termo, mode: 'insensitive' } },
            { documento: { contains: termo, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { nome: 'asc' },
  });
}
```

**Passo a passo:**
1. **O que entra:** uma string opcional `busca` vinda da query string (`GET /api/clientes?busca=maria`).
2. **Limpeza inicial (`:9`):** `busca?.trim()` remove espaços nas pontas. Se o usuário enviou só espaços (`"   "`), `termo` vira `""` (falsy em JavaScript).
3. **Filtro condicional (`:12-20`):**
   - Se `termo` estiver vazio ou `undefined`, `where` recebe `undefined`, então o Prisma traz todos os clientes sem filtro.
   - Se `termo` tiver conteúdo, o Prisma monta uma cláusula `OR`: basta que o texto apareça no `nome`, **ou** no `telefone`, **ou** no `documento`.
   - `contains: termo` funciona como um `ILIKE '%termo%'` no PostgreSQL quando combinado com `mode: 'insensitive'`, ignorando diferenças entre maiúsculas e minúsculas (ex.: `"joão"` encontra `"João Silva"`).
4. **O que sai:** uma `Promise<Cliente[]>` ordenada alfabeticamente (`orderBy: { nome: 'asc' }` em `:21`).

---

### B. Normalização de campos opcionais vazios (`trim() || null`)

Arquivos: `clientes.schema.ts:7-11` e `clientes.service.ts:13-19`

No formulário do frontend, é comum o usuário deixar o campo de telefone ou documento em branco, e o navegador enviar `""` (string vazia) ou espaços `"   "`. No banco de dados, salvar `""` polui os registros — o ideal para um campo opcional ausente é `null`.

Veja como `createCliente` em `clientes.service.ts:13-19` resolve isso:

```ts
createCliente(input: CreateClienteInput): Promise<Cliente> {
  return clientesRepository.create({
    nome: input.nome.trim(),
    telefone: input.telefone?.trim() || null,
    documento: input.documento?.trim() || null,
  });
}
```

**Passo a passo:**
1. No schema (`clientes.schema.ts:9-10`), `telefone` e `documento` são `.string().trim().optional().nullable()` — ou seja, o Zod aceita `string`, `undefined` ou `null` (e já remove espaços das pontas se vier texto).
2. No service (`clientes.service.ts:16-17`), a expressão `input.telefone?.trim() || null` usa dois recursos do JavaScript/TypeScript:
   - **Optional chaining (`?.`)**: se `input.telefone` for `undefined` ou `null`, não tenta chamar `.trim()` e já resulta em `undefined`.
   - **Operador lógico OU (`||`)**: se o lado esquerdo for `undefined` ou `""` (string vazia, que em JavaScript é *falsy*), ele assume o valor da direita: `null`.
3. O mesmo padrão aparece em `categorias.service.ts:36` e `:58` para o campo opcional `instrucaoGeral`.

---

### C. Filtragem e ordenação aninhada no Prisma (`include` com `where` e `orderBy`)

Arquivo: `categorias.repository.ts:12-23`

```ts
findManyWithItens(incluirInativos: boolean): Promise<CategoriaComItens[]> {
  return prisma.categoria.findMany({
    where: incluirInativos ? undefined : { ativo: true },
    include: {
      itens: {
        where: incluirInativos ? undefined : { ativo: true },
        orderBy: { ordem: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });
}
```

**Passo a passo:**
1. **O que entra:** `incluirInativos: boolean` (convertido de `'true' | 'false'` para `boolean` pelo Zod em `categorias.schema.ts:11-16`, e liberado apenas para `ADMIN` em `categorias.service.ts:19-21`).
2. **Filtro no nível pai (`Categoria`, `:14`):** quando `incluirInativos` é `false` (comportamento padrão), traz apenas categorias com `ativo: true`. Quando é `true`, `where: undefined` remove o filtro e traz ativas e inativas.
3. **Filtro e ordenação no nível filho (`itens`, `:15-20`):** dentro de `include`, além de pedir os relacionamentos (`itens`), o Prisma permite passar um objeto com `where` e `orderBy` próprios para os filhos! Assim:
   - Itens desativados (`ativo: false`) também ficam escondidos quando `incluirInativos` é `false`.
   - Os itens de cada categoria já vêm ordenados por `ordem: 'asc'` (`:18`), prontos para serem exibidos passo a passo na bancada.
4. **O que sai:** lista de categorias tipada como `CategoriaComItens[]` (interface estendendo `Categoria` com `itens: ItemChecklist[]`, definida em `categorias.repository.ts:4-6`).

---

### D. Cálculo automático da próxima ordem (`aggregate` + `_max`)

Arquivos: `categorias.repository.ts:66-72` e `categorias.service.ts:64-81`

Quando um administrador adiciona um novo item de checklist sem informar o número da `ordem` manualmente, o sistema deve colocá-lo no final da lista daquela categoria.

1. No repositório (`categorias.repository.ts:66-72`):
   ```ts
   async findMaxOrdemByCategoria(categoriaId: number): Promise<number> {
     const result = await prisma.itemChecklist.aggregate({
       where: { categoriaId },
       _max: { ordem: true },
     });
     return result._max.ordem ?? 0;
   }
   ```
   - `prisma.itemChecklist.aggregate` executa uma função de agregação SQL (`SELECT MAX(ordem)`) filtrada apenas pelos itens da `categoriaId` informada.
   - Se a categoria ainda não tiver nenhum item, `result._max.ordem` será `null`. O operador *Nullish Coalescing* (`??`) devolve `0` apenas quando o valor é `null` ou `undefined`.
2. No service (`categorias.service.ts:70-73`):
   ```ts
   const ordem =
     input.ordem !== undefined
       ? input.ordem
       : (await categoriasRepository.findMaxOrdemByCategoria(categoriaId)) + 1;
   ```
   - Se `input.ordem` foi enviado pelo admin, usa o valor enviado; senão, pega o maior valor atual (ou `0`) e soma `+ 1` (primeiro item ganha `ordem = 1`, o próximo `2`, e assim por diante).

---

### E. Ordem de declaração de rotas no Express (colisão de parâmetros)

Arquivo: `categorias.routes.ts:9-14`

```ts
categoriasRouter.get('/', categoriasController.list);
categoriasRouter.post('/', requireRole('ADMIN'), categoriasController.create);
// Rota /itens/:itemId registrada antes de /:id para evitar colisão de parâmetros.
categoriasRouter.patch('/itens/:itemId', requireRole('ADMIN'), categoriasController.updateItem);
categoriasRouter.patch('/:id', requireRole('ADMIN'), categoriasController.update);
categoriasRouter.post('/:id/itens', requireRole('ADMIN'), categoriasController.createItem);
```

**Por que a ordem importa tanto aqui?**
O Express avalia as rotas **de cima para baixo** na ordem em que foram registradas e executa a **primeira** que combinar com o método HTTP e o padrão da URL:
- Repare que `PATCH /api/categorias/itens/15` tem dois segmentos após `/api/categorias`: `"itens"` e `"15"`. (Na verdade, `PATCH /api/categorias/:id` tem apenas 1 segmento variável após `/api/categorias`, enquanto `PATCH /api/categorias/itens/:itemId` tem 2 segmentos. Mesmo assim, manter rotas literais/específicas como `/itens/...` ou `/me` **antes** de rotas dinâmicas como `/:id` é uma regra de ouro no Express!)
- Imagine se existisse uma rota `GET /:id` antes de `GET /itens` (ou `GET /ativos`): uma requisição para `/api/categorias/itens` entraria em `/:id` com `req.params.id === "itens"`, e o `categoriaIdParamSchema` (`z.coerce.number()`) falharia com erro `400 ID de categoria inválido`.
- Registrando `/itens/:itemId` (`:12`) antes de `/:id` (`:13`), você garante que caminhos com prefixo fixo tenham prioridade sobre parâmetros coringa.

---

### F. Garantindo que um `PATCH` não chegue vazio com Zod `.refine()`

Arquivo: `categorias.schema.ts:24-38` e `:46-60`

Em rotas de atualização parcial (`PATCH`), todos os campos do objeto são `.optional()`, porque o cliente pode querer mudar apenas o `nome`, ou apenas `ativo: false`. O problema é que, se todos os campos são opcionais, um corpo `{}` (objeto vazio) passaria na validação padrão!

Para barrar `{}` já na camada de schema, usa-se `.refine()`:

```ts
export const updateCategoriaSchema = z
  .object({
    nome: z.string().trim().min(1, 'Nome da categoria é obrigatório.').optional(),
    icone: z.string().trim().min(1, 'Ícone da categoria é obrigatório.').optional(),
    instrucaoGeral: z.string().trim().optional().nullable(),
    ativo: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.nome !== undefined ||
      data.icone !== undefined ||
      data.instrucaoGeral !== undefined ||
      data.ativo !== undefined,
    { message: 'Informe ao menos um campo para atualização.' },
  );
```

**Como funciona:**
- Primeiro, o Zod valida cada campo individualmente dentro de `z.object(...)`.
- Depois, o `.refine(fn, { message })` roda uma função customizada com o objeto já validado (`data`).
- Se **nenhum** dos 4 campos for diferente de `undefined`, a função retorna `false` e o Zod dispara um `ZodError` com a mensagem `'Informe ao menos um campo para atualização.'` (que o `errorHandler` transforma em HTTP `400`).
- O mesmo padrão é usado em `updateItemChecklistSchema` (`categorias.schema.ts:53-60`).
- Já no service (`categorias.service.ts:54-61` e `:89-94`), o código usa spread condicional `...(campo !== undefined ? { campo } : {})` para enviar ao `prisma.update` **somente** os campos que realmente vieram na requisição, sem sobrescrever os demais.

---

## 4. O que absorver para o mercado + ordem de leitura

### Checklist de conceitos cobrados em entrevistas

1. **Validação de entrada e atualização parcial (`PATCH` vs `PUT`) com Zod:**
   - Saber por que usar `.optional()` em `PATCH`, como evitar payloads vazios `{}` com `.refine()`, e como usar `z.coerce.number()` em `req.params` (já que parâmetros de URL chegam sempre como `string` no Express).
2. **Queries relacionais e agregações em ORMs (Prisma):**
   - Saber filtrar e ordenar relações aninhadas direto no banco (`include: { itens: { where, orderBy } }`) em vez de trazer tudo para a memória do Node.js e filtrar com `.filter()`/`.sort()`.
   - Saber usar `aggregate({ _max })` no lugar de buscar todos os registros só para descobrir o maior valor.
3. **Roteamento no Express e defesa em profundidade (RBAC):**
   - Saber a importância da ordem das rotas (rotas estáticas/específicas antes de rotas com parâmetros dinâmicos `/:id`).
   - Entender controle de acesso por papel (`requireRole('ADMIN')` nas rotas de escrita e checagem granular no service para `?incluirInativos=true` lançando `403` em `categorias.service.ts:19-21`).
4. **Soft delete (`ativo: boolean`) e tratamento de conflito (`409`) / ausência (`404`):**
   - Em sistemas reais com histórico (como ordens de serviço ligadas a checklists), não se apaga categorias/itens com `DELETE` — desativa-se com `ativo: false` para não quebrar registros antigos.

### Ordem recomendada de leitura dos arquivos

Para estudar essa tarefa sem se perder, siga a ordem abaixo (do contrato de entrada até o banco):

1. `backend/src/app.ts` (linhas 25–30) — ver onde os módulos entram na aplicação.
2. `backend/src/modules/clientes/clientes.routes.ts` e `clientes.schema.ts` — entender os endpoints e validações mais simples primeiro.
3. `backend/src/modules/clientes/clientes.controller.ts` -> `clientes.service.ts` -> `clientes.repository.ts` — acompanhar o fluxo completo da busca flexível e do `trim() || null`.
4. `backend/src/modules/categorias/categorias.routes.ts` e `categorias.schema.ts` — observar a ordem das rotas, `requireRole('ADMIN')`, `z.coerce` e `.refine()`.
5. `backend/src/modules/categorias/categorias.controller.ts` -> `categorias.service.ts` -> `categorias.repository.ts` — acompanhar a regra de `incluirInativos`, conflitos `409`, cálculo de `ordem` com `_max` e a query aninhada com `include`.
