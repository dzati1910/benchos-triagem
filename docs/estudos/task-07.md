# Guia de Estudos — Task 7: Infraestrutura Frontend (Rotas, Proxy LAN, `AuthContext` e Login)

## 1. O que foi construído aqui (em linguagem simples)

Nas etapas anteriores do **BenchOS**, o backend passou a exigir autenticação com token JWT e controle de acesso por papel (`ADMIN` ou `FUNCIONARIO`). Porém, o frontend ainda não tinha como:

1. Fazer o usuário digitar e-mail e senha em uma tela de login e guardar essa sessão no navegador.
2. Enviar o token automaticamente em toda chamada para a API e reagir caso o token expire ou seja invalidado.
3. Impedir que alguém sem login acesse telas internas, ou que um `FUNCIONARIO` entre em rotas exclusivas de `ADMIN`.
4. Funcionar quando outro computador ou celular da bancada (na mesma rede local / LAN) acessa o sistema pelo IP da máquina servidora.

A **Task 7** resolve exatamente essa fundação do frontend em React + TypeScript: configura o proxy do Vite para a rede local, centraliza as requisições HTTP em um cliente único (`apiFetch`), cria o gerenciamento global de autenticação (`AuthContext`), protege as páginas com `react-router-dom` (`ProtectedRoute` + `Layout`) e entrega a `LoginPage` funcional.

---

## 2. Mapa da arquitetura e arquivos

Nesta etapa, os arquivos principais trabalham em camadas bem definidas:

```text
Navegador (React)
  ├── App.tsx                  -> Define o roteamento geral (BrowserRouter + Routes)
  ├── contexts/AuthContext.tsx -> Guarda usuário logado, token, loading, login() e logout()
  ├── routes/ProtectedRoute.tsx-> Porteiro das rotas: exige login e, opcionalmente, role
  ├── components/Layout.tsx    -> Casca visual (navbar + menu por role) envolvendo <Outlet />
  ├── features/auth/LoginPage.tsx -> Formulário de login e redirecionamento pós-autenticação
  ├── services/api.ts          -> Cliente HTTP (apiFetch), token no localStorage e erro tipado
  └── types/index.ts           -> Contratos TypeScript espelhados do backend (DTOs e enums)

Servidor de desenvolvimento / preview (Node/Vite)
  └── vite.config.ts           -> Recebe chamadas em /api e repassa para http://127.0.0.1:3001
```

Por que cada arquivo existe:

- [`frontend/vite.config.ts`](file:///home/dzati/sistema-triagem/frontend/vite.config.ts): configura o servidor do Vite na porta `3000` com `host: '0.0.0.0'` (aceitando conexões da rede local) e ativa o proxy `/api` tanto no modo de desenvolvimento (`server.proxy`) quanto no modo de build servido localmente (`preview.proxy`).
- [`frontend/src/types/index.ts`](file:///home/dzati/sistema-triagem/frontend/src/types/index.ts): reúne todos os tipos e interfaces que o frontend espera receber da API (`PublicUser`, `Role`, `Triagem`, `LoginResponse`, `MeResponse`, etc.).
- [`frontend/src/services/api.ts`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts): centraliza chamadas `fetch` usando caminhos relativos (`/api/...`), injeta o header `Authorization`, padroniza erros com `ApiError` e aciona o callback de sessão expirada quando recebe HTTP `401`.
- [`frontend/src/contexts/AuthContext.tsx`](file:///home/dzati/sistema-triagem/frontend/src/contexts/AuthContext.tsx): cria o estado global de autenticação via React Context e expõe o hook `useAuth()` para qualquer componente da árvore React.
- [`frontend/src/routes/ProtectedRoute.tsx`](file:///home/dzati/sistema-triagem/frontend/src/routes/ProtectedRoute.tsx): componente de guarda de rota que decide entre mostrar tela de carregamento, redirecionar para `/login`, barrar por papel (`roles`) ou liberar a rota filha.
- [`frontend/src/components/Layout.tsx`](file:///home/dzati/sistema-triagem/frontend/src/components/Layout.tsx): barra superior fixa com identificação da bancada, links de navegação condicionais (`Equipe` e `Checklists` só para `ADMIN`), nome/cargo do usuário e botão **Sair**.
- [`frontend/src/features/auth/LoginPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/auth/LoginPage.tsx): tela de entrada do funcionário, com tratamento de erro, estado de envio (`submitting`) e retorno automático à rota de origem após login.
- [`frontend/src/App.tsx`](file:///home/dzati/sistema-triagem/frontend/src/App.tsx): conecta `BrowserRouter`, `AuthProvider`, `ProtectedRoute`, `Layout`, `LoginPage` e as rotas `/triagens`, `/admin/usuarios` e `/admin/checklists` (ainda com `PlaceholderPage` temporário nesta task, conforme descrito em [`task-7-brief.md`](file:///home/dzati/sistema-triagem/.superpowers/sdd/2026-11-25-benchos-reestruturacao/task-7-brief.md#L51)).

---

## 3. Raio-X das funções e blocos principais

### 3.1 Proxy LAN com `API_BASE = '/api'` e `vite.config.ts`

Quando um técnico abre o BenchOS a partir de outro computador na rede local (por exemplo, acessando `http://192.168.1.50:3000`), o código JavaScript roda **no navegador desse outro computador**.

Se o frontend fizesse `fetch('http://localhost:3001/api/triagens')`, o navegador do técnico tentaria falar com a porta `3001` **do próprio computador do técnico** — onde não existe backend rodando — e a requisição falharia.

A solução aplicada na Task 7 tem duas metades:

1. **No navegador** ([`frontend/src/services/api.ts:3`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts#L3) e [`frontend/src/services/api.ts:54`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts#L54)):
   - Define `export const API_BASE = '/api';` (caminho relativo, sem domínio nem porta).
   - O navegador envia a requisição para a **mesma origem** de onde carregou a página (ex.: `http://192.168.1.50:3000/api/auth/login`).
2. **No Vite** ([`frontend/vite.config.ts:4-22`](file:///home/dzati/sistema-triagem/frontend/vite.config.ts#L4-L22)):
   - O objeto `apiProxy` intercepta tudo que começa com `'/api'` e encaminha internamente para `target: 'http://127.0.0.1:3001'` com `changeOrigin: true`.
   - Ele é aplicado tanto em `server.proxy` (usado no `npm run dev`) quanto em `preview.proxy` (usado no `npm run preview` após o build), ambos com `host: '0.0.0.0'` para aceitar conexões de outros equipamentos da rede.
   - Resultado: quem fala com `127.0.0.1:3001` é o processo do Vite rodando no servidor da bancada, nunca o navegador cliente. De quebra, evita problemas de CORS porque, para o navegador, frontend e API estão no mesmo host e porta.

---

### 3.2 Cliente HTTP centralizado: `apiFetch`, `ApiError` e interceptação de `401`

Em [`frontend/src/services/api.ts`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts), em vez de cada tela chamar `fetch` manualmente e repetir headers e tratamento de erro, tudo passa por `apiFetch<T>` (linhas `38-80`):

- **Entrada:** recebe `path: string` (ex.: `'/auth/me'`) e `options: RequestInit = {}` (método, body, headers extras).
- **Normalização e headers automáticos (linhas `42-52`):**
  - Garante barra inicial em `normalizedPath` (`path.startsWith('/') ? path : `/${path}``).
  - Cria um objeto `new Headers(options.headers)`.
  - Lê o token salvo no `localStorage` via `getAuthToken()` (`benchos_token`, linha `4` e linhas `22-24`). Se existir token e o caller não tiver definido manualmente o header `Authorization`, injeta `Authorization: Bearer ${token}` (linhas `46-48`).
  - Se `options.body` for uma `string` (como no `JSON.stringify(...)`) e `Content-Type` não estiver presente, adiciona `Content-Type: application/json` (linhas `50-52`).
- **Disparo da requisição (linhas `54-57`):**
  - Executa `await fetch(`${API_BASE}${normalizedPath}`, { ...options, headers })`.
- **Interceptação global de sessão expirada (`401`) (linhas `59-61`):**
  - Se `res.status === 401` **e** o caminho não começar com `'/auth/login'`, chama `unauthorizedHandler?.()`.
  - Por que excluir `/auth/login`? Porque um `401` na tela de login significa "e-mail ou senha inválidos", e não "sessão que já existia expirou". Sem essa condição, errar a senha acionaria o handler de logout sem necessidade.
  - O handler é conectado pelo `AuthContext` por meio de `registerUnauthorizedHandler(cb)` (linhas `34-36`), evitando acoplamento circular entre `api.ts` (camada de rede) e `AuthContext.tsx` (camada React).
- **Parsing de erros com `ApiError` (linhas `10-20` e `63-73`):**
  - A classe `ApiError` estende `Error` nativo do JavaScript e adiciona `status: number` e `code?: string`.
  - Quando `!res.ok`, `apiFetch` tenta ler o JSON de resposta (`res.json().catch(() => null)` — o `.catch` protege caso o servidor devolva resposta vazia ou não-JSON).
  - Se `payload.error` for uma string não vazia, usa essa mensagem do backend; caso contrário, usa o fallback `` `Erro na requisição (${res.status})` ``. Lança `throw new ApiError(message, res.status, code)`.
- **Retorno tipado (linhas `75-79`):**
  - Se `res.status === 204` (No Content), retorna `undefined as T` sem tentar chamar `res.json()` (que falharia em corpo vazio).
  - Caso contrário, retorna `res.json() as Promise<T>`.
- **Funções prontas de autenticação (linhas `82-91`):**
  - `loginRequest(email, senha)` envia `POST /api/auth/login` e retorna `Promise<LoginResponse>`.
  - `fetchMeRequest()` envia `GET /api/auth/me` e retorna `Promise<MeResponse>`.

---

### 3.3 `AuthContext`, `useAuth` e o uso da flag `cancelled`

O arquivo [`frontend/src/contexts/AuthContext.tsx`](file:///home/dzati/sistema-triagem/frontend/src/contexts/AuthContext.tsx) usa **React Context** para compartilhar o estado de autenticação com toda a aplicação sem precisar passar props manualmente de componente em componente.

1. **Criação do contexto (`linha 20`):**
   - `const AuthContext = createContext<AuthContextValue | undefined>(undefined);`
   - Começa como `undefined` para que o hook `useAuth()` consiga detectar se alguém tentou usá-lo fora do `<AuthProvider>`.
2. **Estados iniciais do `AuthProvider` (`linhas 23-25`):**
   - `user`: começa `null` até o backend confirmar quem é o dono do token.
   - `token`: inicializado com função preguiçosa `() => getAuthToken()`, lendo do `localStorage` uma única vez na montagem.
   - `loading`: inicializado com `() => Boolean(getAuthToken())`. Se há token salvo, já começa `true` para segurar o render das rotas protegidas enquanto `/auth/me` valida a sessão.
3. **`logout` e registro no `api.ts` (`linhas 27-38`):**
   - `logout` é memorizado com `useCallback` para manter referência estável: remove o token do `localStorage` (`clearAuthToken()`) e zera `token` e `user`.
   - O primeiro `useEffect` (`linhas 33-38`) registra `logout` com `registerUnauthorizedHandler(logout)` e, na função de limpeza (cleanup), passa `null` ao desmontar. Assim, qualquer `401` em qualquer chamada do `apiFetch` derruba a sessão no estado React automaticamente.
4. **Revalidação da sessão ao abrir a página (`linhas 40-70`) e a flag `cancelled`:**
   - O segundo `useEffect` roda na montagem (`[]`). Se não houver `storedToken`, define `setLoading(false)` e encerra.
   - Se houver token, declara `let cancelled = false;` (`linha 47`) e chama `fetchMeRequest()`.
   - No retorno de montagem/desmontagem (`linhas 67-69`), define `cancelled = true`.
   - **Por que `cancelled` é tão importante?**
     - Em React (especialmente no `StrictMode` em desenvolvimento, que monta, desmonta e remonta componentes para achar efeitos colaterais, ou quando o usuário navega/fecha o provider antes da requisição terminar), uma `Promise` do `fetchMeRequest()` que já foi disparada pode resolver **depois** que aquele efeito já foi encerrado.
     - Sem a verificação `if (cancelled) return;` (linhas `51`, `56` e `62`), uma resposta antiga ou falha atrasada poderia chamar `setToken`, `setUser` ou `setLoading` de forma desatualizada e causar inconsistência de estado (race condition).
   - Se der sucesso e não estiver cancelado: grava `token` e `res.user`. Se falhar (ex.: token expirado ou usuário desativado): limpa o token do `localStorage` e zera `token` e `user`. No `.finally()`, desliga o `loading` se `!cancelled`.
5. **`login` e `Provider` (`linhas 72-83`):**
   - `login(email, senha)` chama `loginRequest`, salva o token no `localStorage` (`setAuthToken(res.token)`) e atualiza `token` e `user` no estado.
   - `<AuthContext.Provider value={{ user, token, loading, login, logout }}>` disponibiliza esses 5 itens para `{children}`.
6. **Hook `useAuth()` (`linhas 86-92`):**
   - Lê `useContext(AuthContext)`. Se `!ctx`, lança erro explícito (`'useAuth deve ser utilizado dentro de AuthProvider.'`), garantindo uso correto em tempo de desenvolvimento e evitando checagens de `undefined` nos componentes consumidores.

---

### 3.4 `ProtectedRoute`, `Layout` (`<Outlet />`), `LoginPage` e `App.tsx`

A proteção de rotas combina **React Context** com o **React Router (`react-router-dom`)** usando rotas aninhadas:

- **Estrutura em [`frontend/src/App.tsx:20-63`](file:///home/dzati/sistema-triagem/frontend/src/App.tsx#L20-L63):**
  - `<BrowserRouter>` habilita navegação por URL sem recarregar a página.
  - `<AuthProvider>` envolve todas as `<Routes>`.
  - `/login` é pública e renderiza `<LoginPage />` (linha `23`).
  - `<Route element={<ProtectedRoute />}>` (linha `25`) envolve todas as rotas internas:
    - Dentro dele, `<Route element={<Layout />}>` (linha `26`) aplica a barra superior para `/triagens` (linhas `27-35`) e para o grupo administrativo.
    - `<Route element={<ProtectedRoute roles={['ADMIN']} />}>` (linha `37`) envolve `/admin/usuarios` e `/admin/checklists`, aplicando uma segunda barreira apenas para administradores.
  - `<Route path="*" element={<Navigate to="/triagens" replace />} />` (linha `60`) redireciona qualquer URL desconhecida para `/triagens` (que, se o usuário não estiver logado, cairá no `ProtectedRoute` e irá para `/login`).

- **Como o [`ProtectedRoute.tsx`](file:///home/dzati/sistema-triagem/frontend/src/routes/ProtectedRoute.tsx#L12-L38) decide o acesso passo a passo:**
  1. Obtém `{ user, loading }` de `useAuth()` e `location` de `useLocation()` (linhas `13-14`).
  2. Se `loading` for `true` (linhas `16-27`): exibe o indicador `"Verificando sessão..."` em vez de redirecionar prematuramente antes de `/auth/me` responder.
  3. Se `!user` (linhas `29-31`): retorna `<Navigate to="/login" replace state={{ from: location }} />`. O `replace` evita sujar o histórico do botão Voltar, e `state={{ from: location }}` guarda a URL que o usuário tentou abrir.
  4. Se `roles` foi informado e `!roles.includes(user.role)` (linhas `33-35`): significa que o usuário está logado (ex.: é `FUNCIONARIO`), mas tentou acessar uma rota de `ADMIN`. Redireciona para `/triagens`.
  5. Se passou por todas as checagens (linha `37`): renderiza `children` (se passados diretamente) ou `<Outlet />` (que é onde o React Router encaixa a rota filha correspondente).

- **Como o [`Layout.tsx`](file:///home/dzati/sistema-triagem/frontend/src/components/Layout.tsx#L13-L93) usa `<Outlet />` e `user.role`:**
  - Calcula `const isAdmin = user?.role === 'ADMIN'` (linha `15`).
  - Na barra `<nav>` (linhas `39-57`), `<NavLink to="/triagens">` aparece para todos os usuários autenticados; `Equipe` (`/admin/usuarios`) e `Checklists` (`/admin/checklists`) só entram no JSX dentro de `{isAdmin && (...)}` (linhas `45-56`).
  - O helper `navLinkClass` (linhas `6-11`) recebe `{ isActive }` fornecido automaticamente pelo `NavLink` do `react-router-dom` para destacar a aba ativa.
  - Dentro do `<main>` (linhas `88-90`), `{children ?? <Outlet />}` renderiza o conteúdo da página filha abaixo do cabeçalho fixo.

- **Fluxo da [`LoginPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/auth/LoginPage.tsx#L6-L121):**
  - Lê `fromPath` de `location.state?.from?.pathname || '/triagens'` (linhas `10-11`) para devolver o técnico à página original após logar.
  - Se o usuário já estiver autenticado (`!loading && user`, linhas `18-20`), redireciona direto para `/triagens`.
  - No `handleSubmit` (linhas `22-35`): chama `e.preventDefault()` para não recarregar a página, limpa `erro`, marca `submitting = true`, chama `await login(email.trim(), senha)` e navega com `navigate(fromPath, { replace: true })`. Se `login` lançar erro (como um `ApiError`), exibe `err.message` no alerta visual (linhas `57-65`).

---

### 3.5 Por que `frontend/src/types/index.ts` espelha os contratos do backend

Em [`frontend/src/types/index.ts`](file:///home/dzati/sistema-triagem/frontend/src/types/index.ts), os tipos (`Role`, `StatusSelo`, `StatusTriagem`, `DiagnosticoFinal`, `ResultadoItemChecklist`) e interfaces (`PublicUser`, `Triagem`, `TriagemDetalheResponse`, `LoginResponse`, `MeResponse`) reproduzem exatamente o formato JSON que o backend entrega nas rotas.

Isso é essencial por três motivos práticos:
1. **Segurança em tempo de compilação:** se o backend retorna `PublicUser` sem senha e com `criadoEm: string` (porque datas trafegam em JSON como texto ISO, e não como objeto `Date`), o TypeScript avisa imediatamente se algum componente tentar acessar um campo inexistente (como `senhaHash`) ou um valor inválido para `Role`.
2. **Autocompletar confiável com `apiFetch<T>`:** quando `loginRequest` tipa `apiFetch<LoginResponse>` ([`api.ts:83`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts#L83)), o retorno `res` já nasce tipado com `res.token` e `res.user` (`PublicUser`).
3. **Alinhamento entre times/camadas:** evita divergências silenciosas entre nomes de campos do banco/DTO no backend e o código das telas React no frontend.

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas presentes nesta tarefa

1. **Proxy de desenvolvimento vs. URL relativa em APIs (`/api` + `vite.config.ts`):** saber explicar por que não fixar `http://localhost:3001` no código do navegador, como o proxy evita erros de rede em LAN/deploy e resolve problemas de CORS no ambiente local.
2. **Wrapper centralizado de `fetch` + interceptação de `401`:** criar uma camada única (`apiFetch`) que anexa `Authorization: Bearer <token>`, padroniza erros de negócio (`ApiError`) e desloga o usuário globalmente via callback quando a sessão expira, sem acoplar serviço HTTP diretamente a componentes React.
3. **Gerenciamento de sessão com React Context + Protected Routes aninhadas:** combinar `AuthProvider` + hook customizado (`useAuth`) + `ProtectedRoute` com `<Outlet />` e estado `loading` para evitar flashes de redirecionamento e implementar RBAC (controle de acesso baseado em papel: `ADMIN` vs `FUNCIONARIO`).
4. **Cleanup de efeitos assíncronos no `useEffect` (`cancelled`):** saber prevenir race conditions e atualizações de estado após desmontagem quando uma requisição HTTP assíncrona está em andamento.

### Ordem recomendada de leitura dos arquivos

Para estudar o fluxo de ponta a ponta sem se perder, abra os arquivos nesta sequência:

1. [`frontend/src/types/index.ts`](file:///home/dzati/sistema-triagem/frontend/src/types/index.ts) — entenda primeiro os formatos de dados (`Role`, `PublicUser`, `LoginResponse`, `MeResponse`).
2. [`frontend/vite.config.ts`](file:///home/dzati/sistema-triagem/frontend/vite.config.ts) — veja como `/api` sai da porta `3000` e chega à `3001` na rede local.
3. [`frontend/src/services/api.ts`](file:///home/dzati/sistema-triagem/frontend/src/services/api.ts) — acompanhe como `apiFetch` monta headers, trata erros com `ApiError` e dispara o callback de `401`.
4. [`frontend/src/contexts/AuthContext.tsx`](file:///home/dzati/sistema-triagem/frontend/src/contexts/AuthContext.tsx) — veja como `AuthProvider` conecta o `api.ts` ao estado React (`user`, `token`, `loading`, `login`, `logout`) e usa `cancelled`.
5. [`frontend/src/routes/ProtectedRoute.tsx`](file:///home/dzati/sistema-triagem/frontend/src/routes/ProtectedRoute.tsx) — entenda a lógica de guarda (`loading` -> `!user` -> `roles` -> `<Outlet />`).
6. [`frontend/src/components/Layout.tsx`](file:///home/dzati/sistema-triagem/frontend/src/components/Layout.tsx) — veja o menu condicional para `ADMIN` e onde as páginas filhas são injetadas via `<Outlet />`.
7. [`frontend/src/features/auth/LoginPage.tsx`](file:///home/dzati/sistema-triagem/frontend/src/features/auth/LoginPage.tsx) — observe o formulário controlado, tratamento de erro e retorno para `fromPath`.
8. [`frontend/src/App.tsx`](file:///home/dzati/sistema-triagem/frontend/src/App.tsx) — feche a visão vendo todas as peças encaixadas na árvore de rotas.
