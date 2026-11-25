#!/bin/bash
# Script para iniciar o BenchOS na rede local da distribuidora
echo "=========================================================="
echo "   Iniciando BenchOS - Triagem Técnica & Bancada de Testes"
echo "=========================================================="

# Mata processos antigos se estiverem rodando nas portas 3000 ou 3001
lsof -ti :3000 | xargs -r kill -9
lsof -ti :3001 | xargs -r kill -9

echo "[1/2] Iniciando Backend API (Node.js + Express + SQLite) na porta 3001..."
cd /home/dzati/sistema-triagem/backend && npm run dev &
BACKEND_PID=$!

sleep 2

echo "[2/2] Iniciando Frontend React (Vite + Tailwind) na porta 3000..."
cd /home/dzati/sistema-triagem/frontend && npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "🚀 Sistema pronto e operando!"
echo "👉 Acesse localmente: http://localhost:3000"
echo "👉 Acesse de outros computadores da loja: http://[IP_DESTE_PC]:3000"
echo "=========================================================="
echo "Pressione CTRL+C a qualquer momento para parar os servidores."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
