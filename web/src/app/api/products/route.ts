import { NextRequest, NextResponse } from "next/server";
import {
  fetchWholesaleProducts,
  jsonError,
  mapWholesaleProductToPortal,
} from "../_lib/supabase-admin";

export const runtime = "edge";

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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wholesale catalog is currently unavailable";
      console.error("Wholesale products fetch failed:", message);
      return NextResponse.json(
        {
          data: [],
          total: 0,
          page,
          limit,
          pages: 1,
          error: "Live wholesale catalog unavailable",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Products query failed";
    return jsonError(message, 500);
  }
}
