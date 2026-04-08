/**
 * ============================================================
 *  BRND DIRECT — Supabase Client Configuration
 *  ============================================================
 *  HOW TO SET YOUR CREDENTIALS
 *  1. Go to https://supabase.com → your project → Settings → API
 *  2. Copy "Project URL"  → paste as SUPABASE_URL below
 *  3. Copy "anon / public" key → paste as SUPABASE_ANON_KEY below
 *  That's the only change you need to make in this file.
 * ============================================================
 */

// ── YOUR CREDENTIALS (replace placeholder values) ──────────
const SUPABASE_URL      = 'https://lthfgkwyrxryereazdnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0aGZna3d5cnhyeWVyZWF6ZG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzczMzksImV4cCI6MjA4OTg1MzMzOX0.hYBk1iyWAxhdMB5U9EcJ0oau_Q3mu_Ihbwn0-AyRJv0';

// ── Stripe publishable key (replace after Step 5 setup) ────
const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_STRIPE_PUBLISHABLE_KEY';

// ── Cloudflare Worker URL (replace after Step 7 deploy) ────
const CF_WORKER_URL = 'https://brnd-direct-api.YOUR_SUBDOMAIN.workers.dev';

// ── Load Supabase from CDN ──────────────────────────────────
const _supabaseScript = document.createElement('script');
_supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
_supabaseScript.onload = () => {
  window._supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: true,
      storage:           window.localStorage
    }
  });
  // Fire a custom event so every page knows the client is ready
  document.dispatchEvent(new CustomEvent('supabase:ready', { detail: window._supabase }));
};
document.head.appendChild(_supabaseScript);

/**
 * Helper: wait for the Supabase client to initialise
 * Usage:  const sb = await getSupabase();
 */
function getSupabase() {
  return new Promise(resolve => {
    if (window._supabase) { resolve(window._supabase); return; }
    document.addEventListener('supabase:ready', e => resolve(e.detail), { once: true });
  });
}

/**
 * Helper: get the current authenticated session + user
 * Returns { session, user } or { session: null, user: null }
 */
async function getCurrentUser() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return { session, user: session?.user ?? null };
}

/**
 * Helper: redirect to login if no session
 * Call at the top of every protected page
 */
async function requireAuth(loginUrl = '../buyer/index.html') {
  const { user } = await getCurrentUser();
  if (!user) {
    window.location.href = loginUrl;
    return null;
  }
  return user;
}

/**
 * Helper: redirect to seller login if no session
 */
async function requireSellerAuth() {
  return requireAuth('../seller/index.html');
}

/**
 * Helper: get the full profile for the current user
 */
async function getProfile() {
  const sb = await getSupabase();
  const { user } = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*, buyer_profiles(*), seller_profiles(*)')
    .eq('id', user.id)
    .single();
  if (error) { console.error('getProfile:', error.message); return null; }
  return data;
}

/**
 * Helper: show a standardised toast notification
 * (uses the portal.js showToast if available, else console)
 */
function notify(msg, type = 'success') {
  if (typeof showToast === 'function') { showToast(msg, type); return; }
  console[type === 'error' ? 'error' : 'log']('[BRND Direct]', msg);
}
