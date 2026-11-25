# Guia de Estudo — Task 10: Telas Admin (`ADMIN`), `./iniciar.sh`, `README.md` e Verificação E2E

## 1. O que foi construído aqui (em linguagem simples)

Nas Tasks anteriores você construiu o banco PostgreSQL, a autenticação JWT com papéis (`ADMIN` e `FUNCIONARIO`), as rotas de negócio no backend e as telas operacionais do dia a dia (login, dashboard, criação de OS, checklist na bancada e prontuário). Porém, ainda faltavam três peças para o **BenchOS** funcionar de ponta a ponta na loja sem depender de comandos manuais no banco:

1. **Autonomia visual para o administrador (`UsuariosAdminPage.tsx` e `ChecklistsAdminPage.tsx`):** permitir que o dono/gerente cadastre novos técnicos, redefina senhas, desative contas antigas e ajuste categorias e instruções de teste (`comoTestar`) direto pelo navegador em `/admin/*`.
2. **Testes automatizados dessas telas (`adminPages.test.tsx`):** garantir que as regras críticas da interface (como impedir que o admin desative a si mesmo) continuem funcionando mesmo após futuras alterações.
3. **Empacotamento operacional (`iniciar.sh` e `README.md` + verificação E2E):** transformar toda a inicialização (Docker, PostgreSQL saudável, migrations, seed, backend e frontend visível na rede local da loja) em um único comando `./iniciar.sh`, validado com fluxo completo no banco real.

---

## 2. Mapa da arquitetura e arquivos

```text
Navegador (Admin na loja: http://[IP]:3000/admin/*)
   │
   ▼
frontend/src/App.tsx (ProtectedRoute exigindo role ADMIN)
   ├──▶ UsuariosAdminPage.tsx  ──┐
   └──▶ ChecklistsAdminPage.tsx ─┼──▶ frontend/src/services/api.ts (/api/*)
                                 │          │
                                 │          ▼ (Vite proxy /api -> 127.0.0.1:3001)
                                 │    Backend Express (:3001) -> PostgreSQL 16 (Docker)
                                 │
adminPages.test.tsx ─────────────┴──▶ Vitest + Testing Library (mocka AuthContext e api.ts)

Operação na máquina servidora da loja:
./iniciar.sh ──▶ checa Docker ──▶ docker compose up -d ──▶ pg_isready
             ──▶ prisma migrate deploy + prisma db seed
             ──▶ backend (:3001) + frontend (:3000 em 0.0.0.0) com trap cleanup
```

### Papel de cada arquivo analisado

- [`frontend/src/features/admin/UsuariosAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx): tela CRUD de funcionários (`ADMIN`). Lista usuários, mostra contadores resumidos, cria novo usuário, altera papel (`FUNCIONARIO` / `ADMIN`), ativa/desativa contas e redefine senhas.
- [`frontend/src/features/admin/ChecklistsAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/ChecklistsAdminPage.tsx): tela CRUD de categorias e itens de checklist no formato **mestre-detalhe** (lista de categorias à esquerda; detalhes e roteiro de testes à direita).
- [`frontend/src/features/admin/adminPages.test.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/adminPages.test.tsx): suíte de testes unitários/componentes com Vitest e React Testing Library cobrindo as duas páginas administrativas.
- [`iniciar.sh`](file:///home/dzati/sistema-triagem/iniciar.sh): script Bash de produção local que valida o Docker, sobe o container PostgreSQL, espera o banco aceitar conexões, aplica migrations e seed, libera portas ocupadas e sobe backend + frontend com encerramento limpo via `trap`.
- [`README.md`](file:///home/dzati/sistema-triagem/README.md): documentação oficial de arquitetura, rede local (LAN), setup no Pop!_OS/Ubuntu, credenciais iniciais, comandos de teste/banco e segurança na bancada.

---

## 3. Raio-X das funções e blocos principais

### 3.1. CRUD em React: `UsuariosAdminPage.tsx` e `ChecklistsAdminPage.tsx`

#### A) Carregamento inicial e dados derivados com `useCallback` + `useEffect` + `useMemo`
Em [`UsuariosAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx#L50-L72):
- `carregarUsuarios` (linhas 50–61) é memorizada com `useCallback` e executada na montagem pelo `useEffect` (linhas 63–65). Ela controla `carregando` e `erro` com `try / catch / finally`.
- `resumo` (linhas 67–72) usa `useMemo` para calcular `{ total, ativos, admins }` diretamente a partir de `usuarios`. Em React, valores que podem ser calculados a partir de outro estado **não devem** virar um novo `useState` — `useMemo` evita dessincronização entre a tabela e os cards do topo.

#### B) Atualização imediata da lista após criar ou editar
Compare duas estratégias usadas neste módulo:
1. **Atualização otimista/local do array em memória** em [`UsuariosAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx#L87):
   - Ao criar (`handleCriarUsuario`, linhas 74–99): após o `POST` retornar `criado`, faz `setUsuarios((prev) => [...prev, criado])` (linha 87), limpa os inputs e fecha o formulário.
   - Ao alternar status (`handleToggleAtivo`, linhas 101–120) ou mudar papel (`handleAlterarRole`, linhas 122–137): após o `PATCH` retornar `atualizado`, substitui apenas aquele item no array com `prev.map((u) => (u.id === atualizado.id ? atualizado : u))` (linhas 109 e 130).
   - **Vantagem:** zero requisições extras de `GET` e resposta instantânea na tela.
2. **Recarregamento sincronizado preservando seleção** em [`ChecklistsAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/ChecklistsAdminPage.tsx#L77-L95):
   - `carregarCategorias(preferredId?)` busca todas as categorias com seus itens (`fetchCategoriasAdmin()`) e mantém selecionada a categoria `preferredId ?? prev` (se ela ainda existir) ou cai na primeira da lista (`lista[0]?.id ?? null`, linha 88).
   - Após criar categoria (linha 134), editar categoria (linha 157), criar item (linha 200) ou editar/alternar item (linhas 231 e 246), a página chama `await carregarCategorias(...)`.
   - **Por que aqui faz sentido?** Como o backend organiza itens por `ordem` e retorna a árvore completa `Categoria -> itens[]`, recarregar garante que a lista à esquerda (contagem de itens) e a lista ordenada à direita (`itensOrdenados`, linhas 106–109, ordenando por `a.ordem - b.ordem || a.id - b.id`) fiquem 100% fiéis ao banco.

#### C) Padrão Mestre-Detalhe e limpeza de estados transitórios
Em [`ChecklistsAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/ChecklistsAdminPage.tsx#L400-L847):
- A grade `grid-cols-1 lg:grid-cols-12` divide a tela em **Mestre** (`lg:col-span-5`, linhas 401–458, lista clicável de categorias) e **Detalhe** (`lg:col-span-7`, linhas 460–846, painel da `categoriaSelecionada` encontrada via `useMemo` nas linhas 101–104).
- **Detalhe sutil muito importante (linhas 422–427):** ao clicar em outra categoria na coluna esquerda, o `onClick` não faz apenas `setCategoriaSelecionadaId(cat.id)`. Ele também limpa os estados transitórios de edição da categoria anterior:
  - `setEditandoCat(false)` (linha 424)
  - `setItemEditandoId(null)` (linha 425)
  - `setNovoItemAberto(false)` (linha 426)
  - **Por quê?** Se o admin começasse a editar a categoria A ou um item da categoria A e clicasse na categoria B, o formulário aberto continuaria visível na tela com dados antigos da categoria A. Limpar esses estados na troca de seleção evita bugs de interface e confusão operacional.

#### D) Proteção contra auto-bloqueio do admin espelhando o backend
Em [`UsuariosAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx#L31):
- O componente lê quem está logado via `const { user: currentUser } = useAuth();`.
- Ao renderizar cada linha da tabela (linha 420), calcula `const isSelf = u.id === currentUser?.id;` e `const busy = processandoId === u.id;` (linha 421).
- Quando `isSelf` é verdadeiro:
  1. Exibe a tag `"Você"` ao lado do nome (linhas 433–437).
  2. Desabilita o `<select>` de papel (`disabled={isSelf || busy}`, linha 451) com `title` explicativo.
  3. Desabilita o botão `Ativar/Desativar` (`disabled={isSelf || busy}`, linha 497).
  4. Como camada extra de defesa no código, `handleToggleAtivo` (linha 102) e `handleAlterarRole` (linha 123) também fazem `if (alvo.id === currentUser?.id) return;`.
- **Regra de ouro em arquitetura:** validação no frontend melhora a experiência (impede o clique acidental antes mesmo da requisição), mas **nunca substitui** a validação no backend — aqui os dois lados aplicam a mesma regra.

---

### 3.2. Testes de componentes React com Vitest + Testing Library (`adminPages.test.tsx`)

No [`adminPages.test.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/adminPages.test.tsx), os testes verificam o comportamento real do componente no navegador simulado **sem precisar subir servidor Express nem banco PostgreSQL**:

1. **`vi.hoisted` + `vi.mock` (linhas 7–31):**
   - No Vitest, chamadas `vi.mock(...)` são movidas automaticamente para o topo do arquivo antes mesmo dos `import`. Se você criar uma constante comum fora e tentar usá-la dentro de `vi.mock`, ela ainda não existirá na hora do carregamento.
   - Por isso, `mockUserRef` (linha 7) e `apiMocks` (linhas 9–19) são criados dentro de `vi.hoisted(...)`. Depois, `vi.mock('../../contexts/AuthContext', ...)` (linhas 21–29) e `vi.mock('../../services/api', ...)` (linha 31) substituem as dependências reais pelas versões controladas pelo teste.
2. **Ciclo de vida limpo (`beforeEach` / `afterEach`, linhas 85–99):**
   - `vi.clearAllMocks()` zera contadores e retornos pendentes dos mocks antes de cada `it`.
   - `cleanup()` desmonta o DOM renderizado ao fim de cada teste para que elementos de um teste não interfiram no próximo.
3. **`render` e `screen` (linhas 116–130 e 180–186):**
   - `render(<UsuariosAdminPage />)` monta o componente React e dispara seu `useEffect`.
   - Como `fetchUsers()` é assíncrono, o texto não aparece no exato instante do `render`. Por isso o teste usa `await screen.findByText('Administrador BenchOS')` (linha 118): **`findBy*`** espera até o elemento surgir na tela; **`getBy*`** (linha 119, 126) busca de forma síncrona quando já sabemos que o DOM foi atualizado.
   - `screen.getAllByRole('button', { name: /Desativar/i })` (linha 122) e `screen.getByLabelText(...)` (linhas 126–127) buscam elementos pela **acessibilidade** (mesma forma que um usuário ou leitor de tela enxerga), validando `disabled === true` na linha do admin e `false` na linha do colega.
4. **Simulação de interação e asserção assíncrona (`fireEvent` e `waitFor`, linhas 132–154 e 188–209):**
   - `fireEvent.click(...)` dispara cliques em botões (`Novo Funcionário`, `Salvar Funcionário`, `Novo Item`, `Adicionar Item`).
   - `fireEvent.change(input, { target: { value: '...' } })` preenche campos localizados por seu `<label>` (`getByLabelText`). *(Observação de mercado: em projetos reais também é comum usar `@testing-library/user-event`, que simula digitação tecla a tecla e foco de forma ainda mais próxima do usuário humano; aqui `fireEvent` atende de forma direta e rápida).*
   - `await waitFor(() => { expect(apiMocks.criarUsuario).toHaveBeenCalledWith(...) })` (linhas 145–152) reexecuta a checagem até a função assíncrona `handleCriarUsuario` chamar a API com o payload exato esperado, seguido de `await screen.findByText('Mariana Balcão')` (linha 154) confirmando que o novo item apareceu na tabela.

---

### 3.3. Script de produção local `iniciar.sh` e Teste Unitário vs. Teste E2E

#### Passo a passo do [`iniciar.sh`](file:///home/dzati/sistema-triagem/iniciar.sh)
1. **`set -e` e `SCRIPT_DIR` (linhas 2 e 5–7):**
   - `set -e` faz o script parar imediatamente se algum comando falhar (evita subir o backend sem banco, por exemplo).
   - `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` resolve o diretório real onde o `iniciar.sh` mora. Assim o operador da loja pode rodar `/home/dzati/sistema-triagem/iniciar.sh` de qualquer pasta sem quebrar os caminhos `BACKEND_DIR` e `FRONTEND_DIR`.
2. **Checagem preventiva do Docker (linhas 13–22):**
   - Primeiro checa se o comando existe (`command -v docker`), depois se o daemon está rodando e acessível pelo usuário (`docker info`). Se falhar, imprime o comando exato de correção para Pop!_OS/Ubuntu (`usermod -aG docker`).
3. **Garantia do `.env` (linhas 24–35):**
   - Se `backend/.env` não existir, copia automaticamente de `backend/.env.example` ou da raiz `.env.example`, evitando crash imediato do `env.ts` (validação Zod) na primeira execução.
4. **Subida do Postgres e espera ativa com `pg_isready` (linhas 37–54):**
   - `docker compose up -d` retorna assim que o container é criado, mas o PostgreSQL dentro dele ainda leva alguns segundos para aceitar conexões TCP/SQL.
   - O loop de até 30 segundos executa `docker compose exec -T postgres pg_isready -U benchos -d benchos`. Só quando o banco responde saudável o script avança para o Prisma.
5. **`npx prisma migrate deploy` vs. `npx prisma migrate dev` (linhas 56–59):**
   - **`prisma migrate deploy`** (usado na linha 58): apenas aplica migrations já criadas e commitadas no projeto, sem pedir prompts interativos e sem gerar arquivos novos. É o comando correto para **produção/loja**.
   - **`prisma migrate dev`**: comando de desenvolvimento que compara `schema.prisma` com o banco, cria novas migrations e pode apagar/resetar dados se houver divergência de histórico. Nunca deve ser colocado em script de inicialização da loja!
   - Na linha 59, `npx prisma db seed` garante o usuário administrador inicial e as categorias/itens padrão sem duplicá-los (seed idempotente).
6. **Subida conjunta, limpeza de portas e `trap` (linhas 61–106):**
   - Linhas 62–67: procura processos presos nas portas `3000` e `3001` (`lsof -ti :"$port"`) e os encerra antes de subir novos servidores.
   - Linhas 86 e 91: inicia backend (`npm run dev &`) e frontend (`npm run dev -- --host 0.0.0.0 &`) em segundo plano, salvando seus PIDs em `BACKEND_PID` e `FRONTEND_PID`. O `--host 0.0.0.0` (junto ao `vite.config.ts`) permite acesso por outros computadores da loja usando o `LOCAL_IP` obtido na linha 94 (`hostname -I`).
   - Linhas 72–83: `trap cleanup EXIT INT TERM` registra a função `cleanup` para rodar automaticamente quando o operador pressionar `Ctrl+C` (`INT`), fechar a janela (`EXIT`) ou encerrar o processo (`TERM`), matando os dois servidores Node com `kill` para não deixar portas ocupadas em segundo plano.

#### Teste Unitário com Mock vs. Teste E2E Real no Banco
| Aspecto | Teste Unitário com Mock (`adminPages.test.tsx`) | Teste E2E Real no Banco (Step 3 do [`task-10-brief.md`](file:///home/dzati/sistema-triagem/.superpowers/sdd/2026-11-25-benchos-reestruturacao/task-10-brief.md#L24-L37)) |
| :--- | :--- | :--- |
| **O que usa** | Vitest + DOM simulado + `vi.mock` no `api.ts` | Docker + PostgreSQL 16 + migrations + seed + servidor HTTP real + `curl` |
| **Velocidade** | Milissegundos | Segundos a dezenas de segundos |
| **O que prova** | Lógica de UI, estados React, botões desabilitados, envio do payload esperado | Contrato real HTTP/JSON, validação Zod, JWT/RBAC, serial salvo em maiúsculas, reincidência, transições de status (`iniciar` -> `progresso` -> `concluir`) e trilha de auditoria (`recebidoPor`, `analiseIniciadaPor`, `concluidoPor`) gravada no Postgres |
| **Ponto cego** | Não detecta se uma rota do backend mudou ou se uma query Prisma quebrar | Mais lento e suja o banco, exigindo limpeza/reset (`npx prisma migrate reset --force`) ao final |

---

## 4. O que absorver para o mercado + Checklist final (Tasks 1 a 10)

### 4 conceitos muito cobrados em entrevistas presentes nesta tarefa
1. **Estado derivado vs. estado duplicado no React (`useMemo`):** calcular totais (`resumo`) e listas ordenadas (`itensOrdenados`) com `useMemo` em vez de manter múltiplos `useState` sincronizados manualmente.
2. **Defesa em profundidade (UI + API):** desabilitar auto-desativação no frontend para evitar erro humano, mantendo a mesma trava obrigatória no backend para impedir chamadas diretas via `curl`/Insomnia.
3. **Testes baseados em acessibilidade e isolamento (`Testing Library` + `vi.mock`):** consultar elementos por `getByRole` / `getByLabelText` em vez de classes CSS frágeis, e saber a fronteira entre teste unitário mockado e validação E2E com banco real.
4. **Automação segura de banco em produção (`pg_isready` + `prisma migrate deploy`):** entender por que scripts de subida precisam esperar o banco ficar saudável e por que `migrate deploy` (e não `migrate dev`) é o padrão de deploy seguro.

---

### Checklist final de aprendizado: como o BenchOS (Tasks 1 a 10) se conecta

Use esta visão panorâmica e a ordem de revisão abaixo para consolidar o projeto inteiro e explicá-lo com segurança em entrevistas técnicas:

1. **Fundação, Banco e Ambiente (`task-01.md` e `task-02.md`):**
   - Docker Compose com PostgreSQL 16, validação de `.env` com Zod, `schema.prisma` (User, Cliente, Categoria, ItemChecklist, Triagem, TriagemResposta), migrations e seed idempotente.
2. **Segurança, Autenticação e Equipe (`task-03.md` e `task-04.md`):**
   - Arquitetura **Monólito Modular** (`routes -> controller -> service -> repository -> schema`), `AppError` + `errorHandler`, login fechado com bcrypt + JWT, middlewares de autenticação e RBAC (`ADMIN` vs `FUNCIONARIO`) e trava contra auto-bloqueio no backend.
3. **Domínio da Assistência Técnica (`task-05.md` e `task-06.md`):**
   - CRUD de clientes e categorias com `comoTestar`, normalização de serial/MAC em maiúsculas, detecção de reincidência por serial, status de selo/lacre, salvamento parcial de progresso e conclusão transacional no PostgreSQL registrando quem recebeu, quem iniciou na bancada e quem concluiu.
4. **Frontend SPA, Proxy de Rede Local e Fluxo Operacional (`task-07.md`, `task-08.md` e `task-09.md`):**
   - Cliente HTTP relativo `/api` + proxy do Vite (`0.0.0.0:3000 -> 127.0.0.1:3001`) permitindo acesso de qualquer PC na LAN sem `localhost` hardcoded, `AuthContext`, `ProtectedRoute`, dashboard, abertura/edição de OS, checklist guiado na bancada e prontuário técnico/WhatsApp.
5. **Fechamento Administrativo e Operação na Loja (`task-10.md` — esta tarefa):**
   - Ordem recomendada de leitura dos arquivos desta task:
     1. [`README.md`](file:///home/dzati/sistema-triagem/README.md) (visão geral da arquitetura e fluxo de operação).
     2. [`iniciar.sh`](file:///home/dzati/sistema-triagem/iniciar.sh) (como toda a stack sobe junta com segurança).
     3. [`frontend/src/features/admin/UsuariosAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/UsuariosAdminPage.tsx) (CRUD de tabela simples + proteção contra auto-bloqueio).
     4. [`frontend/src/features/admin/ChecklistsAdminPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/ChecklistsAdminPage.tsx) (layout mestre-detalhe + limpeza de estados transitórios).
     5. [`frontend/src/features/admin/adminPages.test.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/admin/adminPages.test.tsx) (como provar automaticamente que as duas telas funcionam).

> **Dica final de entrevista:** ao apresentar o BenchOS, explique primeiro o **problema real** (padronizar triagem técnica na loja com auditoria por funcionário, selo, reincidência por serial e acesso em rede local), depois o **desenho técnico** (Monólito Modular Express + Prisma + PostgreSQL em Docker + React SPA via proxy `/api`) e cite **exemplos concretos** que você domina — como o bloqueio duplo (UI + API) de auto-desativação do admin, a diferença entre `migrate deploy` e `migrate dev` e o equilíbrio entre testes unitários com `vi.mock` e validação E2E no PostgreSQL.
