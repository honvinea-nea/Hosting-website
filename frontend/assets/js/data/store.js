/**
 * Shared demo store for Shoply (shop + admin).
 * localStorage keys: ce_products, ce_orders, ce_notifications, ce_settings, bb_orders
 */
(function (global) {
  const KEYS = {
    products: 'ce_products',
    orders: 'ce_orders',
    notifications: 'ce_notifications',
    settings: 'ce_settings',
    legacyOrders: 'bb_orders'
  };

  const LOW_STOCK_DEFAULT = 5;
  const DEFAULT_SETTINGS = {
    storeName: 'Bloom & Blossom',
    slogan: 'Thoughtful flowers, handcrafted & delivered fresh.',
    lowStockThreshold: LOW_STOCK_DEFAULT,
    deliveryFee: 0,
    freeDeliveryThreshold: 75,
    currency: 'USD',
    taxRate: 0,
    homepageTitle: 'Flowers that speak when <em>words fall short.</em>',
    homepageDescription: 'Thoughtfully curated seasonal bouquets, hand-tied by master florists and delivered fresh across the city with our signature handwritten note.',
    announcement: '✦ Complimentary handwritten note & free local delivery on orders over $75',
    brandColor: '#943853',
    accentColor: '#c99b66'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /** Seed products once from shop catalog if ce_products missing */
  function ensureProducts() {
    let list = read(KEYS.products, null);
    if (list && Array.isArray(list) && list.length) return list;

    // Prefer global products from products.js if loaded
    const source = (typeof products !== 'undefined' && Array.isArray(products))
      ? products.filter(p => p.price > 0)
      : [];

    list = source.map((p, i) => ({
      id: p.id,
      name: p.name,
      sku: 'CE-' + String(p.id).padStart(4, '0'),
      category: p.category || 'general',
      price: Number(p.price) || 0,
      discountPrice: null,
      image: p.image || '',
      desc: p.desc || '',
      stock: 8 + ((i * 3) % 20), // demo stock 8–27
      status: 'active',
      featured: i < 4,
      sizes: [],
      colors: [],
      updatedAt: new Date().toISOString()
    }));

    if (list.length) write(KEYS.products, list);
    return list;
  }

  function getProducts() {
    return ensureProducts();
  }

  function saveProducts(list) {
    write(KEYS.products, list);
  }

  /** Merge legacy bb_orders into ce_orders shape */
  function normalizeOrder(o, idx) {
    if (o.items && o.total != null && o.id) {
      return {
        id: o.id,
        customerName: o.name || o.customerName || 'Customer',
        email: o.email || '',
        phone: o.phone || '',
        address: o.address || '',
        date: o.date || (o.createdAt ? o.createdAt.slice(0, 10) : ''),
        time: o.time || '',
        recipient: o.recipient || o.name || '',
        message: o.message || '',
        items: (o.items || []).map(it => ({
          id: it.id,
          name: it.name,
          price: it.price,
          qty: it.qty,
          image: it.image
        })),
        subtotal: o.total,
        deliveryFee: 0,
        total: o.total,
        paymentMethod: o.paymentMethod || 'Demo',
        status: o.status || 'pending',
        createdAt: o.createdAt || new Date().toISOString()
      };
    }
    return o;
  }

  function getOrders() {
    let orders = read(KEYS.orders, null);
    if (!orders || !orders.length) {
      const legacy = read(KEYS.legacyOrders, []);
      orders = (legacy || []).map(normalizeOrder);
      if (orders.length) write(KEYS.orders, orders);
    }
    return orders || [];
  }

  function saveOrders(list) {
    write(KEYS.orders, list);
  }

  function getNotifications() {
    return read(KEYS.notifications, []);
  }

  function saveNotifications(list) {
    write(KEYS.notifications, list);
  }

  function pushNotification(notif) {
    const list = getNotifications();
    list.unshift({
      id: 'n-' + Date.now(),
      read: false,
      createdAt: new Date().toISOString(),
      ...notif
    });
    saveNotifications(list.slice(0, 50));
  }

  function getSettings() {
    const stored = read(KEYS.settings, {});
    const s = { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}) };
    if (s.homepageTitle === 'Flowers that say it for you.') {
      s.homepageTitle = DEFAULT_SETTINGS.homepageTitle;
    }
    if (s.brandColor === '#202522') {
      s.brandColor = DEFAULT_SETTINGS.brandColor;
    }
    return s;
  }

  function saveSettings(settings) {
    write(KEYS.settings, settings);
  }

  function getPromotions() {
    return read('ce_promotions', [
      { id: 'promo-1', code: 'WELCOME10', type: 'percent', value: 10, active: true, note: 'New customer 10% off' },
      { id: 'promo-2', code: 'FLOWERS15', type: 'percent', value: 15, active: true, note: 'Seasonal promo' },
      { id: 'promo-3', code: 'FREEDEL', type: 'fixed', value: 0, active: false, note: 'Free delivery (disabled demo)' }
    ]);
  }

  function savePromotions(list) {
    write('ce_promotions', list);
  }

  function money(n) {
    return '$' + (Number(n) || 0).toFixed(2);
  }

  function activeOrders(orders) {
    return (orders || []).filter(o => o.status !== 'cancelled');
  }

  global.CEStore = {
    KEYS,
    getProducts,
    saveProducts,
    getOrders,
    saveOrders,
    getNotifications,
    saveNotifications,
    pushNotification,
    getSettings,
    saveSettings,
    getDefaultSettings: () => ({ ...DEFAULT_SETTINGS }),
    getPromotions,
    savePromotions,
    money,
    activeOrders,
    ensureProducts
  };
})(window);
