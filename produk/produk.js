(function () {
  "use strict";

  let products = [];
  let groups = [];
  let activeCategory = "Semua";
  const viewedGroupIds = new Set();
  const viewedProductIds = new Set();

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.dataset.page !== "produk") return;
    if (!window.ALIZZ_STORE || typeof window.ALIZZ_STORE.getProducts !== "function") return;

    products = window.ALIZZ_STORE.getProducts();
    groups = buildProductGroups(products);
    setupCatalog();
    setupYear();
    routeCatalog();

    window.addEventListener("popstate", routeCatalog);
  });

  function setupCatalog() {
    const searchInput = document.querySelector("#searchInput");
    const filterTabs = document.querySelector("#filterTabs");
    if (!searchInput || !filterTabs) return;

    searchInput.addEventListener("input", function () {
      clearDetailRoute(false);
      renderCatalog();
    });

    filterTabs.addEventListener("click", function (event) {
      const button = event.target.closest(".filter-btn");
      if (!button) return;

      activeCategory = button.dataset.category || "Semua";

      document.querySelectorAll(".filter-btn").forEach(function (btn) {
        btn.classList.toggle("active", btn === button);
      });

      clearDetailRoute(false);
      renderCatalog();
    });
  }

  function routeCatalog() {
    products = window.ALIZZ_STORE.getProducts();
    groups = buildProductGroups(products);

    const params = new URLSearchParams(window.location.search);
    const groupId = params.get("group");
    const variantId = params.get("variant");

    if (groupId) {
      renderDetail(groupId, variantId);
      return;
    }

    renderCatalog();
  }

  function renderCatalog() {
    setCheckoutActive(false);
    products = window.ALIZZ_STORE.getProducts();
    groups = buildProductGroups(products);

    const container = document.querySelector("#categorySections");
    const emptyState = document.querySelector("#emptyState");
    const searchInput = document.querySelector("#searchInput");
    if (!container || !emptyState || !searchInput) return;

    const keyword = searchInput.value.trim().toLowerCase();
    const categories = activeCategory === "Semua" ? window.ALIZZ_STORE.CATEGORY_ORDER : [activeCategory];

    let html = "";
    let renderedCount = 0;

    categories.forEach(function (category) {
      const items = groups.filter(function (group) {
        if (group.category !== category) return false;
        return getGroupSearchText(group).includes(keyword);
      });

      if (items.length === 0) return;

      renderedCount += items.length;
      html += createCategorySection(category, items);
    });

    container.innerHTML = html;

    if (renderedCount === 0) emptyState.classList.remove("hidden");
    else emptyState.classList.add("hidden");

    bindCatalogButtons();
    observeGroupViews();
  }

  function renderDetail(groupId, variantId) {
    setCheckoutActive(false);

    const container = document.querySelector("#categorySections");
    const emptyState = document.querySelector("#emptyState");
    if (!container) return;
    if (emptyState) emptyState.classList.add("hidden");

    const group = groups.find(function (item) { return item.id === groupId; });
    if (!group) {
      clearDetailRoute(true);
      return;
    }

    const selected = variantId
      ? group.variants.find(function (item) { return item.id === variantId; }) || null
      : null;

    container.innerHTML = createDetailView(group, selected);
    bindDetailButtons(group, selected);
    if (selected) observeProductViews();
  }

  function createCategorySection(category, items) {
    const meta = window.ALIZZ_STORE.CATEGORY_META[category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;

    return `
      <section class="product-category-section reveal">
        <div class="category-head">
          <div>
            <span class="category-kicker">${escapeHTML(meta.kicker)}</span>
            <h2>${escapeHTML(meta.title)}</h2>
            <p>${escapeHTML(meta.description)}</p>
          </div>
          <span class="category-count">${items.length} paket</span>
        </div>
        <div class="products-grid product-group-grid">
          ${items.map(createGroupCard).join("")}
        </div>
      </section>
    `;
  }

  function createGroupCard(group) {
    const meta = window.ALIZZ_STORE.CATEGORY_META[group.category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;
    const availableCount = group.variants.filter(window.ALIZZ_STORE.isAvailable).length;
    const soldout = availableCount === 0;
    const highlightBenefits = group.benefits.slice(0, 4);
    const stockTotal = group.variants.reduce(function (sum, product) {
      return sum + Number(product.stock || 0);
    }, 0);

    return `
      <article class="product-card product-group-card ${soldout ? "soldout" : ""}" data-group-id="${escapeHTML(group.id)}" data-product-category="${escapeHTML(group.category)}" data-product-name="${escapeHTML(group.title)}">
        <div class="product-top">
          <span class="product-badge ${meta.badgeClass}">${escapeHTML(group.category)}</span>
          <span class="product-status ${soldout ? "soldout" : "available"}">${soldout ? "Habis" : availableCount + " varian ready"}</span>
        </div>

        <h3>${escapeHTML(group.title)}</h3>
        <div class="price">${escapeHTML(getGroupPriceLabel(group))}</div>
        <p class="product-desc">${escapeHTML(group.description)}</p>

        <div class="variant-preview" aria-label="Preview varian ${escapeHTML(group.title)}">
          ${group.variants.slice(0, 6).map(function (variant) {
            return `<span>${escapeHTML(getVariantLabel(group, variant))}</span>`;
          }).join("")}
          ${group.variants.length > 6 ? `<span>+${group.variants.length - 6}</span>` : ""}
        </div>

        <ul class="benefit-list compact">
          ${highlightBenefits.map(function (benefit) {
            return `<li>${escapeHTML(benefit)}</li>`;
          }).join("")}
        </ul>

        <div class="product-meta">
          <span>Total Stok</span>
          <strong>${stockTotal <= 0 ? "Habis" : escapeHTML(String(stockTotal))}</strong>
        </div>

        <button class="btn ${soldout ? "btn-disabled" : meta.buttonClass} view-group-btn" data-group-id="${escapeHTML(group.id)}" ${soldout ? "disabled" : ""}>
          ${soldout ? "Stok Habis" : "Lihat Paket"}
        </button>
      </article>
    `;
  }

  function createDetailView(group, selected) {
    const meta = window.ALIZZ_STORE.CATEGORY_META[group.category] || window.ALIZZ_STORE.CATEGORY_META.Lainnya;
    const hasSelected = Boolean(selected);
    const soldout = hasSelected ? !window.ALIZZ_STORE.isAvailable(selected) : false;
    const variantLabel = hasSelected ? getVariantLabel(group, selected) : "";
    const message = hasSelected ? createOrderMessage(group, selected) : "";
    const whatsappUrl = hasSelected ? createWhatsAppUrl(window.ALIZZ_STORE.WHATSAPP_NUMBER, message) : "#";
    const telegramUrl = "https://t.me/" + window.ALIZZ_STORE.TELEGRAM_USERNAME;
    const helperText = getVariantHelperText(group);

    return `
      <section class="product-detail-shell reveal" id="productDetail" data-group-id="${escapeHTML(group.id)}" ${hasSelected ? `data-product-id="${escapeHTML(selected.id)}" data-product-name="${escapeHTML(selected.name)}" data-product-category="${escapeHTML(group.category)}"` : ""}>
        <div class="detail-toolbar">
          <button class="btn btn-outline btn-sm back-to-catalog-btn" type="button">← Kembali ke Produk</button>
          <span class="product-badge ${meta.badgeClass}">${escapeHTML(group.category)}</span>
        </div>

        <div class="detail-grid">
          <article class="detail-main-card">
            <span class="eyebrow">Detail Paket</span>
            <h2>${escapeHTML(group.title)}</h2>
            <p>${escapeHTML(group.description)}</p>

            <div class="variant-intro">
              <strong>${escapeHTML(helperText)}</strong>
              <span>Pilih salah satu varian. Harga, stok, benefit, dan tombol order baru muncul setelah varian dipilih.</span>
            </div>

            <div class="variant-selector" aria-label="Pilih varian produk">
              ${group.variants.map(function (variant) {
                const isSelected = hasSelected && variant.id === selected.id;
                const isSoldout = !window.ALIZZ_STORE.isAvailable(variant);
                return `<button type="button" class="variant-option ${isSelected ? "active" : ""}" data-variant-id="${escapeHTML(variant.id)}" ${isSoldout ? "disabled aria-disabled=\"true\"" : ""}>${escapeHTML(getVariantLabel(group, variant))}</button>`;
              }).join("")}
            </div>

            ${hasSelected ? `
              <div class="selected-product-card ${soldout ? "soldout" : ""}">
                <div>
                  <span>Varian Dipilih</span>
                  <h3>${escapeHTML(variantLabel)}</h3>
                </div>
                <strong>${escapeHTML(selected.price)}</strong>
              </div>

              <div class="detail-facts">
                <div><span>Stok</span><strong>${Number(selected.stock) <= 0 ? "Habis" : escapeHTML(String(selected.stock))}</strong></div>
                <div><span>Status</span><strong>${soldout ? "Habis" : "Tersedia"}</strong></div>
                <div><span>Order</span><strong>Manual Admin</strong></div>
              </div>

              <p class="product-desc detail-desc">${escapeHTML(selected.description)}</p>

              <ul class="benefit-list detail-benefits">
                ${(Array.isArray(selected.benefits) ? selected.benefits : []).map(function (benefit) {
                  return `<li>${escapeHTML(benefit)}</li>`;
                }).join("")}
              </ul>

              <div class="detail-actions">
                <button class="btn ${soldout ? "btn-disabled" : meta.buttonClass} continue-order-btn" type="button" ${soldout ? "disabled" : ""}>Lanjut Order</button>
                <button class="btn btn-outline js-copy-dana-detail" type="button">Salin Nomor DANA</button>
              </div>
            ` : `
              <div class="variant-required-card" role="status">
                <strong>${escapeHTML(getVariantEmptyTitle(group))}</strong>
                <p>Belum ada varian yang dipilih, jadi harga dan checkout belum ditampilkan.</p>
              </div>
            `}
          </article>

          ${hasSelected ? `
            <aside class="checkout-panel hidden" id="checkoutPanel" aria-label="Checkout manual ALIZZ STORE">
              <span class="eyebrow">Checkout Manual</span>
              <h2>Ringkasan Order</h2>
              <div class="checkout-summary">
                <div><span>Produk</span><strong>${escapeHTML(group.title)}</strong></div>
                <div><span>Varian</span><strong>${escapeHTML(variantLabel)}</strong></div>
                <div><span>Harga</span><strong>${escapeHTML(selected.price)}</strong></div>
                <div><span>Status</span><strong>${soldout ? "Habis" : "Tersedia"}</strong></div>
              </div>
              <p class="checkout-note">Belum ada payment gateway otomatis. Konfirmasi stok dan pembayaran langsung ke admin order.</p>
              <div class="checkout-actions">
                <a class="btn btn-primary checkout-wa-btn" href="${escapeHTML(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Order via WhatsApp</a>
                <a class="btn btn-outline checkout-telegram-btn" href="${escapeHTML(telegramUrl)}" target="_blank" rel="noopener noreferrer">Order via Telegram</a>
                <button class="btn btn-outline js-copy-dana-detail" type="button">Salin Nomor DANA</button>
                <button class="btn btn-ghost back-to-catalog-btn" type="button">Kembali ke Produk</button>
              </div>
            </aside>
          ` : ""}
        </div>
      </section>
    `;
  }

  function bindCatalogButtons() {
    document.querySelectorAll(".view-group-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const groupId = button.dataset.groupId;
        if (!groupId) return;
        setDetailRoute(groupId, null, true);
      });
    });
  }

  function bindDetailButtons(group, selected) {
    document.querySelectorAll(".variant-option").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.disabled) return;
        setDetailRoute(group.id, button.dataset.variantId, false);
      });
    });

    document.querySelectorAll(".back-to-catalog-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        setCheckoutActive(false);
        clearDetailRoute(true);
      });
    });

    if (!selected) return;

    document.querySelectorAll(".continue-order-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        const checkout = document.querySelector("#checkoutPanel");
        if (!checkout) return;
        setCheckoutActive(true);
        checkout.classList.remove("hidden");
        checkout.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    document.querySelectorAll(".checkout-wa-btn").forEach(function (link) {
      link.addEventListener("click", function () {
        trackAnalytics("order_whatsapp_click", {
          source: "checkout_manual",
          productId: selected.id,
          productName: selected.name,
          productCategory: group.category,
          productPrice: selected.price,
          variant: getVariantLabel(group, selected)
        });
      });
    });

    document.querySelectorAll(".checkout-telegram-btn").forEach(function (link) {
      link.addEventListener("click", function () {
        trackAnalytics("order_telegram_click", {
          source: "checkout_manual",
          productId: selected.id,
          productName: selected.name,
          productCategory: group.category,
          productPrice: selected.price,
          variant: getVariantLabel(group, selected)
        });
      });
    });

    document.querySelectorAll(".js-copy-dana-detail").forEach(function (button) {
      button.addEventListener("click", async function () {
        await copyText(window.ALIZZ_STORE.DANA_NUMBER);
        showToast("Nomor DANA berhasil disalin.");
      });
    });
  }

  function buildProductGroups(productList) {
    const categorized = window.ALIZZ_STORE.CATEGORY_ORDER.reduce(function (result, category) {
      result[category] = [];
      return result;
    }, {});

    productList.forEach(function (product) {
      const category = window.ALIZZ_STORE.normalizeCategory(product.category);
      if (!categorized[category]) categorized[category] = [];
      categorized[category].push(product);
    });

    const result = [];
    pushGroup(result, "panel-pterodactyl", "Paket Panel Pterodactyl", "Pilih RAM 1GB sampai UNLI sesuai kebutuhan run bot dan script.", "Panel", categorized.Panel);
    pushGroup(result, "membership-panel", "Membership Panel", "Pilih rank reseller sampai CEO buat mulai jualan panel sendiri.", "Membership", categorized.Membership);
    pushGroup(result, "sewa-bot-whatsapp", "Sewa Bot WhatsApp", "Pilih durasi sewa bot sesuai kebutuhan grup, promosi, atau usaha.", "Sewa Bot", categorized["Sewa Bot"]);
    pushGroup(result, "script-bot-whatsapp", "Paket Script Bot", "Script bot WhatsApp siap pakai, tinggal pilih varian yang cocok.", "Script", categorized.Script);
    pushGroup(result, "produk-digital-lainnya", "Produk Digital Lainnya", "Produk custom dari admin seperti jasa, APK, atau kebutuhan digital lain.", "Lainnya", categorized.Lainnya);

    return result.filter(function (group) { return group.variants.length > 0; });
  }

  function pushGroup(result, id, title, description, category, variants) {
    const cleanVariants = Array.isArray(variants) ? variants.slice() : [];
    if (!cleanVariants.length) return;
    result.push({
      id,
      title,
      description,
      category,
      variants: sortVariants(category, cleanVariants),
      benefits: collectBenefits(cleanVariants)
    });
  }

  function sortVariants(category, variants) {
    return variants.slice().sort(function (a, b) {
      if (category === "Panel") return panelRank(a) - panelRank(b);
      if (category === "Membership") return membershipRank(a) - membershipRank(b);
      if (category === "Sewa Bot") return sewaBotRank(a) - sewaBotRank(b);
      return String(a.name).localeCompare(String(b.name), "id");
    });
  }

  function panelRank(product) {
    const name = String(product.name || "").toLowerCase();
    if (name.includes("unli")) return 999;
    const match = name.match(/(\d+)\s*gb/);
    return match ? Number(match[1]) : 500;
  }

  function membershipRank(product) {
    const name = String(product.name || "").toLowerCase();
    const order = ["reseller", "adp", "pt", "tk", "ceo"];
    const index = order.findIndex(function (key) { return name.includes(key); });
    return index >= 0 ? index : 500;
  }

  function sewaBotRank(product) {
    const name = String(product.name || "").toLowerCase();
    if (name.includes("harian") || name.includes("daily")) return 1;
    if (name.includes("minggu") || name.includes("weekly")) return 2;
    if (name.includes("bulan") || name.includes("monthly")) return 3;
    if (name.includes("tahun") || name.includes("year")) return 4;
    return 500;
  }

  function collectBenefits(variants) {
    const used = new Set();
    const result = [];
    variants.forEach(function (product) {
      (Array.isArray(product.benefits) ? product.benefits : []).forEach(function (benefit) {
        const clean = String(benefit || "").trim();
        const key = clean.toLowerCase();
        if (!clean || used.has(key)) return;
        used.add(key);
        result.push(clean);
      });
    });
    return result.slice(0, 8);
  }

  function getVariantLabel(group, product) {
    const name = String(product.name || "").trim();
    if (group.category === "Panel") {
      const match = name.match(/(\d+\s*GB|UNLI)/i);
      return match ? match[1].replace(/\s+/g, "").toUpperCase() : name;
    }
    if (group.category === "Membership") return name.replace(/^membership\s*/i, "").trim() || name;
    if (group.category === "Sewa Bot") return name.replace(/^sewa\s*bot\s*/i, "").trim() || name;
    return name;
  }

  function getGroupPriceLabel(group) {
    const available = group.variants.filter(window.ALIZZ_STORE.isAvailable);
    const variants = available.length ? available : group.variants;
    if (!variants.length) return "Hubungi Admin";
    if (variants.length === 1) return variants[0].price;
    return "Mulai " + variants[0].price;
  }

  function getGroupSearchText(group) {
    return [
      group.title,
      group.category,
      group.description,
      group.variants.map(function (variant) { return variant.name + " " + variant.price + " " + variant.description; }).join(" "),
      group.benefits.join(" ")
    ].join(" ").toLowerCase();
  }

  function setDetailRoute(groupId, variantId, scrollTop) {
    const params = new URLSearchParams(window.location.search);
    params.set("group", groupId);
    if (variantId) params.set("variant", variantId);
    else params.delete("variant");

    const nextUrl = window.location.pathname + "?" + params.toString();
    window.history.pushState({}, "", nextUrl);
    routeCatalog();
    if (scrollTop) {
      window.setTimeout(function () {
        const detail = document.querySelector("#productDetail");
        if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  function clearDetailRoute(renderAfter) {
    const base = window.location.pathname;
    if (window.location.search || window.location.hash) {
      window.history.pushState({}, "", base);
    }
    setCheckoutActive(false);
    if (renderAfter) renderCatalog();
  }

  function setCheckoutActive(active) {
    if (!document.body) return;
    document.body.classList.toggle("checkout-open", Boolean(active));
  }

  function getVariantHelperText(group) {
    if (group.category === "Panel") return "Pilih RAM panel dulu sebelum lanjut order.";
    if (group.category === "Membership") return "Pilih rank membership dulu sebelum lanjut order.";
    if (group.category === "Sewa Bot") return "Pilih durasi sewa bot dulu sebelum lanjut order.";
    if (group.category === "Script") return "Pilih varian script dulu sebelum lanjut order.";
    return "Pilih varian dulu sebelum lanjut order.";
  }

  function getVariantEmptyTitle(group) {
    if (group.category === "Panel") return "Pilih varian dulu, Bos.";
    return "Pilih varian dulu, Bos.";
  }

  function createOrderMessage(group, product) {
    const variant = getVariantLabel(group, product);
    return `Halo admin ALIZZ STORE, saya mau order ${group.title} varian ${variant} dengan harga ${product.price}. Apakah masih tersedia?`;
  }

  function createWhatsAppUrl(number, message) {
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }

  function observeGroupViews() {
    const cards = Array.from(document.querySelectorAll(".product-group-card[data-group-id]"));
    if (!cards.length) return;

    if (!("IntersectionObserver" in window)) {
      cards.slice(0, 8).forEach(trackGroupViewFromCard);
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;
        trackGroupViewFromCard(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: [0.45] });

    cards.forEach(function (card) {
      const id = card.dataset.groupId;
      if (!id || viewedGroupIds.has(id)) return;
      observer.observe(card);
    });
  }

  function observeProductViews() {
    const cards = Array.from(document.querySelectorAll(".product-detail-shell[data-product-id]"));
    if (!cards.length) return;

    cards.forEach(function (card) {
      const id = card.dataset.productId;
      if (!id || viewedProductIds.has(id)) return;
      viewedProductIds.add(id);
      trackAnalytics("product_view", {
        source: "product_detail_open",
        productId: id,
        productName: card.dataset.productName || "",
        productCategory: card.dataset.productCategory || ""
      });
    });
  }

  function trackGroupViewFromCard(card) {
    if (!card || !card.dataset) return;
    const id = card.dataset.groupId;
    if (!id || viewedGroupIds.has(id)) return;
    viewedGroupIds.add(id);

    trackAnalytics("product_view", {
      source: "catalog_group_visible",
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
