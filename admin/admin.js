(function () {
  const LOGIN_ERROR_MESSAGE = "Login gagal. Cek username atau password.";
  const LOCKOUT_ERROR_MESSAGE = "Terlalu banyak percobaan login. Coba lagi beberapa menit.";
  const RESET_CONFIRM_TEXT = "RESET ALIZZ";

  let products = [];
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
      renderSummary();
      renderTable();
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
