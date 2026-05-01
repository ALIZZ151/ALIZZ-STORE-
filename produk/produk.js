(function () {
  let products = [];
  let activeCategory = "Semua";
  const viewedProductIds = new Set();

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "produk") return;
    if (!window.ALIZZ_STORE || typeof window.ALIZZ_STORE.getProducts !== "function") return;

    products = window.ALIZZ_STORE.getProducts();
    setupCatalog();
    setupYear();
    renderCatalog();
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

    if (renderedCount === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
    }

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

    return `
      <article class="product-card ${soldout ? "soldout" : ""}" data-product-id="${escapeHTML(product.id)}" data-product-name="${escapeHTML(product.name)}" data-product-category="${escapeHTML(category)}">
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

        trackAnalytics("order_whatsapp_click", {
          source: "product_card",
          productId: product.id,
          productName: product.name,
          productCategory: window.ALIZZ_STORE.normalizeCategory(product.category),
          productPrice: product.price
        });

        const message = `Halo admin ALIZZ STORE, saya mau order ${product.name} dengan harga ${product.price}. Apakah masih tersedia?`;
        window.open(`https://wa.me/${window.ALIZZ_STORE.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
      });
    });
  }

  function observeProductViews() {
    const cards = Array.from(document.querySelectorAll(".product-card[data-product-id]"));
    if (!cards.length) return;

    if (!("IntersectionObserver" in window)) {
      cards.slice(0, 8).forEach(function (card) {
        trackProductViewFromCard(card);
      });
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

  function trackAnalytics(eventName, metadata) {
    try {
      if (window.ALIZZ_ANALYTICS && typeof window.ALIZZ_ANALYTICS.track === "function") {
        window.ALIZZ_ANALYTICS.track(eventName, metadata || {});
      }
    } catch (error) {}
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
