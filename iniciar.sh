#!/bin/bash
set -e

# Script para iniciar o BenchOS em MODO DESENVOLVIMENTO (PostgreSQL + Backend + Vite Dev)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# shellcheck source=scripts/benchos-common.sh
source "$SCRIPT_DIR/scripts/benchos-common.sh"

echo "=========================================================="
echo "   Iniciando BenchOS - Modo Desenvolvimento (Hot Reload)"
echo "=========================================================="

benchos_check_prereqs "$BACKEND_DIR" "$FRONTEND_DIR"
benchos_prepare_env "$SCRIPT_DIR" "$BACKEND_DIR" 0
benchos_start_postgres_and_migrate "$SCRIPT_DIR" "$BACKEND_DIR"

benchos_free_port 3000
benchos_free_port 3001

BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=0

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo ""
  echo "Encerrando servidores BenchOS..."
  benchos_kill_tree "$BACKEND_PID"
  benchos_kill_tree "$FRONTEND_PID"
}

trap cleanup EXIT INT TERM

echo "[4] Iniciando Backend (:3001) e Frontend (:3000 em 0.0.0.0)..."
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!

sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Erro: servidor backend encerrou inesperadamente ao iniciar."
  exit 1
fi

(cd "$FRONTEND_DIR" && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!

sleep 1
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo "Erro: servidor frontend Vite encerrou inesperadamente ao iniciar."
  exit 1
fi

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "🚀 BenchOS (DEV) pronto e operando!"
echo "👉 Acesse localmente: http://localhost:3000"
if [ -n "$LOCAL_IP" ]; then
  echo "👉 Acesse na rede local da loja: http://$LOCAL_IP:3000"
else
  echo "👉 Acesse na rede local da loja: http://[IP_DESTE_PC]:3000"
fi
echo "=========================================================="
echo "Pressione CTRL+C a qualquer momento para parar os servidores."

wait
