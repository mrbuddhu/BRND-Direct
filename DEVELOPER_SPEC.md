# BRND Direct Portal — Full Developer Specification
### Version 1.0 · March 2026
### Prepared for: Backend & Frontend Developer Handoff

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [User Roles](#4-user-roles)
5. [Complete Site Map & Pages](#5-complete-site-map--pages)
6. [Buyer Portal — Full Feature Spec](#6-buyer-portal--full-feature-spec)
7. [Seller / Admin Portal — Full Feature Spec](#7-seller--admin-portal--full-feature-spec)
8. [Dropship Module — Full Feature Spec](#8-dropship-module--full-feature-spec)
9. [Database Schema](#9-database-schema)
10. [API Endpoints Required](#10-api-endpoints-required)
11. [Authentication & Security](#11-authentication--security)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [Email Notifications](#13-email-notifications)
14. [Current Frontend Status](#14-current-frontend-status)
15. [Backend To-Do List](#15-backend-to-do-list)
16. [Environment Variables & Secrets](#16-environment-variables--secrets)
17. [Deployment Architecture](#17-deployment-architecture)

---

## 1. PROJECT OVERVIEW

**BRND Direct** is a wholesale B2B marketplace and dropship automation platform.

**What it does:**
- Brands / Sellers list their products at wholesale prices
- Buyers (retailers, resellers) browse, order, and pay for inventory
- Buyers can also enroll in **Dropship Automation** — connecting their Shopify store so customer orders auto-route to BRND Direct for same-day fulfillment, with tracking pushed back automatically

**Business Model:**
- BRND Direct charges sellers a commission on each sale (configurable per seller)
- Buyers get wholesale pricing with net payment terms (Net-30 / Net-60 / Net-90) or prepay
- Dropship buyers pay per-order wholesale cost + shipping, invoiced daily

**Current State:**
- Full HTML/CSS/JS frontend has been designed and built (static, no live backend yet)
- Cloudflare Workers API skeleton exists (`workers/api.js`)
- Supabase PostgreSQL schema exists (`supabase/schema.sql`)
- All pages are built and functional as UI demos — backend needs to be wired in

---

## 2. TECHNOLOGY STACK

### Frontend (already built)
| Layer | Technology |
|-------|-----------|
| HTML | HTML5, semantic markup |
| CSS | Custom CSS design system (`buyer/css/portal.css`) |
| JavaScript | Vanilla JS (ES6+), no framework |
| Fonts | Plus Jakarta Sans, Inter, Outfit (Google Fonts) |
| Icons | Font Awesome 6.5.0 (CDN) |
| Charts | Chart.js 4.4.0 (CDN) |
| Session storage | `sessionStorage` for cart, temp invoice state |

### Backend (to be implemented)
| Layer | Technology |
|-------|-----------|
| API / Edge Functions | Cloudflare Workers (already scaffolded) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + magic link) |
| Payments | Stripe (payment intents, setup intents, Connect for seller payouts) |
| File Storage | Supabase Storage (product images, PO documents, invoices) |
| Email | Resend.com or SendGrid (transactional emails) |
| Shipping — Parcel | Shippo API |
| Shipping — Freight | Freightos API |
| Shopify Integration | Shopify Admin API + Webhooks (dropship module) |
| PDF Generation | Puppeteer via Worker / Cloudflare Browser Rendering |

### Hosting & Infrastructure
| Service | Purpose |
|---------|---------|
| Cloudflare Pages | Static frontend hosting |
| Cloudflare Workers | API layer (serverless) |
| Supabase | PostgreSQL database + Auth + Storage |
| Custom domain | brnddirect.com |

---

## 3. SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BRND Direct Portal                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   BUYER BROWSER              SELLER/ADMIN BROWSER                   │
│   buyer/*.html               seller/*.html / admin/*.html           │
│        │                              │                              │
│        └──────────┬───────────────────┘                             │
│                   │                                                  │
│                   ▼                                                  │
│         Cloudflare Pages (CDN)                                       │
│         - Serves static HTML/CSS/JS                                  │
│         - _redirects enforces auth gate                              │
│         - _headers adds security headers                             │
│                   │                                                  │
│                   ▼                                                  │
│         Cloudflare Workers (/api/*)                                  │
│         workers/api.js                                               │
│         - REST API for all data operations                           │
│         - Handles auth token verification                            │
│         - Calls Supabase, Stripe, Shippo, Freightos                  │
│                   │                                                  │
│         ┌─────────┼──────────────────────────────────┐             │
│         │         │                │                  │             │
│         ▼         ▼                ▼                  ▼             │
│    Supabase    Stripe           Shippo           Freightos          │
│    PostgreSQL  Payments         Parcel           Freight            │
│    + Auth      + Connect        Labels           Quotes             │
│    + Storage   for Sellers      + Tracking       + Booking          │
│                                                                      │
│                   │                                                  │
│                   ▼                                                  │
│         Shopify API (per connected store)                            │
│         - Webhook: orders/create → auto-import                       │
│         - Push: fulfillments/create → tracking                       │
│         - Sync: products/create + update → catalog                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. USER ROLES

### 4.1 Buyer (Wholesale Retailer)
- Browses and purchases products at wholesale prices
- Can enroll in dropship automation (connect Shopify)
- Manages orders, invoices, shipping, and payments
- Has credit limit and net payment terms assigned by admin

### 4.2 Seller (Brand / Supplier)
- Lists products with wholesale pricing, images, descriptions
- Confirms buyer orders → triggers invoice payment
- Marks orders as packed → triggers shipping step
- Receives payouts via Stripe Connect
- Views their own sales analytics and reports

### 4.3 Admin (BRND Direct Staff)
- Full access to all buyers and sellers
- Approves seller registrations and product listings
- Sets buyer credit limits and payment terms
- Views platform-wide analytics
- Manages commissions, disputes, and support

### 4.4 Role Field in Database
```sql
type user_role AS ENUM ('buyer', 'seller', 'admin');
```
Stored in `profiles.role`.

---

## 5. COMPLETE SITE MAP & PAGES

### 5.1 Authentication / Entry Pages
| File | URL | Purpose |
|------|-----|---------|
| `index.html` | `/` | Preview launcher (dev only) → redirects to lock.html in prod |
| `lock.html` | `/lock.html` | Password gate (front-end security layer) |
| `buyer/index.html` | `/buyer/` | Buyer sign in |
| `buyer/register.html` | `/buyer/register` | Buyer registration |
| `buyer/reset-password.html` | `/buyer/reset-password` | Password reset |

### 5.2 Buyer Portal Pages
| File | URL | Step | Purpose |
|------|-----|------|---------|
| `buyer/dashboard.html` | `/buyer/dashboard` | — | KPI overview, recent orders, quick actions |
| `buyer/products.html` | `/buyer/products` | **Step 1** | Product catalog + add to cart |
| `buyer/cart.html` | `/buyer/cart` | **Step 2** | Cart review + order confirmation |
| `buyer/orders.html` | `/buyer/orders` | **Steps 3 & 5** | Order management hub |
| `buyer/invoices.html` | `/buyer/invoices` | **Step 4** | Invoice list + payment portal |
| `buyer/shipping-logistics.html` | `/buyer/shipping` | **Step 6** | Shipment booking + tracking |
| `buyer/dropship.html` | `/buyer/dropship` | — | Dropship automation module |
| `buyer/analytics.html` | `/buyer/analytics` | — | Sales analytics & charts |
| `buyer/rfq.html` | `/buyer/rfq` | — | Request for Quote |
| `buyer/messages.html` | `/buyer/messages` | — | Messaging center |
| `buyer/reports.html` | `/buyer/reports` | — | Detailed reports |
| `buyer/account.html` | `/buyer/account` | — | Profile, settings, billing |
| `buyer/help.html` | `/buyer/help` | — | Help & support center |
| `buyer/trade-finance.html` | `/buyer/trade-finance` | — | BNPL / trade financing |
| `buyer/warehousing.html` | `/buyer/warehousing` | — | Warehousing / storage |
| `buyer/payment-portal.html` | `/buyer/payment` | — | Standalone payment page |

### 5.3 Seller Portal Pages
| File | URL | Purpose |
|------|-----|---------|
| `seller-login.html` | `/seller/login` | Seller sign in |
| `seller-register.html` | `/seller/register` | Seller registration |
| `seller-dashboard.html` | `/seller/dashboard` | Seller overview |
| `seller-products.html` | `/seller/products` | Manage product listings |
| `seller-orders.html` | `/seller/orders` | Orders to fulfill |
| `seller-analytics.html` | `/seller/analytics` | Sales analytics |
| `seller-payouts.html` | `/seller/payouts` | Stripe payout management |
| `seller-brand-hub.html` | `/seller/brand-hub` | Brand profile management |
| `seller-wholesale-pricing.html` | `/seller/pricing` | Pricing tiers |
| `seller-messages.html` | `/seller/messages` | Messaging with buyers |
| `seller-account.html` | `/seller/account` | Account settings |

### 5.4 Setup / Admin Pages
| File | URL | Purpose |
|------|-----|---------|
| `setup/connect-catalog.html` | `/setup/catalog` | Guide to connect Supabase + Cloudflare |

---

## 6. BUYER PORTAL — FULL FEATURE SPEC

### 6.1 The 6-Step Wholesale Order Flow

Every buyer order follows these 6 steps in sequence. The UI shows a visual step-tracker on every page.

```
Step 1         Step 2          Step 3           Step 4       Step 5        Step 6
Browse &   →  Confirm       →  Seller        →  Pay       →  Seller     →  Schedule
Add to Cart    Order            Confirms         Invoice       Packs          Shipping
(products)     (cart)          (orders-s3)      (invoices)   (orders-s5)    (shipping)
```

---

### Step 1 — Browse & Add to Cart (`products.html`)

**Features:**
- Product grid with 3 view modes: Card Grid, List View, Text/Compact View
- Filter by: Category, Brand, Fulfillment Type (wholesale/dropship), Price Range, In-Stock only
- Search: full-text search across name, SKU, UPC, ASIN, brand
- Sort by: Name, Price (low/high), MOQ, Newest, Top Sellers
- Brand sidebar filter with checkboxes
- Each product card shows: Image, Name, Brand, Wholesale price, Retail (MSRP), Margin %, MOQ, Fulfillment type badge, In-stock indicator
- **Add to Cart**: quantity input respecting MOQ, adds to cart with sessionStorage
- Cart icon in topbar shows live item count
- **Product Modal**: full product detail overlay — description, all specs (size, concentration, origin, gender), ASIN/UPC/SKU, stock qty
- **Bulk Order CSV**: upload CSV with SKU/UPC/ASIN + quantity — bulk-adds to cart
- **Bulk Actions Bar**: select multiple → Add All to Order, RFQ, Export
- Pagination (50 per page)
- View toggle: Grid / List / Compact text

**Backend requirements:**
- `GET /api/products` — paginated product list with all filter params
- `GET /api/brands` — all active brands
- Cart state stored client-side (sessionStorage) — no API needed for cart itself
- Products must include: id, sku, upc, asin, name, brand_name, category, subcategory, wholesale_price, msrp, moq, stock_qty, images[], fulfillment_type, is_active, is_top_seller, description, tags[]

---

### Step 2 — Confirm Order (`cart.html`)

**Features:**
- Cart table: product image, name, brand, unit price, qty stepper (min = MOQ), line total, remove button
- MOQ validation: cannot set qty below MOQ
- Order summary sidebar: subtotal, estimated shipping, discount, total
- Shipping method selector: Standard Ground / Express 2-Day / Overnight / Warehouse Pickup
- PO Reference field (optional, text input)
- Notes for seller field
- Payment Terms selector: Net-30 / Net-60 / Net-90 / Prepay / COD
- "Confirm & Place Order" button → animated processing state (3 seconds) → success overlay
- **Success overlay** shows:
  - Order number (BD-XXXXX)
  - Invoice number (INV-XXXXX)
  - PO reference
  - Payment due date (based on terms)
  - 12-second auto-redirect to `invoices.html`
  - "What Happens Next" guide (3 steps: Seller confirms → Pay invoice → Seller ships)

**Backend requirements:**
- `POST /api/orders` — create order from cart items
  - Input: items[], shipping_method, payment_terms, po_reference, notes, shipping_address
  - Output: order { id, order_number, status: 'pending_confirmation', invoice_id }
- `POST /api/invoices` — auto-create invoice when order is placed
  - Invoice status: 'pending' (becomes 'issued' when seller confirms)
- Cart data passed from sessionStorage to API call

---

### Step 3 — Seller Confirms (`orders.html` → Step 3 tab)

**Features:**
- Tab shows all orders in status `pending_confirmation`
- Order cards show: Order #, items summary, total, date placed, seller name, status badge
- "Send Reminder" button → sends notification to seller
- Order detail overlay:
  - Full items list with quantities, prices
  - Timeline: Order Placed ✓ → Seller Confirming (active) → Invoice Issued → Paid → Packing → Shipped
  - Notes from buyer
  - Contact seller button

**Backend requirements:**
- `GET /api/orders?status=pending_confirmation` — buyer's pending orders
- `POST /api/orders/:id/reminder` — send reminder notification to seller
- Real-time status updates (Supabase Realtime or polling every 30s)

---

### Step 4 — Pay Invoice (`invoices.html`)

**Features:**
- Journey strip at top: Steps 1–3 ✓, Step 4 active, Steps 5–6 pending
- "Action Required" banner: outstanding balance total, "Pay Now" CTA
- Invoice stats: Total Billed, Outstanding, Overdue, Paid This Month
- Invoice list with filter tabs: Outstanding / Paid / Upcoming / All
- Each invoice row: Invoice #, Order #, date, due date, amount, status badge, "Pay" or "Download" button
- **4-Step Payment Wizard:**
  1. Select invoices to pay (checkboxes + "Select All")
  2. Choose payment method (Credit Card via Stripe, ACH/Bank Transfer, Wire Transfer, Net Terms)
  3. Review summary (invoice list, total, payment method, due date)
  4. Confirm & pay → animated processing → success screen
- **Payment success screen:**
  - "Paid! Step 5 Starting Now"
  - Confirmation number
  - CTA buttons: "Track Packing (Step 5)" → orders.html?tab=step5
  - CTA: "View Shipping (Step 6)" → shipping-logistics.html
- Invoice PDF download button
- Overdue alerts with red badges

**Backend requirements:**
- `GET /api/invoices` — buyer's invoices with filters (status, date range)
- `POST /api/create-payment-intent` — Stripe payment intent for invoice payment
- `POST /api/stripe-webhook` — handle payment_intent.succeeded → mark invoice paid → notify seller
- `GET /api/invoices/:id/pdf` — generate and return invoice PDF
- `PATCH /api/orders/:id` — update order payment_status to 'paid' → trigger seller notification

---

### Step 5 — Seller Packs (`orders.html` → Step 5 tab)

**Features:**
- Tab shows orders in status `paid` / `packing`
- Progress indicators per order: Paid ✓ → Packing In Progress → Ready to Ship
- "Estimated pack date" shown per order
- Order detail shows: items, quantities, shipping address, carrier preference
- Notification when seller marks order as packed (status → `packed`)

**Backend requirements:**
- `GET /api/orders?status=packing,packed` — buyer's orders being packed
- Supabase Realtime subscription on order status changes
- Push notification / email when status changes to `packed`

---

### Step 6 — Schedule Shipping (`shipping-logistics.html`)

**Features:**
- Journey strip: Steps 1–5 ✓, Step 6 active
- Banner: "X Orders Packed & Ready to Ship"
- **Book Shipment tab (default/first):**
  - Cards for each `packed` order with: Order #, items summary, weight/dimensions (entered by seller), destination address
  - "Schedule Shipment" button → rate comparison popup
  - Rate comparison: FedEx / UPS / USPS / Freightos (for freight >150 lbs)
  - Select carrier + service level → confirm booking → label generated
  - Routing logic: auto-use Freightos if weight >150 lbs or freight_class declared; else Shippo
- **My Shipments tab:** all active and completed shipments
- **Live Tracking tab:** tracking status + map for in-transit shipments
- **Documents tab:** BOLs, labels, customs docs
- **Rate Compare tab:** manual rate comparison tool
- Freightos integration banner (live freight quotes)
- Shippo integration banner (parcel rates)
- KPI strip: Active Shipments, Delivered MTD, Avg Transit Days, Total Freight Cost

**Backend requirements:**
- `POST /api/parcel/rates` — Shippo rates for parcel shipments
- `POST /api/parcel/purchase` — buy Shippo label
- `GET /api/parcel/track/:tracking_number` — parcel tracking
- `POST /api/freight/quote` — Freightos freight quote
- `POST /api/freight/book` — Freightos freight booking
- `GET /api/freight/track/:shipment_id` — freight tracking
- `PATCH /api/orders/:id` — update with tracking_info, status → 'shipped'

---

### 6.2 Dashboard (`dashboard.html`)

**Features:**
- KPI cards: Total Orders, Pending Invoices, Active Shipments, Monthly Spend
- Recent Orders table (5 most recent with status badges)
- Quick action buttons: Browse Products, View Orders, Pay Invoices, Schedule Shipping
- Spend analytics mini-chart (monthly bar chart)
- Low Stock Alerts (products buyer ordered that are now low stock)
- Account rep contact card
- Upcoming invoice due dates
- Recent messages preview

**Backend requirements:**
- `GET /api/dashboard/stats` — KPI summary for the logged-in buyer
- `GET /api/orders?limit=5&sort=created_at` — recent orders
- `GET /api/invoices?status=outstanding&limit=5` — upcoming due invoices

---

### 6.3 Upload PO (AI-Powered) — Inside `orders.html`

**Features:**
- Drag-and-drop zone for PDF/CSV/Excel PO documents
- 3 demo PO files (Fashion, Beauty, Footwear)
- AI parse simulation with 5-step animated progress:
  1. Uploading document
  2. Extracting text
  3. Identifying products
  4. Matching to catalog
  5. Building order
- Editable PO header: PO Number, Buyer Name, Ship-To Address, Required-By Date, Payment Terms
- Line items table with match badges:
  - ✅ Matched (SKU found in catalog)
  - ⚠ Partial (fuzzy match, needs confirmation)
  - ❌ Not Found (no match)
- Editable quantities and prices on each line
- "Generate Sales Order + Invoice" button → success screen with order/invoice numbers

**Backend requirements:**
- `POST /api/po/parse` — accept file upload, call OpenAI (or similar LLM) to extract line items
  - Returns: po_number, buyer_name, ship_to, required_by, line_items[]
  - Each line item: description, qty, unit_price, sku_match (from catalog lookup)
- `POST /api/orders` — create order from parsed PO data

---

### 6.4 Manual Order Builder — Inside `orders.html`

**Features:**
- PO Reference field
- Payment Terms dropdown
- Required-By Date picker
- Ship-To address fields (name, street, city, state, zip, country)
- Product search with brand filter
- Product picker grid (shows price, stock, MOQ)
- Quantity controls per selected product
- Sticky order summary: items, quantities, subtotal, estimated total
- "Generate Order + Invoice" button

**Backend requirements:**
- Same as cart → `POST /api/orders`

---

### 6.5 RFQ — Request for Quote (`rfq.html`)

**Features:**
- RFQ list: submitted, in review, responded, accepted, declined
- Create new RFQ: select products, enter quantities, add notes, desired price target, required by date
- Seller responds with quote (custom price + delivery terms)
- Accept quote → converts to order
- Decline / counter-offer flow
- RFQ history and status tracking

**Backend requirements:**
- `GET /api/rfqs` — buyer's RFQs
- `POST /api/rfqs` — create new RFQ
- `PATCH /api/rfqs/:id` — accept / decline quote
- `POST /api/rfqs/:id/convert-to-order` — convert accepted RFQ to order

---

### 6.6 Analytics (`analytics.html`)

**Features:**
- Date range selector (This Month, Last 30 Days, Quarter, Year)
- KPI cards: Total Spend, Orders Placed, Avg Order Value, Top Category
- Bar chart: Monthly spend trend (12 months)
- Pie/doughnut: Spend by category
- Line chart: Order count over time
- Table: Top 10 products ordered by spend
- Table: Top 5 brands by spend
- Export data as CSV

**Backend requirements:**
- `GET /api/analytics/buyer` — buyer-specific analytics
  - Params: start_date, end_date, group_by (day/month)
  - Returns: orders_count, total_spend, avg_order_value, by_category[], by_brand[], top_products[]

---

### 6.7 Messages (`messages.html`)

**Features:**
- Inbox: conversations list with unread badge
- Open conversation thread with seller / admin
- Send message with text + optional file attachment
- Message read receipts
- "Contact Support" button → opens ticket to admin

**Backend requirements:**
- `GET /api/messages` — buyer's conversations
- `GET /api/messages/:conversation_id` — message thread
- `POST /api/messages` — send message
- Supabase Realtime for live message delivery

---

### 6.8 Account (`account.html`)

**Features:**
- Profile: name, email, phone, company name, logo upload
- Business info: business type, tax ID, address, website
- Payment Methods: saved cards (via Stripe), bank accounts
- Billing Address
- Notification preferences (email, SMS per event type)
- Security: change password, 2FA setup
- Team Members: invite additional users (with buyer role)
- Net Terms status: current terms, credit limit, available credit, history
- Connected Shopify stores (for dropship)

**Backend requirements:**
- `GET /api/profile` — buyer profile
- `PATCH /api/profile` — update profile
- `POST /api/profile/logo` — upload logo to Supabase Storage
- `GET /api/payment-methods` — saved Stripe payment methods
- `POST /api/create-setup-intent` — Stripe setup intent for saving card

---

### 6.9 Trade Finance (`trade-finance.html`)

**Features:**
- BNPL (Buy Now Pay Later) options
- Credit line application form
- Current credit status and history
- Financing offers from BRND Direct partners
- Apply for extended terms (Net-60, Net-90)
- Repayment schedule viewer

**Backend requirements:**
- `GET /api/trade-finance/status` — current credit line info
- `POST /api/trade-finance/apply` — submit credit application
- Admin reviews and approves/denies

---

## 7. SELLER / ADMIN PORTAL — FULL FEATURE SPEC

### 7.1 Seller Registration (`seller-register.html`)

**Features:**
- Brand name, slug, description
- Category selection
- Logo upload
- Revenue range, founding year
- Fulfillment type: Wholesale / Dropship / Both
- Bank details for payout
- Commission rate acknowledgment
- Submit for admin review

**Backend requirements:**
- `POST /api/sellers/register` — create seller_profile, set status = 'pending_review'
- Admin notification of new seller application
- `PATCH /api/sellers/:id/status` — admin approves/rejects

---

### 7.2 Seller Dashboard (`seller-dashboard.html`)

**Features:**
- KPIs: Pending Orders, Revenue MTD, Payout Due, Products Listed
- Orders requiring action: "Confirm" button on pending orders
- Recent activity feed
- Payout schedule

**Backend requirements:**
- `GET /api/seller/dashboard` — seller-specific KPIs

---

### 7.3 Seller Order Management (`seller-orders.html`)

**Features:**
- Tabs: Pending Confirmation | Confirmed | Packing | Shipped | Delivered | All
- **Confirm Order:** seller clicks Confirm → order status changes to `confirmed` → invoice issued to buyer → buyer gets email
- **Pack Order:** seller enters box dimensions, weight, marks as packed → status → `packed` → buyer gets notification
- Order detail view: items, buyer info, shipping address, payment terms, PO reference
- Bulk confirm/reject multiple orders

**Backend requirements:**
- `GET /api/seller/orders` — seller's orders
- `POST /api/seller/orders/:id/confirm` — confirm order → trigger invoice issuance
- `POST /api/seller/orders/:id/pack` — mark packed with dimensions/weight
- `POST /api/seller/orders/:id/ship` — mark shipped with tracking number

---

### 7.4 Seller Product Management (`seller-products.html`)

**Features:**
- Product list: name, SKU, price, stock, status, edit/delete buttons
- Add/Edit product form:
  - Name, description, brand
  - Category, subcategory tags
  - SKU, UPC, ASIN
  - Wholesale price, MSRP (retail)
  - MOQ (minimum order quantity)
  - Stock quantity
  - Fulfillment type (wholesale / dropship / both)
  - Images (up to 8, upload to Supabase Storage)
  - Product details (size, weight, origin, etc.)
- Bulk stock update (CSV upload)
- Product status toggle (active/inactive)

**Backend requirements:**
- `GET /api/seller/products` — seller's products
- `POST /api/seller/products` — create product
- `PUT /api/seller/products/:id` — update product
- `DELETE /api/seller/products/:id` — soft delete
- `POST /api/seller/products/images` — upload to Supabase Storage

---

### 7.5 Seller Payouts (`seller-payouts.html`)

**Features:**
- Payout balance: pending, available, paid out
- Payout history table
- Bank account management (via Stripe Connect)
- Request instant payout button
- Commission breakdown per order

**Backend requirements:**
- `GET /api/payout-link` — Stripe Connect dashboard link
- `GET /api/seller/payouts` — payout history
- Stripe Connect handles actual payout processing
- Commission calculated as: order_total × commission_rate (stored in seller_profiles)

---

### 7.6 Seller Brand Hub (`seller-brand-hub.html`)

**Features:**
- Brand profile: name, slug, story/description, logo, banner image
- Social links, website
- Category tags
- Brand verification status
- Buyer-facing brand page preview

**Backend requirements:**
- `GET /api/brands/:slug` — public brand profile
- `PATCH /api/seller/brand` — update brand profile

---

## 8. DROPSHIP MODULE — FULL FEATURE SPEC

### 8.1 Overview

The Dropship module allows buyers to connect their Shopify store to BRND Direct. When a customer places an order in the buyer's Shopify store, it automatically comes into BRND Direct for fulfillment. BRND Direct ships same-day and pushes tracking back to Shopify.

**Phase 1:** Shopify only  
**Phase 2:** WooCommerce, Amazon, TikTok Shop, eBay, Walmart (future)

---

### 8.2 Complete Dropship Flow

```
1. Buyer connects Shopify store (API credentials OR BRND Direct Shopify App)
        ↓
2. BRND Direct pushes entire catalog + pricing to buyer's Shopify store
   (products created as drafts; buyer publishes what they want to sell)
        ↓
3. Buyer's customer places order on Shopify
        ↓
4. Shopify webhook fires → BRND Direct receives order automatically
   (order appears in buyer's "Daily Orders" tab in portal)
        ↓
5a. FULL AUTO MODE:  Order automatically queued for fulfillment (no buyer action)
    Requires: active Net-30/60/90 credit line OR prepay balance
        OR
5b. DAILY CONFIRM MODE:  Buyer receives 6AM summary email
    Buyer reviews + confirms by 11AM EST
    Unconfirmed = hold until next day (configurable)
        ↓
6. BRND Direct picks, packs, and ships the order before 3PM EST
        ↓
7. Tracking number pushed back to Shopify via API
   Shopify order marked as "Fulfilled"
   Buyer's customer receives Shopify tracking email (automatic)
        ↓
8. At 11:59PM EST: Daily consolidated invoice auto-generated
   Covers all orders shipped that day
   Includes: wholesale cost per unit + actual shipping charges per order
   Invoice emailed to buyer + available in portal
        ↓
9. Buyer pays invoice via Net Terms (Net-30/60/90) or prepay balance
```

---

### 8.3 Dropship Portal Tabs (in order)

| Tab | Step # | Purpose |
|-----|--------|---------|
| Overview | — | Full flow diagram + today's status |
| Connect Store | 1 | Shopify connection wizard + manual upload option |
| Catalog Sync | 2 | Catalog push settings, pricing rules, sync status |
| Automation Mode | 3 | Full Auto vs. Daily Confirm selection |
| Credit & Terms | 4 | Net terms for Full Auto, credit line status |
| Daily Orders | 5 | Today's orders from Shopify, confirm/review |
| Tracking Push | 6 | Tracking push status and history |
| Auto-Invoices | 7 | Daily invoice history, settings |
| Analytics | 8 | Full customer order analytics |

---

### 8.4 Connect Store — Step 1

**Option A: BRND Direct Shopify App (in development)**
- Customer installs from Shopify App Store
- One-click setup, no API keys needed
- App handles all webhooks, catalog sync, tracking push automatically

**Option B: API Credentials (current method)**
- Buyer enters: Shopify Store URL (yourstore.myshopify.com), Admin API Access Token, API Secret Key
- Required Shopify API scopes: `read_orders, write_orders, read_products, write_products, write_fulfillments`
- Test connection button → verify credentials → proceed

**Manual Upload Option (no Shopify required)**
- CSV upload with columns: SKU/UPC, Quantity, Customer Name, Email, Shipping Address
- Template CSV available to download
- Orders processed same as Shopify orders once uploaded

**Backend requirements:**
- `POST /api/dropship/connect` — store encrypted Shopify credentials in DB
- `GET /api/dropship/stores` — list buyer's connected stores
- `DELETE /api/dropship/stores/:id` — disconnect store
- `POST /api/dropship/manual-upload` — process CSV of manual orders
- Shopify webhook registration on connect: `orders/create`, `orders/cancelled`, `orders/updated`

---

### 8.5 Catalog Sync — Step 2

**What gets synced to buyer's Shopify:**
- All active BRND Direct products (1,240+)
- Product images, descriptions, variants
- Wholesale price set as Shopify cost; retail price calculated per pricing rule
- Stock levels: auto-hide product in Shopify when stock = 0
- New products: auto-pushed to Shopify as drafts within 15 minutes

**Pricing rules (buyer configurable):**
- Keystone (×2 markup)
- 2.5× markup
- 3× markup
- Custom markup %
- Use MSRP (MAP pricing)

**Sync events:**
- Full sync: nightly at 2AM or on-demand "Sync Now" button
- Real-time: price changes and stock updates pushed within 5 minutes via Shopify product update API
- New products: pushed within 15 minutes of being added to BRND Direct

**Backend requirements:**
- `POST /api/dropship/sync/:store_id` — trigger full catalog sync to Shopify store
- `GET /api/dropship/sync/status/:store_id` — sync progress and last sync time
- `PATCH /api/dropship/pricing-rule/:store_id` — update pricing rule
- Background job (Cloudflare Cron Trigger or Supabase pg_cron):
  - Every 5 minutes: push stock/price changes to connected Shopify stores
  - Nightly 2AM: full catalog reconciliation

---

### 8.6 Automation Mode — Step 3

**Option 1 — Full Auto:**
- Every incoming Shopify order is automatically processed without any buyer action
- Queued for same-day shipping if received before 1PM EST cutoff
- Requirements: active Net-30/60/90 OR prepay balance on file
- Must be activated by admin (account manager approval)
- Daily invoice auto-generated at 11:59PM

**Option 2 — Daily Confirm (default):**
- 6:00 AM EST: Daily summary email sent to buyer with all pending orders
- 6AM–11AM EST: Buyer reviews in "Daily Orders" tab
- 11:00 AM EST: Confirmation deadline
- If not confirmed by deadline: hold or auto-confirm (buyer configurable)
- 3:00 PM EST: All confirmed orders shipped
- 3–6 PM EST: Tracking pushed to Shopify
- 11:59 PM EST: Daily invoice generated

**Backend requirements:**
- `PATCH /api/dropship/automation-mode/:store_id` — set mode (full_auto / daily_confirm)
- `PATCH /api/dropship/schedule/:store_id` — update deadline, notification email, miss-behavior
- Scheduled job at 6AM EST: send daily order summary emails
- Scheduled job at 11AM EST: check for unconfirmed orders, apply miss-behavior
- Scheduled job at 11:59PM: generate daily invoice

---

### 8.7 Credit & Terms — Step 4

**Credit line:**
- Assigned by BRND Direct admin per buyer account
- Stored in `buyer_profiles.credit_limit`
- Current month usage tracked in `buyer_profiles.credit_used`
- Credit utilization = credit_used / credit_limit

**Payment terms options:**
- Pre-Pay: balance deposited before orders ship
- Net-30: invoice due 30 days after ship date
- Net-60: invoice due 60 days after ship date
- Net-90: invoice due 90 days after ship date

**Net-30 or above required for Full Auto mode.**

**Backend requirements:**
- `GET /api/dropship/credit/:buyer_id` — credit line status
- `POST /api/dropship/request-terms` — buyer requests higher credit/terms → admin notification
- `PATCH /api/admin/buyers/:id/credit` — admin sets credit limit and terms

---

### 8.8 Daily Orders — Step 5

**Features:**
- Table of today's Shopify orders (imported via webhook)
- Columns: checkbox, product name, order ID, brand, customer name & address, wholesale cost, retail price, status
- Status badges: ⏰ Pending Confirm / 🔄 Processing / 🚚 Shipped / ✅ Delivered
- Filter chips: All / Pending / Processing / Shipped / Delivered
- "Confirm All & Ship" button (Daily Confirm mode)
- Individual confirm button per order
- Export CSV
- "Confirm deadline" timer banner when orders are pending

**Backend requirements:**
- `GET /api/dropship/orders?date=today&store_id=X` — today's dropship orders
- `POST /api/dropship/orders/confirm-all` — confirm all pending orders for today
- `POST /api/dropship/orders/:id/confirm` — confirm single order
- `POST /api/dropship/orders/:id/hold` — hold specific order to next day
- `DELETE /api/dropship/orders/:id` — cancel a specific order before confirmation

---

### 8.9 Tracking Push — Step 6

**Flow:**
1. BRND Direct creates shipment (Shippo label)
2. Tracking number generated
3. Within 30 seconds: call Shopify Fulfillment API with tracking number
4. Shopify marks order as "Fulfilled"
5. Shopify auto-sends tracking email to buyer's customer

**Shopify Fulfillment API call:**
```
POST https://{store}.myshopify.com/admin/api/2024-01/orders/{order_id}/fulfillments.json
{
  "fulfillment": {
    "location_id": LOCATION_ID,
    "tracking_number": "1Z999AA10123456784",
    "tracking_company": "UPS",
    "tracking_url": "https://www.ups.com/track?tracknum=...",
    "notify_customer": true
  }
}
```

**Backend requirements:**
- `POST /api/dropship/fulfill/:order_id` — create Shopify fulfillment with tracking
- `GET /api/dropship/tracking` — list of recent tracking pushes and their status
- Push must handle: rate limits, retry on failure (3 attempts), log success/failure
- Store result in `dropship_orders.tracking_pushed_at` and `tracking_number`

---

### 8.10 Auto-Invoices — Step 7

**Daily invoice structure:**
- Invoice number: `DS-INV-XXXX` (sequential)
- Date: today's date
- Buyer: buyer_profile
- Line items: one row per shipped order
  - Order ID, customer name, product name, qty, wholesale cost, shipping charge, line total
- Subtotals: wholesale total, shipping total, grand total
- Payment terms applied (Net-30/60/90 or prepay deducted)
- Due date calculated from ship date + terms days
- Invoice saved as PDF to Supabase Storage
- Emailed to buyer at midnight

**Backend requirements:**
- Scheduled job at 11:59PM EST:
  - Query all dropship_orders where shipped_at = today AND buyer_id = X
  - Calculate totals (wholesale + actual Shippo shipping cost)
  - Generate invoice record in `invoices` table with type = 'dropship_daily'
  - Generate PDF (Cloudflare Browser Rendering or external service)
  - Upload PDF to Supabase Storage
  - Send email to buyer with PDF attachment
- `GET /api/dropship/invoices` — buyer's dropship invoices
- `GET /api/dropship/invoices/:id/pdf` — download invoice PDF

---

### 8.11 Dropship Analytics — Step 8

**KPI cards:**
- Revenue This Month
- Orders Fulfilled MTD
- Average Order Value
- Fulfillment Rate %
- Credit Used MTD
- Average Delivery Time
- Orders Shipped Today
- Latest Daily Invoice Amount

**Charts:**
- Daily Orders This Month (bar)
- Revenue by Category (doughnut)
- Top 10 Products by Orders (horizontal bar)
- Monthly Revenue Trend (line — 6 months)
- Order Status Breakdown (doughnut)
- Daily Invoice Amounts — last 30 days (bar)

**Table:**
- Top Customers by Orders (customer name, location, orders, units, total spent, avg order)

**Backend requirements:**
- `GET /api/dropship/analytics` — all analytics data
  - Params: store_id, start_date, end_date
  - Returns: all KPIs, chart data arrays, top_customers[]

---

## 9. DATABASE SCHEMA

Full schema is in `supabase/schema.sql`. Key tables:

### 9.1 Core Tables

#### `profiles`
```sql
id              UUID (FK → auth.users)
role            user_role ENUM ('buyer','seller','admin')
status          account_status ENUM ('active','pending','suspended','rejected')
full_name       TEXT
email           TEXT
phone           TEXT
avatar_url      TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `buyer_profiles`
```sql
id              UUID (FK → profiles)
business_name   TEXT
business_type   TEXT
tax_id          TEXT
website         TEXT
spend_range     TEXT
credit_limit    NUMERIC(12,2)
credit_used     NUMERIC(12,2)
net_terms       INTEGER  -- 0, 30, 60, or 90
available_credit NUMERIC(12,2) (computed: credit_limit - credit_used)
dropship_mode   TEXT  -- 'full_auto' | 'daily_confirm'
```

#### `seller_profiles`
```sql
id              UUID (FK → profiles)
brand_name      TEXT
slug            TEXT UNIQUE
description     TEXT
logo_url        TEXT
category        TEXT
fulfillment_type fulfill_type ENUM ('wholesale','dropship','both')
commission_rate NUMERIC(5,2)  -- e.g. 15.00 = 15%
stripe_account_id TEXT
status          TEXT  -- 'pending_review' | 'active' | 'suspended'
```

#### `brands`
```sql
id              UUID
name            TEXT
slug            TEXT UNIQUE
description     TEXT
category        TEXT
country_of_origin TEXT
is_verified     BOOLEAN
is_active       BOOLEAN
sort_order      INTEGER
```

#### `products`
```sql
id              UUID
brand_id        UUID (FK → brands)
seller_profile_id UUID (FK → seller_profiles)
sku             TEXT UNIQUE
upc             TEXT
asin            TEXT
name            TEXT
description     TEXT
category        TEXT
subcategory     TEXT[]
tags            TEXT[]
fulfillment_type fulfill_type
wholesale_price NUMERIC(10,2)
msrp            NUMERIC(10,2)
moq             INTEGER
stock_qty       INTEGER
is_active       BOOLEAN
is_top_seller   BOOLEAN
images          TEXT[]  -- array of Supabase Storage URLs
meta            JSONB   -- {size, concentration, gender, origin, etc.}
```

#### `orders`
```sql
id              UUID
order_number    TEXT (generated: BD-XXXXX)
buyer_profile_id UUID (FK → buyer_profiles)
status          order_status ENUM ('pending_confirmation','confirmed','paid','packing','packed','shipped','delivered','cancelled')
payment_status  payment_status ENUM ('unpaid','paid','refunded','partially_paid')
subtotal        NUMERIC(12,2)
discount_amount NUMERIC(12,2)
tax_amount      NUMERIC(12,2)
shipping_amount NUMERIC(12,2)
total_amount    NUMERIC(12,2)
net_terms       INTEGER
due_date        DATE
stripe_payment_intent TEXT
po_reference    TEXT
notes           TEXT
shipping_address JSONB  -- {name, street, city, state, zip, country, phone}
tracking_info   JSONB   -- {carrier, tracking_number, tracking_url, label_url}
fulfillment_type TEXT   -- 'wholesale' | 'dropship'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `order_items`
```sql
id              UUID
order_id        UUID (FK → orders)
product_id      UUID (FK → products)
seller_profile_id UUID
sku             TEXT
name            TEXT
quantity        INTEGER
unit_price      NUMERIC(10,2)
line_total      NUMERIC(12,2) (computed)
fulfillment_type TEXT
```

#### `invoices`
```sql
id              UUID
invoice_number  TEXT (INV-XXXXX or DS-INV-XXXXX)
order_id        UUID (FK → orders, nullable for dropship daily invoices)
buyer_profile_id UUID
seller_profile_id UUID
type            TEXT  -- 'wholesale' | 'dropship_daily'
status          TEXT  -- 'pending' | 'issued' | 'paid' | 'overdue' | 'cancelled'
subtotal        NUMERIC(12,2)
shipping_amount NUMERIC(12,2)
total_amount    NUMERIC(12,2)
net_terms       INTEGER
issue_date      DATE
due_date        DATE
paid_at         TIMESTAMPTZ
stripe_payment_intent TEXT
pdf_url         TEXT  -- Supabase Storage URL
period_start    DATE  -- for dropship daily invoices
period_end      DATE
```

#### `dropship_stores`
```sql
id              UUID
buyer_profile_id UUID
platform        TEXT  -- 'shopify' | 'woocommerce' | etc.
store_url       TEXT  -- yourstore.myshopify.com
display_name    TEXT
api_token_enc   TEXT  -- encrypted Admin API token
api_secret_enc  TEXT  -- encrypted API secret
shopify_location_id TEXT
automation_mode TEXT  -- 'full_auto' | 'daily_confirm'
confirm_deadline TIME  -- default 11:00
miss_behavior   TEXT  -- 'hold' | 'auto_confirm' | 'cancel'
notify_email    TEXT
pricing_rule    TEXT  -- 'keystone' | '2.5x' | '3x' | 'custom' | 'map'
markup_percent  NUMERIC(5,2)
is_active       BOOLEAN
last_sync_at    TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

#### `dropship_orders`
```sql
id              UUID
dropship_store_id UUID (FK → dropship_stores)
buyer_profile_id UUID
shopify_order_id TEXT
shopify_order_number TEXT
customer_name   TEXT
customer_email  TEXT
shipping_address JSONB
line_items      JSONB  -- [{product_id, sku, name, qty, wholesale_cost}]
wholesale_total NUMERIC(12,2)
shipping_cost   NUMERIC(12,2)
total_charged   NUMERIC(12,2)
status          TEXT  -- 'pending_confirm' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
carrier         TEXT
tracking_number TEXT
tracking_url    TEXT
tracking_pushed_at TIMESTAMPTZ
invoice_id      UUID (FK → invoices, nullable until daily invoice generated)
confirmed_at    TIMESTAMPTZ
shipped_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

#### `messages`
```sql
id              UUID
conversation_id UUID
sender_id       UUID (FK → profiles)
recipient_id    UUID (FK → profiles)
body            TEXT
attachments     TEXT[]
is_read         BOOLEAN
created_at      TIMESTAMPTZ
```

#### `rfqs`
```sql
id              UUID
buyer_profile_id UUID
status          rfq_status ENUM ('submitted','in_review','responded','accepted','declined','expired')
items           JSONB  -- [{product_id, qty, target_price}]
notes           TEXT
required_by     DATE
quote           JSONB  -- seller's response {items, total, delivery_days, valid_until}
quoted_at       TIMESTAMPTZ
responded_by    UUID (FK → seller_profiles)
created_at      TIMESTAMPTZ
```

---

## 10. API ENDPOINTS REQUIRED

Base URL: `https://brnddirectbuyerportal.SUBDOMAIN.workers.dev`

### Authentication
All endpoints require `Authorization: Bearer <supabase_jwt>` header except public endpoints.

### 10.1 Auth (handled by Supabase directly from frontend)
```
POST   /auth/signup              Supabase Auth
POST   /auth/signin              Supabase Auth
POST   /auth/signout             Supabase Auth
POST   /auth/reset-password      Supabase Auth
```

### 10.2 Profile & Account
```
GET    /api/profile              Get current user's profile
PATCH  /api/profile              Update profile
POST   /api/profile/avatar       Upload avatar to Supabase Storage
GET    /api/buyer/credit         Buyer credit line status
```

### 10.3 Products & Catalog
```
GET    /api/products             Paginated product list (search, filter, sort)
GET    /api/products/:id         Single product detail
GET    /api/brands               All active brands
GET    /api/categories           Product categories list
```

### 10.4 Orders
```
GET    /api/orders               Buyer's orders (filter by status, date)
GET    /api/orders/:id           Order detail
POST   /api/orders               Create new order (from cart or manual builder)
PATCH  /api/orders/:id           Update order (cancel, add notes)
GET    /api/dashboard/stats      Dashboard KPI summary
```

### 10.5 Seller Order Actions
```
GET    /api/seller/orders        Seller's pending/active orders
POST   /api/seller/orders/:id/confirm    Confirm order → issue invoice
POST   /api/seller/orders/:id/pack       Mark packed (with dimensions)
POST   /api/seller/orders/:id/ship       Mark shipped (with tracking)
```

### 10.6 Invoices
```
GET    /api/invoices             Buyer's invoices
GET    /api/invoices/:id         Invoice detail
GET    /api/invoices/:id/pdf     Download invoice PDF
POST   /api/invoices/:id/pay     Pay invoice via Stripe
```

### 10.7 Payments (Stripe)
```
POST   /api/create-payment-intent     Stripe payment intent
POST   /api/create-setup-intent       Stripe setup intent (save card)
POST   /api/stripe-webhook            Stripe webhook handler
POST   /api/create-connect-account    Stripe Connect for sellers
GET    /api/payout-link               Stripe Connect payout link
```

### 10.8 Shipping — Parcel (Shippo)
```
POST   /api/parcel/validate-address   Validate shipping address
POST   /api/parcel/rates              Get parcel rates
POST   /api/parcel/purchase           Purchase label
GET    /api/parcel/track/:tracking    Track parcel
POST   /api/parcel/refund             Refund unused label
GET    /api/parcel/label/:id          Download label PDF
POST   /api/parcel/manifest           Create manifest
GET    /api/parcel/carriers           List available carriers
```

### 10.9 Shipping — Freight (Freightos)
```
POST   /api/freight/token             Get Freightos OAuth token
POST   /api/freight/quote             Get freight quote
POST   /api/freight/book              Book freight shipment
GET    /api/freight/shipment/:id      Get shipment details
GET    /api/freight/track/:id         Track freight shipment
GET    /api/freight/bol/:id           Download Bill of Lading
POST   /api/freight/cancel/:id        Cancel shipment
```

### 10.10 RFQ
```
GET    /api/rfqs                 Buyer's RFQs
POST   /api/rfqs                 Create new RFQ
GET    /api/rfqs/:id             RFQ detail
PATCH  /api/rfqs/:id             Accept/decline/counter
POST   /api/rfqs/:id/convert     Convert accepted RFQ to order
GET    /api/seller/rfqs          Seller's incoming RFQs
POST   /api/seller/rfqs/:id/quote  Seller submits quote
```

### 10.11 Dropship
```
GET    /api/dropship/stores           Connected stores
POST   /api/dropship/connect          Connect new Shopify store
DELETE /api/dropship/stores/:id       Disconnect store
POST   /api/dropship/sync/:store_id   Trigger catalog sync
GET    /api/dropship/sync/status/:id  Sync progress
PATCH  /api/dropship/pricing-rule/:id Update pricing rule
PATCH  /api/dropship/automation/:id   Set automation mode + schedule
GET    /api/dropship/orders           Daily dropship orders
POST   /api/dropship/orders/:id/confirm   Confirm single order
POST   /api/dropship/orders/confirm-all   Confirm all pending today
POST   /api/dropship/orders/:id/hold      Hold order
DELETE /api/dropship/orders/:id           Cancel order
GET    /api/dropship/invoices         Dropship invoices
GET    /api/dropship/invoices/:id/pdf Download invoice PDF
GET    /api/dropship/tracking         Recent tracking pushes
GET    /api/dropship/analytics        Dropship analytics data
GET    /api/dropship/credit           Credit line status
POST   /api/dropship/manual-upload    Upload CSV of manual orders
```

### 10.12 Seller Products
```
GET    /api/seller/products           Seller's products
POST   /api/seller/products           Create product
PUT    /api/seller/products/:id       Update product
DELETE /api/seller/products/:id       Deactivate product
POST   /api/seller/products/images    Upload product images
```

### 10.13 Analytics
```
GET    /api/analytics/buyer           Buyer analytics
GET    /api/analytics/seller          Seller analytics
GET    /api/analytics/platform        Admin platform-wide analytics
```

### 10.14 Messages
```
GET    /api/messages                  Conversations list
GET    /api/messages/:conversation_id Message thread
POST   /api/messages                  Send message
PATCH  /api/messages/:id/read         Mark as read
```

### 10.15 PO Upload (AI Parsing)
```
POST   /api/po/parse                  Parse PO document (PDF/CSV/Excel) using LLM
```

### 10.16 Webhooks (incoming)
```
POST   /api/stripe-webhook            Stripe events
POST   /api/shopify-webhook/:store_id Shopify order events
```

### 10.17 Admin
```
GET    /api/admin/buyers              All buyers
PATCH  /api/admin/buyers/:id          Update buyer (credit limit, terms, status)
GET    /api/admin/sellers             All sellers
PATCH  /api/admin/sellers/:id/approve Approve seller
GET    /api/admin/orders              All orders
GET    /api/admin/analytics           Platform analytics
```

### 10.18 System
```
GET    /api/health                    Health check
```

---

## 11. AUTHENTICATION & SECURITY

### 11.1 Supabase Auth
- Email + password authentication
- Magic link (passwordless) option
- JWT issued by Supabase on login
- JWT passed as `Authorization: Bearer <token>` on all API calls
- Worker verifies JWT against Supabase JWKS endpoint
- Row Level Security (RLS) in Supabase:
  - Buyers can only read/write their own orders, invoices, cart
  - Sellers can only manage their own products and orders
  - Admin role bypasses RLS

### 11.2 Portal Password Gate (front-end layer)
- Additional layer: `lock.html` with password `BRNDdirect2025!`
- `buyer/js/auth-guard.js` checks sessionStorage on every page load
- This is a UI protection layer, NOT a replacement for Supabase Auth
- In preview/development environments (Genspark), auth is auto-bypassed

### 11.3 API Security
- All Worker endpoints require valid Supabase JWT
- Role checked per endpoint (buyer can't access seller endpoints, etc.)
- Stripe webhook verified via `Stripe-Signature` header
- Shopify webhooks verified via HMAC signature
- API tokens (Shopify, Shippo, Freightos) stored as Cloudflare Worker encrypted secrets

### 11.4 Frontend Security Headers (`_headers`)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: (strict CSP)
X-Robots-Tag: noindex, nofollow, noarchive
Strict-Transport-Security: max-age=63072000; includeSubDomains
Cache-Control: no-store, no-cache, private
Cross-Origin-Resource-Policy: same-origin
```

### 11.5 Crawler Blocking (`robots.txt`)
- Blocks all major search engines and AI crawlers:
  - Googlebot, Bingbot, DuckDuckBot, Yandex, Baidu
  - GPTBot, ChatGPT, Claude, Anthropic
  - Ahrefs, SEMrush, Majestic

---

## 12. THIRD-PARTY INTEGRATIONS

### 12.1 Stripe
- **Buyer payments**: Payment Intents for invoice payments
- **Saved payment methods**: Setup Intents for card-on-file
- **Seller payouts**: Stripe Connect for marketplace payouts
- **Webhooks needed**:
  - `payment_intent.succeeded` → mark invoice paid, notify seller
  - `payment_intent.payment_failed` → notify buyer
  - `account.updated` → update seller Stripe Connect status

### 12.2 Shippo (Parcel Shipping)
- Rate shopping across UPS, FedEx, USPS, DHL
- Label purchase and download
- Tracking updates
- Used for orders < 150 lbs

### 12.3 Freightos (Freight Shipping)
- LTL and FTL freight quotes
- Freight booking
- BOL (Bill of Lading) generation
- Used for orders > 150 lbs or when freight_class is declared

### 12.4 Shopify (Dropship)
- **Admin API scopes needed**: `read_orders, write_orders, read_products, write_products, write_fulfillments`
- **Webhooks to register on connect**:
  - `orders/create` → import to dropship_orders
  - `orders/cancelled` → cancel dropship order
  - `orders/updated` → sync status changes
- **API calls made by BRND Direct**:
  - `GET /products` → catalog reconciliation
  - `POST /products` → push BRND Direct products
  - `PUT /products/:id` → update price/stock
  - `DELETE /products/:id` → remove out-of-stock
  - `POST /orders/:id/fulfillments` → push tracking

### 12.5 Supabase
- PostgreSQL database (all data)
- Supabase Auth (user accounts, JWTs)
- Supabase Storage (product images, PO docs, invoice PDFs)
- Supabase Realtime (live order status updates, messages)

### 12.6 OpenAI / LLM (for PO parsing)
- Accept uploaded PDF/CSV/Excel PO document
- Extract: PO number, buyer info, line items (description, qty, price)
- Match line items against products table by SKU, UPC, ASIN, or product name
- Return structured JSON for editable review before creating order

### 12.7 Email (Resend.com or SendGrid)
- See Section 13 for full email list

---

## 13. EMAIL NOTIFICATIONS

All emails are triggered by the Cloudflare Worker and sent via Resend.com or SendGrid.

| Trigger | Recipient | Email Content |
|---------|-----------|---------------|
| Buyer registers | Buyer | Welcome + portal access instructions |
| Order placed | Seller | New order notification + confirm CTA |
| Order placed | Buyer | Order confirmation + order number |
| Seller confirms order | Buyer | "Your order is confirmed — invoice #INV-XXXXX due [date]" |
| Invoice issued | Buyer | Invoice email with PDF attachment + Pay Now link |
| Invoice overdue | Buyer | Overdue reminder (Day 1, Day 7, Day 14) |
| Payment received | Buyer | Payment confirmation receipt |
| Payment received | Seller | "Buyer paid — you can begin packing order BD-XXXXX" |
| Order packed | Buyer | "Your order is packed — shipment booking required" |
| Order shipped | Buyer | Shipping confirmation + tracking number |
| Dropship: 6AM daily summary | Buyer | Today's orders to confirm (Daily Confirm mode) |
| Dropship: deadline warning | Buyer | 30 min before confirmation deadline (10:30AM EST) |
| Dropship: daily invoice | Buyer | Invoice PDF + payment due date |
| Dropship: order shipped (customer) | End Customer | Shopify handles this via fulfillment webhook |
| Seller registration pending | Admin | New seller application notification |
| Seller approved | Seller | Account approved + next steps |
| New message received | Recipient | "You have a new message from [sender]" |
| Low stock alert | Seller | Product X stock below threshold |
| RFQ submitted | Seller | New RFQ from buyer + respond CTA |
| RFQ quote received | Buyer | Seller responded to your RFQ |

---

## 14. CURRENT FRONTEND STATUS

### ✅ Fully Built (HTML/CSS/JS — static, no backend)

#### Buyer Portal
- [x] `buyer/index.html` — Sign in form (UI only)
- [x] `buyer/register.html` — Registration form (UI only)
- [x] `buyer/dashboard.html` — Full dashboard with KPIs, charts, recent orders
- [x] `buyer/products.html` — Full catalog: grid/list/compact views, filters, search, modals, bulk upload, add to cart
- [x] `buyer/cart.html` — Cart table, shipping selector, payment terms, confirm flow with success overlay
- [x] `buyer/orders.html` — 6-step hub with all tabs: Seller Confirms, Pay Invoice, Packing, Shipping, Upload PO (AI), Manual Builder, All Orders
- [x] `buyer/invoices.html` — Invoice list, 4-step payment wizard, success screen with Step 5 CTA
- [x] `buyer/shipping-logistics.html` — Book shipment, rate compare, tracking, Freightos/Shippo banners
- [x] `buyer/dropship.html` — Complete 8-tab dropship automation module (all tabs built)
- [x] `buyer/analytics.html` — Analytics with Chart.js charts
- [x] `buyer/rfq.html` — RFQ list and create form
- [x] `buyer/messages.html` — Messaging UI
- [x] `buyer/reports.html` — Reports UI
- [x] `buyer/account.html` — Account settings UI
- [x] `buyer/help.html` — Help center UI
- [x] `buyer/trade-finance.html` — Trade finance UI
- [x] `buyer/warehousing.html` — Warehousing UI
- [x] `buyer/payment-portal.html` — Standalone payment UI
- [x] `buyer/reset-password.html` — Password reset UI

#### Auth & Security
- [x] `lock.html` — Password gate with session management
- [x] `buyer/js/auth-guard.js` — Session guard for all buyer pages (with preview bypass)
- [x] `_headers` — Security headers
- [x] `_redirects` — Cloudflare Pages redirects
- [x] `robots.txt` — Bot/crawler blocking
- [x] `index.html` — Preview launcher page

#### API Scaffolding
- [x] `workers/api.js` — Cloudflare Worker with all routes scaffolded (Stripe, Shippo, Freightos, Supabase catalog)
- [x] `supabase/schema.sql` — Full PostgreSQL schema (run in Supabase SQL editor)
- [x] `wrangler.toml` — Cloudflare deployment config
- [x] `buyer/js/catalog-api.js` — Catalog API client module
- [x] `setup/connect-catalog.html` — Setup guide

---

## 15. BACKEND TO-DO LIST

### Priority 1 — Core (must have for launch)
1. [ ] Run `supabase/schema.sql` in Supabase project SQL editor
2. [ ] Configure all Cloudflare Worker secrets (see Section 16)
3. [ ] Implement Supabase Auth in `workers/api.js` — JWT verification middleware
4. [ ] Wire `buyer/index.html` sign-in to Supabase Auth
5. [ ] Wire `buyer/register.html` to Supabase Auth + create profiles/buyer_profiles rows
6. [ ] Implement `GET /api/products` with Supabase query (search, filter, pagination)
7. [ ] Implement `GET /api/brands`
8. [ ] Connect `buyer/products.html` to live API (scaffold already in `buyer/js/catalog-api.js`)
9. [ ] Implement `POST /api/orders` — create order + order_items in Supabase
10. [ ] Implement `POST /api/invoices` — auto-create invoice on order creation
11. [ ] Implement `GET /api/orders` — buyer's order list with status filters
12. [ ] Implement `GET /api/invoices` — buyer's invoice list
13. [ ] Implement `POST /api/create-payment-intent` — Stripe invoice payment
14. [ ] Implement `POST /api/stripe-webhook` — handle payment_intent.succeeded
15. [ ] Implement `POST /api/seller/orders/:id/confirm` — seller confirms order
16. [ ] Implement `POST /api/seller/orders/:id/pack` — seller packs order
17. [ ] Implement `POST /api/seller/orders/:id/ship` — seller ships with tracking
18. [ ] Set up email service (Resend.com recommended) — minimum 5 key emails
19. [ ] Connect seller registration to Supabase

### Priority 2 — Shipping & Dropship
20. [ ] Connect Shippo API in Workers — rates, purchase, tracking
21. [ ] Connect Freightos API in Workers — quote, book, track
22. [ ] Wire `shipping-logistics.html` rate comparison to live APIs
23. [ ] Implement `POST /api/dropship/connect` — store Shopify credentials (encrypted)
24. [ ] Register Shopify webhooks on store connection
25. [ ] Implement `POST /api/shopify-webhook/:store_id` — receive Shopify orders
26. [ ] Implement `POST /api/dropship/sync/:store_id` — push catalog to Shopify
27. [ ] Set up catalog sync Cron Trigger (stock/price updates every 5 min)
28. [ ] Implement `POST /api/dropship/orders/confirm-all` — confirm + queue for fulfillment
29. [ ] Implement `POST /api/dropship/fulfill/:order_id` — create Shippo label + push tracking to Shopify
30. [ ] Set up daily invoice generation Cron Trigger (11:59PM EST)
31. [ ] Generate invoice PDFs and upload to Supabase Storage

### Priority 3 — Enhanced Features
32. [ ] Implement RFQ system (create, quote, accept, convert to order)
33. [ ] Implement PO upload + LLM parsing
34. [ ] Implement Stripe Connect for seller payouts
35. [ ] Set up Supabase Realtime subscriptions for order status + messages
36. [ ] Implement analytics endpoints with proper aggregation queries
37. [ ] Add 2FA to authentication flow
38. [ ] Implement admin panel for buyer/seller management
39. [ ] Add seller product management with image upload

---

## 16. ENVIRONMENT VARIABLES & SECRETS

All secrets stored in Cloudflare Workers (encrypted). Never commit to git.

### Cloudflare Worker Secrets
```
# Supabase
SUPABASE_URL                    = https://lthfgkwyrxryereazdnr.supabase.co
SUPABASE_SERVICE_ROLE_KEY       = eyJ... (from Supabase Settings → API → service_role)

# Stripe
STRIPE_SECRET_KEY               = sk_live_...
STRIPE_WEBHOOK_SECRET           = whsec_...
STRIPE_CONNECT_CLIENT_ID        = ca_...

# Shippo
SHIPPO_API_TOKEN                = shippo_live_...

# Freightos
FREIGHTOS_CLIENT_ID             = ...
FREIGHTOS_CLIENT_SECRET         = ...
FREIGHTOS_BASE_URL              = https://api.freightos.com

# Ship-From Address (BRND Direct warehouse)
SHIP_FROM_NAME                  = BRND Direct
SHIP_FROM_STREET                = 123 Warehouse Blvd
SHIP_FROM_CITY                  = New York
SHIP_FROM_STATE                 = NY
SHIP_FROM_ZIP                   = 10001
SHIP_FROM_COUNTRY               = US
SHIP_FROM_PHONE                 = +12125550100

# Email
RESEND_API_KEY                  = re_...

# LLM (for PO parsing)
OPENAI_API_KEY                  = sk-...
```

### Cloudflare Environment (wrangler.toml)
```toml
name = "brnddirectbuyerportal"
main = "workers/api.js"
compatibility_date = "2024-01-01"
```

---

## 17. DEPLOYMENT ARCHITECTURE

### 17.1 Frontend — Cloudflare Pages
- Repository: GitHub `brnd-direct-portal`
- Build command: (none — static files)
- Output directory: `/`
- Custom domain: `brnddirect.com`
- Automatic deployments on GitHub push to `main` branch

### 17.2 API — Cloudflare Workers
- Worker name: `brnddirectbuyerportal`
- Routes: `brnddirect.com/api/*`
- Deployed via: `wrangler deploy --env production`
- Secrets managed in Cloudflare Dashboard → Workers → Settings → Variables

### 17.3 Database — Supabase
- Project URL: `https://lthfgkwyrxryereazdnr.supabase.co`
- Database: PostgreSQL 15
- Auth: Supabase built-in Auth
- Storage buckets needed:
  - `product-images` (public)
  - `invoices` (private, signed URLs)
  - `po-documents` (private, signed URLs)
  - `brand-logos` (public)

### 17.4 Environments
| Environment | Domain | Cloudflare Worker | Supabase |
|------------|--------|------------------|---------|
| Production | brnddirect.com | `--env production` | Production project |
| Staging | staging.brnddirect.com | `--env staging` | Staging project |
| Development | localhost / Genspark preview | local / preview | Development project |

---

## APPENDIX A — Key Design Decisions

1. **Cloudflare Workers as API layer** — eliminates the need for a Node.js server. All API logic lives in the Worker, which calls Supabase directly. This is fast, cheap (free tier covers millions of requests), and globally distributed.

2. **Vanilla JS frontend** — no React/Vue/Angular. The frontend is intentionally framework-free for simplicity. The developer may choose to rebuild in React/Next.js (Lovable.dev or similar) while keeping the same API layer.

3. **Shopify as a consumer channel, not the platform** — BRND Direct is the master system. Shopify is a sales channel. BRND Direct pushes catalog to Shopify, receives orders from Shopify, and pushes tracking back. The buyer's Shopify store is just one input source.

4. **Daily invoicing for dropship** — instead of per-order invoicing, all dropship orders shipped in a day are consolidated into one daily invoice. This reduces invoice noise and aligns with how wholesale credit terms work.

5. **Two-mode automation for dropship** — Full Auto (zero work, requires credit) vs. Daily Confirm (full control, no credit required). This serves both high-volume buyers who want automation and new buyers who want oversight.

---

## APPENDIX B — Getting Started (for Developer)

1. **Clone the repository** and open in your code editor
2. **Preview the UI**: Open `index.html` in the Genspark preview — all pages are accessible without login
3. **Read the frontend code**: Start with `buyer/products.html` (most complex page) and `buyer/dropship.html` (dropship module)
4. **Review the API scaffold**: Open `workers/api.js` — all routes are defined, most need implementation
5. **Run the database schema**: Copy `supabase/schema.sql` → paste in Supabase SQL Editor → Run
6. **Set up Cloudflare**: Create account → Workers → paste api.js → add secrets from Section 16
7. **Start with Priority 1** from Section 15 — auth, products, orders, invoices

---

*Document prepared by BRND Direct Design Team*  
*Last updated: March 2026*  
*For questions about specific pages, refer to the live portal preview and this document together.*
