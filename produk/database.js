(function () {
  const STORAGE_KEY = "alizz_store_products";
  const BACKUP_KEY = "alizz_store_products_backup_v1";
  const STORAGE_VERSION = 2;

  const WHATSAPP_NUMBER = "6281914401217";
  const TELEGRAM_USERNAME = "my_bini";
  const DEVELOPER_WHATSAPP_NUMBER = "6285943502869";
  const DEVELOPER_TELEGRAM_USERNAME = "Lizz12087";
  const DANA_NUMBER = "085943502869";

  const CATEGORY_ORDER = ["Panel", "Membership", "Sewa Bot", "Script", "Lainnya"];

  const CATEGORY_META = {
    Panel: {
      title: "Panel Pterodactyl",
      kicker: "Panel Pterodactyl",
      description: "Panel buat run bot WhatsApp atau simpan script biar online 24 jam.",
      buttonClass: "btn-panel",
      badgeClass: "cat-panel"
    },
    Membership: {
      title: "Membership Panel",
      kicker: "Membership Panel",
      description: "Cocok buat yang mau jualan panel sendiri.",
      buttonClass: "btn-membership",
      badgeClass: "cat-membership"
    },
    "Sewa Bot": {
      title: "Sewa Bot",
      kicker: "Bot WhatsApp",
      description: "Bot cocok buat jaga grup, promosi, dan kebutuhan usaha.",
      buttonClass: "btn-bot",
      badgeClass: "cat-bot"
    },
    Script: {
      title: "Script Bot",
      kicker: "Script WhatsApp MD",
      description: "Script bot WhatsApp MD siap pakai.",
      buttonClass: "btn-script",
      badgeClass: "cat-script"
    },
    Lainnya: {
      title: "Produk Lainnya",
      kicker: "Produk Custom",
      description: "Kategori ini untuk produk baru dari admin seperti APK Mod, QRIS Payment, Nokos, jasa digital, dan produk custom lainnya.",
      buttonClass: "btn-other",
      badgeClass: "cat-other"
    }
  };

  const INITIAL_PRODUCTS = [
    {
      id: "panel-1gb",
      name: "Panel Pterodactyl 1GB",
      category: "Panel",
      price: "Rp500",
      stock: 20,
      status: "available",
      description: "Panel legal buat run bot WhatsApp ringan biar online 24 jam.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-2gb",
      name: "Panel Pterodactyl 2GB",
      category: "Panel",
      price: "Rp1.000",
      stock: 20,
      status: "available",
      description: "Panel legal dengan kapasitas 2GB untuk kebutuhan bot basic.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-3gb",
      name: "Panel Pterodactyl 3GB",
      category: "Panel",
      price: "Rp1.500",
      stock: 20,
      status: "available",
      description: "Panel legal 3GB buat bot WhatsApp yang butuh resource lebih lega.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-4gb",
      name: "Panel Pterodactyl 4GB",
      category: "Panel",
      price: "Rp2.000",
      stock: 20,
      status: "available",
      description: "Panel 4GB cocok buat bot aktif dengan pemakaian stabil.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-5gb",
      name: "Panel Pterodactyl 5GB",
      category: "Panel",
      price: "Rp2.500",
      stock: 20,
      status: "available",
      description: "Panel 5GB buat bot WhatsApp dan script yang butuh kapasitas lebih.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-6gb",
      name: "Panel Pterodactyl 6GB",
      category: "Panel",
      price: "Rp3.000",
      stock: 20,
      status: "available",
      description: "Panel legal 6GB dengan akses panel penuh dan support admin.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-7gb",
      name: "Panel Pterodactyl 7GB",
      category: "Panel",
      price: "Rp3.500",
      stock: 20,
      status: "available",
      description: "Panel 7GB untuk bot yang lebih aktif dan butuh performa stabil.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-8gb",
      name: "Panel Pterodactyl 8GB",
      category: "Panel",
      price: "Rp4.000",
      stock: 20,
      status: "available",
      description: "Panel 8GB cocok buat run bot WhatsApp dengan kebutuhan lebih besar.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-9gb",
      name: "Panel Pterodactyl 9GB",
      category: "Panel",
      price: "Rp4.500",
      stock: 20,
      status: "available",
      description: "Panel legal 9GB buat kamu yang butuh kapasitas tinggi.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-10gb",
      name: "Panel Pterodactyl 10GB",
      category: "Panel",
      price: "Rp5.000",
      stock: 20,
      status: "available",
      description: "Panel 10GB buat bot aktif, script, dan kebutuhan digital yang lebih berat.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "panel-unli",
      name: "Panel Pterodactyl UNLI",
      category: "Panel",
      price: "Rp6.000",
      stock: 20,
      status: "available",
      description: "Panel UNLI buat kebutuhan bot dan script yang ingin lebih bebas.",
      benefits: ["Panel legal", "Cocok buat run bot WhatsApp", "Full akses panel", "Server stabil", "Garansi aktif", "Support admin"]
    },
    {
      id: "membership-reseller",
      name: "Membership Reseller",
      category: "Membership",
      price: "Rp5.000",
      stock: 15,
      status: "available",
      description: "Cocok buat yang mau mulai jualan panel sendiri dari level awal.",
      benefits: ["Panel legal", "Dapat akses sesuai rank", "Support admin", "Bisa jualan sesuai level", "Bisa jual panel 1GB sampai UNLI"]
    },
    {
      id: "membership-adp",
      name: "Membership ADP",
      category: "Membership",
      price: "Rp6.000",
      stock: 15,
      status: "available",
      description: "Rank ADP buat jual panel dan mulai open reseller.",
      benefits: ["Panel legal", "Dapat akses sesuai rank", "Support admin", "Bisa jualan sesuai level", "Bisa jual panel 1GB sampai UNLI + open reseller"]
    },
    {
      id: "membership-pt",
      name: "Membership PT",
      category: "Membership",
      price: "Rp7.000",
      stock: 15,
      status: "available",
      description: "Rank PT buat yang ingin akses lebih luas dalam jualan panel.",
      benefits: ["Panel legal", "Dapat akses sesuai rank", "Support admin", "Bisa jualan sesuai level", "Bisa open reseller + panel + ADP"]
    },
    {
      id: "membership-tk",
      name: "Membership TK",
      category: "Membership",
      price: "Rp8.000",
      stock: 15,
      status: "available",
      description: "Rank TK cocok buat yang mau buka level lebih tinggi.",
      benefits: ["Panel legal", "Dapat akses sesuai rank", "Support admin", "Bisa jualan sesuai level", "Bisa open reseller + panel + ADP + PT"]
    },
    {
      id: "membership-ceo",
      name: "Membership CEO",
      category: "Membership",
      price: "Rp9.000",
      stock: 15,
      status: "available",
      description: "Rank tertinggi buat akses jualan panel yang lebih lengkap.",
      benefits: ["Panel legal", "Dapat akses sesuai rank", "Support admin", "Bisa jualan sesuai level", "Bisa open reseller + panel + ADP + PT + TK"]
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

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function storageAvailable() {
    try {
      const testKey = "__alizz_storage_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function createProductId(name, fallbackIndex) {
    const base = sanitizeText(name, 90)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return base || `produk-${Date.now()}-${fallbackIndex || 0}`;
  }

  function sanitizeText(value, maxLength) {
    const limit = Number(maxLength) > 0 ? Number(maxLength) : 500;
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function sanitizeBenefit(value) {
    return sanitizeText(value, 120);
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
    const benefits = Array.isArray(item.benefits)
      ? item.benefits.map(sanitizeBenefit).filter(Boolean).slice(0, 12)
      : [];

    const status = item.status === "soldout" || stock <= 0 ? "soldout" : "available";

    return {
      id: sanitizeText(item.id, 120) || createProductId(name, index),
      name,
      category: normalizeCategory(item.category),
      price,
      stock,
      status,
      description,
      benefits
    };
  }

  function isValidProduct(product) {
    return Boolean(
      product &&
      typeof product === "object" &&
      product.id &&
      product.name &&
      product.category &&
      product.price &&
      Number.isFinite(Number(product.stock)) &&
      (product.status === "available" || product.status === "soldout") &&
      product.description &&
      Array.isArray(product.benefits)
    );
  }

  function sanitizeProducts(products) {
    if (!Array.isArray(products)) return [];

    const usedIds = new Set();
    return products
      .map(function (product, index) {
        const sanitized = sanitizeProduct(product, index);
        if (!isValidProduct(sanitized)) return null;

        let uniqueId = sanitized.id;
        let counter = 1;
        while (usedIds.has(uniqueId)) {
          uniqueId = `${sanitized.id}-${counter}`;
          counter += 1;
        }

        usedIds.add(uniqueId);
        sanitized.id = uniqueId;
        return sanitized;
      })
      .filter(Boolean);
  }

  function createStorageEnvelope(products) {
    return {
      storageVersion: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      products: sanitizeProducts(products)
    };
  }

  function parseStoredProducts(raw) {
    if (!raw) return { ok: false, products: [], legacy: false };

    try {
      const parsed = JSON.parse(raw);
      const legacy = Array.isArray(parsed);
      const productsSource = legacy ? parsed : parsed && parsed.products;
      const products = sanitizeProducts(productsSource);
      const sourceLength = Array.isArray(productsSource) ? productsSource.length : 0;

      if (!Array.isArray(productsSource)) {
        return { ok: false, products: [], legacy };
      }

      if (sourceLength > 0 && products.length === 0) {
        return { ok: false, products: [], legacy };
      }

      return { ok: true, products, legacy };
    } catch (error) {
      return { ok: false, products: [], legacy: false };
    }
  }

  function readProductsFromKey(key) {
    if (!storageAvailable()) return { ok: false, products: [] };
    return parseStoredProducts(localStorage.getItem(key));
  }

  function writeProductsToKey(key, products) {
    if (!storageAvailable()) return false;

    try {
      localStorage.setItem(key, JSON.stringify(createStorageEnvelope(products)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function backupCurrentProducts() {
    const current = readProductsFromKey(STORAGE_KEY);
    if (current.ok) {
      writeProductsToKey(BACKUP_KEY, current.products);
    }
  }

  function getProducts() {
    const current = readProductsFromKey(STORAGE_KEY);

    if (current.ok) {
      if (current.legacy) {
        writeProductsToKey(STORAGE_KEY, current.products);
      }
      return clone(current.products);
    }

    const backup = readProductsFromKey(BACKUP_KEY);
    if (backup.ok) {
      writeProductsToKey(STORAGE_KEY, backup.products);
      return clone(backup.products);
    }

    const initial = sanitizeProducts(INITIAL_PRODUCTS);
    writeProductsToKey(STORAGE_KEY, initial);
    return clone(initial);
  }

  function saveProducts(data) {
    const sanitized = sanitizeProducts(data);
    const originalLength = Array.isArray(data) ? data.length : 0;

    if (!Array.isArray(data) || (originalLength > 0 && sanitized.length === 0)) {
      return false;
    }

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

    writeProductsToKey(STORAGE_KEY, backup.products);
    return clone(backup.products);
  }

  function isAvailable(product) {
    const sanitized = sanitizeProduct(product, 0);
    return sanitized.status === "available" && Number(sanitized.stock) > 0;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.ALIZZ_STORE = {
    WHATSAPP_NUMBER,
    TELEGRAM_USERNAME,
    DEVELOPER_WHATSAPP_NUMBER,
    DEVELOPER_TELEGRAM_USERNAME,
    DANA_NUMBER,
    STORAGE_KEY,
    BACKUP_KEY,
    STORAGE_VERSION,
    CATEGORY_ORDER,
    CATEGORY_META,
    INITIAL_PRODUCTS,
    getProducts,
    saveProducts,
    resetProducts,
    recoverProductsFromBackup,
    sanitizeProduct,
    sanitizeProducts,
    normalizeCategory,
    isAvailable,
    escapeHTML
  };
})();
