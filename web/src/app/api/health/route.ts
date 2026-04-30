import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ts: Date.now(),
    providers: {
      wholesale: Boolean(process.env.WHOLESALE_API_BASE_URL && process.env.WHOLESALE_API_KEY),
      sola: Boolean(process.env.SOLA_BASE_URL && process.env.SOLA_API_KEY),
      modern_treasury: Boolean(process.env.MT_BASE_URL && process.env.MT_API_KEY),
      shippo: Boolean(process.env.SHIPPO_API_TOKEN),
      warp: Boolean(process.env.WARP_BASE_URL && process.env.WARP_API_KEY),
      plaid: Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
      middesk: Boolean(process.env.MIDDESK_API_KEY),
      two: Boolean(process.env.TWO_API_KEY),
      shopify: Boolean(process.env.SHOPIFY_API_VERSION),
    },
  });
}
