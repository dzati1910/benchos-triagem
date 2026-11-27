# Stage 1: Frontend Build
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend Build
FROM node:20-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma/ ./prisma/
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# Stage 3: Lean Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat curl bash \
    && npm install -g tsx@4.23.15 \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && mkdir -p /app/backend /app/scripts /home/node/.npm /home/node/.cache \
    && chown -R node:node /app /home/node
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --chown=node:node backend/package*.json ./backend/
USER node

RUN cd backend \
    && npm ci --omit=dev \
    && npm install --no-save prisma@6.19.3 \
    && npm cache clean --force \
    && rm -rf /home/node/.npm/_cacache

COPY --from=backend-builder --chown=node:node /build/backend/dist ./backend/dist
COPY --from=backend-builder --chown=node:node /build/backend/prisma ./backend/prisma
COPY --from=frontend-builder --chown=node:node /build/frontend/dist ./frontend/dist
COPY --chown=node:node scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh \
    && cd backend && npx --no-install prisma generate

EXPOSE 3001

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
