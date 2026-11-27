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
RUN apk add --no-cache openssl libc6-compat curl bash
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev && npm install --no-save prisma@6.19.3 && npm install -g tsx@4.23.15

COPY --from=backend-builder /build/backend/dist ./backend/dist
COPY --from=backend-builder /build/backend/prisma ./backend/prisma
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

RUN cd backend && npx prisma generate

COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh \
    && mkdir -p /home/node/.npm /home/node/.cache \
    && chown -R node:node /app /home/node/.npm /home/node/.cache

USER node

EXPOSE 3001

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
