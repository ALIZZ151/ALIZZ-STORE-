(function () {
  const LOGIN_ERROR_MESSAGE = "Login gagal. Cek username atau password.";
  const LOCKOUT_ERROR_MESSAGE = "Terlalu banyak percobaan login. Coba lagi beberapa menit.";
  const RESET_CONFIRM_TEXT = "RESET ALIZZ";

  let products = [];
  let vouchers = [];
  let isAdminAuthenticated = false;
  let authCheckInProgress = false;

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "admin") return;

    products = window.ALIZZ_STORE.getProducts();

    setupMobileMenu();
    bindEvents();
    renderAdminState();
  });

  function bindEvents() {
    document.querySelector("#loginForm").addEventListener("submit", handleLogin);
    document.querySelector("#sidebarLogoutBtn").addEventListener("click", logout);
    document.querySelector("#topLogoutBtn").addEventListener("click", logout);
    document.querySelector("#productForm").addEventListener("submit", handleProductSubmit);
    document.querySelector("#resetFormBtn").addEventListener("click", resetForm);
    document.querySelector("#resetDataBtn").addEventListener("click", resetData);
    document.querySelector("#exportProductsBtn").addEventListener("click", exportProducts);
    document.querySelector("#importProductsBtn").addEventListener("click", function () {
      document.querySelector("#importProductsFile").click();
    });
    document.querySelector("#importProductsFile").addEventListener("change", importProducts);
  }

  function setupMobileMenu() {
    const hamburgerBtn = document.querySelector("#hamburgerBtn");
    const mobileMenu = document.querySelector("#mobileMenu");
    const mobileOverlay = document.querySelector("#mobileOverlay");
    const mobileCloseBtn = document.querySelector("#mobileCloseBtn");

    if (!hamburgerBtn || !mobileMenu || !mobileOverlay) return;

    function openMenu() {
      hamburgerBtn.classList.add("is-active");
      hamburgerBtn.setAttribute("aria-expanded", "true");
      mobileMenu.classList.add("is-open");
      mobileMenu.setAttribute("aria-hidden", "false");
      mobileOverlay.classList.add("is-open");
      document.body.classList.add("no-scroll");
    }

    function closeMenu() {
      hamburgerBtn.classList.remove("is-active");
      hamburgerBtn.setAttribute("aria-expanded", "false");
      mobileMenu.classList.remove("is-open");
      mobileMenu.setAttribute("aria-hidden", "true");
      mobileOverlay.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    }

    hamburgerBtn.addEventListener("click", function () {
      if (mobileMenu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    mobileOverlay.addEventListener("click", closeMenu);
    if (mobileCloseBtn) mobileCloseBtn.addEventListener("click", closeMenu);

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.closeAdminMobileMenu = closeMenu;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const username = document.querySelector("#adminUsername").value.trim();
    const password = document.querySelector("#adminPassword").value;
    const error = document.querySelector("#loginError");
    const submitButton = document.querySelector("#loginForm button[type='submit']");

    error.textContent = "";
    setButtonLoading(submitButton, true, "Memproses...");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password })
      });
      const result = await safeJson(response);

      if (!response.ok || !result.ok) {
        error.textContent = response.status === 429
          ? LOCKOUT_ERROR_MESSAGE
          : result.message || LOGIN_ERROR_MESSAGE;
        return;
      }

      document.querySelector("#loginForm").reset();
      showToast("Login admin berhasil.");
      await renderAdminState();
    } catch (errorObject) {
      error.textContent = "API login belum aktif. Jalankan lewat Vercel Dev atau deploy preview dengan env yang benar.";
    } finally {
      setButtonLoading(submitButton, false, "Login");
    }
  }

  async function logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin"
      });
    } catch (error) {}

    isAdminAuthenticated = false;
    resetForm();
    await renderAdminState();
    showToast("Admin berhasil logout.");
  }

  async function renderAdminState() {
    if (authCheckInProgress) return;
    authCheckInProgress = true;

    const entryNav = document.querySelector("#adminEntryNav");
    const loginScreen = document.querySelector("#adminLoginScreen");
    const dashboard = document.querySelector("#adminDashboard");
    const securityNote = document.querySelector("#securityNote");

    if (typeof window.closeAdminMobileMenu === "function") {
      window.closeAdminMobileMenu();
    }

    try {
      const response = await fetch("/api/me", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await safeJson(response);

      isAdminAuthenticated = Boolean(response.ok && result.authenticated);

      if (securityNote) {
        if (!result.configured) {
          securityNote.textContent = "Login admin belum aktif. Set environment variables admin di Vercel sebelum login.";
        } else {
          securityNote.textContent = "Login admin dicek lewat server-side API. Password tidak disimpan di frontend.";
        }
      }
    } catch (error) {
      isAdminAuthenticated = false;
      if (securityNote) {
        securityNote.textContent = "API admin belum aktif. Untuk test lokal gunakan npm run dev / npx vercel dev, bukan file static biasa.";
      }
    }

    if (isAdminAuthenticated) {
      entryNav.classList.add("hidden");
      loginScreen.classList.add("hidden");
      dashboard.classList.remove("hidden");
      products = window.ALIZZ_STORE.getProducts();
      injectPhase2AdminUI();
      renderSummary();
      renderTable();
      loadAnalyticsDashboard();
      loadVouchers();
    } else {
      entryNav.classList.remove("hidden");
      loginScreen.classList.remove("hidden");
      dashboard.classList.add("hidden");
    }

    authCheckInProgress = false;
  }

  function ensureAuthenticatedAction() {
    if (isAdminAuthenticated) return true;

    showToast("Session admin tidak valid. Silakan login ulang.");
    renderAdminState();
    return false;
  }

  function renderSummary() {
    const total = products.length;
    const available = products.filter(window.ALIZZ_STORE.isAvailable).length;
    const soldout = products.filter(function (product) {
      return !window.ALIZZ_STORE.isAvailable(product);
    }).length;
    const totalStock = products.reduce(function (sum, product) {
      return sum + Number(product.stock || 0);
    }, 0);

    document.querySelector("#summaryTotal").textContent = total;
    document.querySelector("#summaryAvailable").textContent = available;
    document.querySelector("#summarySoldout").textContent = soldout;
    document.querySelector("#summaryStock").textContent = totalStock;
  }

  function renderTable() {
    const tbody = document.querySelector("#productTableBody");

    tbody.innerHTML = products.map(function (product) {
      const available = window.ALIZZ_STORE.isAvailable(product);
      const statusText = available ? "Tersedia" : "Habis";
      const statusClass = available ? "available" : "soldout";

      return `
        <tr>
          <td data-label="Nama Produk">${escapeHTML(product.name)}</td>
          <td data-label="Kategori">${escapeHTML(window.ALIZZ_STORE.normalizeCategory(product.category))}</td>
          <td data-label="Harga">${escapeHTML(product.price)}</td>
          <td data-label="Stok">${escapeHTML(String(product.stock))}</td>
          <td data-label="Status">
            <span class="table-status ${statusClass}">${statusText}</span>
          </td>
          <td data-label="Aksi">
            <div class="table-actions">
              <button class="action-btn edit-btn" data-id="${escapeHTML(product.id)}">Edit</button>
              <button class="action-btn delete delete-btn" data-id="${escapeHTML(product.id)}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".edit-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        editProduct(button.dataset.id);
      });
    });

    document.querySelectorAll(".delete-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteProduct(button.dataset.id);
      });
    });
  }

  function injectPhase2AdminUI() {
    const adminContent = document.querySelector(".admin-content");
    const summaryGrid = document.querySelector(".summary-grid");
    if (!adminContent || !summaryGrid || document.querySelector("#statistik-admin")) return;

    summaryGrid.insertAdjacentHTML("afterend", [
      '<section class="admin-panel" id="statistik-admin">',
      '  <div class="panel-title">',
      '    <div><h2>Statistik Pengunjung</h2><p>Data dari Supabase analytics. Tidak menyimpan password, token, cookie, atau data sensitif.</p></div>',
      '    <button class="btn btn-outline btn-sm" id="refreshAnalyticsBtn" type="button">Refresh Statistik</button>',
      '  </div>',
      '  <section class="summary-grid" id="analyticsSummaryGrid">',
      '    <div class="summary-card"><span>Visitor Hari Ini</span><strong id="statVisitorsToday">0</strong></div>',
      '    <div class="summary-card"><span>Visitor Minggu Ini</span><strong id="statVisitorsWeek">0</strong></div>',
      '    <div class="summary-card"><span>Page View Hari Ini</span><strong id="statPageViewsToday">0</strong></div>',
      '    <div class="summary-card"><span>Klik WA Order</span><strong id="statWaClicks">0</strong></div>',
      '    <div class="summary-card"><span>Klik Telegram</span><strong id="statTelegramClicks">0</strong></div>',
      '    <div class="summary-card"><span>Klik WA Developer</span><strong id="statDevClicks">0</strong></div>',
      '    <div class="summary-card"><span>Klik Testimoni</span><strong id="statTestimonialClicks">0</strong></div>',
      '    <div class="summary-card"><span>Chatbot Dibuka</span><strong id="statChatbotOpen">0</strong></div>',
      '  </section>',
      '  <div class="admin-grid">',
      '    <div class="admin-panel"><div class="panel-title"><div><h2>Produk Paling Dilihat</h2><p>Top product_view dari katalog.</p></div></div><div class="table-wrap"><table><thead><tr><th>Produk</th><th>Total</th></tr></thead><tbody id="topViewedProductsBody"><tr><td colspan="2">Memuat...</td></tr></tbody></table></div></div>',
      '    <div class="admin-panel"><div class="panel-title"><div><h2>Tombol Beli Terbanyak</h2><p>Top order_whatsapp_click dari produk.</p></div></div><div class="table-wrap"><table><thead><tr><th>Produk</th><th>Total</th></tr></thead><tbody id="topOrderProductsBody"><tr><td colspan="2">Memuat...</td></tr></tbody></table></div></div>',
      '  </div>',
      '</section>',
      '<section class="admin-panel" id="voucher-admin">',
      '  <div class="panel-title"><div><h2>Voucher / Kode Promo</h2><p>Buat voucher percent/fixed. Validasi final tetap lewat API server-side.</p></div><button class="btn btn-outline btn-sm" id="refreshVouchersBtn" type="button">Refresh Voucher</button></div>',
      '  <section class="admin-grid">',
      '    <div class="admin-panel"><div class="panel-title"><div><h2 id="voucherFormTitle">Buat Voucher</h2><p>Contoh: ALIZZ10 percent 10%</p></div><button class="btn btn-ghost btn-sm" id="resetVoucherFormBtn" type="button">Reset</button></div>',
      '      <form id="voucherForm" class="form-grid">',
      '        <input type="hidden" id="voucherEditingCode" />',
      '        <label>Kode Voucher<input type="text" id="voucherCode" placeholder="ALIZZ10" required /></label>',
      '        <label>Tipe<select id="voucherType"><option value="percent">Percent</option><option value="fixed">Fixed / Nominal</option></select></label>',
      '        <label>Value<input type="number" id="voucherValue" min="1" placeholder="10" required /></label>',
      '        <label>Max Uses<input type="number" id="voucherMaxUses" min="0" placeholder="100" /></label>',
      '        <label>Min Order<input type="number" id="voucherMinOrder" min="0" placeholder="0" /></label>',
      '        <label>Scope<select id="voucherScope"><option value="all">Semua Produk</option><option value="category">Kategori</option><option value="product">Product ID</option></select></label>',
      '        <label>Scope Value<input type="text" id="voucherScopeValue" placeholder="Panel / product-id / kosongkan" /></label>',
      '        <label>Mulai<input type="datetime-local" id="voucherStartAt" /></label>',
      '        <label>Berakhir<input type="datetime-local" id="voucherEndAt" /></label>',
      '        <label>Status<select id="voucherIsActive"><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>',
      '        <button class="btn btn-primary full" id="saveVoucherBtn" type="submit">Simpan Voucher</button>',
      '      </form></div>',
      '    <div class="admin-panel"><div class="panel-title"><div><h2>Daftar Voucher</h2><p>Voucher aktif/nonaktif dari Supabase.</p></div></div><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Diskon</th><th>Limit</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="voucherTableBody"><tr><td colspan="5">Memuat...</td></tr></tbody></table></div></div>',
      '  </section>',
      '</section>'
    ].join(""));

    bindPhase2Events();
  }

  function bindPhase2Events() {
    const refreshAnalyticsBtn = document.querySelector("#refreshAnalyticsBtn");
    const refreshVouchersBtn = document.querySelector("#refreshVouchersBtn");
    const voucherForm = document.querySelector("#voucherForm");
    const resetVoucherFormBtn = document.querySelector("#resetVoucherFormBtn");

    if (refreshAnalyticsBtn && refreshAnalyticsBtn.dataset.bound !== "true") {
      refreshAnalyticsBtn.dataset.bound = "true";
      refreshAnalyticsBtn.addEventListener("click", loadAnalyticsDashboard);
    }
    if (refreshVouchersBtn && refreshVouchersBtn.dataset.bound !== "true") {
      refreshVouchersBtn.dataset.bound = "true";
      refreshVouchersBtn.addEventListener("click", loadVouchers);
    }
    if (voucherForm && voucherForm.dataset.bound !== "true") {
      voucherForm.dataset.bound = "true";
      voucherForm.addEventListener("submit", handleVoucherSubmit);
    }
    if (resetVoucherFormBtn && resetVoucherFormBtn.dataset.bound !== "true") {
      resetVoucherFormBtn.dataset.bound = "true";
      resetVoucherFormBtn.addEventListener("click", resetVoucherForm);
    }
  }

  async function loadAnalyticsDashboard() {
    if (!isAdminAuthenticated) return;
    try {
      const response = await fetch("/api/analytics/summary", { method: "GET", credentials: "same-origin", cache: "no-store" });
      const result = await safeJson(response);
      if (!response.ok || !result.ok) throw new Error(result.message || "Gagal memuat statistik.");
      renderAnalyticsDashboard(result);
    } catch (error) {
      renderAnalyticsError(error.message || "Gagal memuat statistik.");
    }
  }

  function renderAnalyticsDashboard(data) {
    const totals = data.totals || {};
    setText("#statVisitorsToday", totals.visitorsToday || 0);
    setText("#statVisitorsWeek", totals.visitorsWeek || 0);
    setText("#statPageViewsToday", totals.pageViewsToday || 0);
    setText("#statWaClicks", totals.whatsappOrderClicks || 0);
    setText("#statTelegramClicks", totals.telegramOrderClicks || 0);
    setText("#statDevClicks", totals.developerWhatsappClicks || 0);
    setText("#statTestimonialClicks", totals.testimonialChannelClicks || 0);
    setText("#statChatbotOpen", totals.chatbotOpen || 0);
    renderTopRows("#topViewedProductsBody", data.topProductsViewed || []);
    renderTopRows("#topOrderProductsBody", data.topOrderClicks || []);
  }

  function renderAnalyticsError(message) {
    renderTopRows("#topViewedProductsBody", [{ label: message, total: "-" }]);
    renderTopRows("#topOrderProductsBody", [{ label: message, total: "-" }]);
  }

  function renderTopRows(selector, rows) {
    const body = document.querySelector(selector);
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="2">Belum ada data.</td></tr>';
      return;
    }
    body.innerHTML = rows.slice(0, 10).map(function (item) {
      return '<tr><td data-label="Produk">' + escapeHTML(item.label || item.key || "Tidak diketahui") + '</td><td data-label="Total">' + escapeHTML(String(item.total || 0)) + '</td></tr>';
    }).join("");
  }

  async function loadVouchers() {
    if (!isAdminAuthenticated) return;
    const body = document.querySelector("#voucherTableBody");
    if (body) body.innerHTML = '<tr><td colspan="5">Memuat voucher...</td></tr>';
    try {
      const response = await fetch("/api/admin/vouchers?includeInactive=true", { method: "GET", credentials: "same-origin", cache: "no-store" });
      const result = await safeJson(response);
      if (!response.ok || !result.ok) throw new Error(result.message || "Gagal memuat voucher.");
      vouchers = Array.isArray(result.vouchers) ? result.vouchers : [];
      renderVoucherTable();
    } catch (error) {
      if (body) body.innerHTML = '<tr><td colspan="5">' + escapeHTML(error.message || "Gagal memuat voucher.") + '</td></tr>';
    }
  }

  function renderVoucherTable() {
    const body = document.querySelector("#voucherTableBody");
    if (!body) return;
    if (!vouchers.length) {
      body.innerHTML = '<tr><td colspan="5">Belum ada voucher.</td></tr>';
      return;
    }
    body.innerHTML = vouchers.map(function (voucher) {
      const active = Boolean(voucher.is_active);
      const limit = voucher.max_uses ? Number(voucher.used_count || 0) + "/" + Number(voucher.max_uses) : Number(voucher.used_count || 0) + "/∞";
      const discount = voucher.type === "percent" ? Number(voucher.value) + "%" : "Rp" + formatNumber(voucher.value);
      return [
        '<tr>',
        '<td data-label="Kode"><strong>' + escapeHTML(voucher.code) + '</strong><br><small>' + escapeHTML(voucher.product_scope || "all") + (voucher.scope_value ? ": " + escapeHTML(voucher.scope_value) : "") + '</small></td>',
        '<td data-label="Diskon">' + escapeHTML(discount) + '</td>',
        '<td data-label="Limit">' + escapeHTML(limit) + '</td>',
        '<td data-label="Status"><span class="table-status ' + (active ? "available" : "soldout") + '">' + (active ? "Aktif" : "Nonaktif") + '</span></td>',
        '<td data-label="Aksi"><div class="table-actions">',
        '<button class="action-btn edit-voucher-btn" data-code="' + escapeHTML(voucher.code) + '">Edit</button>',
        '<button class="action-btn delete toggle-voucher-btn" data-code="' + escapeHTML(voucher.code) + '">' + (active ? "Nonaktifkan" : "Aktifkan") + '</button>',
        '</div></td>',
        '</tr>'
      ].join("");
    }).join("");
    document.querySelectorAll(".edit-voucher-btn").forEach(function (button) {
      button.addEventListener("click", function () { editVoucher(button.dataset.code); });
    });
    document.querySelectorAll(".toggle-voucher-btn").forEach(function (button) {
      button.addEventListener("click", function () { toggleVoucher(button.dataset.code); });
    });
  }

  async function handleVoucherSubmit(event) {
    event.preventDefault();
    if (!ensureAuthenticatedAction()) return;
    const editingCode = document.querySelector("#voucherEditingCode").value.trim().toUpperCase();
    const code = document.querySelector("#voucherCode").value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const payload = {
      code,
      type: document.querySelector("#voucherType").value,
      value: Number(document.querySelector("#voucherValue").value),
      max_uses: Number(document.querySelector("#voucherMaxUses").value || 0) || null,
      min_order: Number(document.querySelector("#voucherMinOrder").value || 0) || 0,
      product_scope: document.querySelector("#voucherScope").value,
      scope_value: document.querySelector("#voucherScopeValue").value.trim() || null,
      start_at: dateTimeLocalToIso(document.querySelector("#voucherStartAt").value) || new Date().toISOString(),
      end_at: dateTimeLocalToIso(document.querySelector("#voucherEndAt").value),
      is_active: document.querySelector("#voucherIsActive").value === "true"
    };
    if (!payload.code || payload.code.length < 3 || !payload.value || payload.value <= 0) {
      showToast("Kode dan value voucher wajib valid.");
      return;
    }
    const button = document.querySelector("#saveVoucherBtn");
    setButtonLoading(button, true, "Menyimpan...");
    try {
      const response = await fetch("/api/admin/vouchers", {
        method: editingCode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const result = await safeJson(response);
      if (!response.ok || !result.ok) throw new Error(result.message || "Gagal menyimpan voucher.");
      showToast(editingCode ? "Voucher berhasil diupdate." : "Voucher berhasil dibuat.");
      resetVoucherForm();
      await loadVouchers();
    } catch (error) {
      showToast(error.message || "Gagal menyimpan voucher.");
    } finally {
      setButtonLoading(button, false, "Simpan Voucher");
    }
  }

  function editVoucher(code) {
    const voucher = vouchers.find(function (item) { return item.code === code; });
    if (!voucher) return;
    document.querySelector("#voucherEditingCode").value = voucher.code;
    document.querySelector("#voucherCode").value = voucher.code;
    document.querySelector("#voucherCode").disabled = true;
    document.querySelector("#voucherType").value = voucher.type || "percent";
    document.querySelector("#voucherValue").value = Number(voucher.value || 0);
    document.querySelector("#voucherMaxUses").value = voucher.max_uses || "";
    document.querySelector("#voucherMinOrder").value = Number(voucher.min_order || 0);
    document.querySelector("#voucherScope").value = voucher.product_scope || "all";
    document.querySelector("#voucherScopeValue").value = voucher.scope_value || "";
    document.querySelector("#voucherStartAt").value = isoToDateTimeLocal(voucher.start_at);
    document.querySelector("#voucherEndAt").value = isoToDateTimeLocal(voucher.end_at);
    document.querySelector("#voucherIsActive").value = voucher.is_active ? "true" : "false";
    document.querySelector("#voucherFormTitle").textContent = "Edit Voucher";
    document.querySelector("#saveVoucherBtn").textContent = "Simpan Perubahan";
    document.querySelector("#voucherForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function toggleVoucher(code) {
    const voucher = vouchers.find(function (item) { return item.code === code; });
    if (!voucher) return;
    const nextActive = !voucher.is_active;
    const ok = confirm((nextActive ? "Aktifkan" : "Nonaktifkan") + " voucher " + voucher.code + "?");
    if (!ok) return;
    try {
      const response = await fetch("/api/admin/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: voucher.code, is_active: nextActive })
      });
      const result = await safeJson(response);
      if (!response.ok || !result.ok) throw new Error(result.message || "Gagal update voucher.");
      showToast("Status voucher berhasil diubah.");
      await loadVouchers();
    } catch (error) {
      showToast(error.message || "Gagal update voucher.");
    }
  }

  function resetVoucherForm() {
    const form = document.querySelector("#voucherForm");
    if (!form) return;
    form.reset();
    document.querySelector("#voucherEditingCode").value = "";
    document.querySelector("#voucherCode").disabled = false;
    document.querySelector("#voucherType").value = "percent";
    document.querySelector("#voucherScope").value = "all";
    document.querySelector("#voucherIsActive").value = "true";
    document.querySelector("#voucherFormTitle").textContent = "Buat Voucher";
    document.querySelector("#saveVoucherBtn").textContent = "Simpan Voucher";
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = String(value);
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(value || 0));
    } catch (error) {
      return String(value || 0);
    }
  }

  function dateTimeLocalToIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function isoToDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function handleProductSubmit(event) {
    event.preventDefault();
    if (!ensureAuthenticatedAction()) return;

    const existingId = document.querySelector("#productId").value.trim();
    const stock = Number(document.querySelector("#productStock").value);
    const selectedStatus = document.querySelector("#productStatus").value;

    const payload = {
      id: existingId || createProductId(document.querySelector("#productName").value),
      name: document.querySelector("#productName").value.trim(),
      category: window.ALIZZ_STORE.normalizeCategory(document.querySelector("#productCategory").value),
      price: document.querySelector("#productPrice").value.trim(),
      stock: Number.isNaN(stock) ? 0 : stock,
      description: document.querySelector("#productDescription").value.trim(),
      benefits: document.querySelector("#productBenefits").value
        .split("\n")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean),
      status: stock <= 0 ? "soldout" : selectedStatus
    };

    if (!validateProduct(payload)) {
      showToast("Lengkapi semua data produk dulu.");
      return;
    }

    if (existingId) {
      products = products.map(function (product) {
        return product.id === existingId ? payload : product;
      });

      showToast("Produk berhasil diedit.");
    } else {
      payload.id = createUniqueId(payload.id);
      products.push(payload);
      showToast("Produk baru berhasil ditambahkan.");
    }

    window.ALIZZ_STORE.saveProducts(products);
    resetForm();
    renderSummary();
    renderTable();
  }

  function validateProduct(product) {
    return (
      product.name &&
      product.category &&
      product.price &&
      product.description &&
      Array.isArray(product.benefits) &&
      product.benefits.length > 0 &&
      !Number.isNaN(Number(product.stock))
    );
  }

  function validateProductsImport(data) {
    return Array.isArray(data) && data.every(function (product) {
      return validateProduct({
        id: product.id,
        name: product.name,
        category: window.ALIZZ_STORE.normalizeCategory(product.category),
        price: product.price,
        stock: Number(product.stock),
        description: product.description,
        benefits: product.benefits,
        status: product.status
      });
    });
  }

  function editProduct(id) {
    if (!ensureAuthenticatedAction()) return;

    const product = products.find(function (item) {
      return item.id === id;
    });

    if (!product) return;

    document.querySelector("#productId").value = product.id;
    document.querySelector("#productName").value = product.name;
    document.querySelector("#productCategory").value = window.ALIZZ_STORE.normalizeCategory(product.category);
    document.querySelector("#productPrice").value = product.price;
    document.querySelector("#productStock").value = product.stock;
    document.querySelector("#productDescription").value = product.description;
    document.querySelector("#productBenefits").value = Array.isArray(product.benefits) ? product.benefits.join("\n") : "";
    document.querySelector("#productStatus").value = product.status;

    document.querySelector("#formTitle").textContent = "Edit Produk";
    document.querySelector("#saveProductBtn").textContent = "Simpan Perubahan";

    document.querySelector("#productForm").scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function deleteProduct(id) {
    if (!ensureAuthenticatedAction()) return;

    const product = products.find(function (item) {
      return item.id === id;
    });

    if (!product) return;

    const confirmed = confirm(`Hapus produk "${product.name}"?`);
    if (!confirmed) return;

    products = products.filter(function (item) {
      return item.id !== id;
    });

    window.ALIZZ_STORE.saveProducts(products);
    resetForm();
    renderSummary();
    renderTable();
    showToast("Produk berhasil dihapus.");
  }

  function resetForm() {
    document.querySelector("#productForm").reset();
    document.querySelector("#productId").value = "";
    document.querySelector("#productCategory").value = "Panel";
    document.querySelector("#productStock").value = 1;
    document.querySelector("#productStatus").value = "available";
    document.querySelector("#formTitle").textContent = "Tambah Produk";
    document.querySelector("#saveProductBtn").textContent = "Simpan Produk";
  }

  function resetData() {
    if (!ensureAuthenticatedAction()) return;

    const typed = prompt(`Reset produk ke data awal? Ketik ${RESET_CONFIRM_TEXT} untuk lanjut.`);
    if (typed !== RESET_CONFIRM_TEXT) {
      showToast("Reset data dibatalkan.");
      return;
    }

    products = window.ALIZZ_STORE.resetProducts();
    resetForm();
    renderSummary();
    renderTable();
    showToast("Data produk berhasil direset.");
  }

  function exportProducts() {
    if (!ensureAuthenticatedAction()) return;

    const json = JSON.stringify(products, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "backup-produk-alizz.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Export produk JSON berhasil dibuat.");
  }

  async function importProducts(event) {
    if (!ensureAuthenticatedAction()) return;

    const fileInput = event.target;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!validateProductsImport(parsed)) {
        showToast("File JSON produk tidak valid.");
        return;
      }

      const confirmed = confirm("Import akan mengganti produk di browser ini. Pastikan sudah export backup. Lanjutkan?");
      if (!confirmed) return;

      products = parsed.map(function (product) {
        const stock = Number(product.stock);
        return {
          id: String(product.id || createProductId(product.name)),
          name: String(product.name || "").trim(),
          category: window.ALIZZ_STORE.normalizeCategory(product.category),
          price: String(product.price || "").trim(),
          stock: Number.isNaN(stock) ? 0 : stock,
          description: String(product.description || "").trim(),
          benefits: Array.isArray(product.benefits) ? product.benefits.map(String).filter(Boolean) : [],
          status: product.status === "soldout" || stock <= 0 ? "soldout" : "available"
        };
      });

      window.ALIZZ_STORE.saveProducts(products);
      resetForm();
      renderSummary();
      renderTable();
      showToast("Import produk JSON berhasil.");
    } catch (error) {
      showToast("Gagal membaca file JSON produk.");
    } finally {
      fileInput.value = "";
    }
  }

  function createProductId(name) {
    const id = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    return id || `produk-${Date.now()}`;
  }

  function createUniqueId(baseId) {
    let uniqueId = baseId;
    let counter = 1;

    while (products.some(function (product) {
      return product.id === uniqueId;
    })) {
      uniqueId = `${baseId}-${counter}`;
      counter++;
    }

    return uniqueId;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.alizzToastTimer);
    window.alizzToastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = text;
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function escapeHTML(value) {
    return window.ALIZZ_STORE.escapeHTML(value);
  }
})();
