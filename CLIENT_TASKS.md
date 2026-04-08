# Client scope — BRND Direct (working checklist)

Use this with `developer-brief.html` for full technical detail.  
**Live app:** Vercel project `brnd-direct` → production URL from [Vercel dashboard](https://vercel.com) (e.g. `https://brnd-direct.vercel.app`).

---

## Phase 1 — MVP (client confirmed)

| Area | Static UI (today) | Backend / product work you still need |
|------|-------------------|----------------------------------------|
| **Dashboard** | `buyer/dashboard.html` | KPIs from Supabase (orders, spend, alerts) |
| **Products** | `buyer/products.html` | List/search products from `products` + brands; cart stays in sync |
| **Orders** | `buyer/orders.html` | CRUD + status flow (draft → confirmed → paid → packed → shipped) |
| **Dropship** | `buyer/dropship.html` | Shopify + webhooks + automation (see developer brief); heavy Phase 1 item |
| **Analytics** | `buyer/analytics.html` | Aggregates / charts from real order + revenue data |
| **Invoices & payments** | `buyer/invoices.html`, `payment-portal.html` | Invoices table + Stripe PaymentIntents + webhooks |
| **Reports** | `buyer/reports.html` | Exports / saved reports from DB queries |
| **Shipping** | `buyer/shipping-logistics.html` | Shipments, tracking, carrier APIs when keys exist |
| **Settings (+ team)** | `buyer/account.html` → Team Members | Supabase Auth + `buyer_account_members` (see `supabase/migrations/`); invites & roles |

## Explicitly **not** Phase 1

- RFQ (`buyer/rfq.html`) — hide link or leave static; no backend sprint.
- Trade finance (`buyer/trade-finance.html`, related settings copy) — same.
- Warehousing (`buyer/warehousing.html`) — same.

## Phase 2 (client)

- **Messages** (`buyer/messages.html`) — Realtime or polling; defer.
- **Help & support** (`buyer/help.html`) — Ticketing or docs; defer.

---

## Engineering order (suggested)

1. **Supabase project** → run `supabase/schema.sql` in SQL Editor → run team migration in `supabase/migrations/*.sql`.
2. **Env on Vercel + local** → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `web/.env.example`).
3. **Auth** → buyer (and later seller) sign-up/sign-in; replace `sessionStorage` demo with real sessions in Next + RLS.
4. **Vertical slice** → products (read) → cart → create order → invoices → Stripe → shipping status.
5. **Settings / team** → org membership + invites (server actions + RLS).
6. **Dropship** → after core B2B order path is stable.

---

## Next.js app location

- Code: `web/` (deploy root on Vercel).
- Legacy HTML mirror: `web/public/` (same URLs as static site until each route is ported to `src/app`).

---

## Decisions to flag back to client (if they change scope)

- Password **`lock.html`** vs real Supabase auth on production domain.
- **Dropship** in Phase 1 vs Phase 1.5 (large integration surface).
- **Team roles** (owner / manager / viewer) and what each can do in RLS.
