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

# Generate Prisma client only.
# This does NOT migrate or modify the database.
RUN npx prisma generate

# Build using the staging database URL and public runtime config as temporary
# BuildKit secrets. Secrets are NOT persisted into the image.
RUN --mount=type=secret,id=database_url,required=true \
    --mount=type=secret,id=next_public_supabase_url,required=true \
    --mount=type=secret,id=next_public_supabase_publishable_key,required=true \
    --mount=type=secret,id=next_public_app_url,required=true \
    --mount=type=secret,id=next_public_google_maps_api_key,required=true \
    --mount=type=secret,id=next_public_google_maps_map_id,required=true \
    --mount=type=secret,id=next_public_firebase_api_key,required=true \
    --mount=type=secret,id=next_public_firebase_auth_domain,required=true \
    --mount=type=secret,id=next_public_firebase_project_id,required=true \
    --mount=type=secret,id=next_public_firebase_storage_bucket,required=true \
    --mount=type=secret,id=next_public_firebase_messaging_sender_id,required=true \
    --mount=type=secret,id=next_public_firebase_app_id,required=true \
    --mount=type=secret,id=next_public_firebase_measurement_id,required=true \
    --mount=type=secret,id=next_public_firebase_vapid_key,required=true \
    DATABASE_URL="$(cat /run/secrets/database_url)" \
    NEXT_PUBLIC_SUPABASE_URL="$(cat /run/secrets/next_public_supabase_url)" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(cat /run/secrets/next_public_supabase_publishable_key)" \
    NEXT_PUBLIC_APP_URL="$(cat /run/secrets/next_public_app_url)" \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$(cat /run/secrets/next_public_google_maps_api_key)" \
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID="$(cat /run/secrets/next_public_google_maps_map_id)" \
    NEXT_PUBLIC_FIREBASE_API_KEY="$(cat /run/secrets/next_public_firebase_api_key)" \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$(cat /run/secrets/next_public_firebase_auth_domain)" \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="$(cat /run/secrets/next_public_firebase_project_id)" \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$(cat /run/secrets/next_public_firebase_storage_bucket)" \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$(cat /run/secrets/next_public_firebase_messaging_sender_id)" \
    NEXT_PUBLIC_FIREBASE_APP_ID="$(cat /run/secrets/next_public_firebase_app_id)" \
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="$(cat /run/secrets/next_public_firebase_measurement_id)" \
    NEXT_PUBLIC_FIREBASE_VAPID_KEY="$(cat /run/secrets/next_public_firebase_vapid_key)" \
    npm run build

# ============================================================
# Production
# ============================================================

FROM node:20-alpine AS runner

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]