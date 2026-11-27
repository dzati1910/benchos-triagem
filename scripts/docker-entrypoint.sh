#!/bin/bash
set -e

echo "[BenchOS Container] Inicializando aplicação..."

if [ -z "$DATABASE_URL" ]; then
  echo "Erro crítico: Variável DATABASE_URL não definida."
  exit 1
fi

echo "[BenchOS Container] Aguardando conectividade com o banco de dados..."
MAX_TRIES=30
TRIES=0
until node -e "const { PrismaClient } = require('./backend/node_modules/@prisma/client'); const p = new PrismaClient(); p.\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "Erro: PostgreSQL não respondeu após $MAX_TRIES tentativas."
    exit 1
  fi
  sleep 1
done

echo "[BenchOS Container] Banco de dados conectado com sucesso!"
echo "[BenchOS Container] Aplicando migrations do Prisma..."
cd /app/backend && export npm_config_update_notifier=false && npx --no-install prisma migrate deploy

echo "[BenchOS Container] Garantindo seed inicial (idempotente)..."
export npm_config_update_notifier=false
npx --no-install prisma db seed

echo "[BenchOS Container] Iniciando servidor BenchOS na porta ${PORT:-3001}..."
exec node dist/server.js
