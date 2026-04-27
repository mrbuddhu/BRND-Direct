import { NextRequest, NextResponse } from "next/server";
import {
  fetchWholesaleProducts,
  jsonError,
  mapWholesaleProductToPortal,
  supabaseRest,
} from "../../_lib/supabase-admin";

export const runtime = "edge";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return jsonError("Invalid product ID", 400);
    }

    // Try wholesale API first by SKU/UPC.
    try {
      const response = await fetchWholesaleProducts({ sku: id, limit: 1 });
      let row = response.data[0];
      if (!row) {
        const byUpc = await fetchWholesaleProducts({ upc: id, limit: 1 });
        row = byUpc.data[0];
      }
      if (row) return NextResponse.json(mapWholesaleProductToPortal(row));
    } catch {
      // Fall through to Supabase fallback.
    }

    const query = `id=eq.${id}&select=*,brands(id,name,logo_url,category,description)`;
    const { data } = await supabaseRest("products", query);
    const product = Array.isArray(data) ? data[0] : data;
    if (!product) return jsonError("Product not found", 404);
    return NextResponse.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product query failed";
    return jsonError(message, 500);
  }
}
