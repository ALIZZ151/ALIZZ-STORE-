const WHATSAPP_NUMBER = "6281914401217";

const PANEL_PLANS = {
  "panel-1gb": { label: "RAM 1GB", productName: "Panel PTERODACTYL 1GB", amount: 1000, memory: 1024, benefits: ["Full akses panel", "Cocok buat bot WhatsApp ringan", "Support admin"] },
  "panel-2gb": { label: "RAM 2GB", productName: "Panel PTERODACTYL 2GB", amount: 1500, memory: 2048, benefits: ["Full akses panel", "Resource lebih lega", "Support admin"] },
  "panel-3gb": { label: "RAM 3GB", productName: "Panel PTERODACTYL 3GB", amount: 2000, memory: 3072, benefits: ["Full akses panel", "Cocok buat bot aktif", "Support admin"] },
  "panel-4gb": { label: "RAM 4GB", productName: "Panel PTERODACTYL 4GB", amount: 2500, memory: 4096, benefits: ["Full akses panel", "Performa stabil", "Support admin"] },
  "panel-5gb": { label: "RAM 5GB", productName: "Panel PTERODACTYL 5GB", amount: 3000, memory: 5120, benefits: ["Full akses panel", "Kapasitas lebih besar", "Support admin"] },
  "panel-6gb": { label: "RAM 6GB", productName: "Panel PTERODACTYL 6GB", amount: 3500, memory: 6144, benefits: ["Full akses panel", "Cocok buat banyak fitur", "Support admin"] },
  "panel-7gb": { label: "RAM 7GB", productName: "Panel PTERODACTYL 7GB", amount: 4000, memory: 7168, benefits: ["Full akses panel", "Server stabil", "Support admin"] },
  "panel-8gb": { label: "RAM 8GB", productName: "Panel PTERODACTYL 8GB", amount: 4500, memory: 8192, benefits: ["Full akses panel", "Resource besar", "Support admin"] },
  "panel-9gb": { label: "RAM 9GB", productName: "Panel PTERODACTYL 9GB", amount: 5000, memory: 9216, benefits: ["Full akses panel", "Kapasitas tinggi", "Support admin"] },
  "panel-10gb": { label: "RAM 10GB", productName: "Panel PTERODACTYL 10GB", amount: 6000, memory: 10240, benefits: ["Full akses panel", "Paket besar", "Support admin"] },
  "panel-unli": { label: "RAM UNLI", productName: "Panel PTERODACTYL UNLI", amount: 8000, memory: 0, benefits: ["Full akses panel", "Paket UNLI", "Butuh konfigurasi unlimited di Pterodactyl"] }
};

const MEMBERSHIP_RANKS = {
  reseller: { rank: "Reseller", productName: "Membership Panel Reseller", amount: 5000, benefits: ["Bisa jual panel"] },
  adp: { rank: "ADP", productName: "Membership Panel ADP", amount: 6000, benefits: ["Bisa jual panel", "Bisa open reseller"] },
  pt: { rank: "PT", productName: "Membership Panel PT", amount: 7000, benefits: ["Bisa open reseller", "Bisa open ADP"] },
  tk: { rank: "TK", productName: "Membership Panel TK", amount: 8000, benefits: ["Bisa open reseller", "Bisa open ADP", "Bisa open PT"] },
  ceo: { rank: "CEO", productName: "Membership Panel CEO", amount: 9000, benefits: ["Bisa open semua rank di bawahnya"] }
};

const MANUAL_PRODUCTS = {
  "sewa-bot-harian": { id: "sewa-bot-harian", name: "Sewa Bot Harian", category: "Sewa Bot", amount: 1000, price: "Rp1.000" },
  "sewa-bot-bulanan": { id: "sewa-bot-bulanan", name: "Sewa Bot Bulanan", category: "Sewa Bot", amount: 10000, price: "Rp10.000" },
  "sc-ourin-pt-free-update": { id: "sc-ourin-pt-free-update", name: "SC Ourin PT Free Update Permanen", category: "Script", amount: 25000, price: "Rp25.000" },
  "sc-ourin-pt-no-update": { id: "sc-ourin-pt-no-update", name: "SC Ourin PT No Update", category: "Script", amount: 10000, price: "Rp10.000" }
};

function normalizeProductType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "panel" || type === "pterodactyl") return "panel";
  if (type === "membership" || type === "member") return "membership";
  return "";
}

function normalizeRank(value) {
  const rank = String(value || "").trim().toLowerCase();
  return MEMBERSHIP_RANKS[rank] ? rank : "";
}

function rupiah(amount) {
  return `Rp${Number(amount || 0).toLocaleString("id-ID")}`;
}

function getPanelPlan(selectedPlan) {
  const id = String(selectedPlan || "").trim().toLowerCase();
  const plan = PANEL_PLANS[id];
  if (!plan) return null;
  return {
    product_type: "panel",
    selected_plan: id,
    product_name: plan.productName,
    selected_label: plan.label,
    amount: plan.amount,
    price: rupiah(plan.amount),
    memory: plan.memory,
    benefits: plan.benefits.slice()
  };
}

function getMembershipRank(selectedRank) {
  const rankId = normalizeRank(selectedRank);
  const rank = MEMBERSHIP_RANKS[rankId];
  if (!rank) return null;
  return {
    product_type: "membership",
    selected_rank: rankId,
    selected_label: rank.rank,
    product_name: rank.productName,
    amount: rank.amount,
    price: rupiah(rank.amount),
    benefits: rank.benefits.slice()
  };
}

function resolveOrderProduct(input) {
  const type = normalizeProductType(input && input.product_type);
  if (type === "panel") return getPanelPlan(input.selected_plan || input.product_id);
  if (type === "membership") return getMembershipRank(input.selected_rank);
  return null;
}

function getManualProduct(productId) {
  const id = String(productId || "").trim();
  return MANUAL_PRODUCTS[id] || null;
}

function buildWhatsAppOrderUrl(product) {
  const name = product && (product.name || product.product_name) ? (product.name || product.product_name) : "produk digital ALIZZ STORE";
  const price = product && product.price ? product.price : product && product.amount ? rupiah(product.amount) : "";
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
  PANEL_PLANS,
  MEMBERSHIP_RANKS,
  MANUAL_PRODUCTS,
  normalizeProductType,
  normalizeRank,
  rupiah,
  getPanelPlan,
  getMembershipRank,
  resolveOrderProduct,
  getManualProduct,
  buildWhatsAppOrderUrl,
  getMembershipLinks
};
