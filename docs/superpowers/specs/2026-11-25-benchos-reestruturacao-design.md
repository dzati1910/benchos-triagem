# Spec de Design — Reestruturação do BenchOS (Sistema de Triagem Técnica)

**Data:** 2026-11-25  
**Escopo:** Projeto completo (reestruturação arquitetural e evolução funcional)  
**Local do projeto:** `/home/dzati/sistema-triagem`  
**Status:** Aprovado pelo usuário em 2026-11-25 — Pronto para planejamento (`writing-plans`)

---

## 1. Intenção e Porquê

### Problema de negócio (Filial da Distribuidora)
A empresa atua como distribuidora de equipamentos de segurança eletrônica (com foco prático em **HDs**, **câmeras Hikvision e HiLook**, **gravadores DVR/NVR Hikvision e HiLook** e **controles de acesso AGL**) distribuídos por várias filiais. Hoje, quase todo o conhecimento de testes está concentrado em uma única pessoa em outra filial. Na filial do usuário:
- Apenas HDs são testados localmente, colocando-os em um DVR de testes — método rápido para detectar discos mortos, mas **não confiável** para identificar *bad blocks*, degradação de **S.M.A.R.T.**, falhas intermitentes ou consumo inadequado de fonte.
- A verificação de elegibilidade de garantia é feita exclusivamente pela presença e integridade do **selo da loja** no produto (sem exigência de nota fiscal). Como os clientes da loja são fixos, recusas por falta de garantia são raras, e análises mais complexas (como investigar queima elétrica ou mau uso) continuam sendo encaminhadas ao técnico especialista da outra filial — o foco local é **fazer testes diretos confiáveis nos equipamentos**.
- Como o volume de testes da filial é pequeno e o mesmo funcionário que testa também atende/vende no balcão, ele precisa conseguir pausar e retomar um teste sem perder anotações, e outro colega precisa conseguir concluir quando necessário, mantendo rastro claro de quem recebeu, quem iniciou e quem concluiu.

### Objetivo duplo do projeto
1. **Valor operacional real:** Focar no **recebimento** e no **laudo técnico** da filial local (sem controle multi-filial), transformando o conhecimento técnico em **roteiros guiados na tela** para capacitar a equipe da filial a testar com segurança e explicar o diagnóstico ao cliente.
2. **Valor de aprendizado e portfólio:** Elevar o protótipo inicial (SQLite + controllers acoplados, sem Git e sem testes) para uma arquitetura de nível de mercado em TypeScript, PostgreSQL em Docker, Prisma ORM, validação Zod, autenticação JWT controlada, testes automatizados e repositório Git estruturado — incluindo aprendizado prático de instalação e uso do Docker no Pop!_OS 24.04.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
- **Repositório Git estruturado:** Inicializar Git no projeto com `.gitignore` adequado e estrutura limpa por camadas, substituindo o banco SQLite anterior.
- **Banco de mercado com Docker:** Rodar PostgreSQL localmente via Docker Compose (`docker-compose.yml`), gerenciado com Prisma ORM, migrations versionadas e seed inicial realista.
- **Recebimento focado e validação de selo:** Registrar entrada manual de Serial/MAC (sem leitor USB), conferência obrigatória do **Selo da Loja** (`INTEGRO`, `VIOLADO`, `SEM_SELO`), defeito reclamado, acessórios, cliente e vínculo automático ao funcionário logado que recebeu.
- **Alerta de reincidência por Serial/MAC:** Ao digitar/consultar um Serial/MAC na entrada, avisar automaticamente se já existem triagens anteriores para o mesmo equipamento.
- **Bancada guiada ("escola na bancada") com salvamento parcial:** Checklists específicos por categoria real da loja (**HD**, **Câmera Hikvision/HiLook**, **Gravador Hikvision/HiLook**, **Controle de Acesso AGL**) focados em **testes diretos no equipamento**, contendo instrução curta de *como testar* em cada item, observação/medição por item (ex.: saúde S.M.A.R.T. e horas de uso em HDs) e **salvamento parcial do progresso** para que o funcionário possa atender vendas no balcão e retomar depois (ou outro colega possa concluir).
- **Resumo para o Cliente:** Ao concluir o laudo, disponibilizar resumo legível e claro para o balcão explicar ao cliente (com opção de copiar texto formatado para WhatsApp e versão simples de impressão).
- **Login controlado sem auto-cadastro + auditoria de equipe pequena:** Acesso fechado a funcionários cadastrados por um administrador (`ADMIN` e `FUNCIONARIO`), com sessão persistida no navegador para reduzir atrito e registro separado de quem recebeu, quem iniciou a análise e quem concluiu (além de edição/cancelamento lógico entre colegas para OS ainda em aberto).
- **Gestão administrativa de checklists:** Permitir que usuários `ADMIN` criem, editem, reordenem e desativem categorias e itens/instruções de checklist pela interface.
- **Qualidade e funcionamento em rede local (LAN):** Validação de schemas com Zod, tratamento consistente de erros HTTP, testes automatizados com Vitest + Supertest no backend e acesso transparente de outros PCs da filial pela rede local sem URL `localhost` fixa no frontend.

### Não-Objetivos (Explicitamente fora do escopo)
- Controle ou rastreamento de múltiplas filiais, transferências entre filiais ou seleção de filial.
- Análises eletrônicas/forenses complexas de queima ou perícia aprofundada de mau uso (ficam fora da bancada local; casos suspeitos apenas recebem encaminhamento no diagnóstico para o especialista da outra filial).
- Suporte específico ou integração com leitores USB de código de barras.
- Controle pós-laudo de retirada no balcão, baixa/troca de estoque no ERP ou rastreamento de RMA enviado ao fabricante.
- Rota ou formulário público de auto-cadastro de usuários.
- Dependência de banco em nuvem ou acesso obrigatório à internet para a filial operar.

### Anti-Objetivos
- Código monolítico sem camadas, sem validação ou sem testes (perderia o objetivo de aprendizado/portfólio).
- Burocracia excessiva na tela que torne o registro lento para um volume pequeno de atendimentos.
- Bloquear o registro de entrada quando o selo está violado ou ausente (a loja precisa registrar a recusa/evidência mesmo assim).
- Teste de HD genérico sem campo explícito para evidências de S.M.A.R.T. / horas ligadas / setores defeituosos.
- Quebrar o acesso de outro computador da filial por referenciar `localhost` no código do cliente HTTP.

---

## 3. Restrições e Contexto Técnico Atual

- **Ambiente verificado da máquina de desenvolvimento:** Pop!_OS 24.04 LTS, Node.js `v24.21.0`, `npm 11.19.0`, `git 2.43.0`. Docker, `psql` e `mysql` **ainda não estão instalados** — a preparação do ambiente inclui ensinar e executar a instalação do Docker Engine + Docker Compose plugin.
- **Execução na loja:** Rede local (LAN) da filial, sem depender de nuvem externa.
- **Código existente em `/home/dzati/sistema-triagem`:** Protótipo inicial em React + Vite + Tailwind CSS + Express + TypeScript + `better-sqlite3` (`triagem.db`). A base visual Tailwind/React serve de referência estética (tema escuro técnico), mas backend, modelo de dados, tipos e componentes serão reestruturados para a nova arquitetura e novo banco.

---

## 4. Abordagens Consideradas

Antes da definição final, alternativas inadequadas foram descartadas: manter SQLite (não atende ao objetivo de banco padrão de mercado), usar NoSQL/MongoDB (os dados de triagem, selos, checklists e usuários são essencialmente relacionais) e reescrever em frameworks pesados/monólitos como NestJS ou Next.js (aumentaria complexidade acidental antes de consolidar fundamentos de Node/Express/React).

Restaram três abordagens reais:

1. **Abordagem 1 (Escolhida): Express em Camadas + PostgreSQL via Docker Compose + Prisma ORM + Zod + JWT + Vitest + React/Vite**
   - *Como funciona:* O PostgreSQL sobe via `docker-compose.yml`; o backend segue camadas claras (`routes -> controllers -> services -> repositories/prisma`), valida entradas com Zod, protege rotas com JWT (`ADMIN` / `FUNCIONARIO`) e versiona tabelas com Prisma Migrations.
   - *Ganhos:* Stack altamente alinhada ao mercado TypeScript/Fullstack, ambiente reproduzível via Git + Docker em qualquer máquina e aprendizado prático de Docker e migrations.
   - *Contrapartidas:* Exige instalar Docker na máquina atual e no servidor da loja; o Prisma abstrai parte do SQL manual cotidiano.
2. **Abordagem 2: Express em Camadas + PostgreSQL Nativo (`apt`/instalador) + Driver `pg` ou Drizzle ORM**
   - *Ganhos:* Menor consumo de RAM em hardware antigo por dispensar Docker; contato direto com SQL puro de PostgreSQL.
   - *Contrapartidas:* Configuração manual de servidor, usuários e migrations em cada computador; menor portabilidade no portfólio.
3. **Abordagem 3: Express + PostgreSQL gerenciado em Nuvem (Neon/Supabase)**
   - *Ganhos:* Dispensa instalação local de banco ou Docker.
   - *Contrapartidas:* Torna a bancada da loja refém da internet e remove o aprendizado de infraestrutura local.

**Escolha do usuário:** Abordagem 1, combinada com guia prático de instalação e uso do Docker no ambiente atual.

---

## 5. Especificação Funcional e Arquitetural

### 5.1 Modelo de Dados (PostgreSQL / Prisma)

1. **`User`**
   - `id` (Int, PK), `nome` (String), `email` (String unique), `senhaHash` (String), `role` (`ADMIN | FUNCIONARIO`), `ativo` (Boolean, default `true`), `criadoEm`, `atualizadoEm`.
2. **`Cliente`**
   - `id` (Int, PK), `nome` (String), `telefone` (String?), `documento` (String?), `criadoEm`.
3. **`Categoria`**
   - `id` (Int, PK), `nome` (String unique), `icone` (String), `instrucaoGeral` (String?), `ativo` (Boolean, default `true`).
4. **`ItemChecklist`**
   - `id` (Int, PK), `categoriaId` (FK `Categoria`), `descricao` (String), `comoTestar` (String), `ordem` (Int), `ativo` (Boolean, default `true`).
5. **`Triagem`**
   - `id` (Int, PK) — número da OS
   - `clienteId` (FK `Cliente`), `categoriaId` (FK `Categoria`)
   - **Trilha de responsáveis (auditoria de equipe):**
     - `recebidoPorId` (FK `User`) — obrigatório, preenchido pelo usuário autenticado na criação
     - `analiseIniciadaPorId` (FK `User`?) — preenchido quando o primeiro funcionário inicia o teste (`PENDENTE -> EM_ANALISE`) e preservado mesmo se outro colega continuar
     - `concluidoPorId` (FK `User`?) — preenchido com quem concluiu o laudo (`CONCLUIDA`)
     - `canceladoPorId` (FK `User`?) — preenchido em caso de cancelamento lógico (`CANCELADA`)
     - `ultimaAtualizacaoPorId` (FK `User`?) — registra o último funcionário que editou dados ou salvou progresso parcial
   - `modelo` (String), `fabricante` (String), `numeroSerieMac` (String — indexado, salvo sempre normalizado em `trim().toUpperCase()`)
   - `statusSelo` (`INTEGRO | VIOLADO | SEM_SELO`), `observacaoSelo` (String?)
   - `defeitoReclamado` (String), `acessoriosInclusos` (String?)
   - `status` (`PENDENTE | EM_ANALISE | CONCLUIDA | CANCELADA`)
   - `diagnosticoFinal` (`OPERACIONAL | DEFEITO_FABRICA | ENCAMINHAR_ESPECIALISTA | SEM_GARANTIA`?)
   - `parecerTecnico` (String?), `resumoCliente` (String?) — servem também como rascunho em `EM_ANALISE` antes da conclusão
   - `criadoEm`, `analiseIniciadaEm`?, `concluidoEm`?, `canceladoEm`?, `atualizadoEm`
6. **`TriagemResposta`**
   - `id` (Int, PK), `triagemId` (FK `Triagem`, cascade delete), `itemChecklistId` (FK `ItemChecklist`)
   - `resultado` (`PENDENTE | APROVADO | REPROVADO | NAO_TESTADO`) — permite salvar progresso parcial (`PENDENTE`) ou registrar itens não executados (`NAO_TESTADO`) em encerramento excepcional sem garantia
   - `observacao` (String?), `respondidoPorId` (FK `User`? — opcional para saber quem preencheu/alterou aquele item específico), `atualizadoEm`
   - Restrição única `(triagemId, itemChecklistId)` para impedir respostas duplicadas para o mesmo item em uma triagem.

### 5.2 Regras de Negócio Principais

- **Controle de Acesso Fechado e Correções em Equipe Pequena:**
  - Não existe tela nem endpoint público de cadastro de contas.
  - Seed inicial cria um usuário `ADMIN` usando variáveis do `.env` (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`), de forma idempotente.
  - Usuários autenticados (`ADMIN` ou `FUNCIONARIO`) podem consultar, criar clientes/triagens, iniciar análise, salvar progresso parcial, assumir/concluir laudos iniciados por outro colega, editar dados de entrada de OS ainda abertas e cancelar logicamente (`CANCELADA`) OS ainda não concluídas (por exemplo, erro de digitação ou duplicidade).
  - *Regra de integridade de edição:* enquanto a OS está `PENDENTE`, pode editar todos os campos da entrada (inclusive `categoriaId`); em `EM_ANALISE`, se `categoriaId` for alterada após já existirem respostas parciais, o sistema exige confirmação ou limpa as respostas anteriores na mesma transação para não misturar checklists de categorias diferentes.
  - Apenas `ADMIN` pode gerenciar usuários (criar, ativar/desativar, redefinir senha — impedindo desativar a si mesmo), gerenciar categorias/itens de checklist e reabrir excepcionalmente uma OS já `CONCLUIDA`.
  - Sessão via JWT com expiração estendida (ex.: `7d` configurável via `.env`) para evitar logins repetitivos na bancada de fluxo pequeno, validada ao abrir a aplicação via `GET /api/auth/me`.
- **Verificação do Selo da Loja na Entrada:**
  - Campo obrigatório no recebimento (`INTEGRO`, `VIOLADO`, `SEM_SELO`), com observação opcional. Toda entrada nasce sempre como `PENDENTE` na fila da bancada (sem fluxo separado de encerramento no modal de recebimento).
  - Como a loja atende clientes fixos, o registro nunca é bloqueado por conta do selo. Se `VIOLADO` ou `SEM_SELO`, a ficha exibe alerta visual discreto e, caso não seja testado, permite concluir diretamente pela bancada como `SEM_GARANTIA` (marcando os itens restantes como `NAO_TESTADO`).
- **Foco em Testes Diretos e Encaminhamento para Especialista:**
  - O foco da bancada local são testes funcionais diretos (`OPERACIONAL` quando aprovado; `DEFEITO_FABRICA` quando falha diretamente no teste funcional).
  - Quando houver suspeita de dano complexo, queima elétrica ou dúvida que exija avaliação do técnico especialista da outra filial, o funcionário conclui localmente com o diagnóstico `ENCAMINHAR_ESPECIALISTA` e registra as observações iniciais no parecer.
- **Reincidência de Serial/MAC:**
  - Digitação manual simples (sem UI de leitor de código de barras).
  - Ao consultar `GET /api/triagens/reincidencia?serial=...` (acionado ao digitar/sair do campo de serial no formulário de entrada), retorna triagens anteriores **não canceladas** (`status != 'CANCELADA'`) com o mesmo `numeroSerieMac` normalizado, permitindo alertar na tela que o item já passou pela bancada (com data, diagnóstico e resumo anterior).
- **Ciclo de Vida, Salvamento Parcial e Auditoria de Passagem de Bastão:**
  - **Recebimento (`POST /api/triagens`):** nasce em `PENDENTE`, gravando `recebidoPorId = req.user.id`.
  - **Início da análise (`PATCH /api/triagens/:id/iniciar`):** ao abrir a bancada pela primeira vez, muda `PENDENTE -> EM_ANALISE`, gravando `analiseIniciadaPorId = req.user.id` e `analiseIniciadaEm`. Se já estiver em `EM_ANALISE`, preserva `analiseIniciadaPorId` original e carrega as respostas parciais salvas.
  - **Salvamento parcial (`PATCH /api/triagens/:id/progresso`):** permitido para qualquer funcionário autenticado enquanto `status === 'EM_ANALISE'` (ou iniciando de `PENDENTE` dentro da mesma operação), salvando em transação as respostas marcadas até o momento (`APROVADO`, `REPROVADO` ou `PENDENTE`), observações por item (com `respondidoPorId`), rascunho de `diagnosticoFinal`/`parecerTecnico` e `ultimaAtualizacaoPorId = req.user.id`.
  - **Conclusão (`PATCH /api/triagens/:id/concluir`):** permitido para qualquer funcionário autenticado enquanto `PENDENTE` ou `EM_ANALISE`, executando transação ACID (`prisma.$transaction`) que persiste todas as respostas finais (exigindo que nenhum item fique `PENDENTE` — salvo se `diagnosticoFinal === 'SEM_GARANTIA'`, quando itens não avaliados podem ser gravados como `NAO_TESTADO`), atualiza `status = 'CONCLUIDA'`, `diagnosticoFinal`, `parecerTecnico`, `resumoCliente`, `concluidoPorId = req.user.id` e `concluidoEm`.
  - **Edição/Cancelamento aberto (`PATCH /api/triagens/:id` e `PATCH /api/triagens/:id/cancelar`):** permitido para qualquer funcionário enquanto `status` for `PENDENTE` ou `EM_ANALISE`. Cancelamento muda `status = 'CANCELADA'`, grava `canceladoPorId` e `canceladoEm`, removendo a OS dos contadores ativos e da busca de reincidência sem apagar o histórico do banco.
  - **Reabertura excepcional (`PATCH /api/triagens/:id/reabrir`):** exclusiva de `ADMIN` para devolver uma OS `CONCLUIDA` para `EM_ANALISE` em caso de erro de lançamento, registrando `ultimaAtualizacaoPorId`.
- **Decisões Técnicas Padronizadas pelo Arquiteto (Builder Calls):**
  - *Enum `ResultadoItemChecklist` (`PENDENTE | APROVADO | REPROVADO | NAO_TESTADO`):* adotado em vez de booleano rígido para suportar salvamento parcial no meio do atendimento de balcão e fechamento excepcional como `SEM_GARANTIA` sem forçar falso positivo/negativo nos testes.
  - *Cancelamento lógico (`CANCELADA`) em vez de `DELETE`:* mantém rastreabilidade de quem criou e cancelou em equipe pequena e evita falsos alertas de reincidência de serial.
  - *Imutabilidade de laudos `CONCLUIDA` para `FUNCIONARIO`:* colegas podem corrigir livremente OS em aberto (`PENDENTE`/`EM_ANALISE`), mas após concluído o laudo final só um `ADMIN` pode reabrir para preservação de histórico.
  - *Troca de categoria em `EM_ANALISE`:* ao alterar categoria de uma OS já com respostas parciais salvas, as respostas da categoria antiga são descartadas na transação mediante confirmação na interface para evitar inconsistência no checklist.
- **Seed Realista de Checklists (Roteiros "Escola na Bancada"):**
  1. **HD (Disco Rígido CFTV):**
     - Inspeção física de placa/conectores SATA e selo da loja (*como testar*: verificar oxidação nos pinos dourados, cheiro de queimado e integridade do selo).
     - Reconhecimento e ruído mecânico na partida (*como testar*: ligar em dock USB-SATA ou DVR de teste e observar se o disco gira sem estalos/cliques anormais).
     - Leitura S.M.A.R.T. no PC de bancada (*como testar*: abrir CrystalDiskInfo/smartctl e anotar na observação: Saúde Saudável/Alerta/Crítico, Horas Ligadas e Setores Pendentes/Realocados).
     - Teste prático de formatação e gravação (*como testar*: formatar e gravar trecho de vídeo ou teste de leitura/escrita por pelo menos 10 min sem travamento).
  2. **Câmera Hikvision / HiLook:**
     - Inspeção física, lacre/selo e cabo/conectores (*como testar*: conferir integridade do cabo P4/BNC/RJ45, ausência de infiltração/umidade na lente e selo da loja).
     - Alimentação elétrica 12V / PoE e infravermelho (*como testar*: alimentar com fonte estabilizada 12V 1A/2A ou switch PoE de bancada; cobrir sensor frontal e verificar se LEDs IR acendem).
     - Vídeo e foco em bancada (*como testar*: conectar no DVR/monitor ou localizar via SADP/navegador se IP; checar imagem limpa sem listras ou tela preta).
     - Corte dia/noite (ICR) e Reset físico (*como testar*: alternar claro/escuro ouvindo estalo do filtro IR; testar botão de reset físico quando aplicável).
  3. **Gravador DVR / NVR Hikvision / HiLook:**
     - Inspeção física e fonte de alimentação (*como testar*: checar conectores traseiros/oxidação, selo da loja e testar preferencialmente com fonte 12V conhecida de bancada).
     - Inicialização e saída de vídeo (*como testar*: ligar com monitor HDMI/VGA conectado e confirmar bip único de boot e tela inicial sem reinicializações).
     - Porta SATA e reconhecimento de HD de bancada (*como testar*: plugar HD de teste, verificar se reconhece capacidade corretamente e inicia gravação).
     - Canais de vídeo e portas de rede/PoE (*como testar*: conectar câmera de teste nos canais BNC ou portas PoE do NVR e testar link Ethernet/Hik-Connect).
     - Ventoinha e aquecimento (*como testar*: verificar giro silencioso do cooler e temperatura estável após 10 minutos ligado).
  4. **Controle de Acesso AGL:**
     - Inspeção física, bornes e selo da loja (*como testar*: checar oxidação nos bornes de ligação, trilhas queimadas por ligação errada e integridade do selo).
     - Alimentação 12V controlada na bancada (*como testar*: alimentar com fonte 12V protegida/multímetro, observando consumo e LEDs indicadores sem aquecimento anormal).
     - Leitura de credencial (TAG RFID / biometria / senha) (*como testar*: aproximar TAG ou digitar senha padrão de teste e confirmar reconhecimento sonoro/visual).
     - Acionamento de saída de relé / fechadura e botoeira (*como testar*: testar contato NA/NF/COM com fechadura de bancada ou multímetro em continuidade ao acionar abertura e botoeira).
     - Reset de fábrica / programação padrão (*como testar*: validar procedimento de reset de fábrica conforme modelo AGL).
- **Resumo para o Cliente:**
  - Ao concluir o checklist, o sistema pré-monta um `resumoCliente` claro com sugestão automática baseada no `diagnosticoFinal` e nos itens marcados, editável pelo técnico antes de salvar (ex.: informando de maneira educada se o produto está OK, recomendando checar fonte/cabo na instalação, ou explicando a falha constatada / perda de garantia pelo selo).
  - Na tela de detalhes do laudo, disponibiliza um cartão visual **"Resumo para Atendimento ao Cliente"** com botão **"Copiar texto (WhatsApp)"** e **"Imprimir Resumo"** (`window.print()` com CSS `@media print` limpo).

### 5.3 Arquitetura Backend e Frontend

- **Backend (`/home/dzati/sistema-triagem/backend` — Monólito Modular em Camadas):**
  - `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
  - `src/config/env.ts` (validação das variáveis `.env` na inicialização com Zod) e `src/lib/prisma.ts` (cliente Prisma singleton)
  - `src/shared/errors/AppError.ts` (erros de domínio tipados com status HTTP)
  - `src/shared/middlewares/` (`auth.ts` com validação Bearer JWT + `requireRole`, e `errorHandler.ts` para erros Zod, `AppError` e erros inesperados)
  - `src/modules/` — um módulo isolado por domínio (`auth`, `users`, `clientes`, `categorias`, `triagens`), contendo dentro de cada módulo:
    - `*.schema.ts` (contratos de entrada com Zod)
    - `*.repository.ts` (consultas e transações Prisma/PostgreSQL)
    - `*.service.ts` (regras de negócio puras, validações de estado e auditoria)
    - `*.controller.ts` (recebe `req`/`res`, chama `service` e devolve resposta HTTP)
    - `*.routes.ts` (definição de endpoints e middlewares do módulo)
  - `src/app.ts` (instância Express exportada sem `listen` para permitir testes com Supertest) e `src/server.ts` (inicialização HTTP em `0.0.0.0:3001`)
  - Testes automatizados com **Vitest + Supertest** (`*.test.ts`) cobrindo `services`/regras de negócio (normalização de serial, cálculo/sugestão de diagnóstico, regras de selo, passagem de bastão e transições de status) e testes de integração de rotas/auth.
  - *Caminho limpo para escala futura (sem overengineering agora — YAGNI):* o isolamento por módulos e `services`/`repositories` permite adicionar futuramente um módulo `filiais` e filtrar consultas por `filialId` (via JWT) caso o sistema passe a atender múltiplas filiais em um servidor central.

- **Frontend (`/home/dzati/sistema-triagem/frontend` — SPA por Features com React Router):**
  - `src/services/api.ts` (cliente HTTP usando caminho relativo `/api` com proxy configurado no `vite.config.ts` para o backend — e suporte a deploy em rede local sem URL `localhost` hardcoded — anexando `Authorization: Bearer <token>` e tratando sessão expirada `401`)
  - `src/contexts/AuthContext.tsx` (sessão persistida, validação via `GET /api/auth/me`, papel `ADMIN` / `FUNCIONARIO` e logout)
  - `src/routes/` (`react-router-dom` com `ProtectedRoute` e guarda de `ADMIN`):
    - `/login` — tela de autenticação
    - `/triagens` — dashboard principal de recebimento e bancada
    - `/admin/usuarios` — gestão de funcionários (somente `ADMIN`)
    - `/admin/checklists` — gestão de categorias e roteiros de teste (somente `ADMIN`)
  - `src/features/` organizadas por domínio:
    - `features/auth/` (LoginPage)
    - `features/triagens/` (TriagensDashboardPage, NovaOuEditarTriagemModal com alerta de reincidência por Serial digitado, BancadaChecklistModal com salvamento parcial e "como testar", ProntuarioResumoModal com cópia para WhatsApp e impressão, `StatusBadge`)
    - `features/admin/` (UsuariosAdminPage, ChecklistsAdminPage)
  - `src/components/` para elementos estruturais/compartilhados de interface (Navbar/Layout autenticado, componentes base).

- **Infraestrutura & Git (`/home/dzati/sistema-triagem`):**
  - `docker-compose.yml` subindo PostgreSQL 16 (porta `5432`, volume persistente local e healthcheck).
  - `.env.example` documentado na raiz/backend e `.gitignore` protegendo `.env`, `node_modules`, `dist` e dados temporários.
  - Script `./iniciar.sh` atualizado para verificar container Postgres rodando, rodar migrations se necessário e iniciar backend + frontend para acesso na LAN.

---

## 6. O Que Fica para Quem Vai Planejar e Construir

- Definir o passo a passo exato de instalação do Docker Engine + Compose no Pop!_OS 24.04 dentro do plano de implementação e validar com o usuário no terminal.
- Decidir a divisão exata entre testes unitários de service (com mock do Prisma) e testes de integração HTTP (Supertest contra `app.ts` com banco/harness de teste).
- Definir o layout detalhado e os componentes internos da área administrativa (`ADMIN`) e do estilo `@media print` do resumo de laudo.
- Decidir se, em ambiente de produção local na loja, o backend Express também servirá o build estático do frontend (`dist/`) na mesma porta ou manterá script unificado com Vite preview/dev + proxy.
- Organizar a sequência didática de commits Git por marcos lógicos durante a execução do plano para maximizar o aprendizado do usuário.
