/* ============================================================
   BRND Direct – Portal JavaScript (Shared)
   All app pages: dashboard, products, orders, account
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ============================================================
     SIDEBAR TOGGLE (Mobile)
     ============================================================ */
  const sidebar         = document.getElementById('sidebar');
  const sidebarOverlay  = document.getElementById('sidebarOverlay');
  const sidebarToggle   = document.getElementById('sidebarToggle');

  function openSidebar() {
    if (sidebar)        sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    if (sidebar)        sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  if (sidebarToggle)  sidebarToggle.addEventListener('click', openSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar on nav-item click (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) closeSidebar();
    });
  });


  /* ============================================================
     FADE-IN ANIMATIONS (IntersectionObserver)
     ============================================================ */
  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    fadeEls.forEach(el => {
      el.style.animationPlayState = 'paused';
      io.observe(el);
    });
  }


  /* ============================================================
     TOPBAR SEARCH — Global shortcut
     ============================================================ */
  const topbarSearch = document.querySelector('.topbar .search-bar input');
  if (topbarSearch) {
    // CMD/CTRL + K to focus
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        topbarSearch.focus();
        topbarSearch.select();
      }
      // ESC to blur
      if (e.key === 'Escape') topbarSearch.blur();
    });
  }


  /* ============================================================
     WINDOW RESIZE — Close sidebar if resizing to desktop
     ============================================================ */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth >= 768) closeSidebar();
    }, 150);
  });


  /* ============================================================
     NOTIFICATION BELL — Click feedback
     ============================================================ */
  const notifBtn = document.querySelector('.topbar__btn[title="Notifications"]');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      const dot = notifBtn.querySelector('.notif-dot');
      if (dot) dot.style.display = 'none';
      showPortalToast('No new notifications.', '');
    });
  }


  /* ============================================================
     SMOOTH PAGE TRANSITIONS
     ============================================================ */
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    // Only handle same-page HTML links
    if (
      href &&
      !href.startsWith('#') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('http') &&
      href.endsWith('.html')
    ) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity .2s ease';
        setTimeout(() => { window.location.href = href; }, 200);
      });
    }
  });

  // Fade in on page load
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity .3s ease';
    document.body.style.opacity    = '1';
  });


  /* ============================================================
     GLOBAL TOAST UTILITY
     ============================================================ */
  window.showPortalToast = function(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', '': 'fa-info-circle' };
    const icon = iconMap[type] || 'fa-info-circle';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`.trim();
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity    = '0';
      toast.style.transform  = 'translateX(60px)';
      toast.style.transition = 'all .3s ease';
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  };


  /* ============================================================
     TOPBAR AVATAR DROPDOWN (Simple)
     ============================================================ */
  const avatar = document.querySelector('.topbar__avatar');
  if (avatar) {
    avatar.setAttribute('title', 'Account User · Settings');
    avatar.addEventListener('click', () => {
      window.location.href = 'account.html';
    });
  }


  /* ============================================================
     ACTIVE NAV HIGHLIGHT (Auto-detect current page)
     ============================================================ */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href === currentPage) {
      item.classList.add('active');
    } else if (currentPage === '' && href === 'dashboard.html') {
      item.classList.add('active');
    }
  });


  /* ============================================================
     DATA TABLE — Row click hint
     ============================================================ */
  document.querySelectorAll('.data-table tbody tr').forEach(row => {
    row.style.cursor = 'default';
  });


  /* ============================================================
     FORM INPUT — Auto-clear error on focus
     ============================================================ */
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderColor = '';
      const errMsg = this.closest('.form-group')?.querySelector('.form-error');
      if (errMsg) errMsg.remove();
    });
  });


  /* ============================================================
     SETTINGS PANELS — Ensure first panel is visible on load
     ============================================================ */
  const firstPanel = document.querySelector('.settings-panel');
  if (firstPanel) {
    // Ensure all except first are hidden on page load
    document.querySelectorAll('.settings-panel').forEach((p, i) => {
      if (i > 0) p.classList.add('hidden');
      else       p.classList.remove('hidden');
    });
  }


  /* ============================================================
     GLOBAL AI ASSISTANT FAB (portal-wide, injected on every page)
     Skip injection if orders.html already has its own #aiFab
     ============================================================ */
  if (!document.getElementById('aiFab')) {
    injectGlobalAIAssistant();
  }

});


/* ============================================================
   GLOBAL AI ASSISTANT — Injected on all pages except orders.html
   (orders.html has its own richer version)
   ============================================================ */
function injectGlobalAIAssistant() {
  // Styles
  const style = document.createElement('style');
  style.textContent = `
    #globalAIFab {
      position:fixed; bottom:28px; right:28px; z-index:9000;
      width:52px; height:52px; border-radius:50%;
      background:linear-gradient(135deg,#4f46e5,#7c3aed);
      border:none; cursor:pointer;
      box-shadow:0 8px 28px rgba(79,70,229,.45);
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-size:1.1rem;
      transition:all .22s; animation:gFabPulse 3s ease-in-out infinite;
    }
    #globalAIFab:hover { transform:scale(1.1); box-shadow:0 12px 36px rgba(79,70,229,.55); }
    @keyframes gFabPulse { 0%,100%{box-shadow:0 8px 28px rgba(79,70,229,.45)} 50%{box-shadow:0 8px 36px rgba(79,70,229,.7)} }
    #globalAIFab .gfab-tip {
      position:absolute; right:58px; background:#0f172a; color:#fff;
      padding:5px 12px; border-radius:8px; font-size:.7rem; font-weight:700;
      white-space:nowrap; opacity:0; transition:opacity .2s; pointer-events:none;
      font-family:inherit;
    }
    #globalAIFab:hover .gfab-tip { opacity:1; }

    #globalAIPanel {
      position:fixed; bottom:94px; right:28px; z-index:9000;
      width:380px; max-height:520px;
      background:#fff; border:1.5px solid #e5e7eb;
      border-radius:16px; box-shadow:0 24px 64px rgba(0,0,0,.18);
      display:flex; flex-direction:column; overflow:hidden;
      animation:gPanelIn .22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes gPanelIn { from{opacity:0;transform:scale(.92) translateY(12px)} to{opacity:1;transform:none} }
    @media(max-width:460px){ #globalAIPanel{ width:calc(100vw - 32px); right:16px; } }
    .g-ai-head {
      background:linear-gradient(135deg,#0f172a,#1e1b4b);
      color:#fff; padding:14px 18px;
      display:flex; align-items:center; gap:12px; flex-shrink:0;
    }
    .g-ai-head .g-avatar {
      width:34px; height:34px; border-radius:50%;
      background:rgba(255,255,255,.15); display:flex; align-items:center;
      justify-content:center; font-size:.85rem; flex-shrink:0;
    }
    .g-ai-head h4 { font-weight:800; font-size:.88rem; margin:0 0 1px; }
    .g-ai-head p  { font-size:.65rem; opacity:.6; margin:0; }
    .g-ai-close { margin-left:auto; background:none; border:none; color:rgba(255,255,255,.6); cursor:pointer; font-size:.85rem; padding:4px; }
    .g-ai-close:hover { color:#fff; }
    .g-ai-msgs  { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; min-height:0; }
    .g-ai-msg   { display:flex; gap:8px; align-items:flex-start; }
    .g-ai-msg.user { flex-direction:row-reverse; }
    .g-ai-bubble { max-width:84%; padding:9px 13px; border-radius:12px; font-size:.8rem; line-height:1.55; word-break:break-word; }
    .g-ai-msg.bot  .g-ai-bubble { background:#f4f5f8; color:#111; border-bottom-left-radius:3px; }
    .g-ai-msg.user .g-ai-bubble { background:#4f46e5; color:#fff; border-bottom-right-radius:3px; }
    .g-ai-av { width:26px; height:26px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.65rem; font-weight:800; }
    .g-ai-msg.bot  .g-ai-av { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; }
    .g-ai-msg.user .g-ai-av { background:#f4f5f8; color:#6b7280; }
    .g-ai-typing span { width:6px;height:6px;border-radius:50%;background:#9ca3af;display:inline-block;animation:gDot 1.2s ease-in-out infinite;margin:0 1px; }
    .g-ai-typing span:nth-child(2){animation-delay:.2s}.g-ai-typing span:nth-child(3){animation-delay:.4s}
    @keyframes gDot{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
    .g-ai-chips { padding:0 14px 10px; display:flex; gap:5px; flex-wrap:wrap; flex-shrink:0; }
    .g-ai-chip  { font-size:.68rem; font-weight:700; padding:4px 10px; border-radius:20px; border:1.5px solid #e5e7eb; background:#fff; cursor:pointer; color:#111; font-family:inherit; transition:all .15s; }
    .g-ai-chip:hover { border-color:#4f46e5; color:#4f46e5; }
    .g-ai-act  { font-size:.68rem; font-weight:700; padding:4px 10px; border-radius:20px; background:#4f46e5; color:#fff; border:none; cursor:pointer; font-family:inherit; margin-top:6px; margin-right:4px; }
    .g-ai-act:hover { background:#3730a3; }
    .g-ai-act.sec { background:#fff; color:#4f46e5; border:1.5px solid #4f46e5; }
    .g-ai-act.sec:hover { background:rgba(79,70,229,.06); }
    .g-ai-bar { padding:10px 12px; border-top:1px solid #e5e7eb; display:flex; gap:7px; align-items:center; flex-shrink:0; }
    .g-ai-bar input { flex:1; border:1.5px solid #e5e7eb; border-radius:8px; padding:7px 11px; font-size:.8rem; outline:none; transition:border-color .15s; color:#111; font-family:inherit; }
    .g-ai-bar input:focus { border-color:#4f46e5; }
    .g-ai-send { width:34px;height:34px;border-radius:8px;background:#4f46e5;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0; }
    .g-ai-send:hover { background:#3730a3; }
    .g-ai-file { width:34px;height:34px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#6b7280;flex-shrink:0;position:relative; }
    .g-ai-file input { position:absolute;inset:0;opacity:0;cursor:pointer; }
    .g-ai-file:hover { border-color:#4f46e5; color:#4f46e5; }
  `;
  document.head.appendChild(style);

  // FAB button
  const fab = document.createElement('button');
  fab.id = 'globalAIFab';
  fab.title = 'AI Assistant';
  fab.innerHTML = '<span class="gfab-tip">AI Assistant</span><i class="fas fa-brain" id="gAIFabIcon"></i>';
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'globalAIPanel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="g-ai-head">
      <div class="g-avatar"><i class="fas fa-brain"></i></div>
      <div><h4>BRND AI Assistant</h4><p>PO reader · Order creator · Site search</p></div>
      <button class="g-ai-close" id="gAIClose"><i class="fas fa-times"></i></button>
    </div>
    <div class="g-ai-msgs" id="gAIMsgs">
      <div class="g-ai-msg bot">
        <div class="g-ai-av"><i class="fas fa-brain"></i></div>
        <div class="g-ai-bubble">
          Hi! I'm your BRND AI Assistant. I can:
          <ul style="margin:7px 0 0 14px;padding:0;font-size:.75rem;line-height:1.8;">
            <li>📄 Read &amp; process Purchase Orders</li>
            <li>🛒 Create orders from product lists</li>
            <li>🔍 Find products, orders &amp; invoices</li>
          </ul>
          <div style="margin-top:9px;">
            <button class="g-ai-act" onclick="window.location.href='orders.html?tab=upload-po'"><i class="fas fa-file-arrow-up" style="margin-right:4px;"></i>Upload PO</button>
            <button class="g-ai-act sec" onclick="window.location.href='orders.html?tab=manual-order'"><i class="fas fa-pen-to-square" style="margin-right:4px;"></i>Build Order</button>
          </div>
        </div>
      </div>
    </div>
    <div class="g-ai-chips" id="gAIChips">
      <button class="g-ai-chip" onclick="gSendMsg('Show my pending orders')">Pending orders</button>
      <button class="g-ai-chip" onclick="gSendMsg('Upload a purchase order')">Upload PO</button>
      <button class="g-ai-chip" onclick="gSendMsg('Find my latest invoice')">Latest invoice</button>
      <button class="g-ai-chip" onclick="gSendMsg('Track my shipment')">Track shipment</button>
    </div>
    <div class="g-ai-bar">
      <div class="g-ai-file" title="Attach PO">
        <input type="file" id="gAIFile" accept=".pdf,.csv,.xlsx,.docx,.txt,.png,.jpg" onchange="gHandleFile(this.files[0])">
        <i class="fas fa-paperclip"></i>
      </div>
      <input type="text" id="gAIInput" placeholder="Ask about orders, POs, products…" onkeydown="if(event.key==='Enter')gSendMsg()">
      <button class="g-ai-send" onclick="gSendMsg()"><i class="fas fa-paper-plane"></i></button>
    </div>`;
  document.body.appendChild(panel);

  // Toggle
  fab.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'flex';
    document.getElementById('gAIFabIcon').className = open ? 'fas fa-brain' : 'fas fa-times';
  });
  document.getElementById('gAIClose').addEventListener('click', () => {
    panel.style.display = 'none';
    document.getElementById('gAIFabIcon').className = 'fas fa-brain';
  });
}

/* ── Global AI quick responses ── */
function gGetResponse(msg) {
  const m = msg.toLowerCase();
  const nav = (label, url) => `<div style="margin-top:7px;"><button class="g-ai-act" onclick="window.location.href='${url}'">${label}</button></div>`;
  if (m.includes('pending') || m.includes('order'))
    return `You have <strong>18 pending orders</strong> and 64 confirmed. ${nav('<i class="fas fa-list-check" style="margin-right:4px;"></i>View Orders', 'orders.html')}`;
  if (m.includes('upload') || m.includes('po') || m.includes('purchase'))
    return `Upload your PO and our AI will parse it instantly — extracting all line items, matching SKUs, and generating a Sales Order + Invoice. ${nav('<i class="fas fa-file-arrow-up" style="margin-right:4px;"></i>Upload PO Now', 'orders.html?tab=upload-po')}`;
  if (m.includes('invoice') || m.includes('payment'))
    return `You have 14 open invoices totalling <strong>$42,860</strong>. ${nav('<i class="fas fa-file-invoice-dollar" style="margin-right:4px;"></i>View Invoices', 'invoices.html')}`;
  if (m.includes('track') || m.includes('ship') || m.includes('delivery'))
    return `Latest shipment: FedEx Ground #794644792798 — Out for Delivery. ${nav('<i class="fas fa-truck-fast" style="margin-right:4px;"></i>Track Shipments', 'shipping-logistics.html')}`;
  if (m.includes('product') || m.includes('catalogue') || m.includes('browse'))
    return `Browse 2,400+ wholesale products. ${nav('<i class="fas fa-boxes-stacked" style="margin-right:4px;"></i>View Catalogue', 'products.html')}`;
  if (m.includes('build') || m.includes('create') || m.includes('manual'))
    return `Open the Manual Order Builder to pick products and auto-generate an order. ${nav('<i class="fas fa-pen-to-square" style="margin-right:4px;"></i>Build Order', 'orders.html?tab=manual-order')}`;
  return `I can help with orders, POs, invoices, shipping &amp; more! Try asking "Upload a PO" or "Show pending orders". <div style="margin-top:7px;"><button class="g-ai-act" onclick="window.location.href='orders.html?tab=upload-po'">Upload PO</button> <button class="g-ai-act sec" onclick="window.location.href='orders.html?tab=manual-order'">Build Order</button></div>`;
}

function gSendMsg(text) {
  const input = document.getElementById('gAIInput');
  const msgs  = document.getElementById('gAIMsgs');
  const msg   = text || (input ? input.value.trim() : '');
  if (!msg || !msgs) return;
  if (input) input.value = '';

  // User bubble
  const u = document.createElement('div');
  u.className = 'g-ai-msg user';
  u.innerHTML = `<div class="g-ai-av">AJ</div><div class="g-ai-bubble">${msg}</div>`;
  msgs.appendChild(u);

  // Typing
  const t = document.createElement('div');
  t.className = 'g-ai-msg bot';
  t.innerHTML = `<div class="g-ai-av"><i class="fas fa-brain"></i></div><div class="g-ai-bubble"><div class="g-ai-typing"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(t);
  msgs.scrollTop = msgs.scrollHeight;

  setTimeout(() => {
    t.remove();
    const b = document.createElement('div');
    b.className = 'g-ai-msg bot';
    b.innerHTML = `<div class="g-ai-av"><i class="fas fa-brain"></i></div><div class="g-ai-bubble">${gGetResponse(msg)}</div>`;
    msgs.appendChild(b);
    msgs.scrollTop = msgs.scrollHeight;
    const chips = document.getElementById('gAIChips');
    if (chips) chips.style.display = 'none';
  }, 1100 + Math.random() * 500);
}

function gHandleFile(file) {
  if (!file) return;
  const msgs = document.getElementById('gAIMsgs');
  if (!msgs) return;
  const u = document.createElement('div');
  u.className = 'g-ai-msg user';
  u.innerHTML = `<div class="g-ai-av">AJ</div><div class="g-ai-bubble"><i class="fas fa-file" style="margin-right:5px;"></i>${file.name}</div>`;
  msgs.appendChild(u);
  const t = document.createElement('div');
  t.className = 'g-ai-msg bot';
  t.innerHTML = `<div class="g-ai-av"><i class="fas fa-brain"></i></div><div class="g-ai-bubble"><div class="g-ai-typing"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(t);
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    t.remove();
    const b = document.createElement('div');
    b.className = 'g-ai-msg bot';
    b.innerHTML = `<div class="g-ai-av"><i class="fas fa-brain"></i></div><div class="g-ai-bubble">
      I've detected a <strong>Purchase Order</strong> in <em>${file.name}</em>. Want me to parse it and generate a Sales Order + Invoice?
      <div style="margin-top:8px;">
        <button class="g-ai-act" onclick="window.location.href='orders.html?tab=upload-po'"><i class="fas fa-wand-magic-sparkles" style="margin-right:4px;"></i>Parse &amp; Generate</button>
        <button class="g-ai-act sec" style="margin-left:4px;" onclick="document.getElementById('globalAIPanel').style.display='none'">Cancel</button>
      </div>
    </div>`;
    msgs.appendChild(b);
    msgs.scrollTop = msgs.scrollHeight;
  }, 1800);
}
