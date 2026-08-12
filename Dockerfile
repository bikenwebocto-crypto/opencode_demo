FROM node:20-alpine AS base

WORKDIR /app

# Prisma requires OpenSSL
RUN apk add --no-cache openssl

# ============================================================
# Dependencies
# ============================================================

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


# ============================================================
# Build
# ============================================================

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN npm run build


# ============================================================
# Production
# ============================================================

FROM node:20-alpine AS runner

WORKDIR /app

# Prisma runtime dependency
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next.js standalone application
COPY --from=builder /app/.next/standalone ./

# Static assets
COPY --from=builder /app/.next/static ./.next/static

# Public assets
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]