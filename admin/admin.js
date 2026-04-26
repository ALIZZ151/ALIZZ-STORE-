(function () {
  const ADMIN_KEY = "EBPGK4q";
  const ADMIN_PASSWORD = "TELUR AYAM";
  const SESSION_KEY = "alizz_admin_logged_in";

  let products = [];

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

  function handleLogin(event) {
    event.preventDefault();

    const key = document.querySelector("#adminKey").value.trim();
    const password = document.querySelector("#adminPassword").value.trim();
    const error = document.querySelector("#loginError");

    if (key === ADMIN_KEY && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      error.textContent = "";
      document.querySelector("#loginForm").reset();
      renderAdminState();
      showToast("Login admin berhasil.");
    } else {
      error.textContent = "Key atau password salah.";
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    resetForm();
    renderAdminState();
    showToast("Admin berhasil logout.");
  }

  function renderAdminState() {
    const isLogin = sessionStorage.getItem(SESSION_KEY) === "true";
    const entryNav = document.querySelector("#adminEntryNav");

    if (typeof window.closeAdminMobileMenu === "function") {
      window.closeAdminMobileMenu();
    }

    if (isLogin) {
      entryNav.classList.add("hidden");
      document.querySelector("#adminLoginScreen").classList.add("hidden");
      document.querySelector("#adminDashboard").classList.remove("hidden");
      products = window.ALIZZ_STORE.getProducts();
      renderSummary();
      renderTable();
    } else {
      entryNav.classList.remove("hidden");
      document.querySelector("#adminLoginScreen").classList.remove("hidden");
      document.querySelector("#adminDashboard").classList.add("hidden");
    }
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
      product.benefits.length > 0 &&
      !Number.isNaN(Number(product.stock))
    );
  }

  function editProduct(id) {
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
    const confirmed = confirm("Reset produk ke data awal? Semua perubahan localStorage akan diganti.");
    if (!confirmed) return;

    products = window.ALIZZ_STORE.resetProducts();
    resetForm();
    renderSummary();
    renderTable();
    showToast("Data produk berhasil direset.");
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

  function escapeHTML(value) {
    return window.ALIZZ_STORE.escapeHTML(value);
  }
})();
