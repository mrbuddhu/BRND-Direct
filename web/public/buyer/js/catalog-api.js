/**
 * ============================================================
 *  BRND DIRECT — Live Catalog API Client
 *  buyer/js/catalog-api.js
 *
 *  Fetches products and brands from the Cloudflare Worker API
 *  which proxies to Supabase. Falls back to static data if API
 *  is unreachable.
 *
 *  Usage:
 *    <script src="js/catalog-api.js"></script>
 *    const result = await CatalogAPI.getProducts({ page:1, limit:50, search:'chanel' });
 *    const brands = await CatalogAPI.getBrands();
 * ============================================================
 */

const CatalogAPI = (() => {

  /* ── Configuration ─────────────────────────────────────── */

  /**
   * Auto-detect the Worker base URL.
   *  - On production (brnddirect.com): same-origin, use relative /api
   *  - On CF Pages (*.pages.dev):      same-origin, use relative /api
   *  - On localhost / file://           point to your deployed Worker URL
   *
   * To override during development, set:
   *   window.BRND_API_BASE = 'https://brnd-direct-api.YOUR.workers.dev';
   */
  function getApiBase() {
    if (window.BRND_API_BASE) return window.BRND_API_BASE.replace(/\/$/, '');
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      // ⚠️ Development: update this URL to your deployed Worker URL
      return window.BRND_WORKER_URL || '';  // leave empty = relative (works if using wrangler dev)
    }
    return ''; // same-origin (relative /api/... paths)
  }

  const CACHE    = new Map();          // in-memory cache per request
  const CACHE_TTL = 60 * 1000;        // 60 seconds

  /* ── Internal fetch helper ─────────────────────────────── */
  async function apiFetch(endpoint, params = {}) {
    const base = getApiBase();
    const qs   = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== null && v !== ''))
    ).toString();
    const url  = `${base}${endpoint}${qs ? '?' + qs : ''}`;
    const key  = url;

    // Return cached result if fresh
    if (CACHE.has(key)) {
      const { ts, val } = CACHE.get(key);
      if (Date.now() - ts < CACHE_TTL) return val;
    }

    const res  = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API ${res.status}: ${err}`);
    }

    const val = await res.json();
    CACHE.set(key, { ts: Date.now(), val });
    return val;
  }

  /* ── Map Supabase row → portal product object ──────────── */
  function mapProduct(row) {
    const brand = row.brands || {};
    const images = Array.isArray(row.images)
      ? row.images.filter((img) => typeof img === 'string' && img.trim())
      : [];
    // Determine fulfillment display label
    const fulfillMap = { wholesale:'wholesale', dropship:'dropship', both:'both' };
    return {
      id:          row.id,
      name:        row.name        || 'Unnamed Product',
      brand:       brand.name      || row.brand_name || 'Unknown Brand',
      brandId:     row.brand_id,
      brandLogo:   brand.logo_url  || null,
      cat:         row.category    || 'other',
      subcat:      Array.isArray(row.subcategory) ? row.subcategory : [],
      sku:         row.sku         || '',
      upc:         row.upc         || '',
      asin:        row.meta?.asin  || '',
      price:       parseFloat(row.wholesale_price) || 0,
      retailPrice: row.msrp        ? parseFloat(row.msrp) : null,
      moq:         parseInt(row.moq, 10) || 1,
      stock:       parseInt(row.stock_qty, 10) || 0,
      fulfill:     fulfillMap[row.fulfillment_type] || 'both',
      images,
      img:         images[0] || null,
      tags:        Array.isArray(row.tags) ? row.tags : [],
      topSeller:   row.is_top_seller || false,
      isNew:       row.is_new       || false,
      desc:        row.description  || '',
      emoji:       row.meta?.emoji  || getCategoryEmoji(row.category),
      details: {
        concentration: row.meta?.concentration || '',
        gender:        row.meta?.gender        || '',
        size:          row.meta?.size          || '',
        origin:        row.meta?.origin        || '',
        type:          row.meta?.type          || ''
      },
      // Raw Supabase row preserved for reference
      _raw: row
    };
  }

  function getCategoryEmoji(cat) {
    const map = { fragrances:'🌸', beauty:'💄', skincare:'🧴', bags:'👜', sneakers:'👟', apparel:'👔', cosmetics:'🎭' };
    return map[cat] || '📦';
  }

  /* ── Map Supabase brand row → portal brand object ──────── */
  function mapBrand(row) {
    return {
      id:          row.id,
      name:        row.name || 'Unknown Brand',
      logo:        row.logo_url  || null,
      banner:      row.banner_url || null,
      category:    row.category  || '',
      description: row.description || '',
      isVerified:  row.is_verified || false,
      _raw:        row
    };
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {

    /**
     * Fetch paginated, filtered products from the live database.
     *
     * @param {Object} opts
     * @param {number}  opts.page     - Page number (1-based)
     * @param {number}  opts.limit    - Items per page
     * @param {string}  opts.search   - Full-text search query
     * @param {string}  opts.category - Category filter
     * @param {string}  opts.brand_id - Brand UUID filter
     * @param {string}  opts.sort     - Sort field
     * @param {string}  opts.fulfillment_type - 'wholesale'|'dropship'|'both'
     * @returns {Promise<{products:Array, total:number, page:number, pages:number}>}
     */
    async getProducts(opts = {}) {
      const res = await apiFetch('/api/products', {
        page:             opts.page  || 1,
        limit:            opts.limit || 50,
        search:           opts.search,
        category:         opts.category,
        brand_id:         opts.brand_id,
        sort:             opts.sort,
        fulfillment_type: opts.fulfillment_type
      });
      return {
        products: (res.data || []).map(mapProduct),
        total:    res.total  || 0,
        page:     res.page   || 1,
        pages:    res.pages  || 1,
        limit:    res.limit  || 50
      };
    },

    /**
     * Fetch a single product by UUID.
     * @param {string} id - UUID
     * @returns {Promise<Object|null>}
     */
    async getProduct(id) {
      try {
        const row = await apiFetch(`/api/products/${id}`);
        return mapProduct(row);
      } catch {
        return null;
      }
    },

    /**
     * Fetch all active brands.
     * @param {Object} opts
     * @param {string} opts.category - Filter brands by category
     * @param {string} opts.search   - Search brands by name
     * @returns {Promise<Array>}
     */
    async getBrands(opts = {}) {
      const res = await apiFetch('/api/brands', {
        category: opts.category,
        search:   opts.search,
        limit:    opts.limit || 200
      });
      return (res.data || []).map(mapBrand);
    },

    /**
     * Check if the API is reachable.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
      try {
        const base = getApiBase();
        const res  = await fetch(`${base}/api/health`, { method:'GET' });
        return res.ok;
      } catch {
        return false;
      }
    },

    /** Clear the in-memory cache (call when products are updated) */
    clearCache() {
      CACHE.clear();
    },

    /** Expose for debugging */
    getApiBase
  };

})();

/* ── Global export (supports both module and script tag) ── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatalogAPI;
}
