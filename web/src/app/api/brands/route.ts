import { NextRequest, NextResponse } from "next/server";
import {
  fetchWholesaleProducts,
  jsonError,
  supabaseRest,
} from "../_lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = (url.searchParams.get("category") || "").trim();
    const search = (url.searchParams.get("search") || "").trim();
    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") || "200", 10)),
    );

    // Primary source: wholesale API derived brands.
    try {
      const wholesale = await fetchWholesaleProducts({ page: 1, limit: 250 });
      const bucket = new Map<
        string,
        { id: string; name: string; logo_url: null; banner_url: null; category: string; description: string; is_verified: boolean }
      >();
      for (const row of wholesale.data) {
        const name = String(row.brand || "").trim();
        if (!name) continue;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const cat = String(row.category || "general").trim().toLowerCase();
        if (!bucket.has(id)) {
          bucket.set(id, {
            id,
            name,
            logo_url: null,
            banner_url: null,
            category: cat,
            description: "",
            is_verified: false,
          });
        }
      }
      let data = [...bucket.values()];
      if (category) data = data.filter((b) => b.category === category.toLowerCase());
      if (search) data = data.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
      data.sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ data: data.slice(0, limit), total: data.length });
    } catch {
      // Fall back to existing Supabase brand table.
    }

    const filters: string[] = ["is_active=eq.true"];
    if (category) filters.push(`category=eq.${encodeURIComponent(category)}`);
    if (search) {
      const s = encodeURIComponent(`%${search}%`);
      filters.push(`name=ilike.${s}`);
    }

    const query = [
      ...filters,
      "select=id,name,logo_url,banner_url,category,description,is_verified",
      "order=name.asc",
      `limit=${limit}`,
    ].join("&");

    const { data, total } = await supabaseRest("brands", query);
    return NextResponse.json({ data, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brands query failed";
    return jsonError(message, 500);
  }
}
