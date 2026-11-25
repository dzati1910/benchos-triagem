#!/bin/bash

# Funções compartilhadas entre iniciar.sh (desenvolvimento) e iniciar-producao.sh (produção)

benchos_check_prereqs() {
  local backend_dir="$1"
  local frontend_dir="$2"

  if ! command -v docker >/dev/null 2>&1; then
    echo "Erro: comando 'docker' não encontrado. Instale o Docker e Docker Compose."
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Erro: Docker não está acessível (daemon parado ou sem permissão no socket)."
    echo "No Pop!_OS/Ubuntu, verifique: sudo systemctl enable --now docker && sudo usermod -aG docker \$USER"
    exit 1
  fi

  if [ ! -d "$backend_dir/node_modules" ] || [ ! -d "$frontend_dir/node_modules" ]; then
    echo "Erro: dependências não instaladas (pasta node_modules ausente)."
    echo "Execute antes: (cd \"$backend_dir\" && npm install) && (cd \"$frontend_dir\" && npm install)"
    exit 1
  fi
}

benchos_prepare_env() {
  local script_dir="$1"
  local backend_dir="$2"
  local warn_prod_defaults="${3:-0}"

  if [ ! -f "$backend_dir/.env" ]; then
    if [ -f "$backend_dir/.env.example" ]; then
      cp "$backend_dir/.env.example" "$backend_dir/.env"
      echo "[!] Arquivo backend/.env criado a partir de backend/.env.example."
    elif [ -f "$script_dir/.env.example" ]; then
      cp "$script_dir/.env.example" "$backend_dir/.env"
      echo "[!] Arquivo backend/.env criado a partir de .env.example."
    else
      echo "Erro: backend/.env não encontrado e nenhum .env.example disponível."
      exit 1
    fi

    if [ "$warn_prod_defaults" -eq 1 ]; then
      echo "[!] ATENÇÃO DE SEGURANÇA: backend/.env foi criado com credenciais de exemplo."
      echo "    Em produção na loja, troque JWT_SECRET, POSTGRES_PASSWORD e SEED_ADMIN_PASSWORD!"
    fi
  fi

  COMPOSE_ARGS=()
  local env_file_src="$backend_dir/.env"
  if [ -f "$script_dir/.env" ]; then
    env_file_src="$script_dir/.env"
  else
    COMPOSE_ARGS=(--env-file "$backend_dir/.env")
  fi

  PG_USER="$(grep -E '^POSTGRES_USER=' "$env_file_src" 2>/dev/null | tail -n 1 | cut -d'=' -f2 | tr -d '"\r ' || true)"
  PG_DB="$(grep -E '^POSTGRES_DB=' "$env_file_src" 2>/dev/null | tail -n 1 | cut -d'=' -f2 | tr -d '"\r ' || true)"
  PG_USER="${PG_USER:-benchos}"
  PG_DB="${PG_DB:-benchos}"
}

benchos_start_postgres_and_migrate() {
  local script_dir="$1"
  local backend_dir="$2"

  echo "[1] Subindo PostgreSQL 16 via Docker Compose..."
  cd "$script_dir"
  docker compose "${COMPOSE_ARGS[@]}" up -d

  echo "[2] Aguardando PostgreSQL ficar saudável (usuário: $PG_USER, banco: $PG_DB)..."
  local pg_ready=0
  for _ in $(seq 1 30); do
    if docker compose "${COMPOSE_ARGS[@]}" exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
      pg_ready=1
      break
    fi
    sleep 1
  done

  if [ "$pg_ready" -ne 1 ]; then
    echo "Erro: PostgreSQL não respondeu dentro de 30 segundos."
    exit 1
  fi

  echo "[3] Aplicando migrations Prisma e executando seed inicial..."
  cd "$backend_dir"
  npx prisma migrate deploy
  npx prisma db seed
}

benchos_free_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti :"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill -9 || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}

benchos_kill_tree() {
  local pid="$1"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    if command -v pkill >/dev/null 2>&1; then
      pkill -P "$pid" 2>/dev/null || true
    fi
    kill "$pid" 2>/dev/null || true
  fi
}
