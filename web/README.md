# BRND Direct — Next.js shell

The original static BRND portal is mirrored under **`public/`** (same URLs as before: `/buyer/dashboard.html`, `/seller/`, `/css/`, `/js/`, etc.). Next.js only provides the host; those HTML/CSS/JS files are unchanged.

## Run locally

```bash
npm install
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000) — redirects to `/index.html` (preview launcher).
- Buyer portal example: [http://localhost:3000/buyer/dashboard.html](http://localhost:3000/buyer/dashboard.html).

## Deploy (Vercel)

Connect this `web` folder (or monorepo with root set to `web`) to Vercel. No framework change needed beyond standard Next.js.

## Next steps

Gradually replace static routes with React pages under `src/app/` while reusing `public/` assets, or wire Supabase from new Route Handlers — without removing the legacy mirror until each route is ported.
