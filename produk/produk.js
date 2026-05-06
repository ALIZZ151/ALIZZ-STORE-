(function () {
  let rawProducts = [];
  let catalogProducts = [];
  let activeCategory = "Semua";
  const viewedProductIds = new Set();
  const ORDER_HISTORY_KEY = "alizz_order_history";
  const OLD_CURRENT_ORDER_KEY = "alizz_current_order";
  const POLL_MS = 7000;
  let checkoutState = null;
  let pollTimer = null;
  let countdownTimer = null;

  const PANEL_PLANS = [
    { id: "panel-1gb", label: "RAM 1GB", price: "Rp1.000", amount: 1000, benefit: "Cocok buat bot WhatsApp ringan." },
    { id: "panel-2gb", label: "RAM 2GB", price: "Rp1.500", amount: 1500, benefit: "Resource lebih lega buat bot basic." },
    { id: "panel-3gb", label: "RAM 3GB", price: "Rp2.000", amount: 2000, benefit: "Cocok buat bot aktif." },
    { id: "panel-4gb", label: "RAM 4GB", price: "Rp2.500", amount: 2500, benefit: "Performa stabil untuk bot harian." },
    { id: "panel-5gb", label: "RAM 5GB", price: "Rp3.000", amount: 3000, benefit: "Kapasitas lebih besar." },
    { id: "panel-6gb", label: "RAM 6GB", price: "Rp3.500", amount: 3500, benefit: "Cocok buat bot dengan fitur banyak." },
    { id: "panel-7gb", label: "RAM 7GB", price: "Rp4.000", amount: 4000, benefit: "Resource tinggi dan stabil." },
    { id: "panel-8gb", label: "RAM 8GB", price: "Rp4.500", amount: 4500, benefit: "Untuk kebutuhan bot lebih berat." },
    { id: "panel-9gb", label: "RAM 9GB", price: "Rp5.000", amount: 5000, benefit: "Kapasitas tinggi." },
    { id: "panel-10gb", label: "RAM 10GB", price: "Rp6.000", amount: 6000, benefit: "Paket besar untuk kebutuhan aktif." },
    { id: "panel-unli", label: "RAM UNLI", price: "Rp8.000", amount: 8000, benefit: "UNLI hanya berjalan jika node Pterodactyl sudah dikonfigurasi aman." }
  ];

  const MEMBERSHIP_RANKS = [
    { rank: "reseller", label: "Reseller", price: "Rp5.000", amount: 5000, benefit: "Bisa jual panel" },
    { rank: "adp", label: "ADP", price: "Rp6.000", amount: 6000, benefit: "Bisa jual panel + open reseller" },
    { rank: "pt", label: "PT", price: "Rp7.000", amount: 7000, benefit: "Bisa open reseller + ADP" },
    { rank: "tk", label: "TK", price: "Rp8.000", amount: 8000, benefit: "Bisa open reseller + ADP + PT" },
    { rank: "ceo", label: "CEO", price: "Rp9.000", amount: 9000, benefit: "Bisa open semua rank di bawahnya" }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "produk") return;
    if (!window.ALIZZ_STORE || typeof window.ALIZZ_STORE.getProducts !== "function") return;

    rawProducts = window.ALIZZ_STORE.getProducts();
    setupCatalog();
    setupYear();
    ensureCheckoutModal();
    ensureHistorySection();
    renderCatalog();
    migrateOldCurrentOrder();
    renderOrderHistory();
    recoverOrderFromUrlOrHistory();
  });

  function buildCatalogProducts() {
    rawProducts = window.ALIZZ_STORE.getProducts();
    const manualProducts = rawProducts.filter(function (product) {
      const category = window.ALIZZ_STORE.normalizeCategory(product.category);
      return category !== "Panel" && category !== "Membership";
    });

    return [
      {
        id: "panel-pterodactyl",
        product_type: "panel",
        name: "Panel PTERODACTYL",
        category: "Panel",
        price: "Mulai Rp1.000",
        stock: 999,
        status: "available",
        description: "Panel untuk menjalankan bot WhatsApp/script 24 jam. Pilih RAM setelah klik Beli.",
        benefits: ["Pilih RAM 1GB sampai UNLI", "Auto QRIS Zakki", "Generate akun setelah payment sukses", "Data akun hanya untuk pembeli dengan token order"]
      },
      {
        id: "membership-panel",
        product_type: "membership",
        name: "Membership Panel",
        category: "Membership",
        price: "Mulai Rp5.000",
        stock: 999,
        status: "available",
        description: "Membership untuk yang mau jual panel dan naik rank reseller sampai CEO.",
        benefits: ["Rank Reseller, ADP, PT, TK, CEO", "Auto QRIS Zakki", "Link grup tampil setelah payment sukses", "Link hanya untuk order valid"]
      }
    ].concat(manualProducts);
  }

  function setupCatalog() {
    const searchInput = document.querySelector("#searchInput");
    const filterTabs = document.querySelector("#filterTabs");
    if (!searchInput || !filterTabs) return;

    searchInput.addEventListener("input", renderCatalog);
    filterTabs.addEventListener("click", function (event) {
      const button = event.target.closest(".filter-btn");
      if (!button) return;
      activeCategory = button.dataset.category;
      document.querySelectorAll(".filter-btn").forEach(function (btn) { btn.classList.remove("active"); });
      button.classList.add("active");
      renderCatalog();
    });
  }

  function renderCatalog() {
    catalogProducts = buildCatalogProducts();
    const container = document.querySelector("#categorySections");
    const emptyState = document.querySelector("#emptyState");
    const searchInput = document.querySelector("#searchInput");
    if (!container || !emptyState || !searchInput) return;

    const keyword = searchInput.value.trim().toLowerCase();
    const categories = activeCategory === "Semua" ? window.ALIZZ_STORE.CATEGORY_ORDER : [activeCategory];
    let html = "";
    let renderedCount = 0;

    categories.forEach(function (category) {
      const items = catalogProducts.filter(function (product) {
        const normalized = window.ALIZZ_STORE.normalizeCategory(product.category);
        const searchable = [
          product.name,
          normalized,
          product.price,
          product.description,
          product.product_type,
          Array.isArray(product.benefits) ? product.benefits.join(" ") : "",
          product.product_type === "panel" ? PANEL_PLANS.map(function (plan) { return `${plan.label} ${plan.price}`; }).join(" ") : "",
          product.product_type === "membership" ? MEMBERSHIP_RANKS.map(function (rank) { return `${rank.label} ${rank.benefit}`; }).join(" ") : ""
        ].join(" ").toLowerCase();
        return normalized === category && searchable.includes(keyword);
      });
      if (items.length === 0) return;
      renderedCount += items.length;
      html += createCategorySection(category, items);
    });

    container.innerHTML = html;
    if (renderedCount === 0) emptyState.classList.remove("hidden");
    else emptyState.classList.add("hidden");

    bindOrderButtons();
    observeProductViews();
  }

  function createCategorySection(category, items) {
    const meta = window.ALIZZ_STORE.CATEGORY_META[category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;
    return `
      <section class="product-category-section">
        <div class="category-head">
          <div>
            <span class="category-kicker">${escapeHTML(meta.kicker)}</span>
            <h2>${escapeHTML(meta.title)}</h2>
            <p>${escapeHTML(meta.description)}</p>
          </div>
          <span class="category-count">${items.length} produk</span>
        </div>
        <div class="products-grid">${items.map(createProductCard).join("")}</div>
      </section>
    `;
  }

  function createProductCard(product) {
    const category = window.ALIZZ_STORE.normalizeCategory(product.category);
    const meta = window.ALIZZ_STORE.CATEGORY_META[category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;
    const soldout = !window.ALIZZ_STORE.isAvailable(product);
    const benefits = Array.isArray(product.benefits) ? product.benefits.slice(0, 5) : [];
    const ctaText = product.product_type === "panel" || product.product_type === "membership" ? "Beli" : "Order via WhatsApp";
    return `
      <article class="product-card ${soldout ? "soldout" : ""}" data-product-id="${escapeAttribute(product.id)}" data-product-name="${escapeAttribute(product.name)}" data-product-category="${escapeAttribute(category)}">
        <div class="product-top">
          <span class="product-badge ${meta.badgeClass}">${escapeHTML(category)}</span>
          <span class="product-status ${soldout ? "soldout" : "available"}">${soldout ? "Habis" : "Tersedia"}</span>
        </div>
        <h3>${escapeHTML(product.name)}</h3>
        <div class="price">${escapeHTML(product.price)}</div>
        <p class="product-desc">${escapeHTML(product.description)}</p>
        <ul class="benefit-list">${benefits.map(function (benefit) { return `<li>${escapeHTML(benefit)}</li>`; }).join("")}</ul>
        <div class="product-meta"><span>Metode</span><strong>${product.product_type ? "Auto QRIS" : "Manual WA"}</strong></div>
        <button class="btn ${soldout ? "btn-disabled" : meta.buttonClass} order-btn" data-id="${escapeAttribute(product.id)}" ${soldout ? "disabled" : ""}>${soldout ? "Stok Habis" : ctaText}</button>
      </article>
    `;
  }

  function bindOrderButtons() {
    document.querySelectorAll(".order-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const product = catalogProducts.find(function (item) { return item.id === button.dataset.id; });
        if (!product || !window.ALIZZ_STORE.isAvailable(product)) return;
        if (product.product_type === "panel" || product.product_type === "membership") {
          openCheckout(product);
          return;
        }
        openManualOrder(product);
      });
    });
  }

  function openManualOrder(product) {
    const category = window.ALIZZ_STORE.normalizeCategory(product.category);
    trackAnalytics("manual_order_click", { source: "product_card", productId: product.id, productName: product.name, productCategory: category, productPrice: product.price });
    trackAnalytics("order_whatsapp_click", { source: "product_card", productId: product.id, productName: product.name, productCategory: category, productPrice: product.price });
    const message = `Halo admin ALIZZ STORE, saya mau order ${product.name} dengan harga ${product.price}. Apakah masih tersedia?`;
    window.open(`https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function ensureCheckoutModal() {
    if (document.querySelector("#checkoutModal")) return;
    const modal = document.createElement("section");
    modal.id = "checkoutModal";
    modal.className = "checkout-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="checkout-backdrop" data-checkout-close="true"></div>
      <div class="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <button class="checkout-close" type="button" data-checkout-close="true" aria-label="Tutup checkout">×</button>
        <div id="checkoutContent"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", function (event) {
      if (event.target && event.target.dataset && event.target.dataset.checkoutClose === "true") closeCheckout();
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeCheckout(); });
  }

  function ensureHistorySection() {
    if (document.querySelector("#purchaseHistorySection")) return;
    const emptyState = document.querySelector("#emptyState");
    if (!emptyState || !emptyState.parentElement) return;
    emptyState.insertAdjacentHTML("afterend", `
      <section class="purchase-history-section" id="purchaseHistorySection">
        <div class="category-head">
          <div>
            <span class="category-kicker">Riwayat Pembelian</span>
            <h2>Riwayat Pembelian Browser Ini</h2>
            <p>Riwayat hanya memakai order_id + recovery_token yang tersimpan di browser ini. Jangan bagikan token order.</p>
          </div>
          <button class="btn btn-outline btn-sm" id="refreshHistoryBtn" type="button">Refresh Riwayat</button>
        </div>
        <div class="order-history-list" id="orderHistoryList"></div>
      </section>`);
    const refresh = document.querySelector("#refreshHistoryBtn");
    if (refresh) refresh.addEventListener("click", renderOrderHistory);
  }

  function openCheckout(product) {
    checkoutState = {
      product,
      product_type: product.product_type,
      selected_plan: null,
      selected_rank: null,
      order: null,
      token: null,
      payment: null,
      status: "select"
    };
    stopPolling();
    if (product.product_type === "panel") renderPanelPlanSelection();
    else renderMembershipRankSelection();
    showCheckout();
    trackAnalytics("checkout_open", { source: "product_card", productId: product.id, productName: product.name, productCategory: product.category });
  }

  function showCheckout() {
    const modal = document.querySelector("#checkoutModal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCheckout() {
    const modal = document.querySelector("#checkoutModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  function renderPanelPlanSelection() {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    const selected = checkoutState.selected_plan || PANEL_PLANS[0].id;
    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">Panel PTERODACTYL</span>
        <h2 id="checkoutTitle">Pilih Paket RAM</h2>
        <p>Pilih paket dulu. QRIS baru dibuat setelah kamu menekan Setuju di halaman konfirmasi.</p>
      </div>
      <label class="checkout-label">Paket RAM
        <select id="panelPlanSelect">${PANEL_PLANS.map(function (plan) { return `<option value="${escapeAttribute(plan.id)}" ${plan.id === selected ? "selected" : ""}>${escapeHTML(plan.label)} - ${escapeHTML(plan.price)}</option>`; }).join("")}</select>
      </label>
      <div id="selectedPlanBenefit" class="checkout-benefit"></div>
      <div class="checkout-actions">
        <button class="btn btn-primary full" type="button" id="continuePanelCheckoutBtn">Order</button>
        <button class="btn btn-outline full" type="button" data-checkout-close="true">Batal</button>
      </div>`;
    const select = document.querySelector("#panelPlanSelect");
    const update = function () {
      const plan = getPlan(select.value);
      checkoutState.selected_plan = plan.id;
      document.querySelector("#selectedPlanBenefit").textContent = plan.benefit;
    };
    select.addEventListener("change", update);
    update();
    document.querySelector("#continuePanelCheckoutBtn").addEventListener("click", renderCheckoutConfirm);
  }

  function renderMembershipRankSelection() {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    const selected = checkoutState.selected_rank || MEMBERSHIP_RANKS[0].rank;
    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">Membership Panel</span>
        <h2 id="checkoutTitle">Pilih Rank</h2>
        <p>Pilih rank dulu. QRIS baru dibuat setelah kamu menekan Setuju di halaman konfirmasi.</p>
      </div>
      <label class="checkout-label">Rank Membership
        <select id="membershipRankSelect">${MEMBERSHIP_RANKS.map(function (rank) { return `<option value="${escapeAttribute(rank.rank)}" ${rank.rank === selected ? "selected" : ""}>${escapeHTML(rank.label)} - ${escapeHTML(rank.price)}</option>`; }).join("")}</select>
      </label>
      <div id="selectedRankBenefit" class="checkout-benefit"></div>
      <div class="checkout-actions">
        <button class="btn btn-primary full" type="button" id="continueMembershipCheckoutBtn">Order</button>
        <button class="btn btn-outline full" type="button" data-checkout-close="true">Batal</button>
      </div>`;
    const select = document.querySelector("#membershipRankSelect");
    const update = function () {
      const rank = getRank(select.value);
      checkoutState.selected_rank = rank.rank;
      document.querySelector("#selectedRankBenefit").textContent = rank.benefit;
    };
    select.addEventListener("change", update);
    update();
    document.querySelector("#continueMembershipCheckoutBtn").addEventListener("click", renderCheckoutConfirm);
  }

  function renderCheckoutConfirm(errorMessage) {
    const content = document.querySelector("#checkoutContent");
    if (!content || !checkoutState) return;
    const summary = getCheckoutSummary();
    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">Konfirmasi Pembayaran</span>
        <h2 id="checkoutTitle">Setuju Buat QRIS?</h2>
        <p>QRIS belum dibuat. Tekan Setuju hanya kalau kamu jadi order.</p>
      </div>
      <div class="checkout-product-box"><span>Produk</span><strong>${escapeHTML(summary.name)}</strong></div>
      <div class="checkout-product-box"><span>Pilihan</span><strong>${escapeHTML(summary.optionLabel)}</strong></div>
      <div class="checkout-product-box"><span>Harga</span><strong>${escapeHTML(summary.price)}</strong></div>
      <div class="checkout-benefit">${escapeHTML(summary.benefit)}</div>
      ${errorMessage ? `<div class="checkout-alert error">${escapeHTML(errorMessage)}</div>` : ""}
      <div class="checkout-actions">
        <button class="btn btn-primary full" type="button" id="confirmCheckoutBtn">Setuju</button>
        <button class="btn btn-outline full" type="button" id="backCheckoutBtn">Kembali</button>
        <button class="btn btn-outline full" type="button" data-checkout-close="true">Batal</button>
      </div>`;
    document.querySelector("#confirmCheckoutBtn").addEventListener("click", createOrder);
    document.querySelector("#backCheckoutBtn").addEventListener("click", function () {
      if (checkoutState.product_type === "panel") renderPanelPlanSelection();
      else renderMembershipRankSelection();
    });
  }

  function getCheckoutSummary() {
    if (checkoutState.product_type === "panel") {
      const plan = getPlan(checkoutState.selected_plan);
      return { name: "Panel PTERODACTYL", optionLabel: plan.label, price: plan.price, amount: plan.amount, benefit: plan.benefit };
    }
    const rank = getRank(checkoutState.selected_rank);
    return { name: "Membership Panel", optionLabel: rank.label, price: rank.price, amount: rank.amount, benefit: rank.benefit };
  }

  async function createOrder() {
    const button = document.querySelector("#confirmCheckoutBtn");
    setButtonLoading(button, true, "Membuat QRIS...");
    try {
      trackAnalytics("checkout_confirm", {
        productType: checkoutState.product_type,
        selectedPlan: checkoutState.selected_plan || undefined,
        selectedRank: checkoutState.selected_rank || undefined
      });
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          product_type: checkoutState.product_type,
          selected_plan: checkoutState.product_type === "panel" ? checkoutState.selected_plan : undefined,
          selected_rank: checkoutState.product_type === "membership" ? checkoutState.selected_rank : undefined
        })
      });
      const result = await safeJson(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat QRIS.");

      checkoutState.order = {
        id: result.order_id,
        public_code: result.public_code,
        product_type: result.product && result.product.product_type,
        product_name: result.product && result.product.product_name,
        selected_plan: result.product && result.product.selected_plan,
        selected_rank: result.product && result.product.selected_rank,
        amount: result.product && result.product.amount,
        payment_status: "pending",
        fulfillment_status: "none",
        order_status: "pending_payment"
      };
      checkoutState.token = result.recovery_token;
      checkoutState.payment = result.payment;
      checkoutState.status = "pay";
      saveOrderHistory(result.order_id, result.recovery_token, checkoutState.order);
      updateOrderUrl(result.order_id, result.recovery_token);
      renderOrderHistory();
      renderPaymentStep();
      startPolling();
      trackAnalytics("payment_qris_shown", { productType: checkoutState.product_type, orderPublicCode: result.public_code });
    } catch (error) {
      renderCheckoutConfirm(error.message || "Gagal membuat QRIS.");
    } finally {
      setButtonLoading(button, false, "Setuju");
    }
  }

  function renderPaymentStep() {
    const content = document.querySelector("#checkoutContent");
    if (!content || !checkoutState) return;
    const order = checkoutState.order || {};
    const payment = checkoutState.payment || {};
    const qrisImage = normalizeQrisImage(payment.qris_image);
    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">QRIS Zakki</span>
        <h2 id="checkoutTitle">Bayar Sesuai Total</h2>
        <p>Gunakan total bayar dari Zakki karena bisa ada kode unik.</p>
      </div>
      <div class="checkout-product-box"><span>Kode Order</span><strong>${escapeHTML(order.public_code || "-")}</strong></div>
      <div class="checkout-product-box"><span>Produk</span><strong>${escapeHTML(order.product_name || "-")}</strong></div>
      <div class="payment-total"><span>Total Bayar</span><strong>${formatRupiah(payment.total_bayar || order.amount)}</strong></div>
      <div class="checkout-countdown" id="checkoutCountdown"></div>
      ${qrisImage ? `<div class="qris-box"><img src="${escapeAttribute(qrisImage)}" alt="QRIS ALIZZ STORE" /></div>` : `<div class="qris-box"><code>${escapeHTML(payment.qris_content || "QRIS image tidak tersedia. Hubungi admin.")}</code></div>`}
      <div class="checkout-actions">
        <button class="btn btn-primary full" type="button" id="checkPaymentBtn">Cek Status Pembayaran</button>
        <button class="btn btn-outline full" type="button" data-checkout-close="true">Tutup</button>
      </div>`;
    startCountdown(payment.expired_at);
    document.querySelector("#checkPaymentBtn").addEventListener("click", function () {
      fetchOrderStatus(order.id, checkoutState.token).then(applyStatusResult).catch(function (error) { showToast(error.message || "Gagal cek status."); });
    });
  }

  async function fetchOrderStatus(orderId, token) {
    const url = `/api/orders/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
    const result = await safeJson(response);
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil status order.");
    return result;
  }

  function applyStatusResult(result) {
    if (!result || !result.order) return;
    checkoutState.order = result.order;
    checkoutState.payment = result.payment || checkoutState.payment;
    checkoutState.product_type = result.order.product_type || checkoutState.product_type;
    checkoutState.selected_plan = result.order.selected_plan || checkoutState.selected_plan;
    checkoutState.selected_rank = result.order.selected_rank || checkoutState.selected_rank;
    saveOrderHistory(result.order.id, checkoutState.token, result.order);
    renderOrderHistory();

    if (result.next_step === "manual_required") return renderManualRequired(result);
    if (result.next_step === "pay") return renderPaymentStep();
    if (result.next_step === "membership_links") return renderMembershipLinks(result);
    if (result.next_step === "submit_credentials") return renderPanelCredentialForm(result);
    if (result.next_step === "fulfilled") return renderPanelAlreadyFulfilled(result);
  }

  function renderMembershipLinks(result) {
    stopPolling();
    const order = result.order || {};
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Payment Success</span>
        <h2 id="checkoutTitle">Link Grup Membership</h2>
        <p>Link hanya tampil untuk order dengan recovery token valid.</p>
      </div>
      <div class="checkout-product-box"><span>Kode Order</span><strong>${escapeHTML(order.public_code || "-")}</strong></div>
      <div class="checkout-product-box"><span>Rank</span><strong>${escapeHTML(order.selected_rank || "-")}</strong></div>
      <div class="checkout-link-list">
        <a class="btn btn-primary full" href="${escapeAttribute(result.membership_links.whatsapp)}" target="_blank" rel="noopener noreferrer">Masuk WhatsApp Group</a>
        <a class="btn btn-outline full" href="${escapeAttribute(result.membership_links.telegram)}" target="_blank" rel="noopener noreferrer">Masuk Telegram Group</a>
      </div>`;
    trackOnce("membership_links_shown", { orderPublicCode: order.public_code, productType: "membership" });
  }

  function renderPanelCredentialForm(result, errorMessage) {
    stopPolling();
    const order = result.order || {};
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Payment Success</span>
        <h2 id="checkoutTitle">Generate Panel</h2>
        <p>Masukkan username dan password panel. Password tidak disimpan di localStorage atau analytics.</p>
      </div>
      <div class="checkout-product-box"><span>Kode Order</span><strong>${escapeHTML(order.public_code || "-")}</strong></div>
      <div class="checkout-product-box"><span>Paket</span><strong>${escapeHTML(order.product_name || order.selected_plan || "-")}</strong></div>
      ${errorMessage ? `<div class="checkout-alert error">${escapeHTML(errorMessage)}</div>` : ""}
      <form class="checkout-form" id="panelCredentialsForm" autocomplete="off">
        <label class="checkout-label">Nama Panel / Username
          <input id="panelUsername" name="username" type="text" inputmode="latin" minlength="3" maxlength="32" pattern="[a-z0-9_]{3,32}" placeholder="contoh: alizz_panel" autocomplete="off" required />
        </label>
        <label class="checkout-label">Password Panel
          <input id="panelPassword" name="password" type="password" minlength="8" placeholder="Minimal 8 karakter" autocomplete="new-password" required />
        </label>
        <div class="checkout-alert warning">Simpan data akun ini. Data hanya dapat dibuka ulang dari riwayat pembelian di perangkat/browser ini selama token order masih tersedia.</div>
        <button class="btn btn-primary full" id="createPanelBtn" type="submit">Generate</button>
      </form>`;
    document.querySelector("#panelCredentialsForm").addEventListener("submit", submitPanelCredentials);
  }

  async function submitPanelCredentials(event) {
    event.preventDefault();
    if (!checkoutState || !checkoutState.order || !checkoutState.token) return;
    const username = document.querySelector("#panelUsername").value.trim().toLowerCase();
    const password = document.querySelector("#panelPassword").value;
    const button = document.querySelector("#createPanelBtn");

    if (!/^[a-z0-9_]{3,32}$/.test(username)) return showToast("Username hanya huruf kecil, angka, underscore, 3-32 karakter.");
    if (password.length < 8) return showToast("Password minimal 8 karakter.");

    setButtonLoading(button, true, "Membuat panel...");
    try {
      trackAnalytics("panel_credentials_submitted", { productType: "panel", orderPublicCode: checkoutState.order.public_code });
      const response = await fetch("/api/orders/submit-panel-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ order_id: checkoutState.order.id, recovery_token: checkoutState.token, username, password })
      });
      const result = await safeJson(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat panel.");
      renderPanelCreated(result);
      trackAnalytics("panel_created", { productType: "panel", orderPublicCode: result.order.public_code });
      saveOrderHistory(result.order.id, checkoutState.token, result.order);
      renderOrderHistory();
    } catch (error) {
      renderPanelCredentialForm({ order: checkoutState.order }, error.message || "Panel gagal dibuat. Hubungi admin.");
    } finally {
      setButtonLoading(button, false, "Generate");
    }
  }

  function renderPanelCreated(result) {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Panel Berhasil Dibuat</span>
        <h2 id="checkoutTitle">Data Login Panel</h2>
        <p>Simpan data akun ini. Data hanya dapat dibuka ulang dari riwayat pembelian di perangkat/browser ini selama token order masih tersedia.</p>
      </div>
      <div class="panel-result">
        <div><span>Domain Panel</span><strong>${escapeHTML(result.panel.domain || "Cek env PTERODACTYL_DOMAIN")}</strong></div>
        <div><span>Username</span><strong>${escapeHTML(result.panel.username || "-")}</strong></div>
        <div><span>Password</span><strong>${escapeHTML(result.panel.password || "Tidak tersedia")}</strong></div>
        <div><span>Paket</span><strong>${escapeHTML(result.panel.package || result.order.product_name || "-")}</strong></div>
      </div>
      <div class="checkout-alert warning">${escapeHTML(result.panel.warning || "Simpan data ini sekarang. Admin tidak bertanggung jawab jika data login hilang/dibagikan.")}</div>
      <button class="btn btn-outline full" type="button" data-checkout-close="true">Selesai</button>`;
  }

  function renderPanelAlreadyFulfilled(result) {
    stopPolling();
    const order = result.order || {};
    const panel = result.panel || {};
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Panel Sudah Dibuat</span>
        <h2 id="checkoutTitle">Data Akun Panel</h2>
        <p>Data ini hanya tampil karena recovery token valid.</p>
      </div>
      <div class="panel-result">
        <div><span>Kode Order</span><strong>${escapeHTML(order.public_code || "-")}</strong></div>
        <div><span>Domain Panel</span><strong>${escapeHTML(panel.domain || "Hubungi admin")}</strong></div>
        <div><span>Username</span><strong>${escapeHTML(panel.username || order.customer_username || "-")}</strong></div>
        <div><span>Password</span><strong>${escapeHTML(panel.password || "Tidak tersedia")}</strong></div>
        <div><span>Paket</span><strong>${escapeHTML(panel.package || order.product_name || "-")}</strong></div>
      </div>
      <div class="checkout-alert warning">${escapeHTML(panel.warning || "Jangan bagikan data akun panel kepada orang lain.")}</div>`;
  }

  function renderManualRequired(result) {
    stopPolling();
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    const code = result.order && result.order.public_code ? result.order.public_code : "order ini";
    const message = `Halo admin ALIZZ STORE, saya butuh bantuan untuk ${code}.`;
    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">Perlu Bantuan Admin</span>
        <h2 id="checkoutTitle">Order Perlu Diproses Manual</h2>
        <p>Sistem otomatis belum bisa melanjutkan order ini. Kirim kode order ke admin.</p>
      </div>
      <div class="checkout-product-box"><strong>${escapeHTML(code)}</strong><span>${escapeHTML((result.order && result.order.product_name) || "ALIZZ STORE")}</span></div>
      <a class="btn btn-primary full" href="https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Hubungi Admin WhatsApp</a>`;
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(function () {
      if (!checkoutState || !checkoutState.order || !checkoutState.token) return;
      fetchOrderStatus(checkoutState.order.id, checkoutState.token).then(applyStatusResult).catch(function () {});
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function startCountdown(expiredAt) {
    if (countdownTimer) window.clearInterval(countdownTimer);
    const node = document.querySelector("#checkoutCountdown");
    if (!node || !expiredAt) return;
    function update() {
      const diff = new Date(expiredAt).getTime() - Date.now();
      if (!Number.isFinite(diff) || diff <= 0) {
        node.textContent = "QRIS expired. Buat order baru atau hubungi admin.";
        node.classList.add("expired");
        if (countdownTimer) window.clearInterval(countdownTimer);
        return;
      }
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      node.textContent = `Expired dalam ${minutes}:${String(seconds).padStart(2, "0")}`;
    }
    update();
    countdownTimer = window.setInterval(update, 1000);
  }

  function recoverOrderFromUrlOrHistory() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = { order_id: params.get("order"), recovery_token: params.get("token") };
    const stored = readOrderHistory()[0];
    const candidate = fromUrl.order_id && fromUrl.recovery_token ? fromUrl : stored;
    if (!candidate || !candidate.order_id || !candidate.recovery_token) return;

    checkoutState = { product: {}, product_type: "", order: { id: candidate.order_id }, token: candidate.recovery_token, payment: null, status: "recovering" };
    showCheckout();
    renderRecoveringState();
    fetchOrderStatus(candidate.order_id, candidate.recovery_token)
      .then(function (result) { applyStatusResult(result); if (result.next_step === "pay") startPolling(); })
      .catch(function (error) { renderRecoveryError(error.message || "Order recovery gagal."); });
  }

  function renderRecoveringState() {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `<div class="checkout-head"><span class="eyebrow">Recovery Order</span><h2 id="checkoutTitle">Memulihkan Order</h2><p>Mengambil status order dari server...</p></div><div class="checkout-loading"></div>`;
  }

  function renderRecoveryError(message) {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `<div class="checkout-head"><span class="eyebrow">Recovery Gagal</span><h2 id="checkoutTitle">Order Tidak Bisa Dipulihkan</h2><p>${escapeHTML(message)}</p></div><button class="btn btn-outline full" type="button" data-checkout-close="true">Tutup</button>`;
  }

  function renderOrderHistory() {
    const list = document.querySelector("#orderHistoryList");
    if (!list) return;
    const history = readOrderHistory();
    if (!history.length) {
      list.innerHTML = `<div class="checkout-alert">Belum ada riwayat order di browser ini.</div>`;
      return;
    }
    list.innerHTML = history.map(function (item, index) {
      return `<article class="order-history-card">
        <div><strong>${escapeHTML(item.product_name || "Order ALIZZ STORE")}</strong><span>${escapeHTML(item.selected_plan || item.selected_rank || item.public_code || "-")}</span><small>${escapeHTML(formatDate(item.created_at))}</small></div>
        <button class="btn btn-outline btn-sm history-detail-btn" type="button" data-index="${index}">Lihat Detail</button>
      </article>`;
    }).join("");
    document.querySelectorAll(".history-detail-btn").forEach(function (button) {
      button.addEventListener("click", function () { openHistoryDetail(Number(button.dataset.index)); });
    });
  }

  function openHistoryDetail(index) {
    const item = readOrderHistory()[index];
    if (!item || !item.order_id || !item.recovery_token) return;
    checkoutState = { product: {}, product_type: "", order: { id: item.order_id }, token: item.recovery_token, payment: null, status: "recovering" };
    showCheckout();
    renderRecoveringState();
    fetchOrderStatus(item.order_id, item.recovery_token).then(applyStatusResult).catch(function (error) { renderRecoveryError(error.message || "Gagal buka detail riwayat."); });
  }

  function readOrderHistory() {
    try {
      const raw = localStorage.getItem(ORDER_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(function (item) { return item && item.order_id && item.recovery_token; }).slice(0, 30) : [];
    } catch (error) {
      return [];
    }
  }

  function saveOrderHistory(orderId, token, order) {
    if (!orderId || !token) return;
    try {
      const history = readOrderHistory().filter(function (item) { return item.order_id !== orderId; });
      const entry = {
        order_id: orderId,
        recovery_token: token,
        public_code: order && order.public_code,
        product_name: order && order.product_name,
        selected_plan: order && order.selected_plan,
        selected_rank: order && order.selected_rank,
        created_at: order && order.created_at ? order.created_at : new Date().toISOString()
      };
      history.unshift(entry);
      localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (error) {}
  }

  function migrateOldCurrentOrder() {
    try {
      const oldRaw = localStorage.getItem(OLD_CURRENT_ORDER_KEY);
      if (!oldRaw) return;
      const old = JSON.parse(oldRaw);
      if (old && old.order_id && old.recovery_token) {
        saveOrderHistory(old.order_id, old.recovery_token, { product_name: "Order ALIZZ STORE", created_at: old.created_at });
      }
      localStorage.removeItem(OLD_CURRENT_ORDER_KEY);
    } catch (error) {}
  }

  function updateOrderUrl(orderId, token) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("order", orderId);
      url.searchParams.set("token", token);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {}
  }

  function getPlan(id) {
    return PANEL_PLANS.find(function (plan) { return plan.id === id; }) || PANEL_PLANS[0];
  }

  function getRank(rankId) {
    return MEMBERSHIP_RANKS.find(function (rank) { return rank.rank === rankId; }) || MEMBERSHIP_RANKS[0];
  }

  function observeProductViews() {
    const cards = Array.from(document.querySelectorAll(".product-card[data-product-id]"));
    if (!cards.length) return;
    if (!("IntersectionObserver" in window)) {
      cards.slice(0, 8).forEach(function (card) { trackProductViewFromCard(card); });
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;
        trackProductViewFromCard(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: [0.45] });
    cards.forEach(function (card) {
      const id = card.dataset.productId;
      if (!id || viewedProductIds.has(id)) return;
      observer.observe(card);
    });
  }

  function trackProductViewFromCard(card) {
    if (!card || !card.dataset) return;
    const id = card.dataset.productId;
    if (!id || viewedProductIds.has(id)) return;
    viewedProductIds.add(id);
    trackAnalytics("product_view", { source: "catalog_card_visible", productId: id, productName: card.dataset.productName || "", productCategory: card.dataset.productCategory || "" });
  }

  const trackedOnce = new Set();
  function trackOnce(eventName, metadata) {
    const key = `${eventName}:${metadata && metadata.orderPublicCode ? metadata.orderPublicCode : ""}`;
    if (trackedOnce.has(key)) return;
    trackedOnce.add(key);
    trackAnalytics(eventName, metadata);
  }

  function trackAnalytics(eventName, metadata) {
    try {
      if (window.ALIZZ_ANALYTICS && typeof window.ALIZZ_ANALYTICS.track === "function") window.ALIZZ_ANALYTICS.track(eventName, metadata || {});
    } catch (error) {}
  }

  function normalizeQrisImage(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^data:image\//i.test(text) || /^https?:\/\//i.test(text)) return text;
    return `data:image/png;base64,${text}`;
  }

  function formatRupiah(value) {
    return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  }

  async function safeJson(response) {
    try { return await response.json(); } catch (error) { return {}; }
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = text;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.alizzToastTimer);
    window.alizzToastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  function setupYear() {
    const yearNow = document.querySelector("#yearNow");
    if (yearNow) yearNow.textContent = new Date().getFullYear();
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replace(/`/g, "&#096;");
  }

  function escapeHTML(value) {
    return window.ALIZZ_STORE.escapeHTML(value);
  }
})();
