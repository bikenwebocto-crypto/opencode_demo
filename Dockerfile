FROM node:20-alpine AS base

WORKDIR /app

# ============================================================
# Dependencies
# ============================================================

FROM base AS deps

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./

RUN npm ci

# ============================================================
# Build
# ============================================================

FROM base AS builder

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

# DATABASE_URL is available only while this command runs.
# It is NOT persisted into the resulting image.
RUN --mount=type=secret,id=database_url \
    DATABASE_URL="$(cat /run/secrets/database_url)" \
    npm run build

# ============================================================
# Production
# ============================================================

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]