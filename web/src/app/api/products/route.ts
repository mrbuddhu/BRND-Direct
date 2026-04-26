import { NextRequest, NextResponse } from "next/server";
import {
  fetchWholesaleProducts,
  jsonError,
  mapWholesaleProductToPortal,
  supabaseRest,
} from "../_lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      250,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10)),
    );
    const search = (url.searchParams.get("search") || "").trim();
    const sku = (url.searchParams.get("sku") || "").trim();
    const upc = (url.searchParams.get("upc") || "").trim();
    const category = (url.searchParams.get("category") || "").trim();
    const brandFilter = (url.searchParams.get("brand_id") || "").trim().toLowerCase();

    // Primary source: Wholesale portal API (owner-provided token).
    try {
      const wholesale = await fetchWholesaleProducts({
        page,
        limit,
        sku: sku || search || undefined,
        upc: upc || undefined,
      });

      let mapped = wholesale.data.map((row, idx) => mapWholesaleProductToPortal(row, idx));
      if (category) mapped = mapped.filter((p) => p.category === category.toLowerCase());
      if (brandFilter) {
        mapped = mapped.filter(
          (p) => String(p.brand_id || "").toLowerCase() === brandFilter,
        );
      }

      return NextResponse.json({
        data: mapped,
        total: wholesale.meta.total,
        page: wholesale.meta.current_page,
        limit: wholesale.meta.per_page,
        pages: wholesale.meta.total_pages,
      });
    } catch {
      // Fallback source: existing Supabase catalog.
    }

    const fulfillment = (url.searchParams.get("fulfillment_type") || "").trim();
    const sortBy = url.searchParams.get("sort") || "name";
    const from = (page - 1) * limit;
    const brandId = (url.searchParams.get("brand_id") || "").trim();
    const filters: string[] = ["is_active=eq.true"];
    if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (brandId) filters.push(`brand_id=eq.${encodeURIComponent(brandId)}`);
    if (fulfillment) filters.push(`fulfillment_type=eq.${encodeURIComponent(fulfillment)}`);
    if (search) {
      const s = encodeURIComponent(`%${search}%`);
      filters.push(`or=(name.ilike.${s},sku.ilike.${s})`);
    }

    const allowedSorts = [
      "name",
      "wholesale_price",
      "msrp",
      "moq",
      "stock_qty",
      "created_at",
    ];
    const sortField = allowedSorts.includes(sortBy) ? sortBy : "name";

    const query = [
      ...filters,
      "select=id,name,sku,upc,category,subcategory,fulfillment_type,wholesale_price,msrp,moq,stock_qty,images,tags,meta,is_top_seller,description,brand_id,brands(id,name,logo_url,category)",
      `order=${sortField}.asc`,
      `offset=${from}`,
      `limit=${limit}`,
    ].join("&");

    const { data, total } = await supabaseRest("products", query);
    const pages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({ data, total, page, limit, pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Products query failed";
    return jsonError(message, 500);
  }
}
