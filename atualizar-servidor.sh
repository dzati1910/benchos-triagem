#!/bin/bash
set -e

# Script de atualização segura em produção (Docker Compose) com rollback automático/interativo

AUTO_ROLLBACK="${AUTO_ROLLBACK:-0}"

print_usage() {
  cat <<'EOF'
Uso: ./atualizar-servidor.sh [--auto-rollback]

Atualiza o servidor BenchOS em produção com segurança:
  1. Verifica working tree limpo e branch ativa (main)
  2. Registra o commit atual (PREV_COMMIT)
  3. Executa git pull origin main
  4. Reconstroi e sobe os containers via docker-compose.prod.yml
  5. Valida GET /api/health (HTTP 200 e "status":"OK") por até 45s
  6. Em caso de falha, exibe logs e executa/oferece rollback para PREV_COMMIT

Opções:
  --auto-rollback   Executa rollback automaticamente em caso de falha (ou use AUTO_ROLLBACK=1)
  -h, --help        Exibe esta ajuda
EOF
}

for arg in "$@"; do
  case "$arg" in
    --auto-rollback)
      AUTO_ROLLBACK=1
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Erro: opção desconhecida '$arg'." >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

read_env_var() {
  local file="$1"
  local key="$2"
  if [ -f "$file" ]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d'=' -f2- | sed -E 's/[[:space:]]*#.*$//' | tr -d "\"'\r " || true
  fi
}

resolve_port() {
  local port="${PORT:-}"
  if [ -z "$port" ]; then
    port="$(read_env_var "$SCRIPT_DIR/.env" "PORT")"
  fi
  if [ -z "$port" ] && [ ! -f "$SCRIPT_DIR/.env" ] && [ -f "$SCRIPT_DIR/backend/.env" ]; then
    port="$(read_env_var "$SCRIPT_DIR/backend/.env" "PORT")"
  fi
  echo "${port:-3001}"
}

wait_for_health() {
  local max_wait="${1:-45}"
  local start_ts now_ts elapsed response http_code body
  start_ts="$(date +%s)"

  while true; do
    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))

    if response="$(curl -sS --max-time 2 -w '\n%{http_code}' "$HEALTH_URL" 2>/dev/null)"; then
      http_code="${response##*$'\n'}"
      body="${response%$'\n'*}"
      if [ "$http_code" = "200" ] && printf '%s' "$body" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"OK"'; then
        return 0
      fi
    fi

    if [ "$elapsed" -ge "$max_wait" ]; then
      return 1
    fi
    sleep 1
  done
}

for cmd in git docker curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo -e "${RED}${BOLD}Erro: comando obrigatório '$cmd' não encontrado.${NC}" >&2
    exit 1
  fi
done

# Verificar working tree limpo antes de qualquer outra ação
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}${BOLD}Erro: o repositório possui alterações locais não commitadas.${NC}" >&2
  echo "Faça commit ou descarte as alterações antes de atualizar o servidor:" >&2
  git status --short >&2
  exit 1
fi

# Verificar se HEAD está em uma branch válida (main)
CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
if [ -z "$CURRENT_BRANCH" ]; then
  echo -e "${RED}${BOLD}Erro: HEAD está em estado 'detached' (fora de uma branch).${NC}" >&2
  echo "Execute 'git checkout main' antes de atualizar o servidor." >&2
  exit 1
fi

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}${BOLD}Erro: a branch atual é '$CURRENT_BRANCH', mas a atualização de produção espera 'main'.${NC}" >&2
  echo "Execute 'git checkout main' antes de atualizar o servidor." >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/docker-compose.prod.yml" ]; then
  echo -e "${RED}${BOLD}Erro: arquivo docker-compose.prod.yml não encontrado em $SCRIPT_DIR.${NC}" >&2
  exit 1
fi

PORT="$(resolve_port)"
HEALTH_URL="http://localhost:${PORT}/api/health"

COMPOSE_ARGS=()
if [ ! -f "$SCRIPT_DIR/.env" ] && [ -f "$SCRIPT_DIR/backend/.env" ]; then
  COMPOSE_ARGS=(--env-file "$SCRIPT_DIR/backend/.env")
fi

PREV_COMMIT="$(git rev-parse HEAD)"
PREV_SHORT="$(git rev-parse --short HEAD)"

echo -e "${CYAN}${BOLD}==========================================================${NC}"
echo -e "${CYAN}${BOLD}   BenchOS — Atualização Segura de Produção (Docker)      ${NC}"
echo -e "${CYAN}${BOLD}==========================================================${NC}"
echo "Commit atual (ponto de rollback): $PREV_SHORT ($PREV_COMMIT)"
echo "Porta monitorada: $PORT"
echo ""

echo "[1/3] Baixando atualizações de origin/main..."
git pull origin main
NEW_COMMIT="$(git rev-parse --short HEAD)"

echo "[2/3] Reconstruindo e iniciando containers (docker-compose.prod.yml)..."
BUILD_OK=1
if ! docker compose -f docker-compose.prod.yml "${COMPOSE_ARGS[@]}" up -d --build; then
  BUILD_OK=0
fi

HEALTH_OK=0
if [ "$BUILD_OK" -eq 1 ]; then
  echo "[3/3] Aguardando healthcheck em ${HEALTH_URL} (até 45s)..."
  if wait_for_health 45; then
    HEALTH_OK=1
  fi
fi

if [ "$BUILD_OK" -eq 1 ] && [ "$HEALTH_OK" -eq 1 ]; then
  LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  echo ""
  echo -e "${GREEN}${BOLD}==========================================================${NC}"
  echo -e "${GREEN}${BOLD}   BenchOS atualizado e saudável!                         ${NC}"
  echo -e "${GREEN}${BOLD}==========================================================${NC}"
  echo -e "${GREEN}Commit ativo:${NC} $NEW_COMMIT ($(git rev-parse HEAD))"
  echo -e "${GREEN}Acesso local:${NC} http://localhost:${PORT}"
  if [ -n "$LOCAL_IP" ]; then
    echo -e "${GREEN}Acesso na rede local (LAN):${NC} http://${LOCAL_IP}:${PORT}"
  else
    echo -e "${YELLOW}IP da LAN não detectado automaticamente. Acesse usando o IP desta máquina na porta ${PORT}.${NC}"
  fi
  exit 0
fi

# Falha no build/up ou timeout do healthcheck
printf '\a'
echo ""
echo -e "${RED}${BOLD}==========================================================${NC}"
if [ "$BUILD_OK" -ne 1 ]; then
  echo -e "${RED}${BOLD}   ERRO CRÍTICO: falha ao construir/subir os containers!  ${NC}"
else
  echo -e "${RED}${BOLD}   ERRO CRÍTICO: healthcheck falhou após 45 segundos!     ${NC}"
fi
echo -e "${RED}${BOLD}==========================================================${NC}"
echo ""
echo -e "${YELLOW}Últimas 50 linhas de log do container 'app':${NC}"
docker compose -f docker-compose.prod.yml "${COMPOSE_ARGS[@]}" logs --tail=50 app || true
echo ""

if [ "${#COMPOSE_ARGS[@]}" -gt 0 ]; then
  MANUAL_ROLLBACK_CMD="git reset --hard ${PREV_COMMIT} && docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build"
else
  MANUAL_ROLLBACK_CMD="git reset --hard ${PREV_COMMIT} && docker compose -f docker-compose.prod.yml up -d --build"
fi

run_rollback() {
  echo -e "${YELLOW}${BOLD}Executando rollback para o commit ${PREV_SHORT} (${PREV_COMMIT})...${NC}"
  git reset --hard "$PREV_COMMIT"
  if docker compose -f docker-compose.prod.yml "${COMPOSE_ARGS[@]}" up -d --build && wait_for_health 45; then
    echo ""
    echo -e "${GREEN}${BOLD}Rollback concluído! Versão anterior (${PREV_SHORT}) está ativa e saudável em http://localhost:${PORT}.${NC}"
    echo -e "${YELLOW}Nota: a atualização para ${NEW_COMMIT} falhou e foi revertida.${NC}"
    exit 1
  else
    printf '\a'
    echo ""
    echo -e "${RED}${BOLD}ERRO CRÍTICO: o rollback também falhou ao subir ou responder /api/health!${NC}" >&2
    docker compose -f docker-compose.prod.yml "${COMPOSE_ARGS[@]}" logs --tail=50 app || true
    exit 1
  fi
}

if [ "$AUTO_ROLLBACK" = "1" ] || [ "$AUTO_ROLLBACK" = "true" ]; then
  run_rollback
elif [ -t 0 ]; then
  read -r -p "Deseja executar rollback para o commit ${PREV_SHORT}? [s/N] " REPLY
  case "$REPLY" in
    [sS]|[sS][iI][mM]|[yY]|[yY][eE][sS])
      run_rollback
      ;;
    *)
      echo -e "${YELLOW}Rollback cancelado. Para reverter manualmente, execute:${NC}"
      echo "  $MANUAL_ROLLBACK_CMD"
      exit 1
      ;;
  esac
else
  echo -e "${YELLOW}Execução não interativa sem --auto-rollback. Para reverter manualmente, execute:${NC}" >&2
  echo "  $MANUAL_ROLLBACK_CMD" >&2
  exit 1
fi
