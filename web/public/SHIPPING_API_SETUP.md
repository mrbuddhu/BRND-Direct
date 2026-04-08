# BRND Direct — Shipping API Setup Guide
## Freightos (Freight) + Shippo (Parcels)

---

## Overview

The shipping section is powered by two live APIs:

| Provider | Use Case | What it does |
|----------|----------|-------------|
| **Freightos** | LTL & FTL Freight | Instant quotes from 75+ carriers, BOL generation, live tracking |
| **Shippo** | Parcels & Small Packages | FedEx, UPS, DHL, USPS rates, label purchase, tracking |

All API calls go through your **Cloudflare Worker** (`workers/api.js`) — the browser never
sees your secret keys.

---

## Step 1 — Freightos Setup

### 1a. Create an account
1. Go to **https://terminal.freightos.com**
2. Sign up as a **Shipper / API user**
3. Request **API access** (may take 1–2 business days for approval)

### 1b. Get your credentials
After API access is approved:
- Go to **Developer → API Keys**
- Copy your:
  - `FREIGHTOS_CLIENT_ID`
  - `FREIGHTOS_CLIENT_SECRET`
- Note the API base URL (sandbox: `https://api-sandbox.freightos.com`, prod: `https://api.freightos.com`)

### 1c. Add secrets to Cloudflare Worker
```bash
wrangler secret put FREIGHTOS_CLIENT_ID        # paste your client ID
wrangler secret put FREIGHTOS_CLIENT_SECRET    # paste your client secret
wrangler secret put FREIGHTOS_BASE_URL         # https://api.freightos.com  (or sandbox URL)
```

---

## Step 2 — Shippo (GoShippo) Setup

### 2a. Create an account
1. Go to **https://app.goshippo.com**
2. Sign up / log in
3. Navigate to **Settings → API** in the left sidebar

### 2b. Get your API token
- You'll see two tokens: **Test** (shippo_test_xxx) and **Live** (shippo_live_xxx)
- Start with the **Test token** to verify everything works
- Switch to **Live token** when ready to go live

### 2c. Add secret to Cloudflare Worker
```bash
wrangler secret put SHIPPO_API_TOKEN           # paste shippo_live_xxx or shippo_test_xxx
```

### 2d. Connect carrier accounts (optional — for better rates)
In Shippo dashboard → **Carriers**:
- Connect your existing FedEx, UPS, DHL, or USPS accounts to use your negotiated rates
- Or use Shippo's pre-negotiated rates (no setup required)

---

## Step 3 — Configure Your Warehouse Address

This is the "ship from" address used by Shippo for all parcel rate quotes and labels.

```bash
wrangler secret put SHIP_FROM_NAME      # e.g. BRND Direct Warehouse
wrangler secret put SHIP_FROM_STREET1   # e.g. 1234 Commerce Blvd
wrangler secret put SHIP_FROM_CITY      # e.g. Chicago
wrangler secret put SHIP_FROM_STATE     # e.g. IL
wrangler secret put SHIP_FROM_ZIP       # e.g. 60607
wrangler secret put SHIP_FROM_COUNTRY   # US
wrangler secret put SHIP_FROM_PHONE     # e.g. 3125550100
```

---

## Step 4 — Deploy the Worker

```bash
# Deploy to production
wrangler deploy --env production

# Verify all secrets are set
wrangler secret list --env production
```

---

## Step 5 — Go Live in the Portal

Once all secrets are set and the worker is deployed:

1. Open `buyer/shipping-logistics.html` in a code editor
2. Find this line near the top of the `<script>` block:
   ```js
   const DEMO_MODE = true;
   ```
3. Change it to:
   ```js
   const DEMO_MODE = false;
   ```
4. Save and redeploy the site

The provider status dots in the portal will turn **green** once the keys are working.

---

## API Routes Reference

### Freightos (Freight)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/freight/token` | Get OAuth2 access token (debug) |
| POST | `/api/freight/quote` | Get LTL/FTL rates |
| POST | `/api/freight/book` | Book a freight shipment |
| GET  | `/api/freight/shipment?id=xxx` | Get shipment status |
| GET  | `/api/freight/track?id=xxx` | Live tracking events |
| GET  | `/api/freight/bol?id=xxx` | Download BOL PDF URL |
| POST | `/api/freight/cancel` | Cancel a shipment |

### Shippo (Parcels)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/parcel/validate-address` | Validate a delivery address |
| POST | `/api/parcel/rates` | Get multi-carrier parcel rates |
| POST | `/api/parcel/purchase` | Purchase a shipping label |
| GET  | `/api/parcel/track?carrier=fedex&tracking=xxx` | Track a parcel |
| POST | `/api/parcel/refund` | Request label refund |
| GET  | `/api/parcel/label?transactionId=xxx` | Get label PDF URL |
| POST | `/api/parcel/manifest` | Create USPS end-of-day SCAN form |
| GET  | `/api/parcel/carriers` | List connected carrier accounts |

---

## Auto-Routing Logic

The portal automatically routes shipments to the right provider:

| Condition | Provider |
|-----------|----------|
| Shipment type = **LTL** or **FTL** | → Freightos |
| Shipment type = **Parcel / Small Package** | → Shippo |

Freightos handles large/heavy freight (pallets, LTL loads).  
Shippo handles boxes/packages shipped via FedEx, UPS, DHL, USPS.

---

## Testing

### Test Shippo (parcels)
- Use token `shippo_test_xxx`
- All label purchases are free in test mode
- Test tracking number: any valid format

### Test Freightos (freight)
- Use sandbox URL: `https://api-sandbox.freightos.com`
- No real charges in sandbox
- Use their sandbox test data for routes

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Status dot shows "Key needed" | Worker secret not set — run `wrangler secret put` |
| "Freightos auth error" | Check CLIENT_ID and CLIENT_SECRET are correct |
| "No parcel rates returned" | Validate address is correct; confirm SHIPPO_API_TOKEN is set |
| "BOL not ready yet" | BOL generation may take 1–2 minutes after booking |
| Worker returns 502 | Check Cloudflare Worker logs in CF dashboard |

---

## Support

- **Freightos API docs**: https://terminal.freightos.com/api-docs
- **Shippo API docs**: https://docs.goshippo.com
- **Cloudflare Workers**: https://developers.cloudflare.com/workers
