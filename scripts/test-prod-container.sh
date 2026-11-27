#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
PROJECT_NAME="benchos-smoke"

export PORT="${SMOKE_PORT:-3099}"
export POSTGRES_DB="benchos_smoke"
export POSTGRES_USER="benchos_smoke"
export POSTGRES_PASSWORD="benchos_smoke_test_pass"
export POSTGRES_CONTAINER_NAME="benchos-postgres-smoke"
export APP_CONTAINER_NAME="benchos-app-smoke"
export JWT_SECRET="benchos-smoke-test-jwt-secret-key-min-32-chars"
export JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-1d}"
export SEED_ADMIN_NAME="Admin Smoke"
export SEED_ADMIN_EMAIL="admin-smoke@benchos.local"
export SEED_ADMIN_PASSWORD="SmokeTest@123"

BASE_URL="http://localhost:${PORT}"

CLEANED_UP=0
cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return 0
  fi
  CLEANED_UP=1
  echo "[Smoke Test] Encerrando e removendo recursos do projeto '${PROJECT_NAME}'..."
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

print_logs_and_fail() {
  echo "[Smoke Test] Coletando logs dos containers antes de encerrar..."
  docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs || true
  exit 1
}

assert_endpoint() {
  local path="$1"
  local expected_status="$2"
  local expected_pattern="${3:-}"
  local response status body

  if ! response="$(curl -sS --max-time 5 -w '\n%{http_code}' "${BASE_URL}${path}")"; then
    echo "[Smoke Test] FAIL: GET ${path} -> falha na requisição curl"
    print_logs_and_fail
  fi

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [ "$status" != "$expected_status" ]; then
    echo "[Smoke Test] FAIL: GET ${path} -> esperado HTTP ${expected_status}, obtido HTTP ${status}"
    print_logs_and_fail
  fi

  if [ -n "$expected_pattern" ] && ! printf '%s' "$body" | grep -Eq "$expected_pattern"; then
    echo "[Smoke Test] FAIL: GET ${path} -> resposta não contém o padrão esperado (${expected_pattern})"
    print_logs_and_fail
  fi

  echo "[Smoke Test] PASS: GET ${path} -> HTTP ${status}"
}

echo "[Smoke Test] Iniciando stack de produção isolada (${PROJECT_NAME}) na porta ${PORT}..."
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build

echo "[Smoke Test] Aguardando ${BASE_URL}/api/health responder HTTP 200 com status OK (até 45s)..."
START_TS="$(date +%s)"
MAX_WAIT=45
HEALTH_OK=0

while true; do
  NOW_TS="$(date +%s)"
  ELAPSED=$((NOW_TS - START_TS))

  if RESPONSE="$(curl -sS --max-time 2 -w '\n%{http_code}' "${BASE_URL}/api/health" 2>/dev/null)"; then
    HTTP_CODE="${RESPONSE##*$'\n'}"
    BODY="${RESPONSE%$'\n'*}"
    if [ "$HTTP_CODE" = "200" ] && printf '%s' "$BODY" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"OK"'; then
      HEALTH_OK=1
      echo "[Smoke Test] PASS: GET /api/health -> HTTP ${HTTP_CODE} (${ELAPSED}s): ${BODY}"
      break
    fi
  fi

  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    break
  fi
  sleep 1
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "[Smoke Test] FAIL: /api/health não respondeu HTTP 200 com status OK dentro de ${MAX_WAIT}s."
  print_logs_and_fail
fi

assert_endpoint "/" "200" 'BenchOS|id="root"'
assert_endpoint "/admin/usuarios" "200" 'id="root"'
assert_endpoint "/api/nao-existe" "404" '"error"'

echo "[Smoke Test] Todos os checks de smoke test passaram com sucesso!"
