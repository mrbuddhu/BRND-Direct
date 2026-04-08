/**
 * ============================================================
 *  BRND DIRECT — Stripe Front-End Integration
 *  js/stripe.js
 *
 *  Exposes:
 *   • initStripe()               — load Stripe.js
 *   • mountPaymentElement(opts)  — mount the embedded payment form
 *   • confirmPayment(opts)       — confirm the payment intent
 *   • initCheckoutModal()        — self-contained checkout modal
 *
 *  Depends on:  js/supabase.js, js/auth.js, js/api.js
 *               STRIPE_PUBLISHABLE_KEY  (in js/supabase.js)
 *               CF_WORKER_URL          (in js/supabase.js)
 * ============================================================
 */

let _stripe      = null;
let _elements    = null;
let _clientSecret = null;

/* ════════════════════════════════════════════════════════════
   1. LOAD STRIPE.JS (deferred)
════════════════════════════════════════════════════════════ */
function loadStripeScript() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) { resolve(window.Stripe); return; }
    const s   = document.createElement('script');
    s.src     = 'https://js.stripe.com/v3/';
    s.async   = true;
    s.onload  = () => resolve(window.Stripe);
    s.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(s);
  });
}

async function initStripe() {
  if (_stripe) return _stripe;
  const StripeLib = await loadStripeScript();
  _stripe = StripeLib(typeof STRIPE_PUBLISHABLE_KEY !== 'undefined'
    ? STRIPE_PUBLISHABLE_KEY
    : 'pk_test_placeholder');
  return _stripe;
}

/* ════════════════════════════════════════════════════════════
   2. CREATE PAYMENT INTENT  (calls Cloudflare Worker)
════════════════════════════════════════════════════════════ */
async function createPaymentIntent(orderId, amount, buyerEmail) {
  const workerUrl = typeof CF_WORKER_URL !== 'undefined'
    ? CF_WORKER_URL
    : '';

  const res = await fetch(`${workerUrl}/api/create-payment-intent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ orderId, amount, buyerEmail })
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create payment intent');
  return json; // { clientSecret, paymentIntentId }
}

/* ════════════════════════════════════════════════════════════
   3. MOUNT PAYMENT ELEMENT
   @param {string} containerId  — DOM element ID to mount into
   @param {string} clientSecret — from createPaymentIntent()
════════════════════════════════════════════════════════════ */
async function mountPaymentElement(containerId, clientSecret) {
  const stripe    = await initStripe();
  _clientSecret   = clientSecret;
  _elements       = stripe.elements({
    clientSecret,
    appearance: {
      theme:     'night',
      variables: {
        colorPrimary:    '#6366f1',
        colorBackground: '#1e1e2e',
        colorText:       '#e2e8f0',
        colorDanger:     '#f43f5e',
        fontFamily:      '"Inter", system-ui, sans-serif',
        borderRadius:    '8px',
        spacingUnit:     '4px'
      }
    }
  });

  const paymentEl = _elements.create('payment', {
    layout: { type: 'tabs', defaultCollapsed: false }
  });
  paymentEl.mount(`#${containerId}`);

  // Return element so caller can listen to events
  return paymentEl;
}

/* ════════════════════════════════════════════════════════════
   4. CONFIRM PAYMENT
   @param {string} returnUrl  — redirect after 3DS or redirect-based methods
════════════════════════════════════════════════════════════ */
async function confirmPayment(returnUrl = window.location.href) {
  if (!_stripe || !_elements) throw new Error('Stripe not initialised');

  const { error } = await _stripe.confirmPayment({
    elements: _elements,
    confirmParams: { return_url: returnUrl },
    redirect: 'if_required'
  });

  if (error) throw error;
  // If no redirect (e.g. card payment), payment succeeded
  return true;
}

/* ════════════════════════════════════════════════════════════
   5. SELF-CONTAINED CHECKOUT MODAL
   Call:  initCheckoutModal()  on any page that has "Pay Now" buttons.
   Buttons need:  data-action="pay-order" data-order-id="xxx"
════════════════════════════════════════════════════════════ */
function initCheckoutModal() {
  // Inject modal HTML once
  if (!document.getElementById('stripeCheckoutModal')) {
    document.body.insertAdjacentHTML('beforeend', checkoutModalTemplate());
  }

  // Delegate click events to "Pay Now" buttons
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="pay-order"]');
    if (!btn) return;

    const orderId = btn.dataset.orderId;
    const amount  = parseFloat(btn.dataset.amount  || '0');
    const email   = btn.dataset.email || '';

    openCheckoutModal(orderId, amount, email);
  });

  // Close modal
  document.addEventListener('click', (e) => {
    if (e.target.closest('#checkoutModalClose') || e.target.id === 'stripeCheckoutModal') {
      closeCheckoutModal();
    }
  });

  // Submit payment
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'stripePaymentForm') return;
    e.preventDefault();
    await submitCheckoutPayment();
  });
}

async function openCheckoutModal(orderId, amount, buyerEmail) {
  const modal      = document.getElementById('stripeCheckoutModal');
  const mountPoint = document.getElementById('stripePaymentElement');
  const amountEl   = document.getElementById('checkoutAmount');
  const errorEl    = document.getElementById('checkoutError');
  const submitBtn  = document.getElementById('checkoutSubmit');

  if (!modal) return;

  // Reset state
  errorEl.textContent = '';
  mountPoint.innerHTML = '<div class="stripe-loading">Loading payment form…</div>';
  if (amountEl) amountEl.textContent = `$${amount.toFixed(2)}`;

  modal.classList.add('active');
  submitBtn.disabled = true;
  modal.dataset.orderId = orderId;

  try {
    const { clientSecret } = await createPaymentIntent(orderId, Math.round(amount * 100), buyerEmail);
    await mountPaymentElement('stripePaymentElement', clientSecret);
    submitBtn.disabled = false;
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled  = false;
  }
}

function closeCheckoutModal() {
  const modal = document.getElementById('stripeCheckoutModal');
  if (modal) modal.classList.remove('active');
  _elements    = null;
  _clientSecret = null;
}

async function submitCheckoutPayment() {
  const modal     = document.getElementById('stripeCheckoutModal');
  const errorEl   = document.getElementById('checkoutError');
  const submitBtn = document.getElementById('checkoutSubmit');
  const successEl = document.getElementById('checkoutSuccess');

  errorEl.textContent = '';
  submitBtn.disabled  = true;
  submitBtn.innerHTML = '<span class="btn-spinner"></span> Processing…';

  try {
    const returnUrl = `${window.location.origin}/buyer/invoices.html?payment=success&orderId=${modal.dataset.orderId}`;
    const success   = await confirmPayment(returnUrl);

    if (success) {
      submitBtn.style.display  = 'none';
      successEl.style.display  = 'block';
      setTimeout(() => {
        closeCheckoutModal();
        window.location.href = returnUrl;
      }, 2000);
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Payment failed. Please try again.';
    submitBtn.disabled  = false;
    submitBtn.innerHTML = 'Pay Now';
  }
}

/* ════════════════════════════════════════════════════════════
   CHECKOUT MODAL TEMPLATE
════════════════════════════════════════════════════════════ */
function checkoutModalTemplate() {
  return `
<div id="stripeCheckoutModal" style="
  display:none; position:fixed; inset:0; z-index:9999;
  background:rgba(0,0,0,.7); backdrop-filter:blur(4px);
  align-items:center; justify-content:center;
" onclick="if(event.target===this)closeCheckoutModal()">
  <style>
    #stripeCheckoutModal.active { display:flex !important; }
    #stripeCheckoutCard {
      background:#1e1e2e; border:1px solid rgba(255,255,255,.1);
      border-radius:16px; padding:32px; width:100%; max-width:480px;
      position:relative; color:#e2e8f0; font-family:'Inter',sans-serif;
    }
    #checkoutModalClose {
      position:absolute; top:16px; right:16px; background:transparent;
      border:none; color:#94a3b8; cursor:pointer; font-size:20px;
    }
    #checkoutModalClose:hover { color:#fff; }
    .checkout-header { margin-bottom:24px; }
    .checkout-header h3 { font-size:1.25rem; font-weight:600; color:#fff; margin:0 0 4px; }
    .checkout-header p  { font-size:.875rem; color:#64748b; margin:0; }
    .checkout-amount    { font-size:2rem; font-weight:700; color:#6366f1; margin-bottom:24px; }
    #checkoutError      { color:#f43f5e; font-size:.875rem; margin-top:12px; min-height:20px; }
    #checkoutSuccess    { display:none; text-align:center; padding:24px 0; }
    #checkoutSuccess .success-icon { font-size:3rem; }
    #checkoutSuccess p  { color:#34d399; font-weight:600; margin-top:12px; }
    #checkoutSubmit {
      width:100%; margin-top:20px; padding:14px;
      background:linear-gradient(135deg,#6366f1,#818cf8);
      border:none; border-radius:10px; color:#fff;
      font-size:1rem; font-weight:600; cursor:pointer;
      display:flex; align-items:center; justify-content:center; gap:8px;
    }
    #checkoutSubmit:disabled { opacity:.6; cursor:not-allowed; }
    #checkoutSubmit:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#6366f1); }
    .btn-spinner {
      width:16px; height:16px; border:2px solid rgba(255,255,255,.3);
      border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite;
      display:inline-block;
    }
    @keyframes spin { to { transform:rotate(360deg); } }
    .stripe-loading { text-align:center; color:#64748b; padding:40px; }
    .stripe-secure  { display:flex; align-items:center; justify-content:center;
                      gap:6px; margin-top:12px; font-size:.75rem; color:#64748b; }
  </style>
  <div id="stripeCheckoutCard">
    <button id="checkoutModalClose" aria-label="Close">✕</button>
    <div class="checkout-header">
      <h3>Complete Payment</h3>
      <p>BRND Direct Wholesale Portal</p>
    </div>
    <div class="checkout-amount" id="checkoutAmount">$0.00</div>

    <form id="stripePaymentForm">
      <div id="stripePaymentElement"></div>
      <div id="checkoutError" role="alert"></div>
      <div id="checkoutSuccess">
        <div class="success-icon">✅</div>
        <p>Payment confirmed!</p>
      </div>
      <button type="submit" id="checkoutSubmit">Pay Now</button>
    </form>

    <div class="stripe-secure">
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
        <path d="M6 0L0 2.667V8c0 3.714 2.56 7.2 6 8 3.44-.8 6-4.286 6-8V2.667L6 0z" fill="#34d399"/>
      </svg>
      Secured by Stripe · 256-bit SSL encryption
    </div>
  </div>
</div>`;
}

/* ════════════════════════════════════════════════════════════
   SETUP INTENT  (save payment method for Net Terms billing)
════════════════════════════════════════════════════════════ */
async function savePaymentMethod(profileId, email, containerId) {
  const workerUrl = typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : '';

  const res = await fetch(`${workerUrl}/api/create-setup-intent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ profileId, email })
  });
  const { clientSecret, error } = await res.json();
  if (error || !res.ok) throw new Error(error || 'Setup intent failed');

  const stripe    = await initStripe();
  const elements  = stripe.elements({
    clientSecret,
    appearance: { theme: 'night', variables: { colorPrimary: '#6366f1' } }
  });
  const el = elements.create('payment');
  el.mount(`#${containerId}`);

  return {
    elements,
    confirm: async (returnUrl) => {
      const { error: confirmErr } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required'
      });
      if (confirmErr) throw confirmErr;
    }
  };
}

/* ════════════════════════════════════════════════════════════
   STRIPE CONNECT — Seller Onboarding
════════════════════════════════════════════════════════════ */
async function startSellerStripeOnboarding(sellerProfileId, email, brandName) {
  const workerUrl = typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : '';

  const res = await fetch(`${workerUrl}/api/create-connect-account`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sellerProfileId, email, brandName })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Stripe Connect setup failed');

  if (json.onboardingUrl) {
    window.location.href = json.onboardingUrl;
  }
  return json;
}

async function openSellerPayoutDashboard(sellerProfileId) {
  const workerUrl = typeof CF_WORKER_URL !== 'undefined' ? CF_WORKER_URL : '';
  const res = await fetch(`${workerUrl}/api/payout-link?sellerProfileId=${encodeURIComponent(sellerProfileId)}`);
  const { url, error } = await res.json();
  if (error) throw new Error(error);
  window.open(url, '_blank');
}
