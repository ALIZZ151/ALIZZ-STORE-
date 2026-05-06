(function () {
  const STORAGE_KEY = "alizz_store_products";
  const BACKUP_KEY = "alizz_store_products_backup_v1";
  const STORAGE_VERSION = 4;

  const WHATSAPP_NUMBER = "6281914401217";
  const TELEGRAM_USERNAME = "my_bini";
  const DEVELOPER_WHATSAPP_NUMBER = "6285943502869";
  const DEVELOPER_TELEGRAM_USERNAME = "Lizz12087";
  const DANA_NUMBER = "085943502869";

  const CATEGORY_ORDER = ["Panel", "Membership", "Sewa Bot", "Script", "Lainnya"];

  const CATEGORY_META = {
    Panel: { title: "Panel Pterodactyl", kicker: "Panel Pterodactyl", description: "Panel buat run bot WhatsApp atau simpan script biar online 24 jam.", buttonClass: "btn-panel", badgeClass: "cat-panel" },
    Membership: { title: "Membership Panel", kicker: "Membership Panel", description: "Cocok buat yang mau jualan panel sendiri.", buttonClass: "btn-membership", badgeClass: "cat-membership" },
    "Sewa Bot": { title: "Sewa Bot", kicker: "Bot WhatsApp", description: "Bot cocok buat jaga grup, promosi, dan kebutuhan usaha.", buttonClass: "btn-bot", badgeClass: "cat-bot" },
    Script: { title: "Script Bot", kicker: "Script WhatsApp MD", description: "Script bot WhatsApp MD siap pakai.", buttonClass: "btn-script", badgeClass: "cat-script" },
    Lainnya: { title: "Produk Lainnya", kicker: "Produk Custom", description: "Kategori ini untuk produk baru dari admin seperti APK Mod, QRIS Payment, Nokos, jasa digital, dan produk custom lainnya.", buttonClass: "btn-other", badgeClass: "cat-other" }
  };

  const INITIAL_PRODUCTS = [
    {
      id: "panel-pterodactyl",
      name: "Panel PTERODACTYL",
      category: "Panel",
      price: "Mulai Rp1.000",
      stock: 999,
      status: "available",
      description: "Satu kartu panel. Pembeli memilih paket RAM setelah klik Beli.",
      benefits: ["Paket RAM 1GB sampai UNLI", "Auto QRIS Zakki", "Generate akun/server setelah paid", "Data akun hanya untuk order valid"]
    },
    {
      id: "membership-panel",
      name: "Membership Panel",
      category: "Membership",
      price: "Mulai Rp5.000",
      stock: 999,
      status: "available",
      description: "Satu kartu membership. Pembeli memilih rank setelah klik Beli.",
      benefits: ["Rank Reseller, ADP, PT, TK, CEO", "Auto QRIS Zakki", "Link grup tampil setelah paid", "Hanya bisa dibuka dengan token order"]
    },
    {
      id: "sewa-bot-harian",
      name: "Sewa Bot Harian",
      category: "Sewa Bot",
      price: "Rp1.000",
      stock: 12,
      status: "available",
      description: "Bot cocok buat jaga grup, promosi, dan kebutuhan usaha harian.",
      benefits: ["Auto respon cepat", "Bisa jaga grup", "Bisa bantu promosi / JPM", "Support admin", "Cocok buat pemula"]
    },
    {
      id: "sewa-bot-bulanan",
      name: "Sewa Bot Bulanan",
      category: "Sewa Bot",
      price: "Rp10.000",
      stock: 12,
      status: "available",
      description: "Paket sewa bot bulanan buat kebutuhan grup dan promosi lebih hemat.",
      benefits: ["Auto respon cepat", "Bisa jaga grup", "Bisa bantu promosi / JPM", "Support admin", "Cocok buat pemula"]
    },
    {
      id: "sc-ourin-pt-free-update",
      name: "SC Ourin PT Free Update Permanen",
      category: "Script",
      price: "Rp25.000",
      stock: 10,
      status: "available",
      description: "Script bot WhatsApp MD siap pakai dengan free update permanen.",
      benefits: ["Bisa coba dulu sebelum beli", "Script bot WhatsApp MD", "Tampilan rapi", "Mudah dipasang", "Support panel / termux", "Cocok buat pemula"]
    },
    {
      id: "sc-ourin-pt-no-update",
      name: "SC Ourin PT No Update",
      category: "Script",
      price: "Rp10.000",
      stock: 10,
      status: "available",
      description: "Script bot WhatsApp MD siap pakai versi no update.",
      benefits: ["Bisa coba dulu sebelum beli", "Script bot WhatsApp MD", "Tampilan rapi", "Mudah dipasang", "Support panel / termux", "Cocok buat pemula"]
    }
  ];

  function clone(data) { return JSON.parse(JSON.stringify(data)); }

  function storageAvailable() {
    try {
      const testKey = "__alizz_storage_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) { return false; }
  }

  function sanitizeText(value, maxLength) {
    const limit = Number(maxLength) > 0 ? Number(maxLength) : 500;
    return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function createProductId(name, fallbackIndex) {
    const base = sanitizeText(name, 90).toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return base || `produk-${Date.now()}-${fallbackIndex || 0}`;
  }

  function normalizeCategory(category) {
    const cleaned = sanitizeText(category, 40);
    if (CATEGORY_ORDER.includes(cleaned)) return cleaned;
    const lower = cleaned.toLowerCase();
    if (lower.includes("panel") || lower.includes("pterodactyl")) return "Panel";
    if (lower.includes("member") || lower.includes("reseller") || lower.includes("adp")) return "Membership";
    if (lower.includes("sewa") || lower.includes("bot")) return "Sewa Bot";
    if (lower.includes("script") || lower === "sc") return "Script";
    return "Lainnya";
  }

  function sanitizeProduct(product, index) {
    const item = product && typeof product === "object" ? product : {};
    const stockNumber = Number(item.stock);
    const stock = Number.isFinite(stockNumber) ? Math.max(0, Math.floor(stockNumber)) : 0;
    const name = sanitizeText(item.name, 120);
    const price = sanitizeText(item.price, 80);
    const description = sanitizeText(item.description, 420);
    const benefits = Array.isArray(item.benefits) ? item.benefits.map(function (value) { return sanitizeText(value, 120); }).filter(Boolean).slice(0, 12) : [];
    const status = item.status === "soldout" || stock <= 0 ? "soldout" : "available";
    return { id: sanitizeText(item.id, 120) || createProductId(name, index), name, category: normalizeCategory(item.category), price, stock, status, description, benefits };
  }

  function isValidProduct(product) {
    return Boolean(product && typeof product === "object" && product.id && product.name && product.category && product.price && Number.isFinite(Number(product.stock)) && (product.status === "available" || product.status === "soldout") && product.description && Array.isArray(product.benefits));
  }

  function isDeprecatedAutoVariant(product) {
    const id = String(product && product.id || "").toLowerCase();
    return /^panel-(?:\d+gb|10gb|unli)$/.test(id) || /^membership-(?:reseller|adp|pt|tk|ceo)$/.test(id);
  }

  function sanitizeProducts(products) {
    if (!Array.isArray(products)) return [];
    const usedIds = new Set();
    return products.map(function (product, index) {
      const sanitized = sanitizeProduct(product, index);
      if (!isValidProduct(sanitized) || isDeprecatedAutoVariant(sanitized)) return null;
      let uniqueId = sanitized.id;
      let counter = 1;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${sanitized.id}-${counter}`;
        counter += 1;
      }
      usedIds.add(uniqueId);
      sanitized.id = uniqueId;
      return sanitized;
    }).filter(Boolean);
  }

  function ensureCoreCards(items) {
    const manual = items.filter(function (product) { return !["panel-pterodactyl", "membership-panel"].includes(product.id); });
    return clone(INITIAL_PRODUCTS.slice(0, 2)).concat(manual);
  }

  function createStorageEnvelope(products) { return { storageVersion: STORAGE_VERSION, updatedAt: new Date().toISOString(), products: sanitizeProducts(products) }; }

  function parseStoredProducts(raw) {
    if (!raw) return { ok: false, products: [], legacy: false, needsWrite: false };
    try {
      const parsed = JSON.parse(raw);
      const legacy = Array.isArray(parsed);
      const productsSource = legacy ? parsed : parsed && parsed.products;
      if (!Array.isArray(productsSource)) return { ok: false, products: [], legacy, needsWrite: false };
      const products = sanitizeProducts(productsSource);
      const needsWrite = legacy || (parsed.storageVersion !== STORAGE_VERSION) || products.length !== productsSource.length;
      return { ok: products.length > 0, products, legacy, needsWrite };
    } catch (error) { return { ok: false, products: [], legacy: false, needsWrite: false }; }
  }

  function readProductsFromKey(key) {
    if (!storageAvailable()) return { ok: false, products: [] };
    return parseStoredProducts(localStorage.getItem(key));
  }

  function writeProductsToKey(key, products) {
    if (!storageAvailable()) return false;
    try { localStorage.setItem(key, JSON.stringify(createStorageEnvelope(products))); return true; } catch (error) { return false; }
  }

  function backupCurrentProducts() {
    const current = readProductsFromKey(STORAGE_KEY);
    if (current.ok) writeProductsToKey(BACKUP_KEY, current.products);
  }

  function getProducts() {
    const current = readProductsFromKey(STORAGE_KEY);
    if (current.ok) {
      const next = ensureCoreCards(current.products);
      if (current.needsWrite || JSON.stringify(next) !== JSON.stringify(current.products)) writeProductsToKey(STORAGE_KEY, next);
      return clone(next);
    }
    const backup = readProductsFromKey(BACKUP_KEY);
    if (backup.ok) {
      const next = ensureCoreCards(backup.products);
      writeProductsToKey(STORAGE_KEY, next);
      return clone(next);
    }
    const initial = sanitizeProducts(INITIAL_PRODUCTS);
    writeProductsToKey(STORAGE_KEY, initial);
    return clone(initial);
  }

  function saveProducts(data) {
    const sanitized = ensureCoreCards(sanitizeProducts(data));
    if (!Array.isArray(data) || sanitized.length === 0) return false;
    backupCurrentProducts();
    return writeProductsToKey(STORAGE_KEY, sanitized);
  }

  function resetProducts() {
    const initial = sanitizeProducts(INITIAL_PRODUCTS);
    backupCurrentProducts();
    writeProductsToKey(STORAGE_KEY, initial);
    return clone(initial);
  }

  function recoverProductsFromBackup() {
    const backup = readProductsFromKey(BACKUP_KEY);
    if (!backup.ok) return getProducts();
    const next = ensureCoreCards(backup.products);
    writeProductsToKey(STORAGE_KEY, next);
    return clone(next);
  }

  function isAvailable(product) {
    const sanitized = sanitizeProduct(product, 0);
    return sanitized.status === "available" && Number(sanitized.stock) > 0;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  window.ALIZZ_STORE = { WHATSAPP_NUMBER, TELEGRAM_USERNAME, DEVELOPER_WHATSAPP_NUMBER, DEVELOPER_TELEGRAM_USERNAME, DANA_NUMBER, STORAGE_KEY, BACKUP_KEY, STORAGE_VERSION, CATEGORY_ORDER, CATEGORY_META, INITIAL_PRODUCTS, getProducts, saveProducts, resetProducts, recoverProductsFromBackup, sanitizeProduct, sanitizeProducts, normalizeCategory, isAvailable, escapeHTML };
})();
