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

});
