# Guia de Estudos — Task 1: Docker, Git e PostgreSQL no BenchOS

## 1. O que foi construído aqui (em linguagem simples)

Antes de escrever qualquer tabela no banco de dados ou rota na API do BenchOS, precisamos preparar a "bancada de trabalho" onde o projeto vai rodar com segurança e previsibilidade.

Na prática, esta tarefa resolve três problemas do dia a dia de qualquer projeto profissional:

1. **Banco de dados isolado e padronizado (Docker + PostgreSQL):** em vez de instalar o PostgreSQL diretamente no seu sistema operacional (o que pode gerar conflito de versões entre projetos e sujeira na máquina), subimos o PostgreSQL 16 dentro de um **container Docker** configurado no arquivo `docker-compose.yml`. Qualquer pessoa do time que rodar `docker compose up -d` terá exatamente o mesmo banco no ar.
2. **Controle de versão sem vazar segredos (Git + `.gitignore` + `.env.example`):** inicializamos o repositório Git para registrar a história do código com segurança, garantindo que senhas reais (`.env` e `backend/.env`) e milhares de arquivos de dependências (`node_modules/`) **nunca** sejam enviados para o GitHub.
3. **Configuração de ambiente reproduzível:** criamos o modelo `.env.example`, que documenta quais variáveis de ambiente o projeto precisa para rodar sem expor credenciais de produção.

No **BenchOS**, esta Task 1 é o alicerce da camada de infraestrutura: é ela que coloca o PostgreSQL disponível em `localhost:5432` para que, nas próximas tarefas, o **Prisma ORM** e o **Backend Express** consigam criar tabelas e gravar os atendimentos de triagem.

---

## 2. Mapa da arquitetura e arquivos

Nesta tarefa não criamos código de aplicação (rotas ou telas React), e sim os arquivos da **base de infraestrutura e versionamento** na raiz do repositório (`/home/dzati/sistema-triagem/`):

```text
/home/dzati/sistema-triagem/
├── .gitignore                  # Lista do que o Git deve ignorar (segredos, builds, dependências)
├── .env.example                # Modelo seguro de variáveis de ambiente (vai para o Git)
├── backend/.env                # Credenciais reais locais (NÃO vai para o Git — ignorado pelo .gitignore)
├── docker-compose.yml          # Receita declarativa para subir o container do PostgreSQL
└── docs/superpowers/plans/...  # Plano técnico da reestruturação (inclui passos de setup do Docker)
```

### Como essas peças conversam entre si

```text
[docker-compose.yml]
   │  lê variáveis (se existir .env na raiz) ou usa valores padrão (:-benchos)
   ▼
[Container: benchos-postgres] ──(porta 5432:5432)──► localhost:5432
   │                                                      ▲
   └──(volume: benchos_pgdata)                            │ lê DATABASE_URL
       salva dados fora do container                      │
                                                    [Backend / Prisma]
                                                    (lê backend/.env)
```

### Git local vs. GitHub remoto e o papel da branch `feat/reestruturacao`

Um erro muito comum de quem está começando é achar que "Git" e "GitHub" são a mesma coisa:

- **Git (local):** é o programa instalado na sua máquina (`.git/` dentro do projeto). Ele grava o histórico de versões (*commits*) localmente no seu computador, funciona mesmo sem internet e permite criar linhas do tempo paralelas (*branches*).
- **GitHub (remoto):** é um serviço na nuvem que hospeda uma cópia do seu repositório Git para backup, colaboração em equipe, *Pull Requests* e revisão de código. Você trabalha no **Git local** (`git add`, `git commit`) e sincroniza com o **GitHub remoto** (`git push`, `git pull`).

**Por que usar uma branch de trabalho (`feat/reestruturacao`) em vez de commitar direto na `main`?**
- A branch `main` representa a versão principal e estável do projeto.
- Criar uma branch separada como `feat/reestruturacao` isola todo o trabalho em andamento: se algo quebrar no meio do caminho, a `main` continua intacta. Além disso, no mercado de trabalho, alterações entram na `main` após revisão (Pull Request) e testes passando.

---

## 3. Raio-X das funções e blocos principais

### A) Protegendo segredos e pastas pesadas — `.gitignore`

O arquivo `.gitignore` diz ao Git quais arquivos e pastas ele deve fingir que não existem na hora de rodar `git status` ou `git add`:

- **`.gitignore:1-4` (`node_modules/`, `dist/`, `coverage/`):**
  - `node_modules/` guarda todas as bibliotecas baixadas pelo `npm`. São milhares de arquivos pesados e facilmente recriados com `npm install` a partir do `package.json`. Subir isso para o Git deixa o repositório lento e gigante.
  - `dist/` (código compilado) e `coverage/` (relatórios de cobertura de testes) são artefatos gerados automaticamente — também não devem ser versionados.
- **`.gitignore:6-10` (`.env`, `backend/.env`, `*.db`, `postgres-data/`):**
  - `.env` e `backend/.env` guardam senhas de banco, chaves JWT (`JWT_SECRET`) e credenciais de administrador. **Regra de ouro:** segredos jamais entram no histórico do Git, pois mesmo que você apague depois em outro commit, a senha continua visível nos commits antigos.
  - `*.db` e `postgres-data/` evitam que arquivos binários de banco local sejam versionados junto com o código.
- **`.gitignore:12-18` (`.DS_Store`, `*.log`, `.worktrees/`, `.superpowers/`):**
  - Ignora arquivos temporários de sistema operacional, logs e pastas locais de ferramentas auxiliares.

---

### B) Contrato de configuração — `.env.example`

Como o `.env` real fica fora do Git, quem clona o repositório precisa saber quais variáveis precisa criar. Para isso existe o `.env.example`:

- **`.env.example:1-4` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`):** definem usuário, senha e nome do banco usados na criação do container PostgreSQL.
- **`.env.example:6-10` (`DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`):**
  - `DATABASE_URL` (`postgresql://benchos:benchos_dev_pass@localhost:5432/benchos?schema=public`) é a *connection string* que o Prisma usa para achar o banco: protocolo (`postgresql://`), usuário e senha (`benchos:benchos_dev_pass`), endereço e porta (`localhost:5432`), nome do banco (`/benchos`) e schema padrão (`?schema=public`).
  - `PORT=3001` define em qual porta o servidor Node.js/Express vai escutar.
  - `JWT_SECRET` é a chave usada para assinar tokens de autenticação (o texto de exemplo lembra que em produção precisa ser trocada por uma chave forte de pelo menos 32 caracteres).
- **`.env.example:12-15` (`SEED_ADMIN_*`):** dados do usuário administrador inicial que será criado pelo script de seed na próxima tarefa.

---

### C) Banco em container — `docker-compose.yml`

O Docker empacota um serviço (como o PostgreSQL) com todas as dependências dele dentro de um **container** isolado. O `docker-compose.yml` descreve esse container em formato YAML para não precisarmos digitar comandos gigantes no terminal toda vez:

- **`docker-compose.yml:1-5` (`services.postgres`, `image`, `container_name`, `restart`):**
  - `image: postgres:16-alpine`: baixa a imagem oficial do PostgreSQL na versão **16** usando a variação **Alpine Linux** (uma distribuição Linux minimalista, muito menor e mais rápida para baixar e subir).
  - `container_name: benchos-postgres`: dá um nome fixo e fácil de identificar quando rodarmos `docker ps` ou `docker logs benchos-postgres`.
  - `restart: unless-stopped`: se o serviço do Docker reiniciar ou o computador ligar novamente, o container sobe sozinho (a menos que você tenha parado ele manualmente com `docker stop`).
- **`docker-compose.yml:6-9` (`environment`):**
  - A sintaxe `${POSTGRES_USER:-benchos}` significa: *"use a variável `POSTGRES_USER` se ela existir no ambiente/.env; caso contrário, use o valor padrão `benchos`"*. Isso garante que o container funcione mesmo se não houver `.env` na raiz.
- **`docker-compose.yml:10-11` (`ports: - "5432:5432"`):**
  - Faz o **mapeamento de portas** no formato `PORTA_DO_SEU_PC:PORTA_DENTRO_DO_CONTAINER`.
  - Um container tem sua própria rede isolada. Sem essa linha, o PostgreSQL rodaria lá dentro na porta `5432`, mas o seu backend rodando fora (na sua máquina) não conseguiria enxergá-lo. Com `"5432:5432"`, qualquer conexão na porta `5432` do seu computador é encaminhada para a porta `5432` do container.
- **`docker-compose.yml:12-13` e `20-21` (`volumes: benchos_pgdata:/var/lib/postgresql/data`):**
  - Containers são **efêmeros** por natureza: se você rodar `docker compose down` e destruir o container, tudo que foi gravado dentro do sistema de arquivos interno dele desaparece.
  - Um **volume nomeado** (`benchos_pgdata`) cria um espaço gerenciado pelo Docker fora do ciclo de vida do container e o conecta à pasta `/var/lib/postgresql/data` (onde o PostgreSQL guarda tabelas e registros). Assim, você pode destruir, atualizar ou recriar o container sem perder os dados do banco.
- **`docker-compose.yml:14-18` (`healthcheck`):**
  - `Up` (container rodando) não significa necessariamente *"banco pronto para aceitar conexões"* — nos primeiros segundos o PostgreSQL ainda está inicializando arquivos.
  - O `healthcheck` executa o utilitário oficial `pg_isready` a cada `5s` (`interval: 5s`), esperando no máximo `5s` (`timeout: 5s`) por até `10` tentativas (`retries: 10`). Só quando `pg_isready` responde sucesso o status em `docker compose ps` muda para `healthy`.

---

### D) Instalação no Pop!_OS, grupo `docker` e TCP vs. Socket Unix

Nos passos de setup documentados em `docs/superpowers/plans/2026-11-25-benchos-reestruturacao.md:78-88`:

1. **Instalação oficial (`...reestruturacao.md:78-84`):** adiciona a chave criptográfica GPG da Docker e o repositório oficial do Ubuntu `noble` (base do Pop!_OS 24.04) para instalar `docker-ce`, `docker-ce-cli`, `containerd.io` e o plugin `docker-compose-plugin` (que habilita `docker compose` com espaço — Compose v2).
2. **Por que adicionar o usuário ao grupo `docker` exige `newgrp docker` ou novo login (`...reestruturacao.md:85-88`)?**
   - O daemon do Docker roda como `root` e se comunica por um arquivo especial chamado socket Unix (`/var/run/docker.sock`), protegido por permissão do grupo `docker`.
   - O comando `sudo usermod -aG docker "$USER"` grava seu usuário no grupo `docker` nos arquivos do sistema (`/etc/group`), **mas a sua sessão de terminal aberta já carregou a lista antiga de grupos quando você fez login**.
   - Por isso, sem `newgrp docker` (que abre um shell já com o novo grupo ativo) ou sem fazer logout/login, você receberia `permission denied` ao tentar rodar `docker ps` sem `sudo`.
3. **Conectar via TCP (`localhost:5432`) vs. Socket Unix:**
   - **Socket Unix:** é um canal de comunicação local via arquivo no sistema operacional (ex.: `/var/run/docker.sock` ou `/var/run/postgresql/.s.PGSQL.5432`). É muito rápido, mas só funciona entre processos na **mesma máquina/sistema de arquivos** — processos fora de um container normalmente não acessam o socket interno do container.
   - **TCP (`localhost:5432`):** é comunicação via rede (protocolo TCP/IP). Quando a `DATABASE_URL` aponta para `localhost:5432`, o Prisma no seu computador fala via TCP com a porta mapeada pelo Docker, que roteia o tráfego para dentro do container `benchos-postgres`. É o mesmo protocolo que o backend usará em produção para falar com um banco em outro servidor.

---

## 4. O que absorver para o mercado + ordem de leitura

### Conceitos mais cobrados em entrevistas desta Task

1. **Segurança em repositórios (`.gitignore` + `.env`):** saber explicar por que credenciais não vão para o Git, qual a função do `.env.example` e qual a diferença entre Git local e repositório remoto (GitHub), além do fluxo de trabalho com branches.
2. **Docker Compose na prática (portas, volumes e healthcheck):** saber explicar a diferença entre *imagem* e *container*, por que sem **volume** os dados do banco se perdem ao recriar o container, como funciona o mapeamento `host:container` em `ports` e para que serve um `healthcheck`.
3. **Conexão de rede em bancos (`DATABASE_URL` via TCP):** entender cada parte de uma string de conexão PostgreSQL (`usuário`, `senha`, `host`, `porta`, `database`) e a diferença entre conexão local via socket Unix e conexão via rede TCP (`localhost:5432`).

### Ordem recomendada de leitura dos arquivos

Abra os arquivos nesta sequência para consolidar o entendimento de fora para dentro:

1. `/home/dzati/sistema-triagem/.gitignore` — veja primeiro o que fica protegido fora do versionamento.
2. `/home/dzati/sistema-triagem/.env.example` — entenda todas as configurações e segredos que o projeto espera receber.
3. `/home/dzati/sistema-triagem/docker-compose.yml` — veja como o container PostgreSQL consome essas variáveis, expõe a porta `5432` e persiste os dados no volume `benchos_pgdata`.
4. `/home/dzati/sistema-triagem/docs/superpowers/plans/2026-11-25-benchos-reestruturacao.md` (linhas 63–117) — revise a sequência prática de comandos usados para instalar o Docker, subir o banco e registrar o commit inicial.
