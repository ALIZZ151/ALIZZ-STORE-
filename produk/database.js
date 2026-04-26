(function () {
  const STORAGE_KEY = "alizz_store_products";
  const WHATSAPP_NUMBER = "6285922199847";
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

  function getProducts() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {}
    }

    const initial = clone(INITIAL_PRODUCTS);
    saveProducts(initial);
    return initial;
  }

  function saveProducts(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function resetProducts() {
    const initial = clone(INITIAL_PRODUCTS);
    saveProducts(initial);
    return initial;
  }

  function normalizeCategory(category) {
    if (CATEGORY_ORDER.includes(category)) return category;
    return "Lainnya";
  }

  function isAvailable(product) {
    return product.status === "available" && Number(product.stock) > 0;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.ALIZZ_STORE = {
    WHATSAPP_NUMBER,
    DANA_NUMBER,
    STORAGE_KEY,
    CATEGORY_ORDER,
    CATEGORY_META,
    INITIAL_PRODUCTS,
    getProducts,
    saveProducts,
    resetProducts,
    normalizeCategory,
    isAvailable,
    escapeHTML
  };
})();
