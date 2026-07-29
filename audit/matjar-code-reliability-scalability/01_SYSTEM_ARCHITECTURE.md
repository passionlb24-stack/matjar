# 01 — System Architecture

_Audit date: 2026-07-29 · Checkpoint 0 (inspection only) · Evidence-based._

## Stack (verified from `package.json`, config, source)

| Layer | Technology | Version | Evidence |
|---|---|---|---|
| Language | TypeScript | ^5 | `package.json` |
| Frontend/SSR | Next.js App Router | 16.2.9 | `package.json`, `src/app/[lang]/…` route groups |
| UI runtime | React | 19.2.4 | `package.json` |
| Styling | Tailwind CSS | ^4 | `postcss.config.mjs`, `package.json` |
| Data/API | Supabase (Postgres + PostgREST + RLS) | `@supabase/supabase-js` ^2.109 | `src/lib/supabase/*`, 194 migrations |
| Business logic | Postgres `SECURITY DEFINER` RPCs | — | `supabase/migrations/*.sql` |
| Auth | Supabase Auth (email + Google OAuth) | — | `src/components/auth-forms.tsx`, `auth.users` |
| Storage | Supabase Storage | — | `phase2_storage_bucket` migration |
| Mobile | Capacitor (hosted-hybrid shell) | @capacitor/core ^8.4.1 | `capacitor.config.ts`, `android/`, `ios/` |
| Hosting | Vercel (push-to-`main` deploy) | — | `vercel.json` |
| Tests | Vitest | ^4.1.10 | `vitest.config.ts`, 8 test files |
| Lint | ESLint | ^9 | `eslint.config.mjs` |
| i18n | Custom dictionaries (ar/en), RTL default | — | `src/i18n/dictionaries/{ar,en}.json` |

## Request flow (canonical)

```
Browser (RTL Arabic default, /[lang]/…)
  │
  ├─ Server Component page.tsx  ──►  src/lib/supabase/server (cookie-scoped client, RLS as caller)
  │        │                              └─ some reads via src/lib/data/*.ts (unstable_cache, anon client)
  │        └─ renders "use client" components (169 of 233 components are client)
  │
  ├─ Client Component  ──►  src/lib/supabase/client (browser client)
  │        └─ supabase.rpc("place_customer_order" | "place_booking" | …)  ← writes go through RPCs
  │
  ▼
Supabase PostgREST  ──►  RLS policies (every public table has RLS enabled)
  │                        └─ SECURITY DEFINER RPCs (server-side price/stock/availability recompute)
  │
  ├─ Postgres tables + triggers (notifications, audit_logs, order_events)
  ├─ Supabase Storage (logos, covers, product images, verification docs)
  └─ Web Push / realtime bridge (notifications table → push)
  │
  ▼
Response → React → hydration
```

## Architectural characteristics (observations)

- **RPC-centric write model.** Only **1** `use server` server action and **4** API routes exist (`src/app/api`). Virtually all mutations are Postgres `SECURITY DEFINER` RPCs called from client components. **Strength:** server-side price/stock/availability recompute is centralized in the DB and cannot be bypassed by the browser. **Risk:** business logic lives in SQL (harder to unit-test; 194 migrations are the source of truth).
- **Config-driven sector registry.** `src/lib/sectors.ts` + `src/lib/modules.ts` + `src/lib/store-experience.ts` are the single source of truth for which transaction surface each business type shows (resolver pattern). This replaced earlier hardcoded slug lists. See `07_RLS` / `03_CODE_QUALITY` for residual hardcoded-slug checks.
- **Heavy client rendering.** 169/233 components (72%) are `"use client"`. Reduces the RSC streaming benefit and grows the client bundle; acceptable where interactive, flagged where not (see `04_FRONTEND`, `10_PERFORMANCE`).
- **Single environment.** Only one Supabase project (`wesihatopiznatsyfxer`) and one Vercel target were found. **No staging environment** → load/stress tests cannot be run safely (see `13`/`14`).
- **Deploy = push to `main`.** No preview-gated migration pipeline; migrations are applied to the production DB directly via tooling and committed. This is a reliability risk (no staging rehearsal of migrations).

## Subsystem map

| Domain | Primary code | DB entities |
|---|---|---|
| Storefront (public) | `(site)/store/[id]`, `product/[id]`, `explore`, `search` | stores, products, product_variants, product_options, reviews |
| Ordering | `store-products.tsx`, `product-order.tsx` | orders, order_items, coupons, loyalty_ledger, order_payments, order_events |
| Booking | `booking-panel.tsx`, `timeslot-booking.tsx`, `classes-booking.tsx` | bookings, store_resources, store_classes, provider_availability_* |
| Vertical engines | lead-form, stay-search, join-action, event-tickets | leads, stay_bookings, accommodation_units, store_memberships, course_enrollments, event_tickets |
| Merchant OS | `(dashboard)/merchant/[storeId]/*` | store_modules, store_staff, store_tasks, store_customers, inventory |
| Admin | `(dashboard)/admin/*` | admin roles, moderation, academy_guides, business_leaders, site_pages |
| Messaging | `messages/*` | conversations, messages |
| Growth | loyalty, referral, flash, featured, campaigns | loyalty_ledger, referrals, store_campaigns |

_See `02_REPOSITORY_INVENTORY.csv` for the full folder inventory._
