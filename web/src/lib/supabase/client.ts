import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://lthfgkwyrxryereazdnr.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aGZna3d5cnhyeWVyZWF6ZG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzczMzksImV4cCI6MjA4OTg1MzMzOX0.hYBk1iyWAxhdMB5U9EcJ0oau_Q3mu_Ihbwn0-AyRJv0";

export function createBrowserSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;
  return createBrowserClient(url, key);
}
