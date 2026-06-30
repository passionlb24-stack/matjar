# متجر · Matjar

منصّة التجارة المحلية في لبنان — كل متجر، منتج، وخدمة بمكان واحد.
Local commerce platform for Lebanon.

## Tech Stack

- **Next.js 16** (App Router, Turbopack, Server Components)
- **React 19**
- **Supabase** (Postgres + Auth + RLS + Storage)
- **Tailwind CSS v4**
- **TypeScript**
- **i18n**: Arabic (default, RTL) + English (LTR)

## Project Structure

```
src/
  app/
    [lang]/          # locale-prefixed routes (/ar, /en)
      layout.tsx     # root layout — sets lang + dir
      page.tsx       # landing page
    globals.css      # Tailwind v4 theme + design tokens
  components/         # shared UI components
  i18n/
    config.ts        # locales, default, direction
    get-dictionary.ts# server-only dictionary loader
    dictionaries/    # ar.json, en.json
  lib/
    supabase/        # browser + server clients
  modules/           # business-type modules (food, retail, services, ...)
  proxy.ts           # locale routing (Next 16 "proxy", formerly middleware)
```

## Getting Started

1. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL and keys.

2. Install dependencies and run the dev server:
   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/ar`.

## Roadmap

- **Phase 0** — Foundation (this) ✅
- **Phase 1** — Auth, roles & permissions, store creation, business types
- **Phase 2** — Commerce core (products, cart, orders)
- **Phase 3** — Services & bookings
- **Phase 4** — Plans & subscriptions
- **Phase 5** — Reviews, search, notifications, analytics
