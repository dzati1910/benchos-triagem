# Instrução de Execução: Implementação de Infraestrutura de Produção e CI/CD do BenchOS

**Workspace:** `/home/dzati/sistema-triagem`  
**Branch:** `main`  
**Modo de Execução Recomendado:** `superpowers:subagent-driven-development` (ou execução direta sequencial das tasks do plano)

---

## 1. Contexto e Documentos de Engenharia

O projeto BenchOS (Sistema de Triagem Técnica e Bancada de Testes em rede local) possui arquitetura fullstack madura com 23 commits e 100 testes automatizados passando (78 backend Vitest + 22 frontend Vitest).

Toda a análise arquitetural, especificação de requisitos e o plano detalhado de implementação passo a passo (TDD/Task-by-Task) já foram elaborados e validados:

- **Especificação Técnica:** [`docs/superpowers/specs/2026-11-27-benchos-docker-prod-cicd-spec.md`](docs/superpowers/specs/2026-11-27-benchos-docker-prod-cicd-spec.md)
- **Plano de Implementação:** [`docs/superpowers/plans/2026-11-27-benchos-docker-prod-cicd.md`](docs/superpowers/plans/2026-11-27-benchos-docker-prod-cicd.md)

---

## 2. Missão da Sessão no Antigravity Desktop

Executar as **6 tasks** do plano de implementação, garantindo a conteinerização completa em produção, automação de CI/CD e estabilidade do servidor da distribuidora:

1. **Task 1: Multi-stage Dockerfile e `.dockerignore`**
   - Criação de `.dockerignore` e `Dockerfile` multi-stage (`frontend-builder` -> `backend-builder` -> `runner` Alpine com Node.js 20, OpenSSL e `libc6-compat` para o Prisma).
2. **Task 2: Entrypoint de Produção (`scripts/docker-entrypoint.sh`)**
   - Script de inicialização do container que aguarda a saúde do Postgres via Prisma, executa `prisma migrate deploy`, seed idempotente e inicia `node dist/server.js`.
3. **Task 3: Production Docker Compose (`docker-compose.prod.yml`)**
   - Orquestração dos serviços `postgres` e `app` em rede interna isolada `benchos_internal`, volume persistente dedicado `benchos_pgdata_prod` e healthcheck com `curl` em `/api/health`.
4. **Task 4: Smoke Test Automatizado (`scripts/test-prod-container.sh`)**
   - Teste de fumaça que sobe o stack prod em porta de teste isolada, valida o status HTTP 200 da API e a entrega do frontend SPA, e faz o teardown limpo.
5. **Task 5: Pipeline de CI/CD com GitHub Actions (`.github/workflows/ci.yml`)**
   - Execução automática de testes do backend, testes do frontend, builds TypeScript e validação de build da imagem Docker em cada push/PR para a `main`.
6. **Task 6: Script de Atualização no Servidor com Rollback (`atualizar-servidor.sh`) & Documentação**
   - Script seguro para a máquina da loja que faz `git pull`, reconstrói containers, monitora healthcheck da aplicação e oferece rollback automático em caso de falha.

---

## 3. Regras de Execução para o Agente

- Siga rigorosamente o plano em [`docs/superpowers/plans/2026-11-27-benchos-docker-prod-cicd.md`](docs/superpowers/plans/2026-11-27-benchos-docker-prod-cicd.md), executando task por task.
- Não commite arquivos temporários, logs ou segredos reais.
- Valide cada task com seu teste/verificação correspondente antes de fazer o commit.
- Mantenha a política de commits atômicos semânticos (Conventional Commits: `feat(docker):`, `ci:`, `test(infra):`, etc.).
- Ao final, rode a suíte completa de regressão (`npm test` no backend e frontend) para garantir que os 100 testes continuam verdes.
