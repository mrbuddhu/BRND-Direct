/**
 * ============================================================
 *  BRND DIRECT — Authentication Module
 *  js/auth.js
 *
 *  Handles: sign-in, sign-up, sign-out, password reset,
 *           OAuth (Google / LinkedIn), session management,
 *           and profile creation for both buyers and sellers.
 *
 *  Depends on: js/supabase.js (must be loaded first)
 * ============================================================
 */

/* ══════════════════════════════════════════════════════════════
   BUYER SIGN-IN
══════════════════════════════════════════════════════════════ */
async function buyerSignIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Verify the user has a buyer role
  const { data: profile } = await sb
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .single();

  if (profile?.role === 'seller') {
    await sb.auth.signOut();
    throw new Error('This account is a seller account. Please use the Brand Portal to sign in.');
  }
  if (profile?.status === 'suspended') {
    await sb.auth.signOut();
    throw new Error('Your account has been suspended. Please contact support@brnddirect.com.');
  }
  if (profile?.status === 'pending') {
    // Allow login but redirect to pending page
    window.location.href = 'pending-approval.html';
    return data;
  }

  return data;
}

/* ══════════════════════════════════════════════════════════════
   SELLER SIGN-IN
══════════════════════════════════════════════════════════════ */
async function sellerSignIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { data: profile } = await sb
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .single();

  if (profile?.role === 'buyer') {
    await sb.auth.signOut();
    throw new Error('This is a buyer account. Please use the Buyer Portal to sign in.');
  }
  if (profile?.status === 'suspended') {
    await sb.auth.signOut();
    throw new Error('Your brand account has been suspended. Please contact support@brnddirect.com.');
  }
  if (profile?.status === 'pending') {
    window.location.href = 'pending-approval.html';
    return data;
  }

  return data;
}

/* ══════════════════════════════════════════════════════════════
   ADMIN SIGN-IN
══════════════════════════════════════════════════════════════ */
async function adminSignIn(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { data: profile } = await sb
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .single();

  if (profile?.role !== 'admin') {
    await sb.auth.signOut();
    throw new Error('This account is not an admin account. Please use the correct portal sign-in.');
  }
  if (profile?.status === 'suspended') {
    await sb.auth.signOut();
    throw new Error('Your admin access is suspended. Please contact support@brnddirect.com.');
  }
  if (profile?.status === 'pending') {
    window.location.href = '../seller/pending-approval.html';
    return data;
  }

  return data;
}

/* ══════════════════════════════════════════════════════════════
   BUYER REGISTRATION
══════════════════════════════════════════════════════════════ */
async function buyerRegister({
  firstName, lastName, businessName, email, password,
  phone, businessType, einTaxId
}) {
  const sb = await getSupabase();

  // Put buyer fields in user metadata so handle_new_user() (SECURITY DEFINER) can
  // insert profiles + buyer_profiles even when email confirmation returns no session.
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'buyer',
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        business_type: businessType || null,
        ein_tax_id: einTaxId || null,
        ...(phone ? { phone } : {}),
      },
    },
  });
  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('Sign up did not return a user. Check Supabase Auth logs for trigger errors.');
  }

  const hasSession = Boolean(data.session);

  // When a session exists, enrich rows from the client (RLS). When it does not
  // (email confirmation required), the DB trigger + metadata above must be deployed.
  if (hasSession) {
    const { error: pErr } = await sb
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        display_name: `${firstName} ${lastName}`.trim(),
        role: 'buyer',
        status: 'pending',
      })
      .eq('id', userId);
    if (pErr) console.warn('[buyerRegister] profile update:', pErr.message);

    const { error: bpErr } = await sb.from('buyer_profiles').upsert(
      {
        profile_id: userId,
        business_name: businessName,
        business_type: businessType || null,
        ein_tax_id: einTaxId || null,
      },
      { onConflict: 'profile_id' },
    );
    if (bpErr) throw bpErr;

    const { error: nErr } = await sb.from('notifications').insert({
      profile_id: userId,
      type: 'system',
      title: 'Welcome to BRND Direct!',
      body: 'Your application is under review. You will be approved within 24 hours.',
      link: '/buyer/dashboard.html',
    });
    if (nErr) console.warn('[buyerRegister] notification:', nErr.message);
  }

  return { ...data, needsEmailConfirmation: !hasSession };
}

/* ══════════════════════════════════════════════════════════════
   SELLER REGISTRATION
══════════════════════════════════════════════════════════════ */
async function sellerRegister({
  brandName, contactName, email, phone,
  primaryCategory, annualRevenue, description
}) {
  const sb = await getSupabase();

  const nameParts  = contactName.trim().split(' ');
  const firstName  = nameParts[0] || '';
  const lastName   = nameParts.slice(1).join(' ') || '';
  const brandSlug  = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // 1. Create auth user (with a temp password — user sets real one via email)
  const tempPassword = crypto.randomUUID();
  const { data, error } = await sb.auth.signUp({
    email,
    password: tempPassword,
    options: {
      data: {
        role:       'seller',
        first_name: firstName,
        last_name:  lastName
      }
    }
  });
  if (error) throw error;

  const userId = data.user.id;

  // 2. Update profile
  await sb.from('profiles').update({
    first_name:   firstName,
    last_name:    lastName,
    phone,
    display_name: contactName
  }).eq('id', userId);

  // 3. Create seller_profiles record
  const { data: sp, error: spErr } = await sb.from('seller_profiles').insert({
    profile_id:          userId,
    brand_name:          brandName,
    brand_slug:          brandSlug,
    description,
    primary_category:    primaryCategory,
    annual_revenue_range: annualRevenue
  }).select().single();
  if (spErr) throw spErr;

  // 4. Create brand entry
  await sb.from('brands').insert({
    seller_profile_id: sp.id,
    name:              brandName,
    slug:              brandSlug,
    description,
    category:          primaryCategory,
    is_verified:       false,
    is_active:         false
  });

  // 5. Welcome notification
  await sb.from('notifications').insert({
    profile_id: userId,
    type:       'system',
    title:      'Brand Application Received',
    body:       'Our team will review your brand and reach out within 24-48 hours.',
    link:       '/seller/dashboard.html'
  });

  return data;
}

/* ══════════════════════════════════════════════════════════════
   SIGN OUT
══════════════════════════════════════════════════════════════ */
async function signOut(redirectUrl = null) {
  const sb = await getSupabase();
  const { error } = await sb.auth.signOut();
  if (error) console.error('Sign out error:', error.message);

  // Determine redirect
  if (redirectUrl) { window.location.href = redirectUrl; return; }
  // Auto-detect where to redirect based on current path
  const path = window.location.pathname;
  if (path.includes('/seller/')) {
    window.location.href = '../seller/index.html';
  } else {
    window.location.href = '../buyer/index.html';
  }
}

/* ══════════════════════════════════════════════════════════════
   PASSWORD RESET
══════════════════════════════════════════════════════════════ */
async function sendPasswordReset(email) {
  const sb = await getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/buyer/reset-password.html`
  });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const sb = await getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/* ══════════════════════════════════════════════════════════════
   OAUTH — Google
══════════════════════════════════════════════════════════════ */
async function signInWithGoogle(role = 'buyer') {
  const sb = await getSupabase();
  const redirectTo = role === 'seller'
    ? `${window.location.origin}/seller/dashboard.html`
    : `${window.location.origin}/buyer/dashboard.html`;

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
      scopes: 'email profile'
    }
  });
  if (error) throw error;
}

/* ══════════════════════════════════════════════════════════════
   OAUTH — LinkedIn
══════════════════════════════════════════════════════════════ */
async function signInWithLinkedIn(role = 'buyer') {
  const sb = await getSupabase();
  const redirectTo = role === 'seller'
    ? `${window.location.origin}/seller/dashboard.html`
    : `${window.location.origin}/buyer/dashboard.html`;

  const { error } = await sb.auth.signInWithOAuth({
    provider:  'linkedin_oidc',
    options: { redirectTo }
  });
  if (error) throw error;
}

/* ══════════════════════════════════════════════════════════════
   PAGE PROTECTION HELPERS
   Call these at the top of each protected page
══════════════════════════════════════════════════════════════ */

/** Buyer portal page guard */
async function initBuyerPage() {
  const sb   = await getSupabase();
  const user = await requireAuth('index.html');
  if (!user) return null;

  const profile = await getProfile();

  // Auto-fill user name in topbar if elements exist
  const nameEl = document.querySelector('.sidebar__user-name, #userName');
  if (nameEl && profile) {
    nameEl.textContent = profile.display_name || `${profile.first_name} ${profile.last_name}`;
  }
  const avatarEl = document.querySelector('.sidebar__user-avatar, .topbar__avatar');
  if (avatarEl && profile) {
    const initials = `${(profile.first_name||'?')[0]}${(profile.last_name||'?')[0]}`.toUpperCase();
    avatarEl.textContent = initials;
    if (profile.avatar_url) {
      avatarEl.style.backgroundImage  = `url(${profile.avatar_url})`;
      avatarEl.style.backgroundSize   = 'cover';
      avatarEl.textContent = '';
    }
  }

  // Wire up logout buttons
  document.querySelectorAll('.sidebar__user-logout, [data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => signOut('index.html'));
  });

  // Load unread notification count
  loadNotificationCount(user.id);
  subscribeNotificationCount(user.id);

  return { user, profile };
}

/** Seller portal page guard */
async function initSellerPage() {
  const user = await requireAuth('../seller/index.html');
  if (!user) return null;

  const profile = await getProfile();
  if (profile?.role !== 'seller' && profile?.role !== 'admin') {
    window.location.href = '../buyer/index.html';
    return null;
  }

  // Auto-fill
  const nameEl = document.querySelector('.sidebar__user-name, #userName');
  if (nameEl && profile) {
    nameEl.textContent = profile.seller_profiles?.[0]?.brand_name
      || profile.display_name
      || `${profile.first_name} ${profile.last_name}`;
  }
  document.querySelectorAll('.sidebar__user-logout, [data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => signOut('../seller/index.html'));
  });

  loadNotificationCount(user.id);
  subscribeNotificationCount(user.id);
  return { user, profile };
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION COUNT
══════════════════════════════════════════════════════════════ */
async function loadNotificationCount(userId) {
  try {
    const sb = await getSupabase();
    const { count } = await sb
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .eq('is_read', false);

    const dot   = document.querySelector('.notif-dot');
    const badge = document.querySelector('#notifCount');
    if (count > 0) {
      if (dot)   dot.style.display   = 'block';
      if (badge) badge.textContent   = count > 99 ? '99+' : count;
    }
  } catch (e) { /* non-critical */ }
}

let notificationChannel = null;

async function subscribeNotificationCount(userId) {
  try {
    const sb = await getSupabase();

    // Avoid duplicate live channels when page guards rerun.
    if (notificationChannel) {
      await sb.removeChannel(notificationChannel);
      notificationChannel = null;
    }

    notificationChannel = sb
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${userId}`,
        },
        () => {
          loadNotificationCount(userId);
        },
      )
      .subscribe();
  } catch (e) {
    // Realtime issues should not block auth/page init.
    console.warn('[notifications] realtime subscribe failed:', e?.message || e);
  }
}

/* ══════════════════════════════════════════════════════════════
   AUTH STATE LISTENER
   Updates UI reactively when session changes
══════════════════════════════════════════════════════════════ */
(async () => {
  const sb = await getSupabase();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      // Clear any cached user data
      sessionStorage.removeItem('bd_profile');
      if (notificationChannel) {
        sb.removeChannel(notificationChannel);
        notificationChannel = null;
      }
    }
    if (event === 'TOKEN_REFRESHED') {
      console.debug('[Auth] Token refreshed silently');
    }
    if (event === 'PASSWORD_RECOVERY') {
      window.location.href = 'reset-password.html';
    }
  });
})();
