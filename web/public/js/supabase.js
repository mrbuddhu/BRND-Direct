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

// ── Load Supabase from CDN (pin version; @2 float can break UMD globals) ──
const _supabaseScript = document.createElement('script');
_supabaseScript.src =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.min.js';
_supabaseScript.onerror = () => {
  console.error('[BRND Direct] Failed to load supabase-js from CDN (network or blocker).');
  document.dispatchEvent(new CustomEvent('supabase:error'));
};
_supabaseScript.onload = () => {
  const mod = globalThis.supabase;
  const createClient = mod && typeof mod.createClient === 'function' ? mod.createClient : null;
  const urlOk = typeof SUPABASE_URL === 'string' && /^https:\/\//.test(SUPABASE_URL);
  const keyOk =
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('YOUR_');

  if (!createClient) {
    console.error('[BRND Direct] supabase-js loaded but createClient is missing.');
    document.dispatchEvent(new CustomEvent('supabase:error'));
    return;
  }
  if (!urlOk || !keyOk) {
    console.error(
      '[BRND Direct] Invalid Supabase URL or anon key in js/supabase.js — Auth requests will return "No API key".',
    );
    document.dispatchEvent(new CustomEvent('supabase:error'));
    return;
  }

  window._supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });
  document.dispatchEvent(new CustomEvent('supabase:ready', { detail: window._supabase }));
};
document.head.appendChild(_supabaseScript);

/**
 * Helper: wait for the Supabase client to initialise
 * Usage:  const sb = await getSupabase();
 */
function getSupabase() {
  return new Promise((resolve, reject) => {
    if (window._supabase) {
      resolve(window._supabase);
      return;
    }
    const onErr = () => {
      document.removeEventListener('supabase:ready', onReady);
      reject(
        new Error(
          'Supabase did not initialize. Open js/supabase.js and set a valid Project URL + anon key, allow this site through ad blockers, and hard-refresh.',
        ),
      );
    };
    const onReady = (e) => {
      document.removeEventListener('supabase:error', onErr);
      resolve(e.detail);
    };
    document.addEventListener('supabase:error', onErr, { once: true });
    document.addEventListener('supabase:ready', onReady, { once: true });
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
