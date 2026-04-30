import { NextRequest, NextResponse } from "next/server";

type JsonMap = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function readJson(request: NextRequest): Promise<JsonMap> {
  try {
    const data = (await request.json()) as JsonMap;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function baseUrl(name: string, fallback = "") {
  const value = process.env[name] || fallback;
  return value.replace(/\/$/, "");
}

async function callJson(
  endpoint: string,
  init: RequestInit,
  base: string,
  errorPrefix: string,
) {
  const response = await fetch(`${base}${endpoint}`, init);
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    // keep text
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : typeof payload === "string"
          ? payload
          : `${errorPrefix} request failed`;
    throw new Error(message);
  }
  return payload;
}

async function shippo(method: string, endpoint: string, body?: unknown) {
  const token = requiredEnv("SHIPPO_API_TOKEN");
  const base = baseUrl("SHIPPO_BASE_URL", "https://api.goshippo.com");
  return callJson(
    endpoint,
    {
      method,
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
    base,
    "Shippo",
  );
}

function shipFromAddress(overrides: JsonMap = {}) {
  return {
    name: String(overrides.name || process.env.SHIP_FROM_NAME || "BRND Direct Warehouse"),
    street1: String(overrides.street1 || process.env.SHIP_FROM_STREET1 || "1234 Commerce Blvd"),
    city: String(overrides.city || process.env.SHIP_FROM_CITY || "Chicago"),
    state: String(overrides.state || process.env.SHIP_FROM_STATE || "IL"),
    zip: String(overrides.zip || process.env.SHIP_FROM_ZIP || "60607"),
    country: String(overrides.country || process.env.SHIP_FROM_COUNTRY || "US"),
    phone: String(overrides.phone || process.env.SHIP_FROM_PHONE || ""),
    email: String(overrides.email || ""),
    is_residential: false,
    validate: true,
  };
}

async function warp(method: string, endpoint: string, body?: unknown) {
  const apiKey = requiredEnv("WARP_API_KEY");
  const base = baseUrl("WARP_BASE_URL", "https://api.warp.io/v1");
  return callJson(
    endpoint,
    {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
    base,
    "Warp",
  );
}

async function twoApi(endpoint: string, body: unknown) {
  const apiKey = requiredEnv("TWO_API_KEY");
  const base = baseUrl("TWO_BASE_URL", "https://api.sandbox.two.inc");
  return callJson(
    endpoint,
    {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    base,
    "Two",
  );
}

async function shopifyApi(
  storeDomain: string,
  accessToken: string,
  endpoint: string,
  method = "GET",
  body?: unknown,
) {
  const version = process.env.SHOPIFY_API_VERSION || "2025-01";
  const domain = storeDomain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return callJson(
    `/admin/api/${version}${endpoint}`,
    {
      method,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
    `https://${domain}`,
    "Shopify",
  );
}

async function solaPayment(body: JsonMap) {
  const apiKey = requiredEnv("SOLA_API_KEY");
  const base = baseUrl("SOLA_BASE_URL", "https://api.sola.com");
  const command = process.env.SOLA_DEFAULT_COMMAND || "cc:sale";
  const amount = Number(body.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amount is required");
  const payload = {
    command,
    amount,
    currency: String(body.currency || "USD").toUpperCase(),
    orderId: body.orderId || "",
    customerEmail: body.buyerEmail || body.email || "",
    metadata: body.metadata || {},
  };
  return callJson(
    "/v1/payments",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
    base,
    "Sola",
  );
}

async function handleFreight(method: string, action: string, request: NextRequest) {
  if (action === "token" && method === "POST") {
    return json({ provider: "warp", status: "ok" });
  }
  if (action === "quote" && method === "POST") {
    const body = await readJson(request);
    const result = await warp("POST", "/quotes", body);
    return json({ provider: "warp", ...(result as JsonMap) });
  }
  if (action === "book" && method === "POST") {
    const body = await readJson(request);
    const result = await warp("POST", "/shipments", body);
    return json({ provider: "warp", ...(result as JsonMap) }, 201);
  }
  if (action === "shipment" && method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "id is required" }, 400);
    const result = await warp("GET", `/shipments/${encodeURIComponent(id)}`);
    return json({ provider: "warp", ...(result as JsonMap) });
  }
  if (action === "track" && method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "id is required" }, 400);
    const result = await warp("GET", `/shipments/${encodeURIComponent(id)}/tracking`);
    return json({ provider: "warp", ...(result as JsonMap) });
  }
  if (action === "bol" && method === "GET") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "id is required" }, 400);
    const result = await warp("GET", `/shipments/${encodeURIComponent(id)}/documents`);
    return json({ provider: "warp", ...(result as JsonMap) });
  }
  if (action === "cancel" && method === "POST") {
    const body = await readJson(request);
    const shipmentId = String(body.shipment_id || "");
    if (!shipmentId) return json({ error: "shipment_id is required" }, 400);
    const result = await warp("POST", `/shipments/${encodeURIComponent(shipmentId)}/cancel`, {
      reason: body.reason || "Cancelled by shipper",
    });
    return json({ provider: "warp", ...(result as JsonMap) });
  }
  return json({ error: "Not found" }, 404);
}

async function handleParcel(method: string, action: string, request: NextRequest) {
  if (action === "validate-address" && method === "POST") {
    const body = await readJson(request);
    const result = await shippo("POST", "/addresses/", {
      name: String(body.name || ""),
      street1: String(body.street1 || ""),
      street2: String(body.street2 || ""),
      city: String(body.city || ""),
      state: String(body.state || ""),
      zip: String(body.zip || ""),
      country: String(body.country || "US"),
      phone: String(body.phone || ""),
      email: String(body.email || ""),
      is_residential: Boolean(body.is_residential),
      validate: true,
    });
    return json({ provider: "shippo", ...(result as JsonMap) });
  }
  if (action === "rates" && method === "POST") {
    const body = await readJson(request);
    const to = (body.to || {}) as JsonMap;
    const from = (body.from || {}) as JsonMap;
    const parcels = Array.isArray(body.parcels) ? body.parcels : [];
    if (!parcels.length) return json({ error: "parcels are required" }, 400);
    const shipment = await shippo("POST", "/shipments/", {
      address_from: shipFromAddress(from),
      address_to: {
        name: String(to.name || "Recipient"),
        street1: String(to.street1 || ""),
        city: String(to.city || ""),
        state: String(to.state || ""),
        zip: String(to.zip || ""),
        country: String(to.country || "US"),
        is_residential: to.is_residential !== undefined ? Boolean(to.is_residential) : true,
        validate: true,
      },
      parcels: parcels.map((parcel) => {
        const p = parcel as JsonMap;
        return {
          length: String(p.length_in || 12),
          width: String(p.width_in || 10),
          height: String(p.height_in || 6),
          distance_unit: "in",
          weight: String(p.weight_lb || 1),
          mass_unit: "lb",
        };
      }),
      async: false,
      currency: String(body.currency || "USD"),
    });
    return json({ provider: "shippo", ...(shipment as JsonMap) });
  }
  if (action === "purchase" && method === "POST") {
    const body = await readJson(request);
    const rateId = String(body.rate_id || "");
    if (!rateId) return json({ error: "rate_id is required" }, 400);
    const txn = await shippo("POST", "/transactions/", {
      rate: rateId,
      label_file_type: String(body.label_file_type || "PDF"),
      metadata: String(body.metadata || ""),
      async: false,
    });
    return json({ provider: "shippo", ...(txn as JsonMap) }, 201);
  }
  if (action === "track" && method === "GET") {
    const search = new URL(request.url).searchParams;
    const carrier = search.get("carrier") || "";
    const tracking = search.get("tracking") || "";
    if (!carrier || !tracking) return json({ error: "carrier and tracking are required" }, 400);
    const result = await shippo(
      "GET",
      `/tracks/${encodeURIComponent(carrier)}/${encodeURIComponent(tracking)}`,
    );
    return json({ provider: "shippo", ...(result as JsonMap) });
  }
  if (action === "refund" && method === "POST") {
    const body = await readJson(request);
    const transactionId = String(body.transaction_id || "");
    if (!transactionId) return json({ error: "transaction_id is required" }, 400);
    const result = await shippo("POST", "/refunds/", { transaction: transactionId, async: false });
    return json({ provider: "shippo", ...(result as JsonMap) });
  }
  if (action === "label" && method === "GET") {
    const transactionId = new URL(request.url).searchParams.get("transactionId");
    if (!transactionId) return json({ error: "transactionId is required" }, 400);
    const result = await shippo("GET", `/transactions/${encodeURIComponent(transactionId)}`);
    return json({ provider: "shippo", ...(result as JsonMap) });
  }
  if (action === "manifest" && method === "POST") {
    const body = await readJson(request);
    const transactionIds = Array.isArray(body.transaction_ids) ? body.transaction_ids : [];
    if (!transactionIds.length) return json({ error: "transaction_ids are required" }, 400);
    const result = await shippo("POST", "/manifests/", {
      shipment_date: String(body.shipment_date || new Date().toISOString().split("T")[0]),
      transactions: transactionIds,
      address_from: shipFromAddress(),
      async: false,
    });
    return json({ provider: "shippo", ...(result as JsonMap) }, 201);
  }
  if (action === "carriers" && method === "GET") {
    const result = await shippo("GET", "/carrier_accounts/?results=100");
    return json({ provider: "shippo", ...(result as JsonMap) });
  }
  return json({ error: "Not found" }, 404);
}

export async function OPTIONS() {
  return json({}, 204);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const [first, second] = slug || [];
  try {
    if (first === "payout-link") {
      const sellerProfileId = new URL(request.url).searchParams.get("sellerProfileId");
      if (!sellerProfileId) return json({ error: "sellerProfileId required" }, 400);
      if (!process.env.MT_API_KEY) {
        return json({ provider: "modern_treasury", accountId: null, url: null }, 200);
      }
      const ledger = process.env.MT_LEDGER_ID || "";
      return json(
        { provider: "modern_treasury", accountId: process.env.MT_INTERNAL_ACCOUNT_ID || null, ledger },
        200,
      );
    }
    if (first === "freight") return await handleFreight("GET", second || "", request);
    if (first === "parcel") return await handleParcel("GET", second || "", request);
    return json({ error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return json({ error: message }, 502);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await context.params;
  const [first, second, third] = slug || [];
  try {
    if (first === "create-payment-intent") {
      const body = await readJson(request);
      const result = await solaPayment(body);
      return json({
        provider: "sola",
        paymentIntentId: (result as JsonMap).id || null,
        checkoutToken: (result as JsonMap).checkout_token || null,
        checkoutUrl: (result as JsonMap).checkout_url || null,
        clientSecret: (result as JsonMap).client_secret || null,
        raw: result,
      });
    }
    if (first === "create-setup-intent") {
      const body = await readJson(request);
      const result = await solaPayment({
        ...body,
        amount: 0,
        metadata: { mode: "vault", ...(body.metadata as JsonMap) },
      });
      return json({ provider: "sola", ...(result as JsonMap) });
    }
    if (first === "stripe-webhook") {
      return json({ received: true, provider: "sola" });
    }
    if (first === "create-connect-account") {
      const body = await readJson(request);
      const sellerProfileId = String(body.sellerProfileId || "");
      if (!sellerProfileId) return json({ error: "sellerProfileId required" }, 400);
      return json({
        provider: "modern_treasury",
        accountId: process.env.MT_INTERNAL_ACCOUNT_ID || null,
        onboardingUrl: null,
        sellerProfileId,
      });
    }
    if (first === "trade-finance" && second === "order") {
      const body = await readJson(request);
      const result = await twoApi("/v1/order", body);
      return json({ provider: "two", ...(result as JsonMap) });
    }
    if (first === "trade-finance" && second === "intent") {
      const body = await readJson(request);
      const result = await twoApi("/v1/order/intent", body);
      return json({ provider: "two", ...(result as JsonMap) });
    }
    if (first === "shopify" && second === "connect") {
      const body = await readJson(request);
      const storeDomain = String(body.storeDomain || "");
      const accessToken = String(body.accessToken || "");
      if (!storeDomain || !accessToken) {
        return json({ error: "storeDomain and accessToken are required" }, 400);
      }
      const shop = await shopifyApi(storeDomain, accessToken, "/shop.json");
      return json({ provider: "shopify", connected: true, store: (shop as JsonMap).shop || null });
    }
    if (first === "shopify" && second === "sync-catalog") {
      const body = await readJson(request);
      const storeDomain = String(body.storeDomain || "");
      const accessToken = String(body.accessToken || "");
      const products = Array.isArray(body.products) ? body.products : [];
      if (!storeDomain || !accessToken) {
        return json({ error: "storeDomain and accessToken are required" }, 400);
      }
      const results: Array<Record<string, unknown>> = [];
      for (const raw of products) {
        const p = raw as JsonMap;
        try {
          const created = await shopifyApi(
            storeDomain,
            accessToken,
            "/products.json",
            "POST",
            {
              product: {
                title: String(p.name || "Product"),
                body_html: String(p.description || ""),
                vendor: String(p.brand || "BRND Direct"),
                product_type: String(p.category || "General"),
                tags: Array.isArray(p.tags) ? p.tags.join(",") : "",
              },
            },
          );
          results.push({ ok: true, id: (created as JsonMap).product || null, sku: p.sku || null });
        } catch (error) {
          results.push({
            ok: false,
            sku: p.sku || null,
            error: error instanceof Error ? error.message : "sync failed",
          });
        }
      }
      return json({
        provider: "shopify",
        synced: results.filter((row) => row.ok).length,
        failed: results.filter((row) => !row.ok).length,
        results,
      });
    }
    if (first === "shopify" && second === "webhook" && third === "orders-create") {
      return json({ provider: "shopify", received: true });
    }
    if (first === "freight") return await handleFreight("POST", second || "", request);
    if (first === "parcel") return await handleParcel("POST", second || "", request);
    return json({ error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return json({ error: message }, 502);
  }
}
