#!/bin/bash
set -e

# Script para iniciar o BenchOS (PostgreSQL + Backend + Frontend) na rede local da distribuidora
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================================="
echo "   Iniciando BenchOS - Triagem Técnica & Bancada de Testes"
echo "=========================================================="

if ! command -v docker >/dev/null 2>&1; then
  echo "Erro: comando 'docker' não encontrado. Instale o Docker e Docker Compose."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Erro: Docker não está acessível (daemon parado ou sem permissão no socket)."
  echo "No Pop!_OS/Ubuntu, verifique: sudo systemctl enable --now docker && sudo usermod -aG docker \$USER"
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  if [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "[!] Arquivo backend/.env criado a partir de backend/.env.example."
  elif [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "[!] Arquivo backend/.env criado a partir de .env.example."
  else
    echo "Erro: backend/.env não encontrado e nenhum .env.example disponível."
    exit 1
  fi
fi

echo "[1/4] Subindo PostgreSQL 16 via Docker Compose..."
cd "$SCRIPT_DIR"
docker compose up -d

echo "[2/4] Aguardando PostgreSQL ficar saudável..."
PG_READY=0
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U benchos -d benchos >/dev/null 2>&1; then
    PG_READY=1
    break
  fi
  sleep 1
done

if [ "$PG_READY" -ne 1 ]; then
  echo "Erro: PostgreSQL não respondeu dentro de 30 segundos."
  exit 1
fi

echo "[3/4] Aplicando migrations Prisma e executando seed inicial..."
cd "$BACKEND_DIR"
npx prisma migrate deploy
npx prisma db seed

# Mata processos antigos se estiverem rodando nas portas 3000 ou 3001
for port in 3000 3001; do
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "$pids" | xargs -r kill -9 || true
  fi
done

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Encerrando servidores BenchOS..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "[4/4] Iniciando Backend (:3001) e Frontend (:3000 em 0.0.0.0)..."
cd "$BACKEND_DIR" && npm run dev &
BACKEND_PID=$!

sleep 2

cd "$FRONTEND_DIR" && npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "🚀 BenchOS pronto e operando!"
echo "👉 Acesse localmente: http://localhost:3000"
if [ -n "$LOCAL_IP" ]; then
  echo "👉 Acesse na rede local da loja: http://$LOCAL_IP:3000"
else
  echo "👉 Acesse na rede local da loja: http://[IP_DESTE_PC]:3000"
fi
echo "=========================================================="
echo "Pressione CTRL+C a qualquer momento para parar os servidores."

wait
