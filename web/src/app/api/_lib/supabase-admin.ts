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

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^https?:\/\//i.test(v);
}

function collectImageUrlsFromUnknown(value: unknown, keyHint = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageUrlsFromUnknown(item, keyHint));
  }

  if (typeof value === "object" && value) {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectImageUrlsFromUnknown(v, k),
    );
  }

  // Only accept URL strings from image-like keys to avoid unrelated links.
  if (
    isImageUrl(value) &&
    /(image|img|photo|thumb|thumbnail|media|gallery|picture|icon|logo)/i.test(keyHint)
  ) {
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
    "https://wholesale-api-421345206834.us-central1.run.app"
  ).replace(/\/$/, "");
  const apiKey = process.env.WHOLESALE_API_KEY || "";
  return { baseUrl, apiKey };
}

export async function fetchWholesaleProducts(params: {
  page?: number;
  limit?: number;
  sku?: string;
  upc?: string;
}) {
  const { baseUrl, apiKey } = getWholesaleConfig();
  if (!apiKey) {
    throw new Error("WHOLESALE_API_KEY is not configured");
  }

  const url = new URL(baseUrl + "/");
  if (params.page) url.searchParams.set("page", String(params.page));
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.sku) url.searchParams.set("sku", params.sku);
  if (params.upc) url.searchParams.set("upc", params.upc);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // keep text fallback
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === "string"
          ? payload
          : "Wholesale API request failed";
    throw new Error(message);
  }

  const meta = (payload as { meta?: WholesaleMeta }).meta || {
    total: 0,
    current_page: 1,
    total_pages: 1,
    per_page: params.limit || 250,
  };
  const data = (payload as { data?: WholesaleProduct[] }).data || [];

  return { meta, data };
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
