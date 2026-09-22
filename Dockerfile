# syntax=docker/dockerfile:1.7

# ---------- 1. Dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Stub-Werte nur für Build-Zeit. Echte Werte kommen zur Laufzeit aus Coolify.
ENV DATABASE_URL=postgresql://stub:stub@localhost:5432/stub
ENV BETTER_AUTH_SECRET=build-stub-secret-replaced-at-runtime-xxxxxxxxxxxxxxxx
ENV BETTER_AUTH_URL=http://localhost:3000

# GitHub-hosted runner hat genug RAM; Node defaulted den Heap sonst auf ~2 GB.
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

# ---------- 3. Runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV FILE_STORAGE_PATH=/app/data/uploads

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/data/uploads \
 && chown nextjs:nodejs /app/data/uploads

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Standalone bündelt postgres/drizzle-orm nicht als bare Imports für migrate.mjs.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./migrations
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./migrate.mjs
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

CMD ["sh", "/app/entrypoint.sh"]
