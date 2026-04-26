(function () {
  let products = [];
  let activeCategory = "Semua";

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "produk") return;

    products = window.ALIZZ_STORE.getProducts();

    setupMobileMenu();
    setupContactButtons();
    setupCatalog();
    setupYear();
    renderCatalog();
  });

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
  }

  function setupContactButtons() {
    document.querySelectorAll(".js-chat-admin").forEach(function (button) {
      button.addEventListener("click", openGeneralWhatsApp);
    });

    document.querySelectorAll(".js-copy-dana").forEach(function (button) {
      button.addEventListener("click", async function () {
        await copyText(window.ALIZZ_STORE.DANA_NUMBER);
        showToast("Nomor DANA berhasil disalin.");
      });
    });
  }

  function setupCatalog() {
    const searchInput = document.querySelector("#searchInput");
    const filterTabs = document.querySelector("#filterTabs");

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

    if (renderedCount === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
    }

    bindOrderButtons();
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

    return `
      <article class="product-card ${soldout ? "soldout" : ""}">
        <div class="product-top">
          <span class="product-badge ${meta.badgeClass}">${escapeHTML(category)}</span>
          <span class="product-status ${soldout ? "soldout" : "available"}">
            ${soldout ? "Habis" : "Tersedia"}
          </span>
        </div>

        <h3>${escapeHTML(product.name)}</h3>
        <div class="price">${escapeHTML(product.price)}</div>
        <p class="product-desc">${escapeHTML(product.description)}</p>

        <ul class="benefit-list">
          ${benefits.map(function (benefit) {
            return `<li>${escapeHTML(benefit)}</li>`;
          }).join("")}
        </ul>

        <div class="product-meta">
          <span>Stok</span>
          <strong>${Number(product.stock) <= 0 ? "Habis" : escapeHTML(String(product.stock))}</strong>
        </div>

        <button
          class="btn ${soldout ? "btn-disabled" : meta.buttonClass} order-btn"
          data-id="${escapeHTML(product.id)}"
          ${soldout ? "disabled" : ""}
        >
          ${soldout ? "Stok Habis" : "Beli Sekarang"}
        </button>
      </article>
    `;
  }

  function bindOrderButtons() {
    document.querySelectorAll(".order-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const product = products.find(function (item) {
          return item.id === button.dataset.id;
        });

        if (!product || !window.ALIZZ_STORE.isAvailable(product)) return;

        const message = `Halo admin ALIZZ STORE, saya mau order ${product.name} dengan harga ${product.price}. Apakah masih tersedia?`;
        window.open(`https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
      });
    });
  }

  function openGeneralWhatsApp() {
    const message = "Halo admin ALIZZ STORE, saya mau order produk digital. Bisa dibantu?";
    window.open(`https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
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

  function setupYear() {
    const yearNow = document.querySelector("#yearNow");
    if (yearNow) yearNow.textContent = new Date().getFullYear();
  }

  function escapeHTML(value) {
    return window.ALIZZ_STORE.escapeHTML(value);
  }
})();
