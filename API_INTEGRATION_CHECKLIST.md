# BRND Direct API Integration Checklist

This checklist keeps UI changes minimal and focuses on API wiring.

## 1) Configure Worker Secrets

Run these in the repo root after `wrangler login`:

```bash
wrangler secret put HELCIM_API_TOKEN
wrangler secret put HELCIM_WEBHOOK_SECRET
wrangler secret put HELCIM_BASE_URL

wrangler secret put TWO_API_KEY
wrangler secret put TWO_BASE_URL

wrangler secret put SHOPIFY_API_VERSION
wrangler secret put SHOPIFY_WEBHOOK_SECRET

wrangler secret put SHIPPO_API_TOKEN
wrangler secret put FREIGHTOS_CLIENT_ID
wrangler secret put FREIGHTOS_CLIENT_SECRET
wrangler secret put FREIGHTOS_BASE_URL

wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## 2) Deploy Worker

```bash
wrangler deploy --env production
```

## 3) Smoke Test Endpoints

Replace `<BASE_URL>` with your deployed API domain:

```bash
curl "<BASE_URL>/api/health"
curl "<BASE_URL>/api/products?page=1&limit=5"
curl "<BASE_URL>/api/brands?limit=10"
```

## 4) Payment (Helcim) Test

Use an existing order ID:

```bash
curl -X POST "<BASE_URL>/api/create-payment-intent" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"<ORDER_ID>\",\"amount\":1000,\"buyerEmail\":\"test@example.com\"}"
```

Expected: response includes `provider: "helcim"` and `checkoutToken` or `checkoutUrl`.

## 5) Trade Finance (Two) Test

```bash
curl -X POST "<BASE_URL>/api/trade-finance/order" \
  -H "Content-Type: application/json" \
  -d "{\"order_amount\":1000,\"currency\":\"USD\"}"
```

Expected: response includes `provider: "two"`.

## 6) Shopify Test

```bash
curl -X POST "<BASE_URL>/api/shopify/connect" \
  -H "Content-Type: application/json" \
  -d "{\"storeDomain\":\"<SHOP>.myshopify.com\",\"accessToken\":\"<TOKEN>\"}"
```

Expected: response includes `provider: "shopify"` and `connected: true`.

## 7) UI Validation (No Major UI Changes)

- Buyer catalog still loads from live API only.
- Invoices/pay modal still opens from the same button paths.
- Seller payout buttons still work without layout changes.
- Shipping pages continue using Shippo/Freightos endpoints.

