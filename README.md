# BRND Direct Portal — Wholesale B2B Marketplace & Investor Demo

## 🎯 Investor Demo Portal
**Path**: `/investor/index.html`
A fully-designed investor-facing demo portal showcasing BRND DIRECT OS as a unicorn B2B wholesale SaaS platform.

### Demo Sections:
| Section | ID | Description |
|---------|-----|-------------|
| Hero / Overview | `#overview` | Architecture diagram, key stats, CTA |
| Commerce Module | `#commerce` | Buyer/Seller/Admin portal mockups with tabs |
| Embedded Finance | `#finance` | Credit scoring, Net-30 flow, virtual card |
| Logistics | `#logistics` | Smart Rate Engine, warehouse map, 3PL integrations |
| Data Moat | `#data` | AI credit model, live metrics, benchmarks |
| Financials | `#financials` | Revenue streams, 24-month projections, roadmap |
| Competitive | `#competitive` | Feature comparison vs Faire, Balance, Shopify B2B |
| CTA | `#contact` | Request investment deck |

### Demo Files:
- `investor/index.html` — Full investor demo page
- `investor/css/demo.css` — Full dark-theme styling (48K)
- `investor/js/demo.js` — Charts (Chart.js), animations, counters, particles

---

## Overview
A full-featured wholesale B2B buyer portal built with vanilla HTML/CSS/JS. Buyers can browse products, build orders (via cart, PO upload, or manual order builder), pay invoices, and schedule shipments — all in one connected flow.

---

## 🚀 Order Flow — 6 Steps (CORRECT ORDER)

The portal implements a clear, guided, end-to-end wholesale order journey. Each page is designed for its specific step:

| Step | Page | Role | Buyer Action |
|------|------|------|-------------|
| **1. Browse & Add to Cart** | `products.html` | Entry point | Search catalogue, add items (MOQ enforced). Cart popup → "Proceed to Step 2 →" |
| **2. Confirm Order** | `cart.html` | **Step 2 is here** | Review cart, select shipping, set payment terms, enter PO#, click "Confirm & Place Order". Generates invoice. Auto-redirects to invoices.html |
| **3. Seller Confirms** | `orders.html` → Step 3 tab | Waiting state | Buyer waits. Orders show in "Seller Confirms" tab with "Pending" status. "Send Reminder" option available. |
| **4. Pay Invoice** | `invoices.html` | **Buyer action** | Seller confirms → Invoice issued. Prominent green "Pay Now" banner. Payment unlocks Step 5. Success screen shows "Step 5 Starting Now" |
| **5. Seller Packs** | `orders.html` → Step 5 tab | Waiting state | After payment, seller picks, packs, confirms dimensions & weight. Buyer monitors in Step 5 tab. |
| **6. Schedule Shipping** | `shipping-logistics.html` | **Buyer action** | Seller marks packed → "Book Shipment" tab is default. Ready-to-ship cards with "Schedule Shipment" buttons. Carrier booking via Freightos/Shippo |

### Journey Strip
A **6-step journey banner** appears on every key page showing:
- ✅ Completed steps (green checkmark)
- 🔵 Current step (active/highlighted with "← YOU ARE HERE")  
- ⬜ Future steps (grayed out)

### Tab Order on `orders.html`
Tabs are ordered **1 → 6** to match the flow, then utility tabs:
`1. Browse & Cart` | `2. Order Cart` | `3. Seller Confirms` | `4. Pay Invoice` | `5. Seller Packs` | `6. Schedule Shipping` | `Upload PO (AI)` | `All Orders`

---

## ✅ Completed Features

### Cart (`buyer/cart.html`) — **This is STEP 2**
- ✅ Journey banner shows Step 1 (done) + **Step 2 active** (← YOU ARE HERE) + Steps 3–6 pending
- ✅ 3-step cart progress bar: Review Cart (done) → **Confirm Order (active)** → Awaiting Seller
- ✅ Cart table with qty stepper, MOQ validation, remove items
- ✅ Shipping method selector (Standard / Express / Overnight / Warehouse Pickup)
- ✅ PO reference & notes fields
- ✅ Payment terms selector (Net-30, Net-60, Prepay, COD)
- ✅ "Confirm & Place Order" button with processing animation
- ✅ Success overlay showing Order #, Invoice #, PO reference, due date
- ✅ "What Happens Next" guide in success overlay
- ✅ Auto-redirect to invoices.html after 12s
- ✅ Invoice saved to sessionStorage for invoices.html to pick up

### Orders (`buyer/orders.html`) — **Steps 1–6 Hub**
- ✅ Master 6-step flow tracker with clickable steps and action badges
- ✅ Step tabs IN ORDER: Browse & Cart (1) | Order Cart (2) | Seller Confirms (3) | Pay Invoice (4) | Seller Packs (5) | Schedule Shipping (6) | [separator] Upload PO | All Orders
- ✅ Each step tab shows orders at that stage with the correct CTA
- ✅ **Step 6 tab** shows "packed" orders ready for carrier booking (NOT shipped/delivered — those go to All Orders)
- ✅ URL param support: `orders.html?tab=step5` opens the Step 5 panel
- ✅ Status filter chips (All / Pending / Awaiting Pay / Packing / Shipped / Delivered / Cancelled)
- ✅ Orders table with Pay button for awaiting_payment orders, Ship button for packed orders
- ✅ Order detail full-screen overlay with fulfillment timeline, items table, tracking, payment status
- ✅ "Pay Now" card in order detail when order is confirmed and unpaid
- ✅ **Upload PO (AI)**: Drag-drop zone, file picker, 3 demo POs (Fashion/Beauty/Footwear)
  - AI parse simulation with 5-step animation
  - Editable PO header fields + line items table with live totals
  - Catalogue match badges (Matched / Partial / Not Found)
  - Generate Sales Order + Invoice button with success screen + next steps guide
- ✅ **Manual Order Builder**: 
  - PO reference, payment terms, required-by date, ship-to fields
  - Product search + brand filter
  - Product picker grid with select/deselect, quantity controls
  - Sticky order summary panel with live subtotals
  - Generate Order + Invoice with success screen
- ✅ AI Assistant floating button (brain FAB) with contextual chat
- ✅ Export CSV functionality

### Invoices (`buyer/invoices.html`) — **This is STEP 4**
- ✅ Journey strip: Steps 1–3 done (✓) + **Step 4 active** ("← YOU ARE HERE") + Steps 5–6 pending
- ✅ Prominent green "Step 4 Action Required" banner with $12,340 outstanding
- ✅ Mini step flow strip inside banner: 3 → **4 PAY** → 5 → 6
- ✅ Invoice stats (Total Billed, Outstanding, Overdue, Paid This Month)
- ✅ Invoice list with Outstanding / Paid / Upcoming filter tabs
- ✅ Payment portal (4-step wizard: Select → Method → Review → **Complete**)
- ✅ **Payment success screen** shows "Step 5 Starting Now — Seller begins packing"
- ✅ Post-pay CTAs: "Track Packing (Step 5)" → orders.html?tab=step5, "View Shipping (Step 6)" → shipping-logistics.html

### Shipping & Logistics (`buyer/shipping-logistics.html`) — **This is STEP 6**
- ✅ Journey strip: Steps 1–5 done (✓) + **Step 6 active** ("← YOU ARE HERE")
- ✅ "3 Orders Packed & Ready to Ship" banner with "Schedule Shipment" CTA
- ✅ Ready-to-Ship cards (BD-48287, BD-48283, BD-48280) each with "Schedule Shipment" button
- ✅ **"Book Shipment" tab is now FIRST and default active** (correct for step 6 action)
- ✅ My Shipments, Live Tracking, Documents, Rate Compare tabs follow
- ✅ Freightos + Shippo integration banners (live rate connections)
- ✅ KPI strip (Active Shipments, Delivered, Avg Transit, Freight Cost, Exceptions)

### Sidebar Navigation
- ✅ All pages: "Order Cart" sidebar link points to `cart.html`
- ✅ Cart badge shows item count across all pages

---

## 📁 File Structure

```
buyer/
├── index.html              Login
├── register.html           Registration
├── dashboard.html          Dashboard with KPIs
├── products.html           Product catalogue (add to cart)
├── cart.html               Order cart + confirm flow  ← KEY
├── orders.html             Order management + Upload PO + Manual Order  ← KEY
├── invoices.html           Invoices + payment portal  ← KEY
├── shipping-logistics.html Shipping + ready-to-ship  ← KEY
├── analytics.html          Analytics charts
├── rfq.html                Request for Quote
├── dropship.html           Dropship orders
├── trade-finance.html      Trade finance / BNPL
├── warehousing.html        Warehouse management
├── messages.html           Messaging
├── reports.html            Reports
├── account.html            Account settings
├── help.html               Help & support
├── payment-portal.html     Standalone payment portal
└── reset-password.html     Password reset

css/
└── portal.css              Global portal stylesheet

js/
├── portal.js               Global portal JS (sidebar, toasts, etc.)
└── catalog-api.js          Live catalog API client (Cloudflare Worker → Supabase)

setup/
└── connect-catalog.html    Step-by-step guide to connect live Cloudflare catalog

workers/
└── api.js                  Cloudflare Worker API (Stripe, Shipping, + Catalog endpoints)

supabase/
└── schema.sql              Full PostgreSQL schema for Supabase
```

---

## 🔌 Live Catalog Integration (Cloudflare → Supabase)

### Architecture
```
Supabase DB (PostgreSQL)  →  Cloudflare Worker (api.js)  →  buyer/products.html
   products / brands              /api/products                  fetch() via
                                  /api/brands                    catalog-api.js
```

### New API Endpoints (in workers/api.js)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products` | Paginated product list with filters |
| `GET` | `/api/products/:id` | Single product by UUID |
| `GET` | `/api/brands` | All active brands |

### Query Parameters for `/api/products`
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 50 | Results per page (max 200) |
| `search` | — | Full-text search (name, SKU) |
| `category` | — | Filter by category |
| `brand_id` | — | Filter by brand UUID |
| `sort` | name | Sort field |
| `fulfillment_type` | — | wholesale / dropship / both |

### Setup Steps (Full guide: `setup/connect-catalog.html`)
1. Get Supabase URL + service_role key from Supabase Dashboard → Settings → API
2. Add both as **encrypted secrets** in Cloudflare Dashboard → Worker → Settings → Variables
3. Copy updated `workers/api.js` into Cloudflare Worker editor and Deploy
4. Open `buyer/products.html` — it auto-detects the API and loads live data
5. Falls back gracefully to static demo data if API is unavailable

### Required Worker Secrets
```
SUPABASE_URL                  = https://YOUR_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY     = eyJ... (long JWT, from Supabase Settings → API → service_role)
```

---

## 🔗 Key Navigation Paths

| User Action | URL |
|-------------|-----|
| **Step 1**: Browse products & add to cart | `buyer/products.html` |
| **Step 2**: Review cart & confirm order | `buyer/cart.html` |
| **Step 3**: Monitor seller confirmation | `buyer/orders.html` → Step 3 tab |
| **Step 4**: Pay outstanding invoices | `buyer/invoices.html` |
| **Step 5**: Monitor seller packing | `buyer/orders.html?tab=step5` |
| **Step 6**: Schedule shipment | `buyer/shipping-logistics.html` |
| Upload a PO (AI-powered) | `buyer/orders.html` → Upload PO tab |
| All orders history | `buyer/orders.html` → All Orders tab |

---

## 🛠 Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Fonts**: Plus Jakarta Sans, Inter, Outfit (Google Fonts)
- **Icons**: Font Awesome 6.5.0
- **Charts**: Chart.js 4.4.0 (shipping-logistics, analytics)
- **Data Persistence**: sessionStorage (cart, new invoices)
- **Carrier Integrations** (UI): Freightos, Shippo, FedEx, UPS, USPS, DHL

---

## 🛒 Dropship Automation Module

**File:** `buyer/dropship.html` (158KB)

### What it does
Buyers who have a Shopify store can connect it to BRND Direct and use the full dropship pipeline. This module has **complete UI** and needs backend integration.

### 8 Tabs
| Tab | Feature |
|-----|---------|
| Overview | Full automation flow diagram + connected store stats |
| Connect Store | 5-step Shopify wizard (install, credentials, catalog, mode, go-live) |
| Catalog Sync | Push 1,240+ products to Shopify, pricing rules, stock sync |
| Automation Mode | Full Auto vs Daily Confirm selection |
| Daily Orders | Morning confirmation queue (6 AM email, 11 AM deadline) |
| Tracking Push | 6-step diagram, stats (31 pushes today, <30s delay, 99.98% success) |
| Auto-Invoices | Daily invoice generation settings + history |
| Analytics | 8 KPI cards + 6 Chart.js charts + Top Customers table |

### Two Automation Modes
- **Full Auto:** Auto-ship daily. Requires Net-30/60/90 credit or pre-pay. No manual confirmation.
- **Daily Confirm:** Receive orders at 6 AM → confirm by 11 AM EST → BRND ships at 3 PM → invoice at midnight.

### Shopify Integration Needs (Backend Build)
1. Connect via Shopify OAuth app or manual API token
2. Scopes needed: `read_orders`, `write_orders`, `read_products`, `write_products`, `write_fulfillments`
3. Catalog sync: push products/pricing/images to merchant's Shopify store
4. Order webhook: `orders/create` → import to BRND Direct DB
5. Tracking push: call Shopify Fulfillment API after shipment
6. Daily invoice auto-generation (midnight cron)
7. Credit line check before auto-ship

### New DB Tables Needed
```sql
shopify_stores     -- store_url, api_token_encrypted, automation_mode, last_sync_at
shopify_orders     -- shopify_order_id, internal_order_id, fulfillment_id
dropship_invoices  -- date, orders_count, wholesale_total, shipping, credit_applied, total_due
```

---

## 👔 Seller Portal

**Path:** `seller/` directory (11 pages)

| File | Purpose |
|------|---------|
| `seller/index.html` | Seller login page |
| `seller/dashboard.html` | Revenue + order KPIs |
| `seller/orders.html` | **CRITICAL:** Confirm orders, pack, enter tracking |
| `seller/products.html` | Product catalog management |
| `seller/wholesale-pricing.html` | Price tiers, volume discounts, MAP |
| `seller/analytics.html` | Revenue, top products, fulfillment metrics |
| `seller/payouts.html` | Stripe Connect payouts (12% commission taken) |
| `seller/brand-hub.html` | Brand profile management |
| `seller/messages.html` | Buyer ↔ seller conversations |
| `seller/account.html` | Seller account settings |
| `seller/register.html` | Seller registration |

---

## 🛡 Admin Portal

**File:** `admin/index.html` (73KB single-page dashboard)

Features: Approve/reject buyers and sellers, set credit limits, oversee all orders, dispute management, platform revenue (GMV), commission tracking, pending payouts to sellers, platform settings (commission rate, max credit limit).

---

## 🔌 Third-Party Integrations Required

| Service | Purpose | Status |
|---------|---------|--------|
| **Supabase** | PostgreSQL DB + Auth + Realtime + Storage | Schema ready — not connected |
| **Stripe** | Buyer payments + Seller payouts (Connect) | Worker scaffold — needs keys |
| **Shopify Admin API** | Dropship catalog sync + order webhook + tracking | UI only — not built |
| **Freightos** | LTL/FTL freight quotes, booking, BOL | Worker built — needs API keys |
| **Shippo** | Parcel labels, rates (FedEx/UPS/USPS/DHL) | Worker built — needs API key |
| **SendGrid/Resend** | Transactional emails (9 templates needed) | Not built |
| **OpenAI/Claude** | AI PO parsing (Upload PO feature) | UI simulated — not connected |

---

## 📋 Backend Build Priority

### P0 — Critical (must do first, unblocks everything)
1. Deploy `supabase/schema.sql` to Supabase SQL Editor
2. Connect Cloudflare Worker to Supabase (add secrets)
3. Implement Supabase Auth (login/register/logout, JWT validation)
4. Order CRUD API (POST /api/orders, GET /api/orders, PATCH /api/orders/:id)
5. Invoice API + Stripe payment flow
6. Seller order confirmation (PATCH status: pending → confirmed)

### P1 — High Priority
7. Carrier integration (Freightos + Shippo API keys)
8. Email notifications (9 templates)
9. Seller packing + tracking entry
10. Stripe Connect + seller payout system
11. Admin panel backend (approvals, credit, oversight)

### P2 — Shopify Dropship
12. Shopify OAuth app or manual API token flow
13. Catalog sync to Shopify
14. Order webhook import
15. Full Auto + Daily Confirm automation modes
16. Tracking push to Shopify fulfillments
17. Daily invoice auto-generation
18. AI PO parsing (OpenAI)

### P3 — Advanced
19. Analytics APIs (buyer + seller + admin)
20. RFQ backend
21. Supabase Realtime messaging
22. PDF invoice generation
23. Reports + CSV export

---

## 🔑 Environment Secrets Required

```bash
# Cloudflare Worker (wrangler secret put KEY)
SUPABASE_URL                    = https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
STRIPE_SECRET_KEY               = sk_live_xxx
STRIPE_WEBHOOK_SECRET           = whsec_xxx
FREIGHTOS_CLIENT_ID             = from Freightos dashboard
FREIGHTOS_CLIENT_SECRET         = from Freightos dashboard
FREIGHTOS_BASE_URL              = https://api.freightos.com
SHIPPO_API_TOKEN                = shippo_live_xxx
SHOPIFY_APP_SECRET              = for webhook signature verification
SENDGRID_API_KEY                = or RESEND_API_KEY
OPENAI_API_KEY                  = for AI PO parsing
SHIP_FROM_NAME                  = BRND Direct Warehouse
SHIP_FROM_STREET1               = Warehouse street address
SHIP_FROM_CITY                  = City
SHIP_FROM_STATE                 = State (2-letter)
SHIP_FROM_ZIP                   = ZIP code
SHIP_FROM_COUNTRY               = US
```

---

## 📄 Developer Documentation

- **`developer-brief.html`** — Full HTML developer brief with all features, flows, API specs, DB schema, integration requirements, and prioritized build checklist. Hand this to your development team.

---

## 🔮 Recommended Next Steps

### Sprint 1 (Week 1–2) — Core
1. Deploy Supabase schema + connect Worker
2. Supabase Auth (login/register/logout)
3. Products API from Supabase
4. Order creation + invoice + Stripe payment
5. Seller order confirmation flow

### Sprint 2 (Week 3–4) — Fulfillment
6. Freightos + Shippo carrier integration
7. Tracking push (seller → buyer)
8. Stripe Connect + seller payouts
9. Admin approvals + credit management
10. All 9 email templates

### Sprint 3 (Week 5–7) — Shopify Dropship
11. Shopify OAuth / manual token connect
12. Catalog sync to Shopify
13. Order webhook + automation modes
14. Tracking push to Shopify
15. Daily invoice auto-generation

### Sprint 4 (Week 8–10) — Advanced
16. AI PO parsing (OpenAI)
17. RFQ system
18. Realtime messaging
19. Analytics dashboards
20. Phase 2: WooCommerce, Amazon, TikTok Shop
