# BRND Direct — Next.js shell

The original static BRND portal is mirrored under **`public/`** (same URLs as before: `/buyer/dashboard.html`, `/seller/`, `/css/`, `/js/`, etc.). Next.js only provides the host; those HTML/CSS/JS files are unchanged.

## Run locally

```bash
npm install
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000) — redirects to `/index.html` (preview launcher).
- Buyer portal example: [http://localhost:3000/buyer/dashboard.html](http://localhost:3000/buyer/dashboard.html).

## Supabase (Next.js)

1. Copy `web/.env.example` → `web/.env.local` and fill keys from the Supabase dashboard.
2. Run `supabase/schema.sql` then `supabase/migrations/*.sql` in the Supabase SQL editor (see `CLIENT_TASKS.md` at repo root).
3. Use `createBrowserSupabaseClient()` / `createServerSupabaseClient()` from `src/lib/supabase/`.

## Deploy (Vercel)

Connect this `web` folder (or monorepo with root set to `web`) to Vercel. Add the same `NEXT_PUBLIC_*` env vars in the Vercel project settings.

## Cloudflare Pages

This app is also deployed to Cloudflare Pages at `app.brnddirect.com`.

## Next steps

Gradually replace static routes with React pages under `src/app/` while reusing `public/` assets, or wire Supabase from new Route Handlers — without removing the legacy mirror until each route is ported.
