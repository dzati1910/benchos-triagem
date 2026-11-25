# Guia de Estudo — Task 02: Modelagem Prisma ORM, Migrations PostgreSQL e Seed Realista da Filial

## 1. O que foi construído aqui (em linguagem simples)

Na Task 01, subimos o PostgreSQL no Docker e configuramos o esqueleto do projeto. Agora, na **Task 02**, demos forma ao banco de dados do **BenchOS**: substituímos o antigo banco local em SQLite (`triagem.db` e `src/database/db.ts`) por uma modelagem profissional em **PostgreSQL** gerenciada pelo **Prisma ORM**, com **migrations** versionadas e um **seed** inicial contendo o usuário administrador e os 4 checklists reais da bancada da filial (18 itens no total).

Para entender bem essa etapa, você precisa dominar três pilares:

### O que é um ORM (e o papel do Prisma)
Um **ORM** (*Object-Relational Mapping*, ou Mapeamento Objeto-Relacional) é uma camada que traduz tabelas e linhas do banco de dados SQL para objetos e métodos em TypeScript.
Sem um ORM, você precisaria escrever SQL manualmente em strings (ex.: `SELECT * FROM ...`) e lidar com resultados genéricos sem garantia de formato. Com o **Prisma**, você define todas as tabelas em um único arquivo legível (`schema.prisma`) e passa a conversar com o PostgreSQL usando métodos TypeScript seguros, como `prisma.user.upsert(...)` ou `prisma.categoria.findFirst(...)`.

### Para que servem `migrations` no PostgreSQL (por que não criar tabelas na mão?)
No início de projetos pequenos com SQLite, é comum rodar comandos `CREATE TABLE` diretamente no código de inicialização. Em aplicações reais com PostgreSQL e equipe, isso vira um problema grave: como saber o que mudou no banco entre ontem e hoje, ou garantir que o banco da sua máquina, o dos testes e o da produção estejam idênticos?

As **migrations** resolvem exatamente isso. Quando rodamos `npx prisma migrate dev --name init`, o Prisma compara o `schema.prisma` com o estado atual do PostgreSQL e gera uma pasta com o SQL exato da mudança (ex.: `backend/prisma/migrations/..._init`). Assim:
- Cada alteração de tabela vira um passo histórico versionado no Git.
- Qualquer desenvolvedor ou servidor novo consegue recriar o banco inteiro do zero executando as migrations na ordem certa.

### Qual o papel do `npx prisma generate`
O arquivo `schema.prisma` é só um texto descritivo — o TypeScript não consegue importá-lo diretamente. Quando você executa `npx prisma generate`, o Prisma lê o `schema.prisma` e **gera código TypeScript customizado** dentro de `node_modules/@prisma/client`.
É isso que faz surgirem os tipos exatos das nossas tabelas (`User`, `Triagem`, `Categoria`), dos nossos `enums` (`Role`, `StatusTriagem`) e o autocompletar dos campos no editor. Sempre que você mudar o `schema.prisma`, precisa regenerar esse cliente (o próprio `prisma migrate dev` já costuma rodar o `generate` ao final).

---

## 2. Mapa da arquitetura e arquivos

Nesta tarefa, os arquivos trabalham em cadeia para sair da definição abstrata das tabelas até um banco PostgreSQL populado e pronto para receber a API:

```text
backend/package.json               (dependências, scripts e ponto de entrada do seed)
         │
         ▼
backend/prisma/schema.prisma       (planta baixa do banco: enums, modelos, relações e índices)
         │
         ├──► npx prisma migrate dev   ──► cria tabelas reais no PostgreSQL (migrations)
         ├──► npx prisma generate      ──► gera tipos e métodos em @prisma/client
         │
         ▼
backend/prisma/seed.ts             (usa @prisma/client + .env para popular Admin e checklists)
```

### Papel de cada arquivo da Task 02
- **`backend/package.json`**: removeu o SQLite (`better-sqlite3`) e trouxe a base moderna do backend: `@prisma/client`, `bcryptjs` (hash de senha), `dotenv` (leitura de `.env`), `zod`, `jsonwebtoken` em `dependencies`, além de `prisma`, `vitest`, `supertest` e `tsx` em `devDependencies`. Também registrou os atalhos `prisma:generate`, `prisma:migrate`, `prisma:seed` e o bloco `"prisma": { "seed": "tsx prisma/seed.ts" }`, que ensina o comando `npx prisma db seed` a executar nosso script TypeScript.
- **`backend/prisma/schema.prisma`**: fonte única da verdade sobre o formato do banco. Declara o provedor PostgreSQL, os 5 enums de regras de negócio e os 6 modelos (`User`, `Cliente`, `Categoria`, `ItemChecklist`, `Triagem`, `TriagemResposta`).
- **`backend/prisma/seed.ts`**: script executável que carrega as variáveis de ambiente do `.env` e grava no PostgreSQL o usuário `ADMIN` inicial e as 4 categorias técnicas com seus 18 passos de bancada.
- **Remoção de `backend/src/database/db.ts` e `backend/triagem.db`**: elimina os restos do banco SQLite antigo para não existir risco de parte do código ainda tentar ler o arquivo antigo.

---

## 3. Raio-X das funções e blocos principais

### A. Anatomia do `backend/prisma/schema.prisma`

#### 1. Gerador e conexão (`schema.prisma:1-8`)
- `generator client` (`schema.prisma:1-3`): define que o código gerado será o `prisma-client-js` (consumido pelo nosso código TypeScript via `@prisma/client`).
- `datasource db` (`schema.prisma:5-8`): define `provider = "postgresql"` e `url = env("DATABASE_URL")`. A string de conexão nunca fica escrita fixa no código; ela vem da variável de ambiente `DATABASE_URL` no `.env`.

#### 2. Enums de domínio (`schema.prisma:10-40`)
Um `enum` limita uma coluna a uma lista fechada de valores válidos, impedindo erros de digitação (como gravar `"admin"`, `"ADM"` e `"Administrador"` para a mesma coisa):
- `Role` (`schema.prisma:10-13`): `ADMIN`, `FUNCIONARIO`.
- `StatusSelo` (`schema.prisma:15-19`): `INTEGRO`, `VIOLADO`, `SEM_SELO`.
- `StatusTriagem` (`schema.prisma:21-26`): `PENDENTE`, `EM_ANALISE`, `CONCLUIDA`, `CANCELADA`.
- `DiagnosticoFinal` (`schema.prisma:28-33`): `OPERACIONAL`, `DEFEITO_FABRICA`, `ENCAMINHAR_ESPECIALISTA`, `SEM_GARANTIA`.
- `ResultadoItemChecklist` (`schema.prisma:35-40`): `PENDENTE`, `APROVADO`, `REPROVADO`, `NAO_TESTADO`.

#### 3. Relacionamentos `@relation` nomeados e trilha de auditoria (`schema.prisma:42-58` e `schema.prisma:92-127`)
Observe que o modelo `Triagem` se conecta **cinco vezes** ao mesmo modelo `User` (`schema.prisma:98-107`):
1. `recebidoPor` (`"TriagensRecebidas"`, obrigatório — sempre há quem recebeu o equipamento no balcão).
2. `analiseIniciadaPor` (`"TriagensIniciadas"`, opcional `User?` — preenchido quando um técnico assume a bancada).
3. `concluidoPor` (`"TriagensConcluidas"`, opcional).
4. `canceladoPor` (`"TriagensCanceladas"`, opcional).
5. `ultimaAtualizacaoPor` (`"TriagensAtualizadas"`, opcional).

Quando dois modelos têm mais de um relacionamento entre si, o Prisma **exige nomes nas diretivas `@relation("...")`** para não confundir qual chave estrangeira (ex.: `recebidoPorId`) alimenta qual lista inversa dentro de `User` (`triagensRecebidas`, `triagensIniciadas`, etc. em `schema.prisma:52-56`). Isso cria uma trilha completa de auditoria para saber exatamente quem executou cada etapa da ordem de serviço.

Já em `TriagemResposta` (`schema.prisma:129-142`), vale notar o `onDelete: Cascade` em `triagem` (`schema.prisma:132`): se uma triagem for apagada do banco, todas as respostas de checklist ligadas a ela são apagadas automaticamente junto, evitando registros órfãos.

#### 4. Restrições únicas e índices (`@unique`, `@@unique` e `@@index`)
- `@unique` em `User.email` (`schema.prisma:45`) e `Categoria.nome` (`schema.prisma:71`): garante no próprio PostgreSQL que nunca existirão dois usuários com o mesmo e-mail nem duas categorias com o mesmo nome. Além disso, campos `@unique` permitem uso direto no `where` do `upsert`.
- `@@index([categoriaId, ordem])` em `ItemChecklist` (`schema.prisma:89`) e `@@index([numeroSerieMac])` em `Triagem` (`schema.prisma:126`): índices funcionam como o índice remissivo de um livro. Em vez de o PostgreSQL ler a tabela inteira linha por linha para achar um número de série/MAC ou ordenar os itens de uma categoria, ele vai direto ao endereço certo — deixando consultas frequentes muito mais rápidas.
- `@@unique([triagemId, itemChecklistId])` em `TriagemResposta` (`schema.prisma:141`): é uma **restrição única composta**. Garante que a combinação `(triagemId, itemChecklistId)` jamais se repita, ou seja, um mesmo item do checklist só pode ter **uma** resposta por triagem.

---

### B. Anatomia do `backend/prisma/seed.ts`

#### 1. Carregamento de `.env` e catálogo realista (`seed.ts:1-161`)
- `import 'dotenv/config'` (`seed.ts:1`): lê o arquivo `.env` automaticamente na primeira linha do script e coloca suas chaves em `process.env`.
- `const prisma = new PrismaClient()` (`seed.ts:5`): abre a instância de conexão com o banco usando as definições geradas do `schema.prisma`.
- `CATEGORIAS_SEED` (`seed.ts:20-161`): array tipado com `SeedCategoria[]` (`seed.ts:13-18`) contendo as 4 categorias reais da operação da loja:
  1. `HD (Disco Rígido CFTV)` (4 itens)
  2. `Câmera Hikvision / HiLook` (4 itens)
  3. `Gravador DVR / NVR Hikvision / HiLook` (5 itens)
  4. `Controle de Acesso AGL` (5 itens)

#### 2. `seedAdmin()` e segurança com `bcryptjs` (`seed.ts:163-192`)
- **Entrada:** lê `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` e `SEED_ADMIN_NAME` de `process.env` (`seed.ts:164-166`). Se e-mail ou senha não estiverem definidos no `.env`, lança um erro imediatamente (`seed.ts:168-172`). Nunca colocamos senhas reais direto no código-fonte porque código vai para o Git.
- **Hash com `bcryptjs` (`seed.ts:174`):** `await bcrypt.hash(password, 10)` transforma a senha em um *hash* criptográfico irreversível antes de gravar no campo `senhaHash`.
  - **Por que nunca salvar senha em texto puro?** Se o banco de dados vazar ou alguém não autorizado fizer uma consulta `SELECT`, a senha real do usuário continua protegida. O `bcrypt` ainda adiciona um *salt* aleatório e um fator de custo (`10` rodadas), tornando ataques de força bruta extremamente lentos.
- **Saída (`seed.ts:176-191`):** executa `prisma.user.upsert`, que procura pelo `email` único: se já existir, atualiza (`update`); se não existir, cria (`create`).

#### 3. `seedCategorias()` e o conceito de idempotência (`seed.ts:194-241`)
Um script **idempotente** é aquele que pode ser executado 2, 5 ou 20 vezes seguidas e o resultado final no banco será exatamente o mesmo, **sem duplicar registros**.

- Para cada categoria em `CATEGORIAS_SEED`, `seedCategorias()` usa `prisma.categoria.upsert` (`seed.ts:196-209`) usando `where: { nome: catData.nome }` (possível porque `nome` é `@unique`).
- Em seguida, percorre os `itens` daquela categoria (`seed.ts:211-239`). Como `ItemChecklist` não possui um `@@unique([categoriaId, ordem])` no `schema.prisma` (apenas `@@index`), o Prisma não aceitaria um `upsert` direto por esses dois campos. Então o código faz o equivalente manual de forma limpa:
  1. Busca se já existe um item com `categoriaId` e `ordem` via `prisma.itemChecklist.findFirst` (`seed.ts:212-217`).
  2. Se encontrou (`if (existing)`), atualiza descrição, `comoTestar` e `ativo` (`seed.ts:219-227`).
  3. Se não encontrou (`else`), cria o registro novo (`seed.ts:228-238`).

#### 4. `main()` e encerramento limpo (`seed.ts:243-256`)
Executa `await seedAdmin()` e `await seedCategorias()` em sequência, imprime a confirmação no console, trata falhas com `process.exit(1)` no `.catch()` e garante em `.finally()` o fechamento da conexão com `await prisma.$disconnect()` (`seed.ts:255`) para o processo Node.js não ficar pendurado.

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas presentes nesta tarefa
1. **Migrations vs alterações manuais:** saber explicar que migrations mantêm o histórico versionado do esquema do banco e permitem reproduzir ambientes com segurança em equipe e CI/CD.
2. **Modelagem relacional prática:** múltiplos relacionamentos entre as mesmas tabelas (`@relation` nomeado), integridade referencial (`onDelete: Cascade`), unicidade composta (`@@unique`) e otimização de leitura com índices (`@@index`).
3. **Segurança básica de autenticação e configuração:** jamais armazenar senha em texto puro (sempre gerar *hash* com algoritmo lento como `bcrypt`) e nunca versionar segredos no código (ler de `.env`).
4. **Scripts idempotentes:** saber garantir que seeds e rotinas de carga inicial possam rodar repetidamente sem duplicar dados (`upsert` ou busca + atualização condicional).

### Ordem recomendada de leitura dos arquivos
1. [`backend/package.json`](file:///home/dzati/sistema-triagem/backend/package.json) — entenda quais bibliotecas entraram no projeto e quais comandos (`prisma:*`) foram configurados.
2. [`backend/prisma/schema.prisma`](file:///home/dzati/sistema-triagem/backend/prisma/schema.prisma) — leia de cima para baixo: enums primeiro, depois cada `model` observando chaves estrangeiras, `@relation`, `@@index` e `@@unique`.
3. [`backend/prisma/seed.ts`](file:///home/dzati/sistema-triagem/backend/prisma/seed.ts) — acompanhe como o código TypeScript usa o cliente gerado pelo Prisma para popular usuário e checklists de forma idempotente.
4. [`task-2-brief.md`](file:///home/dzati/sistema-triagem/.superpowers/sdd/2026-11-25-benchos-reestruturacao/task-2-brief.md) — revise o passo a passo operacional de como a migration e a validação no PostgreSQL foram executadas.
