(function () {
  let products = [];
  let activeCategory = "Semua";
  const viewedProductIds = new Set();
  const ORDER_STORAGE_KEY = "alizz_current_order";
  const POLL_MS = 7000;
  let checkoutState = null;
  let pollTimer = null;
  let countdownTimer = null;

  const MEMBERSHIP_RANKS = [
    { rank: "reseller", label: "Reseller", productId: "membership-reseller", benefit: "Bisa jual panel" },
    { rank: "adp", label: "ADP", productId: "membership-adp", benefit: "Bisa jual panel + open reseller" },
    { rank: "pt", label: "PT", productId: "membership-pt", benefit: "Bisa open reseller + ADP" },
    { rank: "tk", label: "TK", productId: "membership-tk", benefit: "Bisa open reseller + ADP + PT" },
    { rank: "ceo", label: "CEO", productId: "membership-ceo", benefit: "Bisa open semua rank di bawahnya" }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "produk") return;
    if (!window.ALIZZ_STORE || typeof window.ALIZZ_STORE.getProducts !== "function") return;

    products = window.ALIZZ_STORE.getProducts();
    setupCatalog();
    setupYear();
    ensureCheckoutModal();
    renderCatalog();
    recoverOrderFromUrlOrStorage();
  });

  function setupCatalog() {
    const searchInput = document.querySelector("#searchInput");
    const filterTabs = document.querySelector("#filterTabs");
    if (!searchInput || !filterTabs) return;

    searchInput.addEventListener("input", renderCatalog);

    filterTabs.addEventListener("click", function (event) {
      const button = event.target.closest(".filter-btn");
      if (!button) return;

      activeCategory = button.dataset.category;

      document.querySelectorAll(".filter-btn").forEach(function (btn) {
        btn.classList.remove("active");
      });

      button.classList.add("active");
      renderCatalog();
    });
  }

  function renderCatalog() {
    products = window.ALIZZ_STORE.getProducts();

    const container = document.querySelector("#categorySections");
    const emptyState = document.querySelector("#emptyState");
    const searchInput = document.querySelector("#searchInput");
    if (!container || !emptyState || !searchInput) return;
    const keyword = searchInput.value.trim().toLowerCase();
    const categories = activeCategory === "Semua" ? window.ALIZZ_STORE.CATEGORY_ORDER : [activeCategory];

    let html = "";
    let renderedCount = 0;

    categories.forEach(function (category) {
      const items = products.filter(function (product) {
        const normalized = window.ALIZZ_STORE.normalizeCategory(product.category);
        const searchable = [
          product.name,
          normalized,
          product.price,
          product.description,
          Array.isArray(product.benefits) ? product.benefits.join(" ") : ""
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
        <div class="products-grid">
          ${items.map(createProductCard).join("")}
        </div>
      </section>
    `;
  }

  function createProductCard(product) {
    const category = window.ALIZZ_STORE.normalizeCategory(product.category);
    const meta = window.ALIZZ_STORE.CATEGORY_META[category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;
    const soldout = !window.ALIZZ_STORE.isAvailable(product);
    const benefits = Array.isArray(product.benefits) ? product.benefits.slice(0, 5) : [];
    const ctaText = category === "Panel" || category === "Membership" ? "Checkout QRIS" : "Order via WhatsApp";

    return `
      <article class="product-card ${soldout ? "soldout" : ""}" data-product-id="${escapeHTML(product.id)}" data-product-name="${escapeHTML(product.name)}" data-product-category="${escapeHTML(category)}">
        <div class="product-top">
          <span class="product-badge ${meta.badgeClass}">${escapeHTML(category)}</span>
          <span class="product-status ${soldout ? "soldout" : "available"}">${soldout ? "Habis" : "Tersedia"}</span>
        </div>
        <h3>${escapeHTML(product.name)}</h3>
        <div class="price">${escapeHTML(product.price)}</div>
        <p class="product-desc">${escapeHTML(product.description)}</p>
        <ul class="benefit-list">
          ${benefits.map(function (benefit) { return `<li>${escapeHTML(benefit)}</li>`; }).join("")}
        </ul>
        <div class="product-meta"><span>Stok</span><strong>${Number(product.stock) <= 0 ? "Habis" : escapeHTML(String(product.stock))}</strong></div>
        <button class="btn ${soldout ? "btn-disabled" : meta.buttonClass} order-btn" data-id="${escapeHTML(product.id)}" ${soldout ? "disabled" : ""}>
          ${soldout ? "Stok Habis" : ctaText}
        </button>
      </article>
    `;
  }

  function bindOrderButtons() {
    document.querySelectorAll(".order-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const product = products.find(function (item) { return item.id === button.dataset.id; });
        if (!product || !window.ALIZZ_STORE.isAvailable(product)) return;
        const category = window.ALIZZ_STORE.normalizeCategory(product.category);

        if (category === "Panel" || category === "Membership") {
          openCheckout(product);
          return;
        }

        openManualOrder(product);
      });
    });
  }

  function openManualOrder(product) {
    const category = window.ALIZZ_STORE.normalizeCategory(product.category);
    trackAnalytics("manual_order_click", {
      source: "product_card",
      productId: product.id,
      productName: product.name,
      productCategory: category,
      productPrice: product.price
    });
    trackAnalytics("order_whatsapp_click", {
      source: "product_card",
      productId: product.id,
      productName: product.name,
      productCategory: category,
      productPrice: product.price
    });
    const message = `Halo admin ALIZZ STORE, saya mau order ${product.name} dengan harga ${product.price}. Apakah masih tersedia?`;
    window.open(`https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
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
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", function (event) {
      if (event.target && event.target.dataset && event.target.dataset.checkoutClose === "true") closeCheckout();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeCheckout();
    });
  }

  function openCheckout(product) {
    const category = window.ALIZZ_STORE.normalizeCategory(product.category);
    checkoutState = {
      product,
      category,
      order: null,
      token: null,
      payment: null,
      status: "confirm"
    };
    stopPolling();
    renderCheckoutConfirm();
    showCheckout();
    trackAnalytics("checkout_open", {
      source: "product_card",
      productId: product.id,
      productName: product.name,
      productCategory: category,
      productPrice: product.price
    });
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

  function getSelectedMembership(product) {
    const rankNode = document.querySelector("#membershipRankSelect");
    const rank = rankNode ? rankNode.value : product.id.replace("membership-", "");
    const option = MEMBERSHIP_RANKS.find(function (item) { return item.rank === rank; }) || MEMBERSHIP_RANKS[0];
    const selectedProduct = products.find(function (item) { return item.id === option.productId; }) || product;
    return { option, product: selectedProduct };
  }

  function renderCheckoutConfirm(errorMessage) {
    const content = document.querySelector("#checkoutContent");
    if (!content || !checkoutState) return;
    const product = checkoutState.product;
    const category = checkoutState.category;
    const membership = category === "Membership" ? getInitialMembership(product) : null;

    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">Checkout Aman</span>
        <h2 id="checkoutTitle">${category === "Membership" ? "Pilih Rank Membership" : "Konfirmasi Order Panel"}</h2>
        <p>Payment dibuat dari backend. Token/API key tidak pernah masuk ke browser.</p>
      </div>
      <div class="checkout-product-box">
        <strong id="checkoutProductName">${escapeHTML(product.name)}</strong>
        <span id="checkoutProductPrice">${escapeHTML(product.price)}</span>
      </div>
      ${category === "Membership" ? renderMembershipPicker(membership.option.rank) : ""}
      ${errorMessage ? `<div class="checkout-alert error">${escapeHTML(errorMessage)}</div>` : ""}
      <div class="checkout-actions">
        <button class="btn btn-primary" id="confirmCheckoutBtn" type="button">Confirm & Buat QRIS</button>
        <button class="btn btn-outline" type="button" data-checkout-close="true">Batal</button>
      </div>
    `;

    if (category === "Membership") bindMembershipPicker();
    const button = document.querySelector("#confirmCheckoutBtn");
    if (button) button.addEventListener("click", confirmCheckout);
  }

  function getInitialMembership(product) {
    const rank = product.id && product.id.startsWith("membership-") ? product.id.replace("membership-", "") : "reseller";
    const option = MEMBERSHIP_RANKS.find(function (item) { return item.rank === rank; }) || MEMBERSHIP_RANKS[0];
    return { option, product };
  }

  function renderMembershipPicker(selectedRank) {
    return `
      <label class="checkout-label">Pilih Rank
        <select id="membershipRankSelect">
          ${MEMBERSHIP_RANKS.map(function (item) {
            return `<option value="${escapeHTML(item.rank)}" ${item.rank === selectedRank ? "selected" : ""}>${escapeHTML(item.label)}</option>`;
          }).join("")}
        </select>
      </label>
      <div class="checkout-benefit" id="membershipBenefitText"></div>
    `;
  }

  function bindMembershipPicker() {
    const select = document.querySelector("#membershipRankSelect");
    const benefit = document.querySelector("#membershipBenefitText");
    const name = document.querySelector("#checkoutProductName");
    const price = document.querySelector("#checkoutProductPrice");

    function refresh() {
      if (!checkoutState) return;
      const selected = getSelectedMembership(checkoutState.product);
      checkoutState.product = selected.product;
      if (benefit) benefit.textContent = selected.option.benefit;
      if (name) name.textContent = selected.product.name;
      if (price) price.textContent = selected.product.price;
    }

    if (select) select.addEventListener("change", refresh);
    refresh();
  }

  async function confirmCheckout() {
    if (!checkoutState) return;
    const button = document.querySelector("#confirmCheckoutBtn");
    setButtonLoading(button, true, "Membuat QRIS...");
    const product = checkoutState.product;
    const selectedRank = checkoutState.category === "Membership" ? product.id.replace("membership-", "") : undefined;

    try {
      trackAnalytics("checkout_confirm", {
        productId: product.id,
        productName: product.name,
        productCategory: checkoutState.category
      });

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ product_id: product.id, selected_rank: selectedRank })
      });
      const result = await safeJson(response);

      if (result.manual_order && result.whatsapp_url) {
        window.open(result.whatsapp_url, "_blank");
        closeCheckout();
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal membuat QRIS. Coba lagi atau hubungi admin.");
      }

      checkoutState.order = {
        id: result.order_id,
        public_code: result.public_code,
        product_name: product.name,
        product_category: checkoutState.category
      };
      checkoutState.token = result.recovery_token;
      checkoutState.payment = result.payment;
      saveCurrentOrder(result.order_id, result.recovery_token);
      updateOrderUrl(result.order_id, result.recovery_token);
      renderPaymentState();
      startPolling();
      trackAnalytics("payment_qris_shown", {
        productId: product.id,
        productName: product.name,
        productCategory: checkoutState.category,
        orderPublicCode: result.public_code
      });
    } catch (error) {
      renderCheckoutConfirm(error.message || "Gagal membuat QRIS. Coba lagi.");
    } finally {
      setButtonLoading(button, false, "Confirm & Buat QRIS");
    }
  }

  function renderPaymentState(statusMessage) {
    const content = document.querySelector("#checkoutContent");
    if (!content || !checkoutState || !checkoutState.payment) return;
    const payment = checkoutState.payment;
    const expired = payment.expired_at && new Date(payment.expired_at).getTime() <= Date.now();

    content.innerHTML = `
      <div class="checkout-head">
        <span class="eyebrow">QRIS Zakki</span>
        <h2 id="checkoutTitle">Selesaikan Pembayaran</h2>
        <p>Scan QRIS dan bayar sesuai total bayar. Total bisa beda dari harga produk karena kode unik.</p>
      </div>
      <div class="checkout-product-box">
        <strong>${escapeHTML(checkoutState.order.public_code || "Order")}</strong>
        <span>${escapeHTML(checkoutState.order.product_name || checkoutState.product.name)}</span>
      </div>
      <div class="qris-box">
        ${payment.qris_image ? `<img src="${escapeAttribute(normalizeQrisImage(payment.qris_image))}" alt="QRIS pembayaran ALIZZ STORE" />` : `<code>${escapeHTML(payment.qris_content || "QRIS tidak tersedia")}</code>`}
      </div>
      <div class="payment-total"><span>Total Bayar</span><strong>${formatRupiah(payment.total_bayar)}</strong></div>
      <div class="checkout-countdown ${expired ? "expired" : ""}" id="checkoutCountdown">${expired ? "QRIS expired" : "Menghitung waktu expired..."}</div>
      ${statusMessage ? `<div class="checkout-alert">${escapeHTML(statusMessage)}</div>` : ""}
      <div class="checkout-actions">
        <button class="btn btn-primary" id="checkPaymentBtn" type="button">Cek Status Pembayaran</button>
        <button class="btn btn-outline" type="button" data-checkout-close="true">Tutup</button>
      </div>
      <p class="checkout-note">Order disimpan di perangkat ini untuk recovery. Password panel tidak akan disimpan.</p>
    `;

    const checkButton = document.querySelector("#checkPaymentBtn");
    if (checkButton) checkButton.addEventListener("click", checkOrderStatusNow);
    startCountdown(payment.expired_at);
  }

  async function checkOrderStatusNow() {
    if (!checkoutState || !checkoutState.order || !checkoutState.token) return;
    const button = document.querySelector("#checkPaymentBtn");
    setButtonLoading(button, true, "Mengecek...");
    try {
      const result = await fetchOrderStatus(checkoutState.order.id, checkoutState.token);
      applyStatusResult(result);
    } catch (error) {
      renderPaymentState(error.message || "Belum bisa cek status. Coba lagi.");
    } finally {
      setButtonLoading(button, false, "Cek Status Pembayaran");
    }
  }

  async function fetchOrderStatus(orderId, token) {
    const url = `/api/orders/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
    const result = await safeJson(response);
    if (!response.ok || !result.success) throw new Error(result.message || "Gagal mengambil status order.");
    return result;
  }

  function applyStatusResult(result) {
    if (!checkoutState) checkoutState = {};
    checkoutState.order = result.order || checkoutState.order;
    checkoutState.payment = result.payment || checkoutState.payment;

    if (result.next_step === "membership_links" && result.membership_links) {
      renderMembershipLinks(result);
      trackOnce("membership_links_shown", {
        productId: result.order.product_id,
        productName: result.order.product_name,
        productCategory: result.order.product_category,
        orderPublicCode: result.order.public_code
      });
      return;
    }

    if (result.next_step === "submit_credentials") {
      renderPanelCredentialForm(result);
      trackOnce("payment_paid", {
        productId: result.order.product_id,
        productName: result.order.product_name,
        productCategory: result.order.product_category,
        orderPublicCode: result.order.public_code
      });
      return;
    }

    if (result.next_step === "fulfilled") {
      renderPanelAlreadyFulfilled(result);
      return;
    }

    if (result.next_step === "manual_required") {
      renderManualRequired(result);
      return;
    }

    renderPaymentState("Pembayaran masih pending. Sistem akan cek otomatis beberapa detik lagi.");
  }

  function renderMembershipLinks(result) {
    stopPolling();
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Pembayaran Berhasil</span>
        <h2 id="checkoutTitle">Link Grup Membership</h2>
        <p>Silakan masuk grup membership sesuai instruksi admin.</p>
      </div>
      <div class="checkout-product-box"><strong>${escapeHTML(result.order.public_code)}</strong><span>${escapeHTML(result.order.product_name)}</span></div>
      <div class="checkout-link-list">
        <a class="btn btn-primary full" href="${escapeAttribute(result.membership_links.whatsapp)}" target="_blank" rel="noopener noreferrer">Masuk WhatsApp Group</a>
        <a class="btn btn-outline full" href="${escapeAttribute(result.membership_links.telegram)}" target="_blank" rel="noopener noreferrer">Masuk Telegram Group</a>
      </div>
      <p class="checkout-note">Simpan kode order ${escapeHTML(result.order.public_code)} untuk bantuan admin.</p>
    `;
  }

  function renderPanelCredentialForm(result, errorMessage) {
    stopPolling();
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Pembayaran Berhasil</span>
        <h2 id="checkoutTitle">Buat Panel Kamu</h2>
        <p>Masukkan username dan password panel. Password hanya ditampilkan sekali setelah server berhasil dibuat.</p>
      </div>
      <div class="checkout-product-box"><strong>${escapeHTML(result.order.public_code)}</strong><span>${escapeHTML(result.order.product_name)}</span></div>
      ${errorMessage ? `<div class="checkout-alert error">${escapeHTML(errorMessage)}</div>` : ""}
      <form id="panelCredentialForm" class="form-grid checkout-form">
        <label>Username Panel
          <input type="text" id="panelUsername" inputmode="latin" autocomplete="username" placeholder="contoh: alizz_user" pattern="[a-z0-9_]{3,32}" required />
        </label>
        <label>Password Panel
          <input type="password" id="panelPassword" autocomplete="new-password" minlength="8" placeholder="Minimal 8 karakter" required />
        </label>
        <button class="btn btn-primary full" id="createPanelBtn" type="submit">Create Panel</button>
      </form>
      <p class="checkout-note">Jangan gunakan password akun penting lain. Password tidak akan disimpan di database/localStorage.</p>
    `;
    const form = document.querySelector("#panelCredentialForm");
    if (form) form.addEventListener("submit", submitPanelCredentials);
  }

  async function submitPanelCredentials(event) {
    event.preventDefault();
    if (!checkoutState || !checkoutState.order || !checkoutState.token) return;
    const username = document.querySelector("#panelUsername").value.trim().toLowerCase();
    const password = document.querySelector("#panelPassword").value;
    const button = document.querySelector("#createPanelBtn");

    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      showToast("Username hanya huruf kecil, angka, underscore, 3-32 karakter.");
      return;
    }
    if (password.length < 8) {
      showToast("Password minimal 8 karakter.");
      return;
    }

    setButtonLoading(button, true, "Membuat panel...");
    try {
      trackAnalytics("panel_credentials_submitted", {
        productId: checkoutState.order.product_id,
        productName: checkoutState.order.product_name,
        orderPublicCode: checkoutState.order.public_code
      });
      const response = await fetch("/api/orders/submit-panel-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          order_id: checkoutState.order.id,
          recovery_token: checkoutState.token,
          username,
          password
        })
      });
      const result = await safeJson(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Gagal membuat panel.");
      renderPanelCreated(result);
      trackAnalytics("panel_created", {
        productId: result.order.product_id,
        productName: result.order.product_name,
        orderPublicCode: result.order.public_code
      });
    } catch (error) {
      renderPanelCredentialForm({ order: checkoutState.order }, error.message || "Panel gagal dibuat. Hubungi admin.");
    } finally {
      setButtonLoading(button, false, "Create Panel");
    }
  }

  function renderPanelCreated(result) {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Panel Berhasil Dibuat</span>
        <h2 id="checkoutTitle">Data Login Panel</h2>
        <p>Simpan data ini sekarang. Password tidak disimpan dan tidak bisa ditampilkan ulang.</p>
      </div>
      <div class="panel-result">
        <div><span>Domain Panel</span><strong>${escapeHTML(result.panel.domain || "Cek env PTERODACTYL_DOMAIN")}</strong></div>
        <div><span>Username</span><strong>${escapeHTML(result.panel.username || "-")}</strong></div>
        <div><span>Password</span><strong>${escapeHTML(result.panel.password || "Tidak tersedia")}</strong></div>
        <div><span>Paket</span><strong>${escapeHTML(result.panel.package || result.order.product_name || "-")}</strong></div>
      </div>
      <div class="checkout-alert warning">${escapeHTML(result.panel.warning || "Simpan data ini sekarang. Admin tidak bertanggung jawab jika data login hilang/dibagikan.")}</div>
      <button class="btn btn-outline full" type="button" data-checkout-close="true">Selesai</button>
    `;
  }

  function renderPanelAlreadyFulfilled(result) {
    stopPolling();
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head success">
        <span class="eyebrow">Panel Sudah Dibuat</span>
        <h2 id="checkoutTitle">Order Fulfilled</h2>
        <p>Password tidak disimpan, jadi tidak dapat ditampilkan ulang setelah refresh.</p>
      </div>
      <div class="panel-result">
        <div><span>Kode Order</span><strong>${escapeHTML(result.order.public_code)}</strong></div>
        <div><span>Domain Panel</span><strong>${escapeHTML((result.panel && result.panel.domain) || "Hubungi admin")}</strong></div>
        <div><span>Username</span><strong>${escapeHTML((result.panel && result.panel.username) || result.order.customer_username || "-")}</strong></div>
      </div>
      <div class="checkout-alert warning">Password tidak disimpan. Hubungi admin dengan kode order jika butuh bantuan.</div>
    `;
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
      <a class="btn btn-primary full" href="https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Hubungi Admin WhatsApp</a>
    `;
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(function () {
      if (!checkoutState || !checkoutState.order || !checkoutState.token) return;
      fetchOrderStatus(checkoutState.order.id, checkoutState.token)
        .then(applyStatusResult)
        .catch(function () {});
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

  function recoverOrderFromUrlOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = {
      order_id: params.get("order"),
      recovery_token: params.get("token")
    };
    const stored = readCurrentOrder();
    const candidate = fromUrl.order_id && fromUrl.recovery_token ? fromUrl : stored;
    if (!candidate || !candidate.order_id || !candidate.recovery_token) return;

    checkoutState = {
      product: {},
      category: "",
      order: { id: candidate.order_id },
      token: candidate.recovery_token,
      payment: null,
      status: "recovering"
    };
    showCheckout();
    renderRecoveringState();
    fetchOrderStatus(candidate.order_id, candidate.recovery_token)
      .then(function (result) {
        checkoutState.order = result.order;
        checkoutState.category = result.order.product_category;
        checkoutState.product = {
          id: result.order.product_id,
          name: result.order.product_name,
          category: result.order.product_category
        };
        checkoutState.payment = result.payment;
        applyStatusResult(result);
        if (result.next_step === "pay") startPolling();
      })
      .catch(function (error) {
        renderRecoveryError(error.message || "Order recovery gagal.");
      });
  }

  function renderRecoveringState() {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head"><span class="eyebrow">Recovery Order</span><h2 id="checkoutTitle">Memulihkan Order</h2><p>Mengambil status order dari server...</p></div>
      <div class="checkout-loading"></div>
    `;
  }

  function renderRecoveryError(message) {
    const content = document.querySelector("#checkoutContent");
    if (!content) return;
    content.innerHTML = `
      <div class="checkout-head"><span class="eyebrow">Recovery Gagal</span><h2 id="checkoutTitle">Order Tidak Bisa Dipulihkan</h2><p>${escapeHTML(message)}</p></div>
      <button class="btn btn-outline full" type="button" data-checkout-close="true">Tutup</button>
    `;
  }

  function saveCurrentOrder(orderId, token) {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({
        order_id: orderId,
        recovery_token: token,
        created_at: new Date().toISOString()
      }));
    } catch (error) {}
  }

  function readCurrentOrder() {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function updateOrderUrl(orderId, token) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("order", orderId);
      url.searchParams.set("token", token);
      window.history.replaceState({}, "", url.toString());
    } catch (error) {}
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

    trackAnalytics("product_view", {
      source: "catalog_card_visible",
      productId: id,
      productName: card.dataset.productName || "",
      productCategory: card.dataset.productCategory || ""
    });
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
      if (window.ALIZZ_ANALYTICS && typeof window.ALIZZ_ANALYTICS.track === "function") {
        window.ALIZZ_ANALYTICS.track(eventName, metadata || {});
      }
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
