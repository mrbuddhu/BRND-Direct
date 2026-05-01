import { NextResponse } from "next/server";

const FALLBACK_SUPABASE_URL = "https://lthfgkwyrxryereazdnr.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aGZna3d5cnhyeWVyZWF6ZG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzczMzksImV4cCI6MjA4OTg1MzMzOX0.hYBk1iyWAxhdMB5U9EcJ0oau_Q3mu_Ihbwn0-AyRJv0";

type SupabaseResult = {
  data: unknown;
  total: number;
};

type WholesaleMeta = {
  total: number;
  current_page: number;
  total_pages: number;
  per_page: number;
  rate_limit_remaining?: number;
};

type WholesaleCacheEntry = {
  expiresAt: number;
  data: WholesaleProduct[];
  meta: WholesaleMeta;
};

type WholesaleProduct = {
  sku?: string;
  upc?: string;
  itemName?: string;
  brand?: string;
  size?: string;
  asin?: string;
  msrp?: number;
  category?: string;
  availableInventory?: number;
  askingPrice?: number;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  images?: string[];
  [key: string]: unknown;
};

let wholesaleCache: WholesaleCacheEntry | null = null;

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^https?:\/\//i.test(v);
}

function collectImageUrlsFromUnknown(
  value: unknown,
  keyHint = "",
  imageContext = false,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageUrlsFromUnknown(item, keyHint, imageContext));
  }

  if (typeof value === "object" && value) {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectImageUrlsFromUnknown(
        v,
        k,
        imageContext || /(image|img|photo|thumb|thumbnail|media|gallery|picture|icon|logo)/i.test(k),
      ),
    );
  }

  // Accept URL strings from image-like keys, and common nested URL keys within image context.
  if (isImageUrl(value)) {
    const isDirectImageKey = /(image|img|photo|thumb|thumbnail|media|gallery|picture|icon|logo)/i.test(
      keyHint,
    );
    const isNestedUrlKey = /^(url|src|href|original|large|small|full)$/i.test(keyHint);
    if (isDirectImageKey || (imageContext && isNestedUrlKey)) {
      return [value.trim()];
    }
  }

  // Some wholesalers send plain URL strings inside an `images` array.
  if (isImageUrl(value) && imageContext) {
    return [value.trim()];
  }

  return [];
}

function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;
  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseRest(
  table: string,
  queryString = "",
  method = "GET",
  body: unknown = null,
): Promise<SupabaseResult> {
  const { url, key } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/${table}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,count=exact",
    },
    body: body ? JSON.stringify(body) : null,
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep text fallback
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : typeof data === "string"
          ? data
          : "Supabase request failed";
    throw new Error(message);
  }

  const contentRange = response.headers.get("content-range") || "";
  const total = contentRange.includes("/")
    ? Number.parseInt(contentRange.split("/")[1], 10)
    : Array.isArray(data)
      ? data.length
      : 0;

  return { data, total };
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function getWholesaleConfig() {
  const baseUrl = (
    process.env.WHOLESALE_API_BASE_URL ||
    process.env.WHOLESALE_CATALOG_BASE_URL ||
    "https://wholesale-api-421345206834.us-central1.run.app"
  ).replace(/\/$/, "");
  const apiKey =
    process.env.WHOLESALE_API_KEY ||
    process.env.WHOLESALE_CATALOG_API_KEY ||
    "";
  const cacheTtlSeconds = Number(
    process.env.WHOLESALE_CATALOG_CACHE_TTL_SECONDS ||
      process.env.WHOLESALE_API_CACHE_TTL_SECONDS ||
      "300",
  );
  const requestTimeoutMs = Number(
    process.env.WHOLESALE_REQUEST_TIMEOUT_MS || process.env.WHOLESALE_API_TIMEOUT_MS || "0",
  );
  return {
    baseUrl,
    apiKey,
    cacheTtlSeconds: Number.isFinite(cacheTtlSeconds) ? Math.max(0, cacheTtlSeconds) : 300,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) ? Math.max(0, requestTimeoutMs) : 0,
  };
}

export async function fetchWholesaleProducts(params: {
  page?: number;
  limit?: number;
  sku?: string;
  upc?: string;
}) {
  const { baseUrl, apiKey, cacheTtlSeconds, requestTimeoutMs } = getWholesaleConfig();
  if (!apiKey) {
    throw new Error("WHOLESALE_API_KEY is not configured");
  }

  // For catalog list calls, use recently cached successful result to avoid UI timeouts
  // when the upstream wholesale service is temporarily unavailable.
  const isCatalogList = !params.sku && !params.upc;
  if (isCatalogList && wholesaleCache && wholesaleCache.expiresAt > Date.now()) {
    return { meta: wholesaleCache.meta, data: wholesaleCache.data };
  }

  const endpointCandidates = ["/", "/products", "/api/products", "/v1/products"];

  const headerVariants: Array<Record<string, string>> = [
    {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    {
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
  ];

  let lastError = "Wholesale API request failed";
  for (const endpoint of endpointCandidates) {
    const url = new URL(baseUrl + endpoint);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.sku) url.searchParams.set("sku", params.sku);
    if (params.upc) url.searchParams.set("upc", params.upc);
    for (const headers of headerVariants) {
      let response: Response | null = null;
      let timeoutErr = "";
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = new AbortController();
        const timeout =
          requestTimeoutMs > 0 ? setTimeout(() => controller.abort(), requestTimeoutMs) : null;
        try {
          response = await fetch(url.toString(), {
            method: "GET",
            headers,
            cache: "no-store",
            signal: controller.signal,
          });
          if (timeout) clearTimeout(timeout);
          // Retry once for temporary upstream unavailability.
          if (response.status === 503 && attempt === 0) continue;
          break;
        } catch (error) {
          if (timeout) clearTimeout(timeout);
          if (error instanceof Error && error.name === "AbortError") {
            timeoutErr = `Wholesale request timed out after ${requestTimeoutMs}ms`;
          } else {
            timeoutErr = error instanceof Error ? error.message : "Wholesale request failed";
          }
          if (attempt === 0) continue;
        }
      }
      if (!response) {
        lastError = timeoutErr || "Wholesale API request failed";
        continue;
      }

      const text = await response.text();
      let payload: unknown = text;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        // keep text fallback
      }

      if (!response.ok) {
        lastError =
          typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error: unknown }).error)
            : typeof payload === "string"
              ? payload
              : "Wholesale API request failed";
        continue;
      }

      const payloadObj = (payload && typeof payload === "object" ? payload : {}) as Record<
        string,
        unknown
      >;
      const data = (
        (Array.isArray(payloadObj.data) && payloadObj.data) ||
        (Array.isArray(payloadObj.products) && payloadObj.products) ||
        (Array.isArray(payloadObj.items) && payloadObj.items) ||
        []
      ) as WholesaleProduct[];

      const explicitMeta = (payloadObj.meta || payloadObj.pagination || payloadObj.page_info || {}) as Partial<
        WholesaleMeta
      >;
      const total = Number(explicitMeta.total || payloadObj.total || data.length || 0);
      const currentPage = Number(
        explicitMeta.current_page || payloadObj.page || payloadObj.current_page || params.page || 1,
      );
      const perPage = Number(explicitMeta.per_page || payloadObj.limit || params.limit || 250);
      const totalPages = Number(
        explicitMeta.total_pages ||
          payloadObj.total_pages ||
          Math.max(1, Math.ceil(total / Math.max(1, perPage))),
      );

      const meta: WholesaleMeta = {
        total,
        current_page: currentPage,
        total_pages: totalPages,
        per_page: perPage,
      };

      // Treat non-empty list as a successful match for endpoint shape.
      if (Array.isArray(data) && data.length > 0) {
        if (isCatalogList && cacheTtlSeconds > 0) {
          wholesaleCache = {
            data,
            meta,
            expiresAt: Date.now() + cacheTtlSeconds * 1000,
          };
        }
        return { meta, data };
      }
    }
  }

  // Graceful stale fallback for list view if upstream fails now but we have older data.
  if (isCatalogList && wholesaleCache && wholesaleCache.data.length > 0) {
    return { meta: wholesaleCache.meta, data: wholesaleCache.data };
  }

  throw new Error(lastError);
}

export function mapWholesaleProductToPortal(row: WholesaleProduct, index = 0) {
  const sku = String(row.sku || "").trim();
  const upc = String(row.upc || "").trim();
  const brand = String(row.brand || "Wholesale Brand").trim();
  const category = String(row.category || "general").trim().toLowerCase();
  const msrp = Number(row.msrp || 0);
  const wholesale = Number(row.askingPrice || 0);
  const stock = Number(row.availableInventory || 0);
  const syntheticId = sku || upc || `wh-${index + 1}`;
  const images = [
    ...(Array.isArray(row.images) ? row.images : []),
    row.image,
    row.image_url,
    row.imageUrl,
    row.thumbnail,
    row.thumbnail_url,
    row.primaryImage,
    row.mainImage,
    row.featuredImage,
    ...collectImageUrlsFromUnknown(row),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .filter((value, idx, arr) => arr.indexOf(value) === idx);

  return {
    id: syntheticId,
    name: row.itemName || "Unnamed Product",
    sku,
    upc,
    category,
    subcategory: row.size || "",
    fulfillment_type: "wholesale",
    wholesale_price: wholesale,
    msrp,
    moq: 1,
    stock_qty: stock,
    images,
    tags: [],
    meta: {
      size: row.size || "",
      asin: row.asin || "",
      source: "wholesale-api",
    },
    is_top_seller: false,
    description: row.itemName || "",
    brand_id: brand.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    brands: {
      id: brand.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: brand,
      logo_url: null,
      category,
    },
  };
}
