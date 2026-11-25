# Guia de Estudo — Task 8: Dashboard de Triagens, Recebimento com Selo, Reincidência e Edição Aberta

> **Contexto no BenchOS:** Esta tarefa constrói a interface principal da recepção e da fila da bancada (`/triagens`), conectando o frontend aos endpoints de triagens, reincidência por serial, clientes e categorias preparados na Task 7.

---

## 1. O que foi construído aqui (em linguagem simples)

No dia a dia da assistência técnica, quando um equipamento chega ao balcão, a equipe precisa resolver quatro problemas práticos rapidamente:

1. **Enxergar a fila da bancada sem bagunça:** saber quantas Ordens de Serviço (OS) estão aguardando análise, quantas já estão na bancada e quais já têm laudo pronto — além de poder buscar por número de série/MAC, modelo, cliente ou `#OS` sem travar a tela a cada tecla digitada.
2. **Registrar o estado do selo de garantia da loja na entrada:** antes mesmo de abrir o equipamento, é obrigatório marcar se o selo está **Íntegro**, **Violado** ou **Sem Selo** (com observação opcional), evitando discussões futuras sobre garantia.
3. **Detectar reincidência na hora da digitação:** ao digitar manualmente o número de série ou endereço MAC da etiqueta, o sistema consulta o histórico automaticamente para avisar se aquele mesmo equipamento já deu entrada antes.
4. **Editar ou cancelar OS abertas com segurança:** enquanto a triagem ainda está `PENDENTE` ou `EM_ANALISE`, é possível corrigir dados ou cancelar logicamente a OS. Se a OS já estiver `EM_ANALISE` e o usuário trocar a categoria do equipamento, o sistema exige confirmação explícita porque o checklist da bancada pode ter respostas parciais da categoria anterior que serão apagadas.

---

## 2. Mapa da arquitetura e arquivos

A Task 8 adota uma organização por **feature** dentro de `frontend/src/features/triagens/`, separando lógica pura, pequenos componentes visuais reutilizáveis, modal de formulário e página principal (e substituindo os componentes antigos `StatusBadge.tsx` e `NovaTriagemModal.tsx` listados em `task-8-brief.md`):

```text
frontend/src/features/triagens/
├── triagemHelpers.ts                 # Funções puras de formatação, normalização e regras visuais
├── triagemHelpers.test.ts            # Testes unitários rápidos com Vitest para os helpers
├── TriagensDashboardPage.tsx         # Página principal: métricas, filtros, busca, tabela e ações
└── components/
    ├── StatusBadge.tsx               # Etiqueta visual de status da OS ou diagnóstico final
    ├── SeloBadge.tsx                 # Etiqueta visual da condição do selo (com observação opcional)
    └── NovaOuEditarTriagemModal.tsx  # Modal único para criar, editar, cadastrar cliente rápido e cancelar OS
```

### Como os arquivos conversam entre si

```text
TriagensDashboardPage.tsx
  ├── busca dados da API (fetchTriagens, fetchCategorias, fetchClientes)
  ├── usa triagemHelpers.ts (formatarDataHora, isTriagemAberta)
  ├── renderiza em cada linha da tabela:
  │     ├── SeloBadge.tsx    ──► usa triagemHelpers.ts (formatarStatusSelo)
  │     └── StatusBadge.tsx  ──► usa triagemHelpers.ts (formatarStatusTriagem, formatarDiagnosticoFinal)
  └── abre quando solicitado:
        └── NovaOuEditarTriagemModal.tsx
              ├── consome fetchReincidenciaSerial, criarTriagem, editarTriagem, cancelarTriagem, criarCliente
              ├── usa triagemHelpers.ts (normalizarSerialInput, precisaConfirmarTrocaCategoria, etc.)
              └── avisa o pai via callbacks (onSaved, onCanceled, onClienteCreated, onClose)
```

- **Por que um único `NovaOuEditarTriagemModal.tsx`?** Criar e editar uma triagem compartilham praticamente os mesmos campos, validações e consulta de reincidência. Controlar o modo via prop `triagemEdicao?: Triagem | null` (`isEditMode = Boolean(triagemEdicao)`) evita duplicar quase 500 linhas de formulário.
- **Por que `StatusBadge.tsx` e `SeloBadge.tsx` ficam separados?** Porque serão reutilizados também fora da tabela principal (por exemplo, na visualização de histórico/laudo), mantendo a mesma cor, ícone e texto em todo o BenchOS.

---

## 3. Raio-X das funções e blocos principais

### 3.1. Funções puras fora do React e testes no Vitest (`triagemHelpers.ts` e `triagemHelpers.test.ts`)

**Por que extrair para `triagemHelpers.ts`?**  
Uma **função pura** depende apenas dos parâmetros que recebe e sempre devolve o mesmo resultado, sem acessar estado de componente (`useState`), DOM ou rede. Quando colocamos regras de texto e decisão dentro do JSX dos componentes, testar exige montar o React inteiro em um navegador simulado. Extraindo essas regras para um arquivo `.ts` comum:
- múltiplos componentes (`StatusBadge`, `SeloBadge`, `NovaOuEditarTriagemModal`, `TriagensDashboardPage`) compartilham exatamente a mesma regra;
- os testes rodam em milissegundos no Vitest sem precisar renderizar componentes.

Principais blocos em `frontend/src/features/triagens/triagemHelpers.ts`:

- **Dicionários tipados com `Record<UnionType, string>`** (`triagemHelpers.ts:3-27`): `STATUS_SELO_LABELS`, `STATUS_SELO_DESCRICOES`, `STATUS_TRIAGEM_LABELS` e `DIAGNOSTICO_FINAL_LABELS`. Usar `Record<StatusSelo, string>` faz o TypeScript garantir em tempo de compilação que nenhum valor do tipo foi esquecido.
- **`normalizarSerialInput(raw: string)`** (`triagemHelpers.ts:32-34`): recebe o texto digitado pelo usuário, remove espaços nas pontas (`.trim()`) e converte para maiúsculas (`.toUpperCase()`), garantindo consistência tanto para exibir quanto para enviar à API.
- **`formatarStatusSelo`, `formatarStatusTriagem`, `formatarDiagnosticoFinal`** (`triagemHelpers.ts:36-46`): recebem o código interno (`'PENDENTE'`, `'ENCAMINHAR_ESPECIALISTA'`, etc.) e devolvem o rótulo em português para a interface.
- **`precisaConfirmarTrocaCategoria(status, originalCategoriaId, novaCategoriaId)`** (`triagemHelpers.ts:51-61`):
  - **Entra:** status atual da triagem, id da categoria original e id da categoria selecionada.
  - **Faz:** retorna `true` apenas quando `status === 'EM_ANALISE'`, existe `originalCategoriaId != null` e `novaCategoriaId !== originalCategoriaId`.
  - **Sai:** booleano indicando se o modal deve exibir a caixa de confirmação de limpeza do checklist.
- **`isTriagemAberta(status)`** (`triagemHelpers.ts:63-65`): retorna `true` apenas para `'PENDENTE'` ou `'EM_ANALISE'`, centralizando quem pode ser editado ou cancelado.
- **`formatarDataHora(iso)`** (`triagemHelpers.ts:67-79`): protege contra valores nulos ou datas inválidas (`Number.isNaN(date.getTime())`) e formata com `Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })`.

**Como o Vitest testa diretamente (`frontend/src/features/triagens/triagemHelpers.test.ts:1-67`):**  
O arquivo importa `describe`, `expect` e `it` do `'vitest'` (`triagemHelpers.test.ts:1`) e chama cada função passando entradas variadas:
- Em `normalizarSerialInput` (`triagemHelpers.test.ts:12-18`), testa espaços nas pontas, letras minúsculas, formato MAC (`'  aa:bb:cc:11:22:33  '`) e string vazia `''`.
- Em `formatarStatusSelo`, `formatarStatusTriagem` e `formatarDiagnosticoFinal` (`triagemHelpers.test.ts:20-46`), verifica todos os valores possíveis de cada enum/union.
- Em `precisaConfirmarTrocaCategoria` (`triagemHelpers.test.ts:48-57`), testa o caminho positivo (`'EM_ANALISE', 1, 2 -> true`) e casos de borda (`mesma categoria`, `'PENDENTE'`, `'CONCLUIDA'`, `'CANCELADA'` e `originalCategoriaId` igual a `null`).
- Em `isTriagemAberta` (`triagemHelpers.test.ts:59-66`), valida os 4 status possíveis.

---

### 3.2. Badges visuais (`StatusBadge.tsx` e `SeloBadge.tsx`)

- **`StatusBadge`** (`frontend/src/features/triagens/components/StatusBadge.tsx:41-88`):
  - **Entra:** `status` (`StatusTriagem`) e `diagnosticoFinal` opcional.
  - **Faz:** se `status === 'CONCLUIDA'` e existe `diagnosticoFinal` (`StatusBadge.tsx:42-53`), busca cor e ícone no mapa `DIAGNOSTICO_STYLE` (`StatusBadge.tsx:19-39`) e exibe o diagnóstico final (ex.: `Defeito de Fábrica`, `Encaminhar ao Especialista`). Caso contrário, segue ramos específicos para `'EM_ANALISE'` (`StatusBadge.tsx:55-62`), `'CONCLUIDA'` sem diagnóstico (`StatusBadge.tsx:64-71`), `'CANCELADA'` (`StatusBadge.tsx:73-80`) e o fallback `'PENDENTE'` (`StatusBadge.tsx:82-87`).
- **`SeloBadge`** (`frontend/src/features/triagens/components/SeloBadge.tsx:30-55`):
  - **Entra:** `statusSelo`, `observacaoSelo` e `showObservacao` (padrão `false`).
  - **Faz:** consulta `SELO_STYLE[statusSelo]` (`SeloBadge.tsx:12-28`) para escolher ícone e classes Tailwind, limpa espaços da observação (`observacaoSelo?.trim()` em `SeloBadge.tsx:37`) e usa o atributo nativo `title` (`SeloBadge.tsx:42`) para mostrar a observação no hover mesmo quando `showObservacao` for falso. Se `showObservacao && obs` for verdadeiro (`SeloBadge.tsx:48-52`), exibe o texto truncado logo abaixo do selo.

---

### 3.3. Modal de Recebimento, Reincidência e Edição (`NovaOuEditarTriagemModal.tsx`)

#### A) Inicialização de estado ao abrir o modal (`NovaOuEditarTriagemModal.tsx:119-157`)
Quando `isOpen` ou `triagemEdicao` mudam, o `useEffect` limpa erros, confirmações e resultados anteriores de reincidência (`NovaOuEditarTriagemModal.tsx:124-134`). Se `triagemEdicao` existir, preenche os campos com os dados da OS aberta (`NovaOuEditarTriagemModal.tsx:136-145`); caso contrário, zera tudo para uma nova entrada (`NovaOuEditarTriagemModal.tsx:146-156`).  
Também há um `useMemo` em `categoriasDisponiveis` (`NovaOuEditarTriagemModal.tsx:111-117`) que filtra apenas categorias ativas, mas mantém a categoria da OS sendo editada na lista caso ela tenha sido inativada depois da criação.

#### B) Busca de reincidência por Serial: debounce, `onBlur` e proteção contra *race condition*
Esse é um dos trechos mais ricos do modal (`NovaOuEditarTriagemModal.tsx:108-109`, `159-210` e `231-237`):

1. **Debounce com `setTimeout` e `clearTimeout` (`NovaOuEditarTriagemModal.tsx:191-210`):**
   - Sempre que `numeroSerieMac` muda com o modal aberto, o `useEffect` normaliza o texto (`normalizarSerialInput(numeroSerieMac)`).
   - Se tiver menos de 3 caracteres (`normalizado.length < 3`, linha `197`), limpa `reincidencias` e `ultimoSerialConsultadoRef.current`, evitando requisições inúteis para 1 ou 2 letras.
   - Se tiver 3 ou mais caracteres, agenda `consultarReincidencia` para daqui a **350 ms** com `window.setTimeout` (`NovaOuEditarTriagemModal.tsx:203-205`).
   - A função de limpeza (`return () => window.clearTimeout(timer)` nas linhas `207-209`) cancela o timer anterior toda vez que o usuário digita outra tecla antes dos 350 ms. Assim, a API só é chamada quando há uma pequena pausa na digitação.

2. **Confirmação imediata no `onBlur` (`NovaOuEditarTriagemModal.tsx:231-237` e `647`):**
   - Ao sair do campo de serial (`onBlur={handleSerialBlur}`), a função normaliza o texto diretamente no input (se houver diferença) e chama `consultarReincidencia(normalizado, true)` com `force = true`.
   - O parâmetro `force` (`NovaOuEditarTriagemModal.tsx:159`, `167`) garante que, mesmo se o usuário colou/editou rápido e saiu do campo antes dos 350 ms, a consulta ocorra sem esperar. Quando `force` é `false` (caso do debounce), a linha `167` evita refazer a mesma requisição se `ultimoSerialConsultadoRef.current === normalizado`.

3. **Contador de requisição com `useRef` contra *race condition* visual (`NovaOuEditarTriagemModal.tsx:108`, `172-188`):**
   - **O problema:** imagine que a requisição A (`"4K0"`) sai primeiro e demora 800 ms, enquanto a requisição B (`"4K08A"`) sai depois e responde em 100 ms. Sem controle, a resposta atrasada de A sobrescreveria na tela o resultado mais novo de B (isso é uma *race condition* de rede/UI).
   - **A solução em `consultarReincidencia`:**
     - `serialReqCounterRef` guarda um número que sobrevive entre renderizações sem causar re-render (`useRef(0)` na linha `108`).
     - Antes de chamar `fetchReincidenciaSerial`, faz `const reqId = ++serialReqCounterRef.current` (`NovaOuEditarTriagemModal.tsx:172`), capturando o número desta tentativa na variável local `reqId`.
     - Quando a Promise resolve no `try`, rejeita no `catch` ou finaliza no `finally`, o código só atualiza `setReincidencias` e `setBuscandoReincidencia(false)` se `serialReqCounterRef.current === reqId` (`NovaOuEditarTriagemModal.tsx:177`, `181`, `185`). Se outra consulta mais recente já tiver incrementado o contador, a resposta antiga é descartada silenciosamente.

#### C) Tratamento de troca de categoria e erro `409 CHECKLIST_CONFIRM_CLEAR_REQUIRED`
O modal trata essa regra em duas camadas (prevenção no cliente + fallback do servidor):

1. **Detecção antecipada (`NovaOuEditarTriagemModal.tsx:216-228`):** calcula `trocaCategoriaEmAnalise` usando `precisaConfirmarTrocaCategoria(...)` e combina com `exigirConfirmacao409` em `const exigeConfirmacaoLimpeza = trocaCategoriaEmAnalise || exigirConfirmacao409`. Quando verdadeiro, renderiza o alerta amarelo com checkbox de confirmação (`NovaOuEditarTriagemModal.tsx:603-627`).
2. **Envio no `handleSubmit` (`NovaOuEditarTriagemModal.tsx:302-326`):**
   - Se `exigeConfirmacaoLimpeza` for `true` e o checkbox `confirmarLimparChecklist` não estiver marcado, barra o envio já no frontend (`NovaOuEditarTriagemModal.tsx:302-307`).
   - Quando confirmado, inclui `{ limparRespostasAnteriores: true }` no payload de `editarTriagem` (`NovaOuEditarTriagemModal.tsx:322-324`).
3. **Captura do erro 409 vindo do backend (`NovaOuEditarTriagemModal.tsx:341-353`):**
   - Caso a OS tenha mudado para `EM_ANALISE` no servidor enquanto o modal estava aberto (por exemplo, outro técnico iniciou os testes em outra aba), o backend responde HTTP `409` com código `'CHECKLIST_CONFIRM_CLEAR_REQUIRED'`.
   - O `catch` verifica `err instanceof ApiError && err.status === 409 && err.code === 'CHECKLIST_CONFIRM_CLEAR_REQUIRED'` (`NovaOuEditarTriagemModal.tsx:342-346`), ativa `setExigirConfirmacao409(true)`, reseta o checkbox (`setConfirmarLimparChecklist(false)`) e exibe `err.message`. Assim o alerta com o checkbox aparece na hora para o usuário confirmar e reenviar.

#### D) Cadastro rápido de cliente e cancelamento em dois passos
- **Cadastro rápido inline (`handleCriarClienteInline`, `NovaOuEditarTriagemModal.tsx:239-267`):** permite cadastrar um cliente novo sem fechar o modal nem perder o que já foi digitado na triagem. Após `criarCliente`, notifica o componente pai (`onClienteCreated?.(novoCliente)`) e já seleciona o novo cliente (`setClienteId(String(novoCliente.id))`).
- **Cancelamento em dois cliques (`NovaOuEditarTriagemModal.tsx:358-374` e `803-839`):** no modo edição, clicar em `Cancelar OS` troca o botão por uma confirmação inline (`Confirmar` / `Voltar`), evitando cancelamentos acidentais antes de chamar `cancelarTriagem(triagemEdicao.id)`.

---

### 3.4. Dashboard principal (`TriagensDashboardPage.tsx`)

#### A) Estados e filtros (`TriagensDashboardPage.tsx:43-68`)
- **`buscaInput` vs `buscaAplicada` (`TriagensDashboardPage.tsx:47-48` e `63-68`):** `buscaInput` atualiza instantaneamente a cada tecla para o `<input>` não travar, enquanto um `useEffect` com debounce de **300 ms** copia o valor `.trim()` para `buscaAplicada`. Quem dispara a requisição à API é `buscaAplicada`, não `buscaInput`.
- **`statusFiltro` e `mostrarCanceladas` (`TriagensDashboardPage.tsx:49-50` e `165-173`):** `statusFiltro` aceita `'TODAS_ATIVAS' | StatusTriagem`. Em `handleToggleCanceladas`, se o usuário ocultar as canceladas enquanto estava vendo a aba `'CANCELADA'`, o filtro volta automaticamente para `'TODAS_ATIVAS'` (`TriagensDashboardPage.tsx:168-170`) para não deixar a tabela vazia por acidente.

#### B) Carregamento assíncrono com `useCallback` + `useEffect` (`TriagensDashboardPage.tsx:70-104`)
- **`carregarTriagens` (`TriagensDashboardPage.tsx:70-84`):** memorizada com `useCallback` dependendo de `[buscaAplicada, mostrarCanceladas, statusFiltro]`. Busca `fetchTriagens` passando `busca` e `incluirCanceladas: mostrarCanceladas || statusFiltro === 'CANCELADA'`, atualiza `carregando` e `erro` com bloco `try / catch / finally`.
- **`carregarCatalogos` (`TriagensDashboardPage.tsx:86-96`):** memorizada com `useCallback([])`, carrega categorias e clientes em paralelo com `Promise.all([fetchCategorias(), fetchClientes()])` — mais rápido do que fazer um `await` após o outro.
- **Disparo inicial e reativo (`TriagensDashboardPage.tsx:98-104`):** dois `useEffect`s chamam `carregarCatalogos` (uma vez na montagem) e `carregarTriagens` (na montagem e sempre que seus filtros de consulta mudarem). Além disso, `handleTriagemSalva` e `handleTriagemCancelada` (`TriagensDashboardPage.tsx:147-157`) rechamam `carregarTriagens()` para manter lista e métricas sincronizadas após mutações.

#### C) Métricas derivadas e lista filtrada com `useMemo` (`TriagensDashboardPage.tsx:106-135`)
Em vez de guardar contadores separados em `useState` (o que poderia dessincronizar quando uma triagem é criada, editada ou cancelada), o componente **deriva** os números diretamente do array `triagens`:
- **`metricas` (`TriagensDashboardPage.tsx:106-126`):** percorre `triagens` uma única vez contando `pendentes`, `emAnalise`, `concluidas` e `canceladas`, e calcula `totalAtivas: pendentes + emAnalise`.
- **`triagensVisiveis` (`TriagensDashboardPage.tsx:128-135`):** filtra `triagens` no cliente conforme `statusFiltro` e `mostrarCanceladas`, sem precisar fazer nova requisição HTTP ao alternar entre as abas `Todas ativas`, `Pendentes`, `Em Análise` e `Concluídas`.

#### D) Renderização condicional de ações por status (`TriagensDashboardPage.tsx:399` e `485-542`)
Para cada linha da tabela, o componente verifica `const aberta = isTriagemAberta(triagem.status)` (`TriagensDashboardPage.tsx:399`) e exibe botões diferentes conforme o ciclo de vida da OS:
- `triagem.status === 'PENDENTE'` (`487-496`): botão **`Iniciar Teste`**.
- `triagem.status === 'EM_ANALISE'` (`498-507`): botão **`Continuar Teste`**.
- `aberta` (`PENDENTE` ou `EM_ANALISE`, linhas `509-518`): botão **`Editar`** (abre `NovaOuEditarTriagemModal` preenchido).
- `triagem.status === 'CONCLUIDA'` (`520-529`): botão **`Ver Laudo`**.
- `triagem.status === 'CANCELADA'` (`531-540`): botão **`Ver Resumo`** (e a linha ganha `opacity-70` na linha `404`).

*(Nota: os estados `triagemBancadaSelecionada` e `triagemResumoSelecionada` nas linhas `60-61` e `175-187` já deixam os ganchos preparados para os modais da Task 9.)*

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas presentes nesta tarefa

1. **Separação entre lógica pura e camada de UI (Testabilidade):** saber tirar transformações, formatações e regras de negócio simples dos componentes React para arquivos puros (`.ts`) e testá-los rapidamente com Vitest (`describe`/`it`/`expect`).
2. **Debounce + Prevenção de *Race Condition* em buscas assíncronas:** usar `setTimeout`/`clearTimeout` dentro do `useEffect` para não bombardear a API a cada tecla, combinado com controle de versão de requisição (`useRef` incremental) para garantir que uma resposta de rede lenta e antiga nunca sobrescreva uma resposta mais recente na tela.
3. **Estado derivado vs estado duplicado (`useMemo`):** evitar criar vários `useState` para métricas ou listas filtradas que podem ser calculadas a partir de uma única fonte da verdade (`triagens`).
4. **Sincronização de regras entre Frontend e Backend (Erro HTTP `409`):** validar previamente no formulário quando possível (`precisaConfirmarTrocaCategoria`), mas também tratar o código de conflito do servidor (`ApiError` com `status === 409` e `code`) para lidar com mudanças concorrentes sem quebrar a experiência do usuário.

### Ordem recomendada de leitura para estudar

1. **`frontend/src/features/triagens/triagemHelpers.ts`** — comece pelas regras puras e tipos usados por toda a feature.
2. **`frontend/src/features/triagens/triagemHelpers.test.ts`** — veja como cada helper é validado de forma isolada no Vitest.
3. **`frontend/src/features/triagens/components/SeloBadge.tsx`** e **`StatusBadge.tsx`** — componentes pequenos de apresentação que consomem os helpers.
4. **`frontend/src/features/triagens/components/NovaOuEditarTriagemModal.tsx`** — foque primeiro nos hooks (`useRef`, `useEffect` de reset e `useEffect` de debounce), depois em `consultarReincidencia`, `handleSubmit` e no `catch` do erro `409`.
5. **`frontend/src/features/triagens/TriagensDashboardPage.tsx`** — feche o ciclo entendendo como a página orquestra carregamento (`useCallback` + `useEffect`), deriva dados (`useMemo`) e conecta os badges e o modal.
