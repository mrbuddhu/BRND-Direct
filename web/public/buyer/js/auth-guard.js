/**
 * ============================================================
 *  BRND DIRECT — Auth Guard
 *  buyer/js/auth-guard.js
 *
 *  Include this script at the TOP of every protected page.
 *  If the visitor is not authenticated via lock.html,
 *  they are immediately redirected to the lock page.
 *
 *  Usage: <script src="js/auth-guard.js"></script>
 *  (Add as first script in <head> of every buyer page)
 * ============================================================
 */

(function () {
  'use strict';

  const SESSION_KEY      = 'brnd_portal_auth';
  const PORTAL_PASSWORD  = 'BRNDdirect2025!';   // must match lock.html
  const LOCK_PAGE        = '/lock.html';

  /* ── Anti right-click / inspect protection ── */
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key)) {
      e.preventDefault(); return false;
    }
    if (e.ctrlKey && ['U','S','P'].includes(e.key)) {
      e.preventDefault(); return false;
    }
  });

  /* ── Detect DevTools open (basic detection) ── */
  let devtoolsOpen = false;
  const threshold  = 160;
  setInterval(() => {
    if (
      window.outerWidth  - window.innerWidth  > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        // Optional: log attempt or redirect
        // window.location.replace(LOCK_PAGE);
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1000);

  /* ── Disable text selection on sensitive elements ── */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.price, .wholesale-price, .product-price, .invoice-amount')
      .forEach(el => { el.style.userSelect = 'none'; });
  });

  /* ── Preview / development mode bypass ── */
  // Auto-authenticate when running inside the Genspark preview iframe
  // or when the hostname is not a real production domain.
  const PREVIEW_HOSTS = ['genspark.ai', 'genspark.site', 'localhost', '127.0.0.1'];
  const isPreview = PREVIEW_HOSTS.some(h => location.hostname.includes(h)) || location.hostname === '';

  if (isPreview) {
    // Automatically set a valid session so all pages are accessible in preview
    const session = {
      token:   btoa(PORTAL_PASSWORD + '_authenticated'),
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /* ── Check authentication ── */
  function isAuthenticated() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const { token, expires } = JSON.parse(raw);
      if (Date.now() > expires) {
        sessionStorage.removeItem(SESSION_KEY);
        return false;
      }
      return token === btoa(PORTAL_PASSWORD + '_authenticated');
    } catch {
      return false;
    }
  }

  /* ── Redirect if not authenticated ── */
  if (!isAuthenticated()) {
    // Hide page content immediately before redirect
    document.documentElement.style.display = 'none';
    window.location.replace(LOCK_PAGE);
  }

  /* ── Session expiry warning (30 min before expiry) ── */
  function checkSessionExpiry() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const { expires } = JSON.parse(raw);
      const remaining = expires - Date.now();
      // Warn 30 minutes before expiry
      if (remaining < 30 * 60 * 1000 && remaining > 0) {
        const mins = Math.ceil(remaining / 60000);
        if (!window._sessionWarnShown) {
          window._sessionWarnShown = true;
          const warn = document.createElement('div');
          warn.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            background:#1e293b; border:1px solid #f59e0b; border-radius:10px;
            padding:12px 20px; font-size:.82rem; color:#fcd34d;
            font-family:sans-serif; z-index:99999;
            box-shadow:0 8px 24px rgba(0,0,0,.4);
            display:flex; align-items:center; gap:10px;
          `;
          warn.innerHTML = `⏰ Your session expires in ${mins} minute${mins===1?'':'s'}. <a href="/lock.html" style="color:#60a5fa;margin-left:6px;">Re-login →</a>`;
          document.body.appendChild(warn);
          setTimeout(() => warn.remove(), 8000);
        }
      }
      // Auto-logout on expiry
      if (remaining <= 0) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.replace(LOCK_PAGE);
      }
    } catch {}
  }

  // Check every 60 seconds
  setInterval(checkSessionExpiry, 60 * 1000);

})();
