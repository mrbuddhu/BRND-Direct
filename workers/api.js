/**
 * ============================================================
 *  BRND DIRECT — Cloudflare Worker API
 *  workers/api.js
 *
 *  Handles:
 *   • POST /api/create-payment-intent      — Stripe PaymentIntent
 *   • POST /api/create-setup-intent        — Stripe SetupIntent (save card)
 *   • POST /api/stripe-webhook             — Stripe webhook events
 *   • POST /api/create-connect-account     — Stripe Connect for sellers
 *   • GET  /api/health                     — Health check
 *
 *  ── SHIPPING ROUTES ──────────────────────────────────────
 *   FREIGHTOS (LTL / FTL Freight)
 *   • POST /api/freight/token              — Get OAuth2 access token
 *   • POST /api/freight/quote              — Get LTL/FTL rates from Freightos
 *   • POST /api/freight/book               — Book a freight shipment
 *   • GET  /api/freight/shipment           — Get shipment status  ?id=xxx
 *   • GET  /api/freight/track              — Track freight        ?id=xxx
 *   • GET  /api/freight/bol                — Download BOL PDF     ?id=xxx
 *   • POST /api/freight/cancel             — Cancel a shipment
 *
 *   SHIPPO (Parcel / Small Package)
 *   • POST /api/parcel/validate-address    — Validate address via Shippo
 *   • POST /api/parcel/rates               — Get parcel rates from Shippo
 *   • POST /api/parcel/purchase            — Purchase shipping label
 *   • GET  /api/parcel/track               — Track parcel         ?carrier=xxx&tracking=xxx
 *   • POST /api/parcel/refund              — Request label refund
 *   • GET  /api/parcel/label               — Get label PDF/PNG    ?transactionId=xxx
 *   • POST /api/parcel/manifest            — Create end-of-day manifest (USPS)
 *   • GET  /api/parcel/carriers            — List available carriers & services
 *
 *  ── ROUTING LOGIC ────────────────────────────────────────
 *   Auto-routing: weight > 150 lbs OR freight_class declared → Freightos
 *                 otherwise → Shippo (parcels)
 *
 *  Environment variables (set in CF dashboard via wrangler secret put):
 *   • STRIPE_SECRET_KEY          — sk_live_xxx  or  sk_test_xxx
 *   • STRIPE_WEBHOOK_SECRET      — whsec_xxx
 *   • SUPABASE_URL               — https://xxx.supabase.co
 *   • SUPABASE_SERVICE_ROLE_KEY  — service_role JWT (never expose client-side)
 *   • FREIGHTOS_CLIENT_ID        — from Freightos Terminal API dashboard
 *   • FREIGHTOS_CLIENT_SECRET    — from Freightos Terminal API dashboard
 *   • FREIGHTOS_BASE_URL         — https://api.freightos.com (prod) or sandbox URL
 *   • SHIPPO_API_TOKEN           — shippo_live_xxx or shippo_test_xxx
 *   • SHIP_FROM_NAME             — Your warehouse name
 *   • SHIP_FROM_STREET1          — Warehouse street address
 *   • SHIP_FROM_CITY             — Warehouse city
 *   • SHIP_FROM_STATE            — Warehouse state (2-letter)
 *   • SHIP_FROM_ZIP              — Warehouse ZIP code
 *   • SHIP_FROM_COUNTRY          — Warehouse country (US)
 *   • SHIP_FROM_PHONE            — Warehouse phone
 *
 *  Deploy:  wrangler deploy --env production
 * ============================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // ── CORS preflight ──────────────────────────────────────
    if (method === 'OPTIONS') {
      return corsResponse('', 204);
    }

    // ── Route table ─────────────────────────────────────────
    try {
      if (method === 'GET'  && path === '/api/health') {
        return corsResponse(JSON.stringify({
          status: 'ok',
          ts: Date.now(),
          providers: {
            supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
            shippo: Boolean(env.SHIPPO_API_TOKEN),
            freightos: Boolean(env.FREIGHTOS_CLIENT_ID && env.FREIGHTOS_CLIENT_SECRET),
            stripe: Boolean(env.STRIPE_SECRET_KEY),
          },
        }), 200);
      }

      // ── CATALOG ROUTES ────────────────────────────────────
      if (method === 'GET'  && path === '/api/products') {
        return await handleGetProducts(request, env);
      }
      if (method === 'GET'  && path === '/api/brands') {
        return await handleGetBrands(request, env);
      }
      if (method === 'GET'  && path.startsWith('/api/products/')) {
        const id = path.replace('/api/products/', '');
        return await handleGetProduct(request, env, id);
      }

      if (method === 'POST' && path === '/api/create-payment-intent') {
        return await handleCreatePaymentIntent(request, env);
      }
      if (method === 'POST' && path === '/api/create-setup-intent') {
        return await handleCreateSetupIntent(request, env);
      }
      if (method === 'POST' && path === '/api/stripe-webhook') {
        return await handleStripeWebhook(request, env, ctx);
      }
      if (method === 'POST' && path === '/api/create-connect-account') {
        return await handleCreateConnectAccount(request, env);
      }
      if (method === 'GET'  && path === '/api/payout-link') {
        return await handlePayoutLink(request, env);
      }

      // ── FREIGHTOS FREIGHT ROUTES ──────────────────────────
      if (method === 'POST' && path === '/api/freight/token') {
        return await handleFreightosToken(request, env);
      }
      if (method === 'POST' && path === '/api/freight/quote') {
        return await handleFreightosQuote(request, env);
      }
      if (method === 'POST' && path === '/api/freight/book') {
        return await handleFreightosBook(request, env);
      }
      if (method === 'GET'  && path === '/api/freight/shipment') {
        return await handleFreightosShipment(request, env);
      }
      if (method === 'GET'  && path === '/api/freight/track') {
        return await handleFreightosTrack(request, env);
      }
      if (method === 'GET'  && path === '/api/freight/bol') {
        return await handleFreightosBOL(request, env);
      }
      if (method === 'POST' && path === '/api/freight/cancel') {
        return await handleFreightosCancel(request, env);
      }

      // ── SHIPPO PARCEL ROUTES ──────────────────────────────
      if (method === 'POST' && path === '/api/parcel/validate-address') {
        return await handleShippoValidateAddress(request, env);
      }
      if (method === 'POST' && path === '/api/parcel/rates') {
        return await handleShippoRates(request, env);
      }
      if (method === 'POST' && path === '/api/parcel/purchase') {
        return await handleShippoPurchase(request, env);
      }
      if (method === 'GET'  && path === '/api/parcel/track') {
        return await handleShippoTrack(request, env);
      }
      if (method === 'POST' && path === '/api/parcel/refund') {
        return await handleShippoRefund(request, env);
      }
      if (method === 'GET'  && path === '/api/parcel/label') {
        return await handleShippoLabel(request, env);
      }
      if (method === 'POST' && path === '/api/parcel/manifest') {
        return await handleShippoManifest(request, env);
      }
      if (method === 'GET'  && path === '/api/parcel/carriers') {
        return await handleShippoCarriers(request, env);
      }

      return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
    } catch (err) {
      console.error('[Worker Error]', err.message, err.stack);
      return corsResponse(JSON.stringify({ error: 'Internal server error', detail: err.message }), 500);
    }
  }
};

/* ════════════════════════════════════════════════════════════
   CATALOG HANDLERS  — Supabase Products & Brands
════════════════════════════════════════════════════════════ */

/**
 * Thin Supabase REST helper.
 * Uses the service_role key so it bypasses RLS.
 */
async function supabase(env, table, queryString = '', method = 'GET', body = null) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Worker secrets.');
  }
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${queryString ? '?' + queryString : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey':        env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation,count=exact'
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === 'object' ? (data.message || JSON.stringify(data)) : text);
  // Extract count from Content-Range header: "0-49/150"
  const range = res.headers.get('Content-Range') || '';
  const total = range.includes('/') ? parseInt(range.split('/')[1], 10) : (Array.isArray(data) ? data.length : 0);
  return { data, total };
}

/**
 * GET /api/products
 * Query params: page, limit, search, category, brand_id, sort, fulfillment_type
 */
async function handleGetProducts(request, env) {
  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1', 10));
  const limit  = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const search = (url.searchParams.get('search') || '').trim();
  const cat    = (url.searchParams.get('category') || '').trim();
  const brandId= (url.searchParams.get('brand_id') || '').trim();
  const fulfil = (url.searchParams.get('fulfillment_type') || '').trim();
  const sortBy = url.searchParams.get('sort') || 'name';
  const from   = (page - 1) * limit;
  const to     = from + limit - 1;

  // Build PostgREST filter string
  const filters = ['is_active=eq.true'];
  if (cat)     filters.push(`category=eq.${encodeURIComponent(cat)}`);
  if (brandId) filters.push(`brand_id=eq.${encodeURIComponent(brandId)}`);
  if (fulfil)  filters.push(`fulfillment_type=eq.${encodeURIComponent(fulfil)}`);

  // Full-text search using ilike on name or sku
  if (search) {
    const s = encodeURIComponent(`%${search}%`);
    filters.push(`or=(name.ilike.${s},sku.ilike.${s})`);
  }

  // Validate sort field whitelist
  const allowedSorts = ['name','wholesale_price','msrp','moq','stock_qty','created_at'];
  const sortField = allowedSorts.includes(sortBy) ? sortBy : 'name';

  const qs = [
    ...filters,
    `select=id,name,sku,upc,category,subcategory,fulfillment_type,wholesale_price,msrp,moq,stock_qty,images,tags,meta,is_top_seller,description,brand_id,brands(id,name,logo_url,category)`,
    `order=${sortField}.asc`,
    `offset=${from}`,
    `limit=${limit}`
  ].join('&');

  try {
    const { data, total } = await supabase(env, 'products', qs);
    const pages = Math.ceil(total / limit);
    return corsResponse(JSON.stringify({ data, total, page, limit, pages }), 200);
  } catch (err) {
    console.error('[Catalog] Products error:', err.message);
    return corsResponse(JSON.stringify({ error: err.message }), 500);
  }
}

/**
 * GET /api/products/:id
 */
async function handleGetProduct(request, env, id) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return corsResponse(JSON.stringify({ error: 'Invalid product ID' }), 400);
  }
  try {
    const qs = `id=eq.${id}&select=*,brands(id,name,logo_url,category,description)`;
    const { data } = await supabase(env, 'products', qs);
    const product  = Array.isArray(data) ? data[0] : data;
    if (!product) return corsResponse(JSON.stringify({ error: 'Product not found' }), 404);
    return corsResponse(JSON.stringify(product), 200);
  } catch (err) {
    return corsResponse(JSON.stringify({ error: err.message }), 500);
  }
}

/**
 * GET /api/brands
 * Query params: category, search, page, limit
 */
async function handleGetBrands(request, env) {
  const url    = new URL(request.url);
  const cat    = (url.searchParams.get('category') || '').trim();
  const search = (url.searchParams.get('search') || '').trim();
  const limit  = Math.min(500, parseInt(url.searchParams.get('limit') || '200', 10));

  const filters = ['is_active=eq.true'];
  if (cat) filters.push(`category=eq.${encodeURIComponent(cat)}`);
  if (search) {
    const s = encodeURIComponent(`%${search}%`);
    filters.push(`name=ilike.${s}`);
  }

  const qs = [
    ...filters,
    `select=id,name,logo_url,banner_url,category,description,is_verified`,
    `order=name.asc`,
    `limit=${limit}`
  ].join('&');

  try {
    const { data, total } = await supabase(env, 'brands', qs);
    return corsResponse(JSON.stringify({ data, total }), 200);
  } catch (err) {
    console.error('[Catalog] Brands error:', err.message);
    return corsResponse(JSON.stringify({ error: err.message }), 500);
  }
}

/* ════════════════════════════════════════════════════════════
   STRIPE HELPERS
════════════════════════════════════════════════════════════ */

/** Thin wrapper around the Stripe REST API */
async function stripe(env, endpoint, params = {}, method = 'POST') {
  const body = method === 'POST'
    ? new URLSearchParams(flatten(params)).toString()
    : null;

  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-04-10'
    },
    body
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Stripe API error');
  return data;
}

/** Recursively flatten nested objects for URL encoding */
function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => { out[`${key}[${i}]`] = item; });
    } else if (v !== undefined && v !== null) {
      out[key] = String(v);
    }
  }
  return out;
}

/* ════════════════════════════════════════════════════════════
   SUPABASE ADMIN HELPER
════════════════════════════════════════════════════════════ */
async function supabaseAdmin(env, method, table, body = null, query = '') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey:        env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:        method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

/* ════════════════════════════════════════════════════════════
   1. CREATE PAYMENT INTENT
   Body: { orderId, amount, currency, buyerEmail, metadata }
════════════════════════════════════════════════════════════ */
async function handleCreatePaymentIntent(request, env) {
  const body = await request.json();
  const { orderId, amount, currency = 'usd', buyerEmail, metadata = {} } = body;

  if (!orderId || !amount) {
    return corsResponse(JSON.stringify({ error: 'orderId and amount are required' }), 400);
  }
  if (typeof amount !== 'number' || amount < 50) {
    return corsResponse(JSON.stringify({ error: 'amount must be a number ≥ 50 (cents)' }), 400);
  }

  // Look up the order in Supabase to confirm amount server-side
  const orders = await supabaseAdmin(
    env, 'GET', 'orders', null,
    `?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,total_amount,payment_status`
  );
  const order = orders?.[0];
  if (!order) return corsResponse(JSON.stringify({ error: 'Order not found' }), 404);
  if (order.payment_status === 'paid') {
    return corsResponse(JSON.stringify({ error: 'Order already paid' }), 409);
  }

  // Convert dollars → cents
  const amountCents = Math.round(order.total_amount * 100);

  const pi = await stripe(env, 'payment_intents', {
    amount:             amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    receipt_email:      buyerEmail || undefined,
    metadata: {
      order_id:     orderId,
      order_number: order.order_number,
      platform:     'brnd-direct',
      ...metadata
    }
  });

  // Store the payment intent ID on the order
  await supabaseAdmin(
    env, 'PATCH', 'orders',
    { stripe_payment_intent: pi.id, payment_status: 'pending', updated_at: new Date().toISOString() },
    `?id=eq.${encodeURIComponent(orderId)}`
  );

  return corsResponse(JSON.stringify({
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id
  }), 200);
}

/* ════════════════════════════════════════════════════════════
   2. CREATE SETUP INTENT  (save card for Net Terms billing)
   Body: { profileId, email }
════════════════════════════════════════════════════════════ */
async function handleCreateSetupIntent(request, env) {
  const { profileId, email } = await request.json();
  if (!profileId) return corsResponse(JSON.stringify({ error: 'profileId required' }), 400);

  // Find or create Stripe customer
  let customerId;
  const profiles = await supabaseAdmin(
    env, 'GET', 'buyer_profiles', null,
    `?profile_id=eq.${encodeURIComponent(profileId)}&select=id,stripe_customer_id`
  );
  const bp = profiles?.[0];

  if (bp?.stripe_customer_id) {
    customerId = bp.stripe_customer_id;
  } else {
    const customer = await stripe(env, 'customers', { email, metadata: { profile_id: profileId } });
    customerId = customer.id;
    // Save customer id (add stripe_customer_id column to buyer_profiles if not present)
    await supabaseAdmin(env, 'PATCH', 'buyer_profiles',
      { stripe_customer_id: customerId },
      `?profile_id=eq.${encodeURIComponent(profileId)}`
    );
  }

  const si = await stripe(env, 'setup_intents', {
    customer:              customerId,
    payment_method_types:  ['card'],
    usage:                 'off_session',
    metadata: { profile_id: profileId }
  });

  return corsResponse(JSON.stringify({ clientSecret: si.client_secret }), 200);
}

/* ════════════════════════════════════════════════════════════
   3. STRIPE WEBHOOK
   Events handled:
    • payment_intent.succeeded
    • payment_intent.payment_failed
    • invoice.payment_succeeded  (Stripe Billing / net-terms)
    • account.updated            (Stripe Connect)
════════════════════════════════════════════════════════════ */
async function handleStripeWebhook(request, env, ctx) {
  const rawBody  = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  // Verify webhook signature
  const isValid = await verifyWebhookSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return corsResponse(JSON.stringify({ error: 'Invalid signature' }), 401);
  }

  const event = JSON.parse(rawBody);
  console.log('[Webhook]', event.type);

  ctx.waitUntil(processWebhookEvent(event, env));

  return corsResponse(JSON.stringify({ received: true }), 200);
}

async function processWebhookEvent(event, env) {
  try {
    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi      = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;

        await supabaseAdmin(env, 'PATCH', 'orders', {
          payment_status: 'paid',
          status:         'confirmed',
          updated_at:     new Date().toISOString()
        }, `?id=eq.${encodeURIComponent(orderId)}`);

        // Create invoice record
        const orders = await supabaseAdmin(
          env, 'GET', 'orders', null,
          `?id=eq.${encodeURIComponent(orderId)}&select=id,buyer_profile_id,total_amount,net_terms`
        );
        const order = orders?.[0];
        if (order) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (order.net_terms || 30));
          await supabaseAdmin(env, 'POST', 'invoices', {
            order_id:         orderId,
            buyer_profile_id: order.buyer_profile_id,
            amount:           order.total_amount,
            payment_status:   'paid',
            paid_at:          new Date().toISOString(),
            due_date:         dueDate.toISOString().split('T')[0]
          });

          // Notification
          const buyers = await supabaseAdmin(
            env, 'GET', 'buyer_profiles', null,
            `?id=eq.${encodeURIComponent(order.buyer_profile_id)}&select=profile_id`
          );
          const profileId = buyers?.[0]?.profile_id;
          if (profileId) {
            await supabaseAdmin(env, 'POST', 'notifications', {
              profile_id: profileId,
              type:       'payment',
              title:      'Payment confirmed',
              body:       `Your payment of $${order.total_amount} has been received.`,
              link:       '/buyer/invoices.html'
            });
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi      = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;

        await supabaseAdmin(env, 'PATCH', 'orders', {
          payment_status: 'failed',
          updated_at:     new Date().toISOString()
        }, `?id=eq.${encodeURIComponent(orderId)}`);
        break;
      }

      case 'account.updated': {
        // Stripe Connect seller account updated
        const account = event.data.object;
        if (account.charges_enabled) {
          await supabaseAdmin(env, 'PATCH', 'seller_profiles', {
            stripe_account_id: account.id,
            updated_at:        new Date().toISOString()
          }, `?stripe_account_id=eq.${encodeURIComponent(account.id)}`);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object;
        if (transfer.metadata?.payout_id) {
          await supabaseAdmin(env, 'PATCH', 'payouts', {
            status:            'processing',
            stripe_transfer_id: transfer.id,
            updated_at:        new Date().toISOString()
          }, `?id=eq.${encodeURIComponent(transfer.metadata.payout_id)}`);
        }
        break;
      }
    }
  } catch (e) {
    console.error('[Webhook Processing Error]', e.message);
  }
}

/** Verify Stripe webhook HMAC-SHA256 signature */
async function verifyWebhookSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  try {
    const parts     = sigHeader.split(',');
    const tPart     = parts.find(p => p.startsWith('t='));
    const v1Part    = parts.find(p => p.startsWith('v1='));
    if (!tPart || !v1Part) return false;

    const timestamp = tPart.split('=')[1];
    const sig       = v1Part.split('=')[1];
    const signed    = `${timestamp}.${payload}`;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', keyMaterial, new TextEncoder().encode(signed));
    const expected       = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === sig;
  } catch { return false; }
}

/* ════════════════════════════════════════════════════════════
   4. CREATE STRIPE CONNECT ACCOUNT  (for sellers)
   Body: { sellerProfileId, email, brandName }
════════════════════════════════════════════════════════════ */
async function handleCreateConnectAccount(request, env) {
  const { sellerProfileId, email, brandName } = await request.json();
  if (!sellerProfileId || !email) {
    return corsResponse(JSON.stringify({ error: 'sellerProfileId and email required' }), 400);
  }

  // Check if account already exists
  const profiles = await supabaseAdmin(
    env, 'GET', 'seller_profiles', null,
    `?id=eq.${encodeURIComponent(sellerProfileId)}&select=id,stripe_account_id`
  );
  const sp = profiles?.[0];
  if (sp?.stripe_account_id) {
    return corsResponse(JSON.stringify({ accountId: sp.stripe_account_id }), 200);
  }

  // Create Express account
  const account = await stripe(env, 'accounts', {
    type:          'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true }
    },
    business_type: 'company',
    metadata: { seller_profile_id: sellerProfileId, brand_name: brandName || '' }
  });

  // Save account ID
  await supabaseAdmin(env, 'PATCH', 'seller_profiles', {
    stripe_account_id: account.id,
    updated_at:        new Date().toISOString()
  }, `?id=eq.${encodeURIComponent(sellerProfileId)}`);

  // Create onboarding link
  const accountLink = await stripe(env, 'account_links', {
    account:     account.id,
    refresh_url: `https://brnddirect.com/seller/account.html?stripe=refresh`,
    return_url:  `https://brnddirect.com/seller/account.html?stripe=success`,
    type:        'account_onboarding'
  });

  return corsResponse(JSON.stringify({
    accountId:    account.id,
    onboardingUrl: accountLink.url
  }), 200);
}

/* ════════════════════════════════════════════════════════════
   5. GET PAYOUT LINK   (seller dashboard link to Stripe Express)
   Query: ?sellerProfileId=xxx
════════════════════════════════════════════════════════════ */
async function handlePayoutLink(request, env) {
  const url              = new URL(request.url);
  const sellerProfileId  = url.searchParams.get('sellerProfileId');
  if (!sellerProfileId) return corsResponse(JSON.stringify({ error: 'sellerProfileId required' }), 400);

  const profiles = await supabaseAdmin(
    env, 'GET', 'seller_profiles', null,
    `?id=eq.${encodeURIComponent(sellerProfileId)}&select=stripe_account_id`
  );
  const accountId = profiles?.[0]?.stripe_account_id;
  if (!accountId) return corsResponse(JSON.stringify({ error: 'No Stripe account linked' }), 404);

  const link = await stripe(env, `accounts/${accountId}/login_links`, {});
  return corsResponse(JSON.stringify({ url: link.url }), 200);
}

/* ════════════════════════════════════════════════════════════
   FREIGHTOS HELPERS
   All calls route through the Freightos Terminal REST API.
   OAuth2 client-credentials flow: token cached in env.FREIGHT_TOKEN_CACHE (KV)
   or fetched fresh on each worker invocation (stateless fallback).
════════════════════════════════════════════════════════════ */

/** Get a Freightos Bearer token (client_credentials) */
async function freightosToken(env) {
  const base = (env.FREIGHTOS_BASE_URL || 'https://api.freightos.com').replace(/\/$/, '');
  const res  = await fetch(`${base}/auth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     env.FREIGHTOS_CLIENT_ID     || '',
      client_secret: env.FREIGHTOS_CLIENT_SECRET || '',
      scope:         'shipment:read shipment:write rates:read bol:read'
    }).toString()
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freightos auth error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

/** Generic Freightos API call */
async function freightos(env, method, endpoint, body = null) {
  const token = await freightosToken(env);
  const base  = (env.FREIGHTOS_BASE_URL || 'https://api.freightos.com').replace(/\/$/, '');
  const res   = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Freightos API error [${res.status}]: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ────────────────────────────────────────────────────────
   F-1. GET FREIGHTOS ACCESS TOKEN  (for frontend debug)
──────────────────────────────────────────────────────── */
async function handleFreightosToken(request, env) {
  try {
    const token = await freightosToken(env);
    return corsResponse(JSON.stringify({ access_token: token, provider: 'freightos' }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-2. FREIGHT RATE QUOTE
   Body: {
     origin: { city, state, zip, country },
     destination: { city, state, zip, country },
     cargo: [{ weight_lb, length_in, width_in, height_in, qty, freight_class?, description }],
     shipment_type: 'LTL' | 'FTL',
     pickup_date: 'YYYY-MM-DD',
     declared_value?: number,
     currency?: 'USD'
   }
──────────────────────────────────────────────────────── */
async function handleFreightosQuote(request, env) {
  try {
    const body = await request.json();
    const { origin, destination, cargo, shipment_type = 'LTL', pickup_date, declared_value, currency = 'USD' } = body;

    if (!origin || !destination || !cargo || !cargo.length) {
      return corsResponse(JSON.stringify({ error: 'origin, destination and cargo are required' }), 400);
    }

    const payload = {
      shipmentType: shipment_type,
      origin: {
        type: 'ADDRESS',
        address: {
          city:    origin.city,
          state:   origin.state,
          zip:     origin.zip,
          country: origin.country || 'US'
        }
      },
      destination: {
        type: 'ADDRESS',
        address: {
          city:    destination.city,
          state:   destination.state,
          zip:     destination.zip,
          country: destination.country || 'US'
        }
      },
      cargo: cargo.map(c => ({
        quantity:      c.qty || 1,
        weight:        { value: c.weight_lb, unit: 'LB' },
        dimensions:    { length: c.length_in, width: c.width_in, height: c.height_in, unit: 'IN' },
        freightClass:  c.freight_class || '70',
        description:   c.description   || 'Merchandise',
        stackable:     true
      })),
      pickupDate:      pickup_date,
      declaredValue:   declared_value ? { value: declared_value, currency } : undefined,
      currency
    };

    const data = await freightos(env, 'POST', '/v1/quotes', payload);

    // Normalise response to our standard rate format
    const rates = (data.rates || data.quotes || []).map(r => ({
      provider:   'freightos',
      rate_id:    r.rateId || r.id,
      carrier:    r.carrierName || r.carrier?.name || 'Carrier',
      service:    r.serviceLevel || r.serviceName || shipment_type,
      transit:    r.transitDays ? `${r.transitDays} business day${r.transitDays > 1 ? 's' : ''}` : '—',
      price:      r.totalCharges?.value || r.totalAmount || 0,
      currency:   r.totalCharges?.currency || currency,
      breakdown:  r.charges || [],
      expires_at: r.expiresAt || null,
      guaranteed: r.guaranteedDelivery || false
    }));

    return corsResponse(JSON.stringify({ rates, provider: 'freightos', raw: data }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-3. BOOK FREIGHT SHIPMENT
   Body: { rate_id, shipper: {...}, consignee: {...}, cargo, pickup_date,
           reference?, notes?, declared_value? }
──────────────────────────────────────────────────────── */
async function handleFreightosBook(request, env) {
  try {
    const body = await request.json();
    const { rate_id, shipper, consignee, cargo, pickup_date, reference, notes, declared_value } = body;

    if (!rate_id || !shipper || !consignee) {
      return corsResponse(JSON.stringify({ error: 'rate_id, shipper and consignee are required' }), 400);
    }

    const payload = {
      rateId:    rate_id,
      shipper: {
        companyName: shipper.name,
        address: {
          street1: shipper.street1,
          city:    shipper.city,
          state:   shipper.state,
          zip:     shipper.zip,
          country: shipper.country || 'US'
        },
        contact: { name: shipper.contact_name || shipper.name, phone: shipper.phone || '', email: shipper.email || '' }
      },
      consignee: {
        companyName: consignee.name,
        address: {
          street1: consignee.street1,
          city:    consignee.city,
          state:   consignee.state,
          zip:     consignee.zip,
          country: consignee.country || 'US'
        },
        contact: { name: consignee.contact_name || consignee.name, phone: consignee.phone || '', email: consignee.email || '' }
      },
      cargo: (cargo || []).map(c => ({
        quantity:   c.qty || 1,
        weight:     { value: c.weight_lb, unit: 'LB' },
        dimensions: { length: c.length_in, width: c.width_in, height: c.height_in, unit: 'IN' },
        freightClass: c.freight_class || '70',
        description: c.description || 'Merchandise'
      })),
      pickupDate:      pickup_date,
      referenceNumber: reference || '',
      specialInstructions: notes || '',
      declaredValue:   declared_value ? { value: declared_value, currency: 'USD' } : undefined
    };

    const data = await freightos(env, 'POST', '/v1/shipments', payload);

    return corsResponse(JSON.stringify({
      provider:    'freightos',
      shipment_id: data.shipmentId || data.id,
      bol_number:  data.bolNumber  || data.bol,
      status:      data.status     || 'booked',
      tracking_url: data.trackingUrl || null,
      raw:         data
    }), 201);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-4. GET SHIPMENT STATUS
   Query: ?id=<shipmentId>
──────────────────────────────────────────────────────── */
async function handleFreightosShipment(request, env) {
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return corsResponse(JSON.stringify({ error: 'id is required' }), 400);

    const data = await freightos(env, 'GET', `/v1/shipments/${encodeURIComponent(id)}`);
    return corsResponse(JSON.stringify({ provider: 'freightos', ...data }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-5. TRACK FREIGHT
   Query: ?id=<shipmentId>
──────────────────────────────────────────────────────── */
async function handleFreightosTrack(request, env) {
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return corsResponse(JSON.stringify({ error: 'id is required' }), 400);

    const data = await freightos(env, 'GET', `/v1/shipments/${encodeURIComponent(id)}/tracking`);

    // Normalise events
    const events = (data.events || data.trackingEvents || []).map(e => ({
      timestamp:   e.timestamp || e.eventTime,
      description: e.description || e.eventDescription,
      location:    e.location   || e.eventLocation || '',
      code:        e.code       || e.eventCode || '',
      status:      e.status
    }));

    return corsResponse(JSON.stringify({
      provider:    'freightos',
      shipment_id: id,
      status:      data.status || data.shipmentStatus,
      eta:         data.estimatedDeliveryDate || data.eta || null,
      events,
      raw:         data
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-6. DOWNLOAD BOL
   Query: ?id=<shipmentId>
   Returns: { bol_url, bol_number } — presigned PDF URL
──────────────────────────────────────────────────────── */
async function handleFreightosBOL(request, env) {
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return corsResponse(JSON.stringify({ error: 'id is required' }), 400);

    const data = await freightos(env, 'GET', `/v1/shipments/${encodeURIComponent(id)}/documents`);

    const bol = (data.documents || []).find(d => d.type === 'BOL' || d.documentType === 'BOL');
    return corsResponse(JSON.stringify({
      provider:   'freightos',
      bol_url:    bol?.url || bol?.downloadUrl || null,
      bol_number: bol?.documentNumber || null,
      documents:  data.documents || []
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   F-7. CANCEL FREIGHT SHIPMENT
   Body: { shipment_id, reason? }
──────────────────────────────────────────────────────── */
async function handleFreightosCancel(request, env) {
  try {
    const { shipment_id, reason } = await request.json();
    if (!shipment_id) return corsResponse(JSON.stringify({ error: 'shipment_id is required' }), 400);

    const data = await freightos(env, 'POST', `/v1/shipments/${encodeURIComponent(shipment_id)}/cancel`,
      { reason: reason || 'Cancelled by shipper' });

    return corsResponse(JSON.stringify({
      provider:    'freightos',
      shipment_id,
      status:      data?.status || 'cancelled',
      raw:         data
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}


/* ════════════════════════════════════════════════════════════
   SHIPPO HELPERS
   All calls go to https://api.goshippo.com/
   Uses API token auth: "ShippoToken <SHIPPO_API_TOKEN>"
════════════════════════════════════════════════════════════ */

/** Generic Shippo API call */
async function shippo(env, method, endpoint, body = null) {
  const token = env.SHIPPO_API_TOKEN || '';
  const res   = await fetch(`https://api.goshippo.com${endpoint}`, {
    method,
    headers: {
      Authorization:  `ShippoToken ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shippo API error [${res.status}]: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** Build a Shippo address object from env defaults (ship-from) */
function shipFromAddress(env, overrides = {}) {
  return {
    name:    overrides.name    || env.SHIP_FROM_NAME    || 'BRND Direct Warehouse',
    street1: overrides.street1 || env.SHIP_FROM_STREET1 || '1234 Commerce Blvd',
    city:    overrides.city    || env.SHIP_FROM_CITY    || 'Chicago',
    state:   overrides.state   || env.SHIP_FROM_STATE   || 'IL',
    zip:     overrides.zip     || env.SHIP_FROM_ZIP     || '60607',
    country: overrides.country || env.SHIP_FROM_COUNTRY || 'US',
    phone:   overrides.phone   || env.SHIP_FROM_PHONE   || '3125550100',
    email:   overrides.email   || '',
    is_residential: false,
    validate: true
  };
}

/* ────────────────────────────────────────────────────────
   S-1. VALIDATE ADDRESS
   Body: { name, street1, street2?, city, state, zip, country?, is_residential? }
──────────────────────────────────────────────────────── */
async function handleShippoValidateAddress(request, env) {
  try {
    const body = await request.json();
    const addr = await shippo(env, 'POST', '/addresses/', {
      name:           body.name     || '',
      street1:        body.street1  || '',
      street2:        body.street2  || '',
      city:           body.city     || '',
      state:          body.state    || '',
      zip:            body.zip      || '',
      country:        body.country  || 'US',
      phone:          body.phone    || '',
      email:          body.email    || '',
      is_residential: body.is_residential || false,
      validate:       true
    });

    return corsResponse(JSON.stringify({
      provider:   'shippo',
      valid:      addr.validation_results?.is_valid ?? null,
      messages:   addr.validation_results?.messages || [],
      address_id: addr.object_id,
      address:    addr
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-2. GET PARCEL RATES
   Body: {
     to: { name, street1, city, state, zip, country?, is_residential? },
     from?: { ... },   // defaults to warehouse
     parcels: [{ weight_lb, length_in, width_in, height_in, qty? }],
     declared_value?: number,
     currency?: 'USD',
     extra?: { signature_confirmation?, insurance?, saturday_delivery? }
   }
──────────────────────────────────────────────────────── */
async function handleShippoRates(request, env) {
  try {
    const body = await request.json();
    const { to, from: fromOverride, parcels, declared_value, currency = 'USD', extra = {} } = body;

    if (!to || !parcels || !parcels.length) {
      return corsResponse(JSON.stringify({ error: 'to and parcels are required' }), 400);
    }

    // Create a shipment in Shippo (async: false for immediate rates)
    const shipment = await shippo(env, 'POST', '/shipments/', {
      address_from: shipFromAddress(env, fromOverride || {}),
      address_to: {
        name:           to.name     || 'Recipient',
        street1:        to.street1  || '',
        city:           to.city     || '',
        state:          to.state    || '',
        zip:            to.zip      || '',
        country:        to.country  || 'US',
        is_residential: to.is_residential !== undefined ? to.is_residential : true,
        validate:       true
      },
      parcels: parcels.map(p => ({
        length:        String(p.length_in || 12),
        width:         String(p.width_in  || 10),
        height:        String(p.height_in || 6),
        distance_unit: 'in',
        weight:        String(p.weight_lb || 1),
        mass_unit:     'lb'
      })),
      extra: {
        signature_confirmation: extra.signature_confirmation || 'STANDARD',
        insurance: declared_value ? { amount: String(declared_value), currency, provider: 'SHIPPO' } : undefined,
        saturday_delivery: extra.saturday_delivery || false
      },
      async: false,
      currency
    });

    // Normalise rates
    const rates = (shipment.rates || []).map(r => ({
      provider:      'shippo',
      rate_id:       r.object_id,
      carrier:       r.provider,
      carrier_account: r.carrier_account,
      service:       r.servicelevel?.name || r.servicelevel_token,
      service_token: r.servicelevel?.token,
      transit:       r.estimated_days ? `${r.estimated_days} business day${r.estimated_days > 1 ? 's' : ''}` : r.duration_terms || '—',
      estimated_delivery: r.arrives_by,
      price:         parseFloat(r.amount || 0),
      currency:      r.currency,
      zone:          r.zone,
      included_insurance: r.included_insurance_price || '0',
      trackable:     r.trackable,
      image_url:     r.carrier_image_200 || null,
      attributes:    r.attributes || []
    })).sort((a, b) => a.price - b.price);

    return corsResponse(JSON.stringify({
      provider:    'shippo',
      shipment_id: shipment.object_id,
      rates,
      address_valid: shipment.address_to?.validation_results?.is_valid,
      raw_shipment:  shipment
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-3. PURCHASE LABEL
   Body: { rate_id, label_file_type?: 'PDF'|'PNG'|'ZPLII', metadata? }
──────────────────────────────────────────────────────── */
async function handleShippoPurchase(request, env) {
  try {
    const body = await request.json();
    const { rate_id, label_file_type = 'PDF', metadata = '' } = body;

    if (!rate_id) return corsResponse(JSON.stringify({ error: 'rate_id is required' }), 400);

    const txn = await shippo(env, 'POST', '/transactions/', {
      rate:            rate_id,
      label_file_type,
      metadata,
      async:           false
    });

    if (txn.status !== 'SUCCESS') {
      return corsResponse(JSON.stringify({
        provider: 'shippo',
        status:   txn.status,
        messages: txn.messages || [],
        raw:      txn
      }), 422);
    }

    return corsResponse(JSON.stringify({
      provider:       'shippo',
      transaction_id: txn.object_id,
      tracking_number: txn.tracking_number,
      tracking_url:   txn.tracking_url_provider,
      label_url:      txn.label_url,
      commercial_invoice_url: txn.commercial_invoice_url || null,
      qr_code_url:    txn.qr_code_url || null,
      status:         txn.status,
      raw:            txn
    }), 201);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-4. TRACK PARCEL
   Query: ?carrier=fedex&tracking=794644792798
──────────────────────────────────────────────────────── */
async function handleShippoTrack(request, env) {
  try {
    const url      = new URL(request.url);
    const carrier  = url.searchParams.get('carrier') || '';
    const tracking = url.searchParams.get('tracking') || '';

    if (!carrier || !tracking) {
      return corsResponse(JSON.stringify({ error: 'carrier and tracking are required' }), 400);
    }

    const data = await shippo(env, 'GET', `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(tracking)}`);

    const events = (data.tracking_history || []).map(e => ({
      timestamp:   e.status_date,
      description: e.status_details,
      location:    [e.location?.city, e.location?.state, e.location?.country].filter(Boolean).join(', '),
      code:        e.status,
      substatus:   e.substatus?.code || null
    }));

    return corsResponse(JSON.stringify({
      provider:         'shippo',
      tracking_number:  tracking,
      carrier,
      status:           data.tracking_status?.status,
      substatus:        data.tracking_status?.substatus?.code || null,
      status_details:   data.tracking_status?.status_details,
      eta:              data.eta,
      location:         data.tracking_status?.location,
      events,
      address_from:     data.address_from,
      address_to:       data.address_to,
      transaction:      data.transaction,
      raw:              data
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-5. REFUND LABEL
   Body: { transaction_id }
──────────────────────────────────────────────────────── */
async function handleShippoRefund(request, env) {
  try {
    const { transaction_id } = await request.json();
    if (!transaction_id) return corsResponse(JSON.stringify({ error: 'transaction_id is required' }), 400);

    const data = await shippo(env, 'POST', '/refunds/', { transaction: transaction_id, async: false });

    return corsResponse(JSON.stringify({
      provider:  'shippo',
      refund_id: data.object_id,
      status:    data.status,
      raw:       data
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-6. GET LABEL
   Query: ?transactionId=xxx
──────────────────────────────────────────────────────── */
async function handleShippoLabel(request, env) {
  try {
    const url = new URL(request.url);
    const tid = url.searchParams.get('transactionId');
    if (!tid) return corsResponse(JSON.stringify({ error: 'transactionId is required' }), 400);

    const data = await shippo(env, 'GET', `/transactions/${encodeURIComponent(tid)}`);
    return corsResponse(JSON.stringify({
      provider:        'shippo',
      transaction_id:  tid,
      label_url:       data.label_url,
      tracking_number: data.tracking_number,
      tracking_url:    data.tracking_url_provider,
      qr_code_url:     data.qr_code_url || null,
      status:          data.status,
      raw:             data
    }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-7. CREATE END-OF-DAY MANIFEST  (USPS SCAN form)
   Body: { transaction_ids: [...], shipment_date?: 'YYYY-MM-DD' }
──────────────────────────────────────────────────────── */
async function handleShippoManifest(request, env) {
  try {
    const body = await request.json();
    const { transaction_ids = [], shipment_date } = body;

    if (!transaction_ids.length) {
      return corsResponse(JSON.stringify({ error: 'transaction_ids are required' }), 400);
    }

    const manifest = await shippo(env, 'POST', '/manifests/', {
      carrier_account:   '',   // Shippo picks the right one from the transactions
      shipment_date:     shipment_date || new Date().toISOString().split('T')[0],
      transactions:      transaction_ids,
      address_from:      shipFromAddress(env),
      async:             false
    });

    return corsResponse(JSON.stringify({
      provider:     'shippo',
      manifest_id:  manifest.object_id,
      status:       manifest.status,
      document_url: manifest.documents?.[0] || null,
      raw:          manifest
    }), 201);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}

/* ────────────────────────────────────────────────────────
   S-8. LIST CARRIER ACCOUNTS / SERVICES
──────────────────────────────────────────────────────── */
async function handleShippoCarriers(request, env) {
  try {
    const data = await shippo(env, 'GET', '/carrier_accounts/?results=100');

    const carriers = (data.results || []).map(c => ({
      provider:    'shippo',
      id:          c.object_id,
      carrier:     c.carrier,
      account:     c.account_id,
      active:      c.active,
      is_shippo_account: c.carrier_name?.startsWith('Shippo') ?? false
    }));

    return corsResponse(JSON.stringify({ provider: 'shippo', carriers, count: data.count || carriers.length }), 200);
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 502);
  }
}


/* ════════════════════════════════════════════════════════════
   CORS HELPER
════════════════════════════════════════════════════════════ */
function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
