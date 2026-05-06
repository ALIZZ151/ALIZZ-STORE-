const WHATSAPP_NUMBER = "6281914401217";

const PANEL_PRICES = {
  "panel-1gb": { name: "Panel Pterodactyl 1GB", amount: 1000, memory: 1024 },
  "panel-2gb": { name: "Panel Pterodactyl 2GB", amount: 1500, memory: 2048 },
  "panel-3gb": { name: "Panel Pterodactyl 3GB", amount: 2000, memory: 3072 },
  "panel-4gb": { name: "Panel Pterodactyl 4GB", amount: 2500, memory: 4096 },
  "panel-5gb": { name: "Panel Pterodactyl 5GB", amount: 3000, memory: 5120 },
  "panel-6gb": { name: "Panel Pterodactyl 6GB", amount: 3500, memory: 6144 },
  "panel-7gb": { name: "Panel Pterodactyl 7GB", amount: 4000, memory: 7168 },
  "panel-8gb": { name: "Panel Pterodactyl 8GB", amount: 4500, memory: 8192 },
  "panel-9gb": { name: "Panel Pterodactyl 9GB", amount: 5000, memory: 9216 },
  "panel-10gb": { name: "Panel Pterodactyl 10GB", amount: 6000, memory: 10240 },
  "panel-unli": { name: "Panel Pterodactyl UNLI", amount: 8000, memory: 0 }
};

const MEMBERSHIP_PRODUCTS = {
  "membership-reseller": {
    rank: "Reseller",
    name: "Membership Reseller",
    amount: 5000,
    benefits: ["Bisa jual panel"]
  },
  "membership-adp": {
    rank: "ADP",
    name: "Membership ADP",
    amount: 6000,
    benefits: ["Bisa jual panel", "Bisa open reseller"]
  },
  "membership-pt": {
    rank: "PT",
    name: "Membership PT",
    amount: 7000,
    benefits: ["Bisa open reseller", "Bisa open ADP"]
  },
  "membership-tk": {
    rank: "TK",
    name: "Membership TK",
    amount: 8000,
    benefits: ["Bisa open reseller", "Bisa open ADP", "Bisa open PT"]
  },
  "membership-ceo": {
    rank: "CEO",
    name: "Membership CEO",
    amount: 9000,
    benefits: ["Bisa open semua rank di bawahnya"]
  }
};

const MANUAL_PRODUCTS = {
  "sewa-bot-harian": { name: "Sewa Bot Harian", category: "Sewa Bot", amount: 1000 },
  "sewa-bot-bulanan": { name: "Sewa Bot Bulanan", category: "Sewa Bot", amount: 10000 },
  "sc-ourin-pt-free-update": { name: "SC Ourin PT Free Update Permanen", category: "Script", amount: 25000 },
  "sc-ourin-pt-no-update": { name: "SC Ourin PT No Update", category: "Script", amount: 10000 }
};

function normalizeRank(value) {
  const rank = String(value || "").trim().toLowerCase();
  if (["reseller", "adp", "pt", "tk", "ceo"].includes(rank)) return rank;
  return "";
}

function rupiah(amount) {
  return `Rp${Number(amount || 0).toLocaleString("id-ID")}`;
}

function getProductById(productId, selectedRank) {
  const id = String(productId || "").trim();
  const rank = normalizeRank(selectedRank);

  if (rank) {
    return getProductById(`membership-${rank}`);
  }

  if (PANEL_PRICES[id]) {
    return {
      id,
      product_id: id,
      name: PANEL_PRICES[id].name,
      category: "Panel",
      amount: PANEL_PRICES[id].amount,
      price: rupiah(PANEL_PRICES[id].amount),
      memory: PANEL_PRICES[id].memory
    };
  }

  if (MEMBERSHIP_PRODUCTS[id]) {
    return {
      id,
      product_id: id,
      name: MEMBERSHIP_PRODUCTS[id].name,
      category: "Membership",
      amount: MEMBERSHIP_PRODUCTS[id].amount,
      price: rupiah(MEMBERSHIP_PRODUCTS[id].amount),
      selected_rank: MEMBERSHIP_PRODUCTS[id].rank,
      benefits: MEMBERSHIP_PRODUCTS[id].benefits
    };
  }

  if (MANUAL_PRODUCTS[id]) {
    return {
      id,
      product_id: id,
      name: MANUAL_PRODUCTS[id].name,
      category: MANUAL_PRODUCTS[id].category,
      amount: MANUAL_PRODUCTS[id].amount,
      price: rupiah(MANUAL_PRODUCTS[id].amount)
    };
  }

  return null;
}

function isAutoPaymentProduct(product) {
  return Boolean(product && ["Panel", "Membership"].includes(product.category));
}

function isManualProduct(product) {
  return Boolean(product && ["Sewa Bot", "Script", "Lainnya"].includes(product.category));
}

function buildWhatsAppOrderUrl(product) {
  const name = product && product.name ? product.name : "produk digital ALIZZ STORE";
  const price = product && product.price ? product.price : "";
  const message = `Halo admin ALIZZ STORE, saya mau order ${name}${price ? ` dengan harga ${price}` : ""}. Apakah masih tersedia?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function getMembershipLinks() {
  return {
    whatsapp: process.env.MEMBERSHIP_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/EM7QsayWlS7DeunD5pnub1?mode=gi_t",
    telegram: process.env.MEMBERSHIP_TELEGRAM_GROUP_URL || "https://t.me/+imrqqPIaeWJjNGRl"
  };
}

module.exports = {
  WHATSAPP_NUMBER,
  PANEL_PRICES,
  MEMBERSHIP_PRODUCTS,
  MANUAL_PRODUCTS,
  normalizeRank,
  rupiah,
  getProductById,
  isAutoPaymentProduct,
  isManualProduct,
  buildWhatsAppOrderUrl,
  getMembershipLinks
};
