#!/bin/bash
set -e

# Script para iniciar o BenchOS em MODO PRODUÇÃO (PostgreSQL + Build Estático servido pelo Backend)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# shellcheck source=scripts/benchos-common.sh
source "$SCRIPT_DIR/scripts/benchos-common.sh"

echo "=========================================================="
echo "   BenchOS — Inicialização em Modo Produção (Loja/LAN)"
echo "=========================================================="

benchos_check_prereqs "$BACKEND_DIR" "$FRONTEND_DIR"
benchos_prepare_env "$SCRIPT_DIR" "$BACKEND_DIR" 1
benchos_start_postgres_and_migrate "$SCRIPT_DIR" "$BACKEND_DIR"

echo "[4] Compilando Frontend e Backend para produção..."
cd "$FRONTEND_DIR"
npm run build

cd "$BACKEND_DIR"
npm run build

BACKEND_PORT="$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | tail -n 1 | cut -d'=' -f2 | tr -d '"\r ' || true)"
BACKEND_PORT="${BACKEND_PORT:-3001}"

benchos_free_port "$BACKEND_PORT"

SERVER_PID=""
CLEANED_UP=0

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo ""
  echo "Encerrando servidor BenchOS (Produção)..."
  benchos_kill_tree "$SERVER_PID"
}

trap cleanup EXIT INT TERM

echo "[5] Iniciando servidor único (API + Frontend compilado) na porta :$BACKEND_PORT..."
(cd "$BACKEND_DIR" && NODE_ENV=production node dist/server.js) &
SERVER_PID=$!

sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Erro: servidor BenchOS encerrou inesperadamente ao iniciar na porta :$BACKEND_PORT."
  wait "$SERVER_PID" || true
  exit 1
fi

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "🚀 BenchOS (MODO PRODUÇÃO) pronto e operando!"
echo "👉 Acesse localmente: http://localhost:$BACKEND_PORT"
if [ -n "$LOCAL_IP" ]; then
  echo "👉 Acesse na rede local da loja: http://$LOCAL_IP:$BACKEND_PORT"
else
  echo "👉 Acesse na rede local usando o IP desta máquina na porta $BACKEND_PORT"
fi
echo "=========================================================="
echo "Pressione Ctrl+C para encerrar o servidor."

wait "$SERVER_PID"
