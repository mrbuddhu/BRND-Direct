/* ═══════════════════════════════════════════════════════
   BRND DIRECT OS — Investor Demo JS
   The Wholesale Cloud
═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── NAV SCROLL ─────────────────────────────────────
  const nav = document.getElementById('demoNav');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    updateActiveNav();
  });

  function updateActiveNav() {
    const sections = ['overview','commerce','finance','logistics','data','financials'];
    let current = 'overview';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });
    navLinks.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === '#' + current);
    });
  }

  // ─── SMOOTH SCROLL for nav ──────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── SCROLL TO SECTION (arch diagram) ───────────────
  window.scrollToSection = function(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ─── STAT COUNTERS (Hero) ───────────────────────────
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters(entry.target.querySelectorAll('[data-target]'));
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.hero-stats').forEach(el => counterObserver.observe(el));

  function animateCounters(elements) {
    elements.forEach(el => {
      const target = parseInt(el.dataset.target);
      const duration = 1800;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ─── LIVE COUNTERS (Data Moat) ────────────────────────
  const liveObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounters(entry.target.querySelectorAll('.live-counter[data-target]'));
        liveObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.live-metrics').forEach(el => liveObserver.observe(el));

  // ─── DEMO TABS ───────────────────────────────────────
  document.querySelectorAll('.demo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      const container = tab.closest('.module-section');

      container.querySelectorAll('.demo-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const panel = document.getElementById(tabId);
      if (panel) {
        panel.classList.add('active');
        // Re-render charts that might be in this tab
        if (tabId === 'seller-tab') initSellerChart();
      }
    });
  });

  // ─── PARTICLES ───────────────────────────────────────
  function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 50; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: absolute;
        width: ${Math.random() * 3 + 1}px;
        height: ${Math.random() * 3 + 1}px;
        background: rgba(99,102,241,${Math.random() * 0.5 + 0.1});
        border-radius: 50%;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: particle-float ${Math.random() * 10 + 8}s ease-in-out infinite;
        animation-delay: ${Math.random() * 5}s;
      `;
      container.appendChild(dot);
    }

    const style = document.createElement('style');
    style.textContent = `
      @keyframes particle-float {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
        25% { transform: translateY(-30px) translateX(15px); opacity: 0.8; }
        50% { transform: translateY(-20px) translateX(-10px); opacity: 0.5; }
        75% { transform: translateY(-40px) translateX(5px); opacity: 0.9; }
      }
    `;
    document.head.appendChild(style);
  }
  createParticles();

  // ─── CHARTS ──────────────────────────────────────────

  Chart.defaults.color = '#8892b0';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.font.family = 'Inter, sans-serif';

  // Seller Revenue Chart (mini)
  function initSellerChart() {
    const ctx = document.getElementById('sellerRevenueChart');
    if (!ctx || ctx._chartInstance) return;
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [{
          label: 'Revenue',
          data: [42000, 58000, 74000, 61000, 80000, 88000, 94200],
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#22d3ee',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              font: { size: 10 },
              callback: v => '$' + (v/1000).toFixed(0) + 'K'
            }
          }
        }
      }
    });
    ctx._chartInstance = chart;
  }

  // Finance Revenue Chart (stacked bar)
  const financeCtx = document.getElementById('financeRevenueChart');
  if (financeCtx) {
    new Chart(financeCtx, {
      type: 'bar',
      data: {
        labels: ['Month 1', 'Month 3', 'Month 6', 'Month 9', 'Month 12', 'Month 18', 'Month 24'],
        datasets: [
          {
            label: 'Factoring Fees',
            data: [8000, 22000, 48000, 80000, 125000, 220000, 380000],
            backgroundColor: 'rgba(99,102,241,0.8)',
            stack: 'stack',
          },
          {
            label: 'Card Interchange',
            data: [2000, 8000, 18000, 32000, 54000, 95000, 160000],
            backgroundColor: 'rgba(245,158,11,0.8)',
            stack: 'stack',
          },
          {
            label: 'Origination Fees',
            data: [2000, 6000, 14000, 24000, 33000, 58000, 95000],
            backgroundColor: 'rgba(16,185,129,0.8)',
            stack: 'stack',
          },
          {
            label: 'Late Payment Fees',
            data: [1000, 4000, 10000, 18000, 28000, 48000, 82000],
            backgroundColor: 'rgba(34,211,238,0.8)',
            stack: 'stack',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 } },
          tooltip: {
            callbacks: { label: ctx => ctx.dataset.label + ': $' + ctx.parsed.y.toLocaleString() }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            stacked: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K', font: { size: 10 } }
          }
        }
      }
    });
  }

  // Logistics Chart (bar by industry)
  const logisticsCtx = document.getElementById('logisticsChart');
  if (logisticsCtx) {
    new Chart(logisticsCtx, {
      type: 'bar',
      data: {
        labels: ['Beauty', 'Apparel', 'Home Goods', 'Food & Bev', 'Industrial'],
        datasets: [
          {
            label: 'Platform Margin (avg %)',
            data: [42, 40, 28, 32, 20],
            backgroundColor: [
              'rgba(99,102,241,0.8)',
              'rgba(34,211,238,0.8)',
              'rgba(245,158,11,0.8)',
              'rgba(16,185,129,0.8)',
              'rgba(139,92,246,0.8)',
            ],
            borderRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { callback: v => v + '%', font: { size: 10 } },
            max: 55,
          },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // Data Growth Chart (area)
  const dataGrowthCtx = document.getElementById('dataGrowthChart');
  if (dataGrowthCtx) {
    new Chart(dataGrowthCtx, {
      type: 'line',
      data: {
        labels: ['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'],
        datasets: [
          {
            label: 'Active Buyers',
            data: [120, 380, 720, 1100, 1540, 1842],
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: 'Brand Partners',
            data: [12, 45, 95, 168, 228, 284],
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.05)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 }, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  // Growth Projection Chart (24 months)
  const growthCtx = document.getElementById('growthProjectionChart');
  if (growthCtx) {
    const months = [];
    for (let i = 1; i <= 24; i++) months.push('M' + i);

    // Exponential-ish growth curves
    const saas = months.map((_, i) => Math.round(4000 * Math.pow(1.18, i)));
    const factoring = months.map((_, i) => Math.round(3000 * Math.pow(1.22, i)));
    const shipping = months.map((_, i) => Math.round(2000 * Math.pow(1.2, i)));
    const cards = months.map((_, i) => Math.round(500 * Math.pow(1.28, i)));

    new Chart(growthCtx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          { label: 'SaaS', data: saas, borderColor: '#6366f1', fill: false, tension: 0.3, borderWidth: 2, pointRadius: 0 },
          { label: 'Factoring', data: factoring, borderColor: '#22d3ee', fill: false, tension: 0.3, borderWidth: 2, pointRadius: 0 },
          { label: 'Shipping', data: shipping, borderColor: '#f59e0b', fill: false, tension: 0.3, borderWidth: 2, pointRadius: 0 },
          { label: 'Cards', data: cards, borderColor: '#10b981', fill: false, tension: 0.3, borderWidth: 2, pointRadius: 0 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label + ': $' + ctx.parsed.y.toLocaleString()
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 12 } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              callback: v => '$' + (v >= 1000000 ? (v/1000000).toFixed(1) + 'M' : (v/1000).toFixed(0) + 'K'),
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  // ─── INTERSECTION OBSERVER for animations ──────────
  const aosSections = document.querySelectorAll('.module-section, .problem-solution');
  const aosObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('[data-aos]').forEach((el, i) => {
          setTimeout(() => el.classList.add('aos-visible'), i * 80);
        });
      }
    });
  }, { threshold: 0.1 });

  aosSections.forEach(s => aosObserver.observe(s));

  // ─── SCORE RING ANIMATION ──────────────────────────
  const scoreObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target.querySelector('#scoreFill');
        if (fill) {
          setTimeout(() => {
            fill.style.strokeDashoffset = '47'; // animate to 742/850
          }, 300);
        }
        scoreObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.score-ring').forEach(el => scoreObserver.observe(el));

  // ─── TYPEWRITER for hero ────────────────────────────
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    heroTitle.style.animation = 'fadeUp 0.9s ease 0.2s both';
  }

  document.querySelectorAll('.hero-subtitle, .hero-stats, .hero-ctas').forEach((el, i) => {
    el.style.animation = `fadeUp 0.9s ease ${0.4 + i * 0.15}s both`;
  });

  // ─── LIVE TICKER (simulated) ────────────────────────
  function startLiveTicker() {
    const kpiValues = [
      { el: null, base: 4200000, variance: 5000, fmt: v => '$' + (v/1000000).toFixed(2) + 'M' }
    ];
    // subtle pulse on metric cards
    setInterval(() => {
      document.querySelectorAll('.mock-kpi--admin .kpi-value').forEach(el => {
        el.style.transition = 'color 0.5s';
        el.style.color = '#a5b4fc';
        setTimeout(() => { el.style.color = '#fff'; }, 500);
      });
    }, 5000);
  }
  startLiveTicker();

  // ─── CURSOR GLOW ────────────────────────────────────
  let glow = document.createElement('div');
  glow.style.cssText = `
    position: fixed; pointer-events: none; z-index: 9999;
    width: 400px; height: 400px; border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    transition: left 0.3s ease, top 0.3s ease;
    top: 0; left: 0;
  `;
  document.body.appendChild(glow);

  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });

  // ─── ARCH DIAGRAM hover effects ─────────────────────
  document.querySelectorAll('.arch-pillar').forEach(pillar => {
    pillar.addEventListener('mouseenter', () => {
      pillar.style.transition = 'all 0.3s';
    });
  });

  // ─── INIT ────────────────────────────────────────────
  initSellerChart();

  console.log('%cBRND DIRECT OS — Investor Demo', 'color:#6366f1;font-size:18px;font-weight:bold;');
  console.log('%cThe Wholesale Cloud — Series A Ready', 'color:#22d3ee;font-size:12px;');
  console.log('%cContact: invest@brnddirect.com', 'color:#10b981;font-size:12px;');

});
