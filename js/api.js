/**
 * ============================================================
 *  BRND DIRECT — Front-end Data API Layer
 *  js/api.js
 *
 *  All Supabase interactions for the buyer + seller portals.
 *  Every function is async and returns { data, error }.
 *
 *  Depends on: js/supabase.js  (must be loaded first)
 * ============================================================
 */

/* ════════════════════════════════════════════════════════════
   PRODUCTS
════════════════════════════════════════════════════════════ */

/**
 * List products with optional filters
 * @param {Object} opts
 * @param {string}   opts.category     - category filter
 * @param {string[]} opts.subcategory  - subcategory array filter
 * @param {string}   opts.search       - text search (name / brand / sku / upc)
 * @param {string}   opts.searchField  - 'name'|'brand'|'sku'|'upc'|'all'
 * @param {string[]} opts.tags         - tag filter ['today','weekly','holiday']
 * @param {boolean}  opts.topSeller    - filter top sellers
 * @param {string}   opts.sort         - 'price_asc'|'price_desc'|'name_asc'|'name_desc'|'top_seller'
 * @param {number}   opts.page         - 1-based page number
 * @param {number}   opts.limit        - items per page (default 24)
 * @param {number}   opts.minPrice
 * @param {number}   opts.maxPrice
 * @param {number}   opts.maxMoq
 * @param {string}   opts.fulfillment  - 'wholesale'|'dropship'|'both'
 */
async function getProducts(opts = {}) {
  const sb = await getSupabase();
  const {
    category, subcategory, search, searchField = 'all',
    tags, topSeller, sort = 'name_asc',
    page = 1, limit = 24,
    minPrice, maxPrice, maxMoq, fulfillment,
    brandId
  } = opts;

  let query = sb
    .from('products')
    .select('*, brands(name, logo_url, slug)', { count: 'exact' })
    .eq('is_active', true);

  if (category)    query = query.eq('category', category);
  if (brandId)     query = query.eq('brand_id', brandId);
  if (subcategory?.length) query = query.contains('subcategory', subcategory);
  if (tags?.length)        query = query.overlaps('tags', tags);
  if (topSeller)   query = query.eq('is_top_seller', true);
  if (fulfillment && fulfillment !== 'all') {
    query = query.in('fulfillment_type', [fulfillment, 'both']);
  }
  if (minPrice)    query = query.gte('wholesale_price', minPrice);
  if (maxPrice)    query = query.lte('wholesale_price', maxPrice);
  if (maxMoq)      query = query.lte('moq', maxMoq);

  // Text search
  if (search) {
    const s = search.trim();
    if (searchField === 'sku')  query = query.ilike('sku', `%${s}%`);
    else if (searchField === 'upc')  query = query.ilike('upc', `%${s}%`);
    else if (searchField === 'name') query = query.ilike('name', `%${s}%`);
    else query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%,upc.ilike.%${s}%`);
  }

  // Sort
  switch (sort) {
    case 'price_asc':    query = query.order('wholesale_price', { ascending: true });  break;
    case 'price_desc':   query = query.order('wholesale_price', { ascending: false }); break;
    case 'name_asc':     query = query.order('name',            { ascending: true });  break;
    case 'name_desc':    query = query.order('name',            { ascending: false }); break;
    case 'top_seller':   query = query.order('is_top_seller',   { ascending: false }); break;
    default:             query = query.order('name',            { ascending: true });
  }

  // Pagination
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;
  return { data, error, count, page, limit, totalPages: Math.ceil((count || 0) / limit) };
}

/**
 * Get a single product by ID (with brand info)
 */
async function getProduct(productId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('products')
    .select('*, brands(name, logo_url, slug, description, country_of_origin)')
    .eq('id', productId)
    .single();
  return { data, error };
}

/**
 * Bulk lookup products by UPC or SKU array
 * Returns matched products keyed by upc/sku
 */
async function bulkLookupProducts(identifiers = [], fieldType = 'upc') {
  if (!identifiers.length) return { data: [], error: null };
  const sb = await getSupabase();
  const field = fieldType === 'sku' ? 'sku' : 'upc';
  const { data, error } = await sb
    .from('products')
    .select('id, name, sku, upc, wholesale_price, moq, fulfillment_type, brands(name)')
    .in(field, identifiers)
    .eq('is_active', true);
  return { data, error };
}

/**
 * Get all brands (for A-Z sidebar), sorted alphabetically
 */
async function getBrands(category = null) {
  const sb = await getSupabase();
  let query = sb
    .from('brands')
    .select('id, name, slug, logo_url, category')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  return { data, error };
}

/* ════════════════════════════════════════════════════════════
   ORDERS
════════════════════════════════════════════════════════════ */

/**
 * List orders for the current buyer
 */
async function getOrders(buyerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { status, page = 1, limit = 20 } = opts;
  let query = sb
    .from('orders')
    .select('*, order_items(*, products(name, sku, images))', { count: 'exact' })
    .eq('buyer_profile_id', buyerProfileId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;
  return { data, error, count, totalPages: Math.ceil((count || 0) / limit) };
}

/**
 * Get a single order with all line items
 */
async function getOrder(orderId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        products(id, name, sku, upc, images, brands(name))
      )
    `)
    .eq('id', orderId)
    .single();
  return { data, error };
}

/**
 * Create a new draft order with line items
 * @param {string} buyerProfileId
 * @param {Array}  items  [{ productId, quantity, unitPrice, fulfillmentType }]
 * @param {Object} opts   { shippingAddress, notes, netTerms }
 */
async function createOrder(buyerProfileId, items, opts = {}) {
  const sb = await getSupabase();

  // 1. Create the order shell
  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      buyer_profile_id: buyerProfileId,
      status:           'draft',
      payment_status:   'unpaid',
      net_terms:        opts.netTerms || 30,
      notes:            opts.notes    || null,
      shipping_address: opts.shippingAddress || null
    })
    .select()
    .single();
  if (orderErr) return { data: null, error: orderErr };

  // 2. Insert line items
  const lineItems = items.map(item => ({
    order_id:         order.id,
    product_id:       item.productId,
    sku:              item.sku,
    name:             item.name,
    quantity:         item.quantity,
    unit_price:       item.unitPrice,
    fulfillment_type: item.fulfillmentType || 'wholesale',
    seller_profile_id: item.sellerProfileId || null
  }));

  const { error: itemsErr } = await sb.from('order_items').insert(lineItems);
  if (itemsErr) return { data: null, error: itemsErr };

  // Re-fetch to get updated totals (trigger recalculates total_amount)
  return getOrder(order.id);
}

/**
 * Update order status (admin / seller use)
 */
async function updateOrderStatus(orderId, status) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();
  return { data, error };
}

/* ════════════════════════════════════════════════════════════
   INVOICES
════════════════════════════════════════════════════════════ */

async function getInvoices(buyerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { paymentStatus, page = 1, limit = 20 } = opts;
  let query = sb
    .from('invoices')
    .select('*, orders(order_number, total_amount, status)', { count: 'exact' })
    .eq('buyer_profile_id', buyerProfileId)
    .order('created_at', { ascending: false });
  if (paymentStatus && paymentStatus !== 'all') {
    query = query.eq('payment_status', paymentStatus);
  }
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

/* ════════════════════════════════════════════════════════════
   RFQS
════════════════════════════════════════════════════════════ */

async function getRFQs(buyerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { status, page = 1, limit = 20 } = opts;
  let query = sb
    .from('rfqs')
    .select(`*, products(name, sku, images, brands(name)),
             seller_profiles(brand_name)`, { count: 'exact' })
    .eq('buyer_profile_id', buyerProfileId)
    .order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

async function createRFQ(buyerProfileId, rfqData) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('rfqs')
    .insert({ buyer_profile_id: buyerProfileId, ...rfqData })
    .select()
    .single();
  return { data, error };
}

/* ════════════════════════════════════════════════════════════
   MESSAGES / CONVERSATIONS
════════════════════════════════════════════════════════════ */

async function getConversations(buyerProfileId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('conversations')
    .select(`*, seller_profiles(brand_name, logo_url),
             messages(body, created_at, sender_id)`)
    .eq('buyer_profile_id', buyerProfileId)
    .order('last_message_at', { ascending: false });
  return { data, error };
}

async function getMessages(conversationId) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('messages')
    .select('*, profiles(display_name, avatar_url, role)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return { data, error };
}

async function sendMessage(conversationId, senderId, body, attachmentUrl = null) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body, attachment_url: attachmentUrl })
    .select()
    .single();
  return { data, error };
}

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════════════════════ */

async function getNotifications(profileId, unreadOnly = false) {
  const sb = await getSupabase();
  let query = sb
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (unreadOnly) query = query.eq('is_read', false);
  const { data, error } = await query;
  return { data, error };
}

async function markNotificationsRead(profileId) {
  const sb = await getSupabase();
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false);
  return { error };
}

/* ════════════════════════════════════════════════════════════
   ANALYTICS EVENTS  (lightweight tracking)
════════════════════════════════════════════════════════════ */

async function trackEvent(eventType, payload = {}, profileId = null) {
  try {
    const sb = await getSupabase();
    await sb.from('analytics_events').insert({
      event_type: eventType,
      payload,
      profile_id: profileId
    });
  } catch (e) { /* non-critical — never throw */ }
}

/* ════════════════════════════════════════════════════════════
   SELLER — PRODUCTS MANAGEMENT
════════════════════════════════════════════════════════════ */

async function getSellerProducts(sellerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { search, page = 1, limit = 20 } = opts;
  let query = sb
    .from('products')
    .select('*, brands(name)', { count: 'exact' })
    .eq('seller_profile_id', sellerProfileId)
    .order('created_at', { ascending: false });
  if (search) query = query.ilike('name', `%${search}%`);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

async function upsertProduct(sellerProfileId, productData) {
  const sb = await getSupabase();
  const payload = { ...productData, seller_profile_id: sellerProfileId };
  if (payload.id) {
    // Update
    const { data, error } = await sb.from('products').update(payload).eq('id', payload.id).select().single();
    return { data, error };
  }
  const { data, error } = await sb.from('products').insert(payload).select().single();
  return { data, error };
}

async function deleteProduct(productId) {
  const sb = await getSupabase();
  const { error } = await sb.from('products').update({ is_active: false }).eq('id', productId);
  return { error };
}

/* ════════════════════════════════════════════════════════════
   SELLER — ORDERS (view orders that include their products)
════════════════════════════════════════════════════════════ */

async function getSellerOrders(sellerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { status, page = 1, limit = 20 } = opts;

  // Order items matching this seller
  let query = sb
    .from('order_items')
    .select(`
      *,
      products(name, sku, images),
      orders!inner(
        id, order_number, status, payment_status,
        total_amount, created_at,
        buyer_profiles!inner(business_name, profile_id)
      )
    `, { count: 'exact' })
    .eq('seller_profile_id', sellerProfileId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('orders.status', status);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

/* ════════════════════════════════════════════════════════════
   SELLER — PAYOUTS
════════════════════════════════════════════════════════════ */

async function getPayouts(sellerProfileId, opts = {}) {
  const sb = await getSupabase();
  const { status, page = 1, limit = 20 } = opts;
  let query = sb
    .from('payouts')
    .select('*', { count: 'exact' })
    .eq('seller_profile_id', sellerProfileId)
    .order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

/* ════════════════════════════════════════════════════════════
   ADMIN — OVERVIEW  (only available to admin role)
════════════════════════════════════════════════════════════ */

async function getAdminOverview() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('admin_overview').select('*').single();
  return { data, error };
}

async function getAdminUsers(opts = {}) {
  const sb = await getSupabase();
  const { role, status, search, page = 1, limit = 20 } = opts;
  let query = sb
    .from('profiles')
    .select(`
      *,
      buyer_profiles(id, business_name, business_type, credit_limit, net_terms, approved_at),
      seller_profiles(id, brand_name, brand_slug, commission_rate, approved_at, stripe_account_id)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (role   && role   !== 'all') query = query.eq('role', role);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(
    `first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`
  );
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

async function updateUserStatus(profileId, status) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update({ status })
    .eq('id', profileId)
    .select('id, status, role, display_name')
    .single();
  return { data, error };
}

async function getAdminOrders(opts = {}) {
  const sb = await getSupabase();
  const { status, page = 1, limit = 20 } = opts;
  let query = sb
    .from('orders')
    .select(`
      *,
      buyer_profiles(business_name, profile_id),
      order_items(id, quantity, unit_price, line_total, products(name, sku))
    `, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (status && status !== 'all') query = query.eq('status', status);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);
  const { data, error, count } = await query;
  return { data, error, count };
}

async function getRevenueByMonth() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('revenue_by_month').select('*');
  return { data, error };
}

async function getTopProducts(limit = 10) {
  const sb = await getSupabase();
  const { data, error } = await sb.from('top_products').select('*').limit(limit);
  return { data, error };
}

async function getAppSettings() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('app_settings').select('*');
  return { data, error };
}

async function updateAppSetting(key, value) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .select()
    .single();
  return { data, error };
}

/* ════════════════════════════════════════════════════════════
   PROFILE  (buyer / seller account updates)
════════════════════════════════════════════════════════════ */

async function updateProfile(profileId, updates) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();
  return { data, error };
}

async function updateBuyerProfile(profileId, updates) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('buyer_profiles')
    .update(updates)
    .eq('profile_id', profileId)
    .select()
    .single();
  return { data, error };
}

async function updateSellerProfile(profileId, updates) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('seller_profiles')
    .update(updates)
    .eq('profile_id', profileId)
    .select()
    .single();
  return { data, error };
}

/**
 * Upload a file to Supabase Storage
 * @param {string} bucket - 'avatars' | 'product-images' | 'brand-logos' | 'documents'
 * @param {string} path   - Storage path e.g. 'user-id/filename.jpg'
 * @param {File}   file   - Browser File object
 */
async function uploadFile(bucket, path, file) {
  const sb = await getSupabase();
  const { data, error } = await sb.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type
  });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);
  return { url: publicUrl, error: null };
}
