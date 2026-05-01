(function () {
  const ORDER_WHATSAPP_NUMBER = "6281914401217";
  const DEVELOPER_WHATSAPP_NUMBER = "6285943502869";
  const ORDER_TELEGRAM_USERNAME = "my_bini";
  const DEVELOPER_TELEGRAM_USERNAME = "Lizz12087";
  const DANA_NUMBER = "085943502869";

  const GENERAL_ORDER_MESSAGE = "Halo admin ALIZZ STORE, saya mau order produk digital. Bisa dibantu?";
  const BUG_REPORT_MESSAGE = "Halo Developer ALIZZ STORE, saya menemukan bug/kendala di website. Bisa dibantu?";
  const OUT_OF_SCOPE_MESSAGE = "Maaf kak, aku cuma bisa bantu soal ALIZZ STORE, produk, order, panel, bot, script, dan kontak admin ya.";

  const DEFAULT_QUICK_REPLIES = [
    "Produk apa saja?",
    "Harga panel berapa?",
    "Cara order gimana?",
    "Rekomendasi pemula",
    "Kontak admin",
    "Bug website"
  ];

  document.addEventListener("DOMContentLoaded", function () {
    const page = document.body ? document.body.dataset.page : "";

    setupYear();
    setupDeveloperFloatingButton(page);

    if (page === "demo") {
      setupMobileMenu();
      setupContactButtons();
    }

    if (page === "chatbot") {
      setupMobileMenu();
      setupChatbot();
    }
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
      button.addEventListener("click", function () {
        openWhatsApp(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE);
      });
    });

    document.querySelectorAll(".js-copy-dana").forEach(function (button) {
      button.addEventListener("click", async function () {
        await copyText(DANA_NUMBER);
        showToast("Nomor DANA berhasil disalin.");
      });
    });
  }

  function setupDeveloperFloatingButton(page) {
    const allowedPages = ["demo", "produk", "chatbot"];
    if (!allowedPages.includes(page)) return;
    if (document.querySelector(".dev-whatsapp-float")) return;

    const link = document.createElement("a");
    link.className = "dev-whatsapp-float";
    link.href = createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Hubungi Developer ALIZZ STORE untuk bug atau kendala");
    link.innerHTML = '<span class="dev-wa-icon" aria-hidden="true">WA</span><span class="dev-wa-text">Bug? Chat Dev</span>';
    document.body.appendChild(link);
  }

  function setupYear() {
    const yearNow = document.querySelector("#yearNow");
    if (yearNow) yearNow.textContent = new Date().getFullYear();
  }

  function setupChatbot() {
    const messagesEl = document.querySelector("#chatMessages");
    const form = document.querySelector("#chatForm");
    const input = document.querySelector("#chatInput");
    const quickRepliesEl = document.querySelector("#quickReplies");
    const clearBtn = document.querySelector("#clearChatBtn");

    if (!messagesEl || !form || !input || !quickRepliesEl) return;

    let messages = getSavedChatMessages();

    bindStaticChatButtons();
    renderMessages(messages);
    renderQuickReplies(DEFAULT_QUICK_REPLIES);

    if (messages.length === 0) {
      addBotMessage({
        text: "Halo kak 👋 Aku ASISTEN STORE. Aku bisa bantu jelasin produk ALIZZ STORE, harga panel, bot, script, cara order, kontak admin, sampai bug report website.",
        actions: getMainActions(),
        quickReplies: DEFAULT_QUICK_REPLIES
      }, false);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitChatInput();
    });

    quickRepliesEl.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-question]");
      if (!button) return;
      handleUserMessage(button.dataset.question || button.textContent || "");
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        const confirmed = confirm("Hapus riwayat chat ASISTEN STORE di browser ini?");
        if (!confirmed) return;

        if (window.ALIZZ_CHATBOT_DB && typeof window.ALIZZ_CHATBOT_DB.clearMessages === "function") {
          window.ALIZZ_CHATBOT_DB.clearMessages();
        }

        messages = [];
        renderMessages(messages);
        addBotMessage({
          text: "Riwayat chat sudah aku bersihin ya kak. Mau tanya apa dulu?",
          actions: getMainActions(),
          quickReplies: DEFAULT_QUICK_REPLIES
        }, false);
      });
    }

    function submitChatInput() {
      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      handleUserMessage(text);
    }

    function handleUserMessage(text) {
      const cleaned = sanitizePlainText(text, 500);
      if (!cleaned) return;

      addUserMessage(cleaned);
      showTypingIndicator();

      window.setTimeout(function () {
        hideTypingIndicator();
        const response = createBotResponse(cleaned);
        addBotMessage(response, true);
      }, getTypingDelay(cleaned));
    }

    function addUserMessage(text) {
      const message = createMessage("user", text, []);
      messages.push(message);
      persistMessages();
      renderMessages(messages);
    }

    function addBotMessage(response, persist) {
      const message = createMessage("bot", response.text, response.actions || []);
      messages.push(message);
      if (persist !== false) persistMessages();
      if (persist === false) persistMessages();
      renderMessages(messages);
      renderQuickReplies(response.quickReplies || DEFAULT_QUICK_REPLIES);
    }

    function createMessage(role, text, actions) {
      return {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text: sanitizePlainText(text, 1200),
        timestamp: Date.now(),
        actions: Array.isArray(actions) ? actions.slice(0, 6) : []
      };
    }

    function persistMessages() {
      messages = messages.slice(-90);
      if (window.ALIZZ_CHATBOT_DB && typeof window.ALIZZ_CHATBOT_DB.saveMessages === "function") {
        window.ALIZZ_CHATBOT_DB.saveMessages(messages);
      }
    }

    function showTypingIndicator() {
      hideTypingIndicator();

      const row = document.createElement("div");
      row.className = "chat-row bot typing-row";
      row.id = "chatTypingIndicator";

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble typing-bubble";
      bubble.setAttribute("aria-label", "ASISTEN STORE sedang mengetik");

      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("i");
        bubble.appendChild(dot);
      }

      row.appendChild(bubble);
      messagesEl.appendChild(row);
      scrollChatToBottom();
    }

    function hideTypingIndicator() {
      const typing = document.querySelector("#chatTypingIndicator");
      if (typing) typing.remove();
    }

    function renderMessages(messageList) {
      messagesEl.innerHTML = "";

      messageList.forEach(function (message) {
        messagesEl.appendChild(createMessageElement(message));
      });

      scrollChatToBottom();
    }

    function createMessageElement(message) {
      const row = document.createElement("div");
      row.className = `chat-row ${message.role === "user" ? "user" : "bot"}`;

      const wrap = document.createElement("div");
      wrap.className = "chat-message-wrap";

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.textContent = message.text;

      const meta = document.createElement("time");
      meta.className = "chat-time";
      meta.dateTime = new Date(message.timestamp).toISOString();
      meta.textContent = formatTime(message.timestamp);

      wrap.appendChild(bubble);

      if (message.role !== "user" && Array.isArray(message.actions) && message.actions.length) {
        wrap.appendChild(createActionGroup(message.actions));
      }

      wrap.appendChild(meta);
      row.appendChild(wrap);
      return row;
    }

    function createActionGroup(actions) {
      const group = document.createElement("div");
      group.className = "chat-actions-row";

      actions.forEach(function (action) {
        if (action.type === "reply") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "chat-action-btn";
          button.textContent = action.label;
          button.addEventListener("click", function () {
            handleUserMessage(action.value);
          });
          group.appendChild(button);
          return;
        }

        const link = document.createElement("a");
        link.className = "chat-action-btn";
        link.href = action.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = action.label;
        group.appendChild(link);
      });

      return group;
    }

    function renderQuickReplies(replies) {
      quickRepliesEl.innerHTML = "";

      replies.slice(0, 8).forEach(function (reply) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reply-chip";
        button.dataset.question = reply;
        button.textContent = reply;
        quickRepliesEl.appendChild(button);
      });
    }

    function scrollChatToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function bindStaticChatButtons() {
    const orderWaBtn = document.querySelector("#orderWhatsAppBtn");
    const orderTelegramBtn = document.querySelector("#orderTelegramBtn");
    const devWaBtn = document.querySelector("#developerWhatsAppBtn");
    const devTelegramBtn = document.querySelector("#developerTelegramBtn");

    if (orderWaBtn) {
      orderWaBtn.href = createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE);
    }

    if (orderTelegramBtn) {
      orderTelegramBtn.href = `https://t.me/${ORDER_TELEGRAM_USERNAME}`;
    }

    if (devWaBtn) {
      devWaBtn.href = createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE);
    }

    if (devTelegramBtn) {
      devTelegramBtn.href = `https://t.me/${DEVELOPER_TELEGRAM_USERNAME}`;
    }
  }

  function createBotResponse(input) {
    const text = normalizeText(input);
    const products = getProductsSafely();
    const intent = detectIntent(text);

    if (isOutOfStoreTopic(text, intent)) {
      return {
        text: OUT_OF_SCOPE_MESSAGE,
        actions: getMainActions(),
        quickReplies: DEFAULT_QUICK_REPLIES
      };
    }

    if (intent === "greeting") {
      return {
        text: "Halo kak 👋 Mau cari panel, sewa bot, script, membership, atau mau tanya cara order? Aku bantu arahin biar gak bingung.",
        actions: getMainActions(),
        quickReplies: ["Produk apa saja?", "Harga panel", "Cara order", "Rekomendasi pemula"]
      };
    }

    if (intent === "about") {
      return {
        text: "ALIZZ STORE adalah toko digital milik ALIZZ yang fokus ke produk hosting/panel, bot WhatsApp, script bot, membership panel, dan produk digital lain. Order tetap lewat admin, jadi pembayaran dan stok paling aman dikonfirmasi langsung ya kak.",
        actions: getMainActions(),
        quickReplies: ["Produk apa saja?", "Kontak admin", "Garansi support", "Cara order"]
      };
    }

    if (intent === "products") {
      return createProductSummaryResponse(products);
    }

    if (intent === "panel" || intent === "panel_price") {
      return createCategoryResponse(products, "Panel", "Ini daftar panel dari katalog saat ini:");
    }

    if (intent === "membership") {
      return createCategoryResponse(products, "Membership", "Ini paket membership yang ada di katalog saat ini:");
    }

    if (intent === "sewa_bot") {
      return createCategoryResponse(products, "Sewa Bot", "Ini produk sewa bot yang ada di katalog saat ini:");
    }

    if (intent === "script") {
      return createCategoryResponse(products, "Script", "Ini script bot yang ada di katalog saat ini:");
    }

    if (intent === "order") {
      return {
        text: "Cara order gampang kak:\n1. Buka katalog produk.\n2. Pilih produk yang dibutuhkan.\n3. Klik Beli Sekarang / chat admin.\n4. Konfirmasi stok dan detail ke admin.\n5. Lanjut pembayaran sesuai arahan admin.\n\nOrder umum bisa langsung lewat WhatsApp atau Telegram di bawah ini.",
        actions: getOrderActions(),
        quickReplies: ["Produk apa saja?", "Pembayaran", "Stok produk", "Garansi support"]
      };
    }

    if (intent === "payment") {
      return {
        text: `Untuk pembayaran, ikuti arahan admin saat order ya kak. Nomor DANA yang tampil di website: ${DANA_NUMBER}. Jangan kirim password, token, atau data sensitif ke chat mana pun. Setelah bayar, konfirmasi bukti pembayaran ke admin order.`,
        actions: getOrderActions(),
        quickReplies: ["Cara order", "Kontak admin", "Garansi support"]
      };
    }

    if (intent === "support") {
      return {
        text: "Untuk garansi/support, admin bisa bantu sesuai ketentuan produk yang dibeli. Kalau kendalanya produk/order, hubungi admin order. Kalau kendalanya bug website, hubungi developer/owner ya kak.",
        actions: getSupportActions(),
        quickReplies: ["Kontak admin", "Bug website", "Cara order", "Stok produk"]
      };
    }

    if (intent === "contact") {
      return {
        text: "Kontak order ALIZZ STORE:\nWhatsApp order: 6281914401217\nTelegram order: @my_bini\n\nKontak developer/bug report:\nWhatsApp developer: 6285943502869\nTelegram developer: @Lizz12087\n\nJangan kebalik ya kak: order ke admin order, bug/kendala website ke developer.",
        actions: getSupportActions(),
        quickReplies: ["Cara order", "Produk apa saja?", "Bug website"]
      };
    }

    if (intent === "developer") {
      return {
        text: "Kalau ada bug/kendala website, langsung hubungi Developer ALIZZ STORE ya kak. Pesan default sudah aku siapin biar cepat diproses.",
        actions: getDeveloperActions(),
        quickReplies: ["Kontak admin", "Produk apa saja?", "Cara order"]
      };
    }

    if (intent === "stock") {
      return createStockResponse(products);
    }

    if (intent === "recommendation") {
      return createRecommendationResponse(products);
    }

    if (intent === "clear") {
      return {
        text: "Kalau mau hapus chat, pencet tombol Hapus Chat di kanan atas panel ya kak. Riwayat cuma tersimpan lokal di browser kamu, bukan dikirim ke server.",
        actions: [{ label: "Tanya produk", type: "reply", value: "Produk apa saja?" }],
        quickReplies: DEFAULT_QUICK_REPLIES
      };
    }

    return {
      text: "Aku belum paham detail pertanyaannya kak. Coba pilih topik cepat di bawah, atau tanya seputar produk ALIZZ STORE seperti panel, bot, script, cara order, stok, pembayaran, garansi, dan kontak admin.",
      actions: getMainActions(),
      quickReplies: DEFAULT_QUICK_REPLIES
    };
  }

  function detectIntent(text) {
    if (hasAny(text, ["hapus chat", "clear chat", "reset chat", "bersihin chat"])) return "clear";
    if (hasAny(text, ["halo", "hai", "hello", "min", "kak", "assalam", "pagi", "siang", "sore", "malam"])) return "greeting";
    if (hasAny(text, ["apa itu alizz", "tentang alizz", "alizz store itu", "siapa alizz", "store apa"])) return "about";
    if (hasAny(text, ["bug", "kendala website", "error website", "developer", "dev", "owner", "lapor", "website rusak"])) return "developer";
    if (hasAny(text, ["kontak", "nomor", "whatsapp", "wa", "telegram", "admin", "hubungi"])) return "contact";
    if (hasAny(text, ["garansi", "support", "bantuan", "dibantu", "refund", "komplain"])) return "support";
    if (hasAny(text, ["stok", "stock", "ready", "tersedia", "habis", "available"])) return "stock";
    if (hasAny(text, ["rekomendasi", "saran", "pemula", "baru mulai", "cocoknya", "bagusnya"])) return "recommendation";
    if (hasAny(text, ["bayar", "pembayaran", "payment", "dana", "qris", "transfer", "metode bayar"])) return "payment";
    if (hasAny(text, ["order", "beli", "buy", "pesan", "checkout", "cara beli", "cara order"])) return "order";
    if (hasAny(text, ["harga panel", "panel berapa", "list panel", "panel ptero", "pterodactyl", "panel", "ptero"])) return hasAny(text, ["harga", "berapa", "price", "rp", "list"]) ? "panel_price" : "panel";
    if (hasAny(text, ["membership", "member", "reseller", "adp", "pt", "tk", "ceo"])) return "membership";
    if (hasAny(text, ["sewa bot", "bot sewa", "bot whatsapp", "rent bot", "jaga grup"])) return "sewa_bot";
    if (hasAny(text, ["script", "sc", "source code", "whatsapp md", "bot md"])) return "script";
    if (hasAny(text, ["produk", "katalog", "jualan apa", "jual apa", "list produk", "barang apa", "menu"])) return "products";

    return fuzzyIntent(text);
  }

  function fuzzyIntent(text) {
    const targets = [
      { intent: "products", words: ["produk", "katalog", "barang"] },
      { intent: "panel", words: ["panel", "pterodactyl", "ptero"] },
      { intent: "membership", words: ["membership", "reseller"] },
      { intent: "sewa_bot", words: ["bot", "sewa"] },
      { intent: "script", words: ["script", "source"] },
      { intent: "order", words: ["order", "beli", "pesan"] },
      { intent: "contact", words: ["kontak", "whatsapp", "telegram"] }
    ];

    const tokens = text.split(" ").filter(Boolean);
    let best = { intent: "unknown", score: 0 };

    targets.forEach(function (target) {
      target.words.forEach(function (word) {
        tokens.forEach(function (token) {
          const score = similarity(token, word);
          if (score > best.score) best = { intent: target.intent, score };
        });
      });
    });

    return best.score >= 0.78 ? best.intent : "unknown";
  }

  function createProductSummaryResponse(products) {
    if (!products.length) {
      return {
        text: "Katalog produk belum kebaca di browser ini kak. Coba buka halaman Produk, atau langsung tanya admin order biar aman.",
        actions: getOrderActions(),
        quickReplies: ["Kontak admin", "Cara order", "Harga panel"]
      };
    }

    const grouped = groupProducts(products);
    const lines = ["Produk ALIZZ STORE yang kebaca dari katalog saat ini:"];

    Object.keys(grouped).forEach(function (category) {
      lines.push(`\n${category}: ${grouped[category].length} produk`);
      grouped[category].slice(0, 4).forEach(function (product) {
        lines.push(`- ${product.name} (${product.price})`);
      });
    });

    lines.push("\nUntuk detail stok paling aman konfirmasi ke admin ya kak, biar gak salah info.");

    return {
      text: lines.join("\n"),
      actions: getOrderActions(),
      quickReplies: ["Harga panel", "Membership", "Sewa bot", "Script bot", "Rekomendasi pemula"]
    };
  }

  function createCategoryResponse(products, category, intro) {
    const items = products.filter(function (product) {
      return normalizeCategory(product.category) === category;
    });

    if (!items.length) {
      return {
        text: `${intro}\nBelum ada data ${category} yang kebaca dari katalog di browser ini. Coba cek halaman Produk atau konfirmasi ke admin order ya kak.`,
        actions: getOrderActions(),
        quickReplies: ["Produk apa saja?", "Kontak admin", "Cara order"]
      };
    }

    const lines = [intro];
    items.slice(0, 12).forEach(function (product) {
      const status = product.stock > 0 && product.status === "available" ? `stok ${product.stock}` : "stok habis";
      lines.push(`- ${product.name}: ${product.price} (${status})`);
    });

    if (items.length > 12) lines.push(`+ ${items.length - 12} produk lainnya ada di katalog.`);
    lines.push("\nCatatan: stok dari local browser/katalog, jadi sebelum bayar tetap konfirmasi ke admin ya kak.");

    return {
      text: lines.join("\n"),
      actions: getOrderActions(),
      quickReplies: ["Cara order", "Stok produk", "Kontak admin", "Rekomendasi pemula"]
    };
  }

  function createStockResponse(products) {
    if (!products.length) {
      return {
        text: "Aku belum bisa baca stok dari katalog di browser ini kak. Untuk stok paling aman langsung konfirmasi ke admin ya kak, biar gak salah info.",
        actions: getOrderActions(),
        quickReplies: ["Kontak admin", "Produk apa saja", "Cara order"]
      };
    }

    const available = products.filter(function (product) {
      return product.status === "available" && Number(product.stock) > 0;
    });
    const soldout = products.length - available.length;

    return {
      text: `Dari katalog lokal saat ini, ada ${available.length} produk tersedia dan ${soldout} produk habis. Tapi stok bukan cek real-time server ya kak. Untuk stok paling aman langsung konfirmasi ke admin ya kak, biar gak salah info.`,
      actions: getOrderActions(),
      quickReplies: ["Harga panel", "Cara order", "Kontak admin"]
    };
  }

  function createRecommendationResponse(products) {
    const panel = findProductByName(products, "Panel Pterodactyl 2GB") || findFirstByCategory(products, "Panel");
    const bot = findFirstByCategory(products, "Sewa Bot");
    const script = findFirstByCategory(products, "Script");

    const lines = ["Kalau masih pemula, rekomendasi aman dari aku:"];

    if (panel) lines.push(`- Mau run bot sendiri: ${panel.name} (${panel.price}) buat mulai.`);
    if (bot) lines.push(`- Mau langsung pakai tanpa setup banyak: ${bot.name} (${bot.price}).`);
    if (script) lines.push(`- Mau punya base bot sendiri: ${script.name} (${script.price}).`);

    lines.push("\nKalau bingung pilih, chat admin dan jelasin kebutuhan kamu: buat grup, jualan, JPM, atau belajar bot.");

    return {
      text: lines.join("\n"),
      actions: getOrderActions(),
      quickReplies: ["Harga panel", "Sewa bot", "Script bot", "Cara order"]
    };
  }

  function getProductsSafely() {
    try {
      if (window.ALIZZ_STORE && typeof window.ALIZZ_STORE.getProducts === "function") {
        return window.ALIZZ_STORE.getProducts();
      }
    } catch (error) {}

    return [];
  }

  function groupProducts(products) {
    return products.reduce(function (result, product) {
      const category = normalizeCategory(product.category);
      if (!result[category]) result[category] = [];
      result[category].push(product);
      return result;
    }, {});
  }

  function findFirstByCategory(products, category) {
    return products.find(function (product) {
      return normalizeCategory(product.category) === category && Number(product.stock) > 0;
    });
  }

  function findProductByName(products, name) {
    const needle = normalizeText(name);
    return products.find(function (product) {
      return normalizeText(product.name) === needle;
    });
  }

  function normalizeCategory(category) {
    if (window.ALIZZ_STORE && typeof window.ALIZZ_STORE.normalizeCategory === "function") {
      return window.ALIZZ_STORE.normalizeCategory(category);
    }

    const value = String(category || "").trim();
    return ["Panel", "Membership", "Sewa Bot", "Script", "Lainnya"].includes(value) ? value : "Lainnya";
  }

  function getMainActions() {
    return [
      { label: "Lihat Produk", type: "link", url: `${location.origin}/produk/` },
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` }
    ];
  }

  function getOrderActions() {
    return [
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` },
      { label: "Buka Katalog", type: "link", url: `${location.origin}/produk/` }
    ];
  }

  function getDeveloperActions() {
    return [
      { label: "WhatsApp Developer", type: "link", url: createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE) },
      { label: "Telegram Developer", type: "link", url: `https://t.me/${DEVELOPER_TELEGRAM_USERNAME}` }
    ];
  }

  function getSupportActions() {
    return [
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` },
      { label: "Bug Report", type: "link", url: createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE) }
    ];
  }

  function isOutOfStoreTopic(text, intent) {
    if (intent !== "unknown") return false;

    const blocked = [
      "politik", "agama", "dewasa", "bokep", "porn", "seks", "sex", "kekerasan", "bunuh", "narkoba",
      "hack", "hacking", "ddos", "phishing", "carding", "malware", "virus", "slot", "judi", "pinjol"
    ];

    const storeHints = ["alizz", "store", "produk", "panel", "bot", "script", "order", "admin", "wa", "telegram", "pterodactyl"];
    if (hasAny(text, storeHints)) return false;

    return blocked.some(function (word) {
      return text.includes(word);
    }) || text.split(" ").filter(Boolean).length > 2;
  }

  function hasAny(text, keywords) {
    return keywords.some(function (keyword) {
      return text.includes(keyword);
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9@.\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizePlainText(value, maxLength) {
    const limit = Number(maxLength) > 0 ? Number(maxLength) : 800;
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);

    const distance = levenshteinDistance(a, b);
    return 1 - distance / Math.max(a.length, b.length);
  }

  function levenshteinDistance(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, function () {
      return Array(b.length + 1).fill(0);
    });

    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  }

  function getSavedChatMessages() {
    if (window.ALIZZ_CHATBOT_DB && typeof window.ALIZZ_CHATBOT_DB.getMessages === "function") {
      return window.ALIZZ_CHATBOT_DB.getMessages();
    }

    return [];
  }

  function getTypingDelay(text) {
    const length = String(text || "").length;
    return Math.min(900, Math.max(420, length * 10));
  }

  function formatTime(timestamp) {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(timestamp));
    } catch (error) {
      return "Baru saja";
    }
  }

  function createWhatsAppUrl(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function openWhatsApp(number, message) {
    window.open(createWhatsAppUrl(number, message), "_blank", "noopener,noreferrer");
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
})();
