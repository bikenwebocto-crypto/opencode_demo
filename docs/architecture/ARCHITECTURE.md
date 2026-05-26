# Employee Perks Platform Architecture

## Overview

Enterprise-grade SaaS platform for managing employee perks, merchant offers, and real-time redemptions across multiple dashboards (Admin, Merchant, Company, Employee).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript 5.6+ |
| Database | PostgreSQL 16 (via Supabase) |
| ORM | Prisma 5 |
| Auth | Supabase Auth (PKCE flow) |
| Realtime | Supabase Realtime (Postgres Changes) |
| State (Client) | Zustand 5 |
| Server Cache | TanStack Query 5 |
| Validation | Zod 3 + React Hook Form |
| UI | TailwindCSS 3 + ShadCN UI |
| Styling | Class Variance Authority |
| Charts | Recharts |
| Queue | pgmq / Supabase Realtime |
| Background Jobs | Node.js worker (pg LISTEN/NOTIFY) |
| File Storage | Supabase Storage |
| Edge Functions | Supabase Edge Functions (Deno) |
| Testing | Vitest + Playwright + MSW |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Edge Runtime (Middleware) → Auth, Redirects, CSRF   │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Server Components (Default)                         │   │
│  │  │  ├─ Server Actions (Mutations)                     │   │
│  │  │  ├─ Route Handlers (API)                           │   │
│  │  │  └─ React Server Components (Data Fetching)        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Client Components (When Needed)                     │   │
│  │  │  ├─ Zustand (Client State)                         │   │
│  │  │  ├─ TanStack Query (Server State)                  │   │
│  │  │  ├─ Supabase Realtime (Live Updates)               │   │
│  │  │  └─ React Hook Form (Forms)                        │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                        Service Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services (Business Logic)                           │   │
│  │  ├─ AuthService    ├─ OfferService                   │   │
│  │  ├─ MerchantService ├─ RedemptionService              │   │
│  │  ├─ CompanyService  ├─ AnalyticsService               │   │
│  │  └─ UploadService   └─ NotificationService            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Repositories (Data Access)                          │   │
│  │  ├─ BaseRepository (CRUD)                            │   │
│  │  ├─ MerchantRepository                               │   │
│  │  ├─ OfferRepository                                  │   │
│  │  └─ ...                                              │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Infrastructure                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Supabase DB  │  │  Supabase     │  │  Edge Functions  │  │
│  │  (PostgreSQL) │  │  Realtime     │  │  (Deno)          │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤  │
│  │  Prisma ORM   │  │  pgmq Queue   │  │  CSV Processing  │  │
│  │  RLS Policies │  │  LISTEN/NOTIFY│  │  Webhooks        │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Vercel Edge Network (CDN + ISR + Streaming)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group: auth pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (dashboard)/              # Route group: dashboards
│   │   ├── admin/                # Admin dashboard (Parallel Routes)
│   │   │   ├── action-queue/
│   │   │   ├── merchants/
│   │   │   ├── companies/
│   │   │   ├── employees/
│   │   │   ├── csv-uploads/
│   │   │   ├── content/
│   │   │   ├── reports/
│   │   │   ├── audit-logs/
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   ├── merchant/             # Merchant dashboard
│   │   │   ├── offers/
│   │   │   ├── analytics/
│   │   │   ├── branches/
│   │   │   ├── profile/
│   │   │   ├── settings/
│   │   │   └── redemptions/
│   │   ├── company/              # Company dashboard
│   │   │   ├── employees/
│   │   │   ├── analytics/
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   └── employee/             # Employee mobile web app
│   │       ├── offers/
│   │       ├── redemptions/
│   │       └── profile/
│   └── api/                      # Route Handlers
│       ├── auth/
│       ├── admin/merchants/
│       ├── analytics/
│       ├── upload/
│       ├── webhooks/
│       └── realtime/
├── components/
│   ├── ui/                       # ShadCN UI components
│   ├── shared/                   # Shared components
│   ├── forms/                    # Form components
│   ├── tables/                   # Data tables
│   ├── charts/                   # Chart components
│   ├── layout/                   # Layout components
│   └── realtime/                 # Realtime-aware components
├── features/                     # Feature modules
│   ├── admin/                    # Admin-specific components
│   ├── merchant/
│   ├── company/
│   └── employee/
├── lib/
│   ├── prisma/                   # Prisma client + extensions
│   ├── supabase/                 # Supabase clients + realtime
│   ├── redis/                    # Redis client (caching)
│   ├── queue/                    # Background job queue
│   ├── upload/                   # File upload service
│   ├── email/                    # Email service
│   ├── analytics/                # Analytics aggregation
│   └── providers/                # React providers
├── services/                     # Business logic layer
├── repositories/                 # Data access layer (repository pattern)
├── hooks/
│   └── queries/                  # TanStack Query hooks
├── store/                        # Zustand stores
├── types/                        # TypeScript type definitions
├── schemas/                      # Zod validation schemas
├── actions/                      # Next.js Server Actions
├── middleware/                   # Auth middleware
└── utils/                        # Utility functions
```

## Key Architecture Decisions

### 1. Server Components by Default
- All pages are Server Components unless interactivity requires Client Components
- Data fetching happens in the Server Component or via Route Handlers
- Mutations use Server Actions (form-based or programmatic)

### 2. Real-Time Architecture
- **Supabase Realtime** for Postgres change data capture
- **Zustand** buffers events client-side with deduplication
- **TanStack Query** auto-refetch as fallback (30s intervals)
- Reconnection handled by Supabase SDK with exponential backoff

### 3. State Management
| State | Tool | Rationale |
|-------|------|-----------|
| Server data | TanStack Query | Caching, dedup, refetch |
| Client UI state | Zustand | Minimal boilerplate |
| Auth state | Zustand + persist | Survives page refresh |
| Realtime events | Zustand (buffer) | Batched processing |

### 4. Security Model
- **RLS Policies** at database level (row-level security)
- **Middleware** validates JWT and user type for protected routes
- **CSRF tokens** required for all mutation requests
- **Rate limiting** via middleware (sliding window)
- **Input validation** via Zod on both client and server
- **Audit logging** via Prisma middleware for all critical mutations

### 5. Data Flow

```
User Action → Server Action → Service → Repository → Prisma → PostgreSQL
                                  ↓
                            Zod Validation
                                  ↓
                            Audit Log (async)
                                  ↓
                            Realtime Broadcast (DB trigger)
                                  ↓
                    All connected clients receive update
```

### 6. Pagination Strategy
- Cursor-based for realtime feeds (redemptions)
- Offset-based for admin lists (merchants, companies)
- Keyset pagination for large datasets (>100k rows)

### 7. Caching Strategy
| Cache | TTL | Where |
|-------|-----|-------|
| TanStack Query | 30s stale, 5min GC | Browser |
| Next.js ISR | On-demand revalidation | Edge |
| API responses | 30s with stale-while-revalidate | CDN |
| Database query cache | Prisma (implicit) | Server |

### 8. Background Jobs
| Job | Trigger | Processor |
|-----|---------|-----------|
| CSV Employee Import | Supabase Edge Function (on-demand) | Deno |
| Daily Analytics Aggregation | pg_cron (midnight) | Node.js worker |
| Expired Offer Cleanup | pg_cron (hourly) | Node.js worker |
| Notification Delivery | Realtime event | Server Action |
| Email Sending | Queue worker async | Resend/SMTP |

## Performance Targets

| Metric | Target |
|--------|--------|
| API response time (p95) | < 200ms |
| Realtime event latency | < 500ms |
| Dashboard initial load | < 2s |
| CSV import (10k employees) | < 30s |
| Concurrent admin users | 500+ |
| Daily redemptions | 1M+ |
| Database query time (p99) | < 1s |

## Scaling Recommendations

1. **Database**: Add connection pooling (PgBouncer), read replicas for analytics
2. **Caching**: Redis layer for session store and rate limiting
3. **Queue**: Replace pgmq with BullMQ + Redis for high-throughput jobs
4. **Edge**: Deploy critical API routes to Vercel Edge Functions
5. **CDN**: Supabase Storage behind CDN for image delivery
6. **Streaming**: Use React Suspense boundaries for staggered UI loading
7. **ISR**: Revalidate only on mutation, serve cached content otherwise

## Index Strategy

```sql
-- Critical indexes (managed via Prisma schema)
- redemptions(merchant_id, redeemed_at)
- redemptions(company_id, redeemed_at)
- redemptions(offer_id, redeemed_at)
- merchant_offers(merchant_id, status)
- merchant_offers(status, start_date, end_date)
- action_queue_items(status, type)
- audit_logs(entity_type, created_at)
- notification_events(recipient_id, is_read)
```

## Monitoring

- **Vercel Analytics** for frontend performance
- **Sentry** for error tracking
- **Supabase Logs** for database queries
- **Custom health check** endpoint (/api/health)
- **Realtime connection health** indicator in dashboard header
