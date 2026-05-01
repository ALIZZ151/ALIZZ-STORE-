(function () {
  "use strict";

  const ORDER_WHATSAPP_NUMBER = "6281914401217";
  const DEVELOPER_WHATSAPP_NUMBER = "6285943502869";
  const ORDER_TELEGRAM_USERNAME = "my_bini";
  const DEVELOPER_TELEGRAM_USERNAME = "Lizz12087";
  const DANA_NUMBER = "085943502869";
  const GEMINI_API_BASE = "https://api.lexcode.biz.id/api/ai/gemini-2-5-flash?text=";
  const API_TIMEOUT_MS = 9000;

  const GENERAL_ORDER_MESSAGE = "Halo admin ALIZZ STORE, saya mau order produk digital. Bisa dibantu?";
  const GENERAL_DEV_MESSAGE = "Halo Developer ALIZZ STORE, saya mau tanya/konsultasi soal website. Bisa dibantu?";
  const BUG_REPORT_MESSAGE = "Halo Developer ALIZZ STORE, saya menemukan bug/kendala di website. Bisa dibantu?";
  const OUT_OF_SCOPE_MESSAGE = "Maaf kak, aku cuma bisa bantu soal ALIZZ STORE, produk, order, panel, bot, script, dan kontak admin ya.";
  const UNKNOWN_FALLBACK_MESSAGE = "Maaf kak, aku belum nangkep maksudnya. Coba pilih menu di bawah ya: Produk, Harga Panel, Cara Order, Garansi, atau Kontak Admin.";

  const DEFAULT_QUICK_REPLIES = [
    "Produk apa aja?",
    "Harga panel",
    "Cara order",
    "Rekomendasi pemula",
    "Kontak admin",
    "Garansi"
  ];

  document.addEventListener("DOMContentLoaded", function () {
    const page = document.body ? document.body.dataset.page || "" : "";

    setupYear();
    setupFloatingWidgets(page);

    if (page === "demo") {
      setupMobileMenu();
      setupContactButtons();
    }

    if (page === "chatbot") {
      setupMobileMenu();
      setupContactButtons();
      setupChatbot();
    }
  });

  function setupMobileMenu() {
    const hamburgerBtn = document.querySelector("#hamburgerBtn");
    const mobileMenu = document.querySelector("#mobileMenu");
    const mobileOverlay = document.querySelector("#mobileOverlay");
    const mobileCloseBtn = document.querySelector("#mobileCloseBtn");

    if (!hamburgerBtn || !mobileMenu || !mobileOverlay) return;
    if (hamburgerBtn.dataset.alizzMenuBound === "true") return;
    hamburgerBtn.dataset.alizzMenuBound = "true";

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
      if (mobileMenu.classList.contains("is-open")) closeMenu();
      else openMenu();
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
      if (button.dataset.alizzContactBound === "true") return;
      button.dataset.alizzContactBound = "true";
      button.addEventListener("click", function () {
        openWhatsApp(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE);
      });
    });

    document.querySelectorAll(".js-copy-dana").forEach(function (button) {
      if (button.dataset.alizzCopyBound === "true") return;
      button.dataset.alizzCopyBound = "true";
      button.addEventListener("click", async function () {
        await copyText(DANA_NUMBER);
        showToast("Nomor DANA berhasil disalin.");
      });
    });
  }

  function setupFloatingWidgets(page) {
    const allowed = ["demo", "produk", "chatbot"];
    if (!allowed.includes(page)) return;

    const stack = getFloatingStack();
    if (!stack) return;

    if (page !== "chatbot") {
      setupDeveloperWhatsAppWidget(stack);
      setupChatbotLauncher(stack);
    } else {
      setupDeveloperWhatsAppWidget(stack);
    }
  }

  function getFloatingStack() {
    let stack = document.querySelector("#floatingWidgetStack");
    if (stack) return stack;

    stack = document.createElement("div");
    stack.id = "floatingWidgetStack";
    stack.className = "floating-widget-stack";
    stack.setAttribute("aria-label", "Widget bantuan ALIZZ STORE");
    document.body.appendChild(stack);
    return stack;
  }

  function setupDeveloperWhatsAppWidget(stack) {
    if (!stack || document.querySelector(".wa-dev-widget")) return;

    const widget = document.createElement("section");
    widget.className = "wa-dev-widget";
    widget.setAttribute("aria-label", "Chat Developer ALIZZ STORE");

    const head = document.createElement("div");
    head.className = "wa-dev-head";

    const avatar = document.createElement("div");
    avatar.className = "wa-dev-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "WA";

    const titleWrap = document.createElement("div");
    titleWrap.className = "wa-dev-title";

    const title = document.createElement("strong");
    title.textContent = "Developer ALIZZ";

    const status = document.createElement("span");
    status.innerHTML = '<i aria-hidden="true"></i> Online / Siap bantu';

    titleWrap.appendChild(title);
    titleWrap.appendChild(status);
    head.appendChild(avatar);
    head.appendChild(titleWrap);

    const bubble = document.createElement("p");
    bubble.className = "wa-dev-bubble";
    bubble.textContent = "Ada kendala atau mau tanya soal website? Chat developer di sini.";

    const actions = document.createElement("div");
    actions.className = "wa-dev-actions";

    const chatLink = document.createElement("a");
    chatLink.className = "wa-dev-action primary";
    chatLink.href = createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, GENERAL_DEV_MESSAGE);
    chatLink.target = "_blank";
    chatLink.rel = "noopener noreferrer";
    chatLink.textContent = "Chat Developer";

    const bugLink = document.createElement("a");
    bugLink.className = "wa-dev-action secondary";
    bugLink.href = createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE);
    bugLink.target = "_blank";
    bugLink.rel = "noopener noreferrer";
    bugLink.textContent = "Laporkan Bug";

    actions.appendChild(chatLink);
    actions.appendChild(bugLink);
    widget.appendChild(head);
    widget.appendChild(bubble);
    widget.appendChild(actions);
    stack.appendChild(widget);
  }

  function setupChatbotLauncher(stack) {
    if (!stack || document.querySelector(".chatbot-launcher-widget")) return;

    const launcher = document.createElement("a");
    launcher.className = "chatbot-launcher-widget";
    launcher.href = "/chatbot/";
    launcher.setAttribute("aria-label", "Buka ASISTEN STORE chatbot");

    launcher.innerHTML = [
      '<span class="chatbot-launcher-avatar"><img src="/chatbot/chatbot-profile.jpg" alt="" loading="lazy" /></span>',
      '<span class="chatbot-launcher-content">',
      '  <span class="chatbot-launcher-top"><strong>ASISTEN STORE</strong><em>AI</em></span>',
      '  <span class="chatbot-launcher-status"><i aria-hidden="true"></i> Online</span>',
      '  <span class="chatbot-launcher-bubble">Butuh bantuan pilih produk? Tanya aku kak.</span>',
      '</span>'
    ].join("");

    stack.appendChild(launcher);
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
    if (form.dataset.alizzChatBound === "true") return;
    form.dataset.alizzChatBound = "true";

    let messages = getSavedChatMessages();
    let isBotThinking = false;

    bindStaticChatButtons();
    renderMessages(messages);
    renderQuickReplies(DEFAULT_QUICK_REPLIES);

    if (messages.length === 0) {
      addBotMessage({
        text: "Halo kak 👋 Aku ASISTEN STORE. Aku bisa bantu soal produk ALIZZ STORE: panel Pterodactyl, bot WhatsApp, script, membership, cara order, harga, garansi, kontak admin, sampai kendala website.",
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
      if (!button || isBotThinking) return;
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
      if (isBotThinking) return;
      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      handleUserMessage(text);
    }

    async function handleUserMessage(text) {
      const cleaned = sanitizePlainText(text, 500);
      if (!cleaned) return;

      addUserMessage(cleaned);
      isBotThinking = true;
      setInputState(true);
      showTypingIndicator();

      try {
        await wait(getTypingDelay(cleaned));
        const response = await createBotResponse(cleaned);
        hideTypingIndicator();
        addBotMessage(response, true);
      } catch (error) {
        hideTypingIndicator();
        addBotMessage(createUnknownFallbackResponse(), true);
      } finally {
        isBotThinking = false;
        setInputState(false);
      }
    }

    function setInputState(disabled) {
      input.disabled = disabled;
      const sendBtn = form.querySelector("button[type='submit']");
      if (sendBtn) sendBtn.disabled = disabled;
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
        text: sanitizePlainText(text, 1600),
        timestamp: Date.now(),
        actions: Array.isArray(actions) ? actions.slice(0, 6) : []
      };
    }

    function persistMessages() {
      messages = messages.slice(-100);
      if (window.ALIZZ_CHATBOT_DB && typeof window.ALIZZ_CHATBOT_DB.saveMessages === "function") {
        window.ALIZZ_CHATBOT_DB.saveMessages(messages);
      }
    }

    function showTypingIndicator() {
      hideTypingIndicator();

      const row = document.createElement("div");
      row.className = "chat-row bot typing-row";
      row.id = "chatTypingIndicator";

      const avatar = document.createElement("span");
      avatar.className = "chat-message-avatar";
      avatar.innerHTML = '<img src="chatbot-profile.jpg" alt="" />';

      const bubble = document.createElement("div");
      bubble.className = "chat-bubble typing-bubble";
      bubble.setAttribute("aria-label", "ASISTEN STORE sedang mengetik");

      for (let index = 0; index < 3; index += 1) {
        const dot = document.createElement("i");
        bubble.appendChild(dot);
      }

      row.appendChild(avatar);
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

      if (message.role !== "user") {
        const avatar = document.createElement("span");
        avatar.className = "chat-message-avatar";
        avatar.innerHTML = '<img src="chatbot-profile.jpg" alt="ASISTEN STORE" />';
        row.appendChild(avatar);
      }

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
        const label = sanitizePlainText(action.label, 60);
        if (!label) return;

        if (action.type === "reply") {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "chat-action-btn";
          button.textContent = label;
          button.addEventListener("click", function () {
            if (!isBotThinking) handleUserMessage(action.value || label);
          });
          group.appendChild(button);
          return;
        }

        const href = sanitizePlainText(action.url, 700);
        if (!/^https:\/\//i.test(href) && !href.startsWith("/")) return;

        const link = document.createElement("a");
        link.className = "chat-action-btn";
        link.href = href;
        link.target = href.startsWith("/") ? "_self" : "_blank";
        link.rel = href.startsWith("/") ? "" : "noopener noreferrer";
        link.textContent = label;
        group.appendChild(link);
      });

      return group;
    }

    function renderQuickReplies(replies) {
      quickRepliesEl.innerHTML = "";

      replies.slice(0, 8).forEach(function (reply) {
        const label = sanitizePlainText(reply, 80);
        if (!label) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "quick-reply-chip";
        button.dataset.question = label;
        button.textContent = label;
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

    if (orderWaBtn) orderWaBtn.href = createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE);
    if (orderTelegramBtn) orderTelegramBtn.href = `https://t.me/${ORDER_TELEGRAM_USERNAME}`;
    if (devWaBtn) devWaBtn.href = createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, GENERAL_DEV_MESSAGE);
    if (devTelegramBtn) devTelegramBtn.href = `https://t.me/${DEVELOPER_TELEGRAM_USERNAME}`;
  }

  async function createBotResponse(input) {
    const text = normalizeText(input);
    const products = getProductsSafely();
    const intent = detectIntent(text);

    if (isBlockedTopic(text)) {
      return createOutOfScopeResponse();
    }

    if (intent !== "unknown") {
      return createLocalResponseByIntent(intent, input, text, products);
    }

    if (hasSensitivePattern(text)) {
      return createUnknownFallbackResponse();
    }

    const apiResponse = await askGeminiSafely(input);
    if (apiResponse) {
      return {
        text: apiResponse,
        actions: getMainActions(),
        quickReplies: DEFAULT_QUICK_REPLIES
      };
    }

    return createUnknownFallbackResponse();
  }

  function createLocalResponseByIntent(intent, rawInput, normalizedInput, products) {
    if (intent === "greeting") {
      return {
        text: "Halo kak 👋 Mau cari panel, sewa bot, script, membership, atau mau tanya cara order? Aku bantu arahin biar gak bingung.",
        actions: getMainActions(),
        quickReplies: ["Produk apa aja?", "Harga panel", "Cara order", "Rekomendasi pemula"]
      };
    }

    if (intent === "about") {
      return {
        text: "ALIZZ STORE adalah toko digital milik ALIZZ yang fokus ke panel Pterodactyl, bot WhatsApp, script bot, membership, dan produk digital lain. Order tetap lewat admin, jadi stok dan pembayaran paling aman dikonfirmasi langsung ya kak.",
        actions: getMainActions(),
        quickReplies: ["Produk apa aja?", "Kontak admin", "Garansi", "Cara order"]
      };
    }

    if (intent === "products" || intent === "price") return createProductSummaryResponse(products, intent === "price");
    if (intent === "panel" || intent === "panel_price") return createCategoryResponse(products, "Panel", "Ini daftar panel dari katalog saat ini:");
    if (intent === "membership") return createCategoryResponse(products, "Membership", "Ini paket membership yang ada di katalog saat ini:");
    if (intent === "sewa_bot") return createCategoryResponse(products, "Sewa Bot", "Ini produk sewa bot yang ada di katalog saat ini:");
    if (intent === "script") return createCategoryResponse(products, "Script", "Ini script bot yang ada di katalog saat ini:");

    if (intent === "order") {
      return {
        text: "Cara order gampang kak:\n1. Buka katalog produk.\n2. Pilih produk yang dibutuhkan.\n3. Klik Beli Sekarang atau chat admin.\n4. Konfirmasi stok, detail, dan kebutuhan ke admin.\n5. Lanjut pembayaran sesuai arahan admin.\n\nOrder umum bisa langsung lewat WhatsApp atau Telegram di bawah ini.",
        actions: getOrderActions(),
        quickReplies: ["Produk apa aja?", "Pembayaran", "Stok produk", "Garansi"]
      };
    }

    if (intent === "payment") {
      return {
        text: `Untuk pembayaran, ikuti arahan admin saat order ya kak. Nomor DANA yang tampil di website: ${DANA_NUMBER}. Jangan kirim password, token, cookie, atau data sensitif. Setelah bayar, konfirmasi bukti pembayaran ke admin order.`,
        actions: getOrderActions(),
        quickReplies: ["Cara order", "Kontak admin", "Garansi"]
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
        quickReplies: ["Cara order", "Produk apa aja?", "Bug website"]
      };
    }

    if (intent === "developer" || intent === "bug") {
      return {
        text: "Kalau ada bug/kendala website atau mau konsultasi soal website, langsung hubungi Developer ALIZZ STORE ya kak. Aku siapin dua tombol: chat umum dan laporkan bug.",
        actions: getDeveloperActions(),
        quickReplies: ["Kontak admin", "Produk apa aja?", "Cara order"]
      };
    }

    if (intent === "stock") return createStockResponse(products);
    if (intent === "recommendation") return createRecommendationResponse(products);

    if (intent === "clear") {
      return {
        text: "Kalau mau hapus chat, pencet tombol Hapus Chat di kanan atas panel ya kak. Riwayat cuma tersimpan lokal di browser kamu, bukan dikirim ke server.",
        actions: [{ label: "Tanya produk", type: "reply", value: "Produk apa aja?" }],
        quickReplies: DEFAULT_QUICK_REPLIES
      };
    }

    return createUnknownFallbackResponse();
  }

  async function askGeminiSafely(userInput) {
    const question = sanitizeForApi(userInput);
    if (!question || hasSensitivePattern(normalizeText(question))) return "";

    const prompt = `Kamu adalah ASISTEN STORE milik ALIZZ STORE. Jawab hanya tentang toko digital hosting, panel, bot WhatsApp, script, cara order, harga, garansi, kontak admin, dan bantuan produk. Gunakan bahasa Indonesia santai, sopan, gaul ringan, tidak baku. Jangan bahas topik di luar store. Jika pertanyaan di luar store, jawab: ${OUT_OF_SCOPE_MESSAGE} Pertanyaan user: ${question}`;
    const apiUrl = GEMINI_API_BASE + encodeURIComponent(prompt);

    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, API_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) return "";
      const data = await response.json();
      const result = sanitizePlainText(data && data.result, 1400);

      if (data && data.success === true && isValidAiResult(result) && isStoreFocusedAnswer(result)) {
        return result;
      }

      return "";
    } catch (error) {
      return "";
    } finally {
      window.clearTimeout(timer);
    }
  }

  function isValidAiResult(result) {
    if (!result) return false;
    if (result.length < 12) return false;
    if (/^no response$/i.test(result.trim())) return false;
    if (/^(null|undefined)$/i.test(result.trim())) return false;
    return true;
  }

  function isStoreFocusedAnswer(answer) {
    const normalized = normalizeText(answer);
    if (!normalized) return false;
    if (normalized.includes(normalizeText(OUT_OF_SCOPE_MESSAGE))) return true;

    const allowedHints = [
      "alizz", "store", "produk", "order", "admin", "panel", "pterodactyl", "bot", "script",
      "whatsapp", "telegram", "garansi", "support", "harga", "kontak", "hosting", "membership"
    ];

    return hasAny(normalized, allowedHints);
  }

  function detectIntent(text) {
    if (hasAny(text, ["hapus chat", "clear chat", "reset chat", "bersihin chat"])) return "clear";
    if (hasAny(text, ["halo", "hai", "hello", "helo", "min", "kak", "assalam", "pagi", "siang", "sore", "malam"])) return "greeting";
    if (hasAny(text, ["apa itu alizz", "tentang alizz", "alizz store itu", "siapa alizz", "store apa", "ini toko apa"])) return "about";
    if (hasAny(text, ["bug", "kendala website", "error website", "website error", "web error", "laporkan", "lapor bug", "fitur rusak", "website rusak"])) return "bug";
    if (hasAny(text, ["developer", "dev", "owner", "pemilik", "kontak owner", "hubungi owner", "admin web"])) return "developer";
    if (hasAny(text, ["kontak", "nomor", "whatsapp", "wa", "telegram", "admin", "hubungi", "chat admin"])) return "contact";
    if (hasAny(text, ["garansi", "support", "bantuan", "dibantu", "refund", "komplain", "klaim", "after sales"])) return "support";
    if (hasAny(text, ["stok", "stock", "ready", "tersedia", "habis", "available", "masih ada"])) return "stock";
    if (hasAny(text, ["rekomendasi", "saran", "pemula", "baru mulai", "cocoknya", "bagusnya", "pilih apa", "bingung pilih"])) return "recommendation";
    if (hasAny(text, ["bayar", "pembayaran", "payment", "dana", "qris", "transfer", "metode bayar", "tf"])) return "payment";
    if (hasAny(text, ["order", "beli", "buy", "pesan", "checkout", "cara beli", "cara order", "mau beli"])) return "order";
    if (hasAny(text, ["harga panel", "panel berapa", "list panel", "panel ptero", "pterodactyl", "ptero", "panel"])) return hasAny(text, ["harga", "berapa", "price", "rp", "list", "daftar"]) ? "panel_price" : "panel";
    if (hasAny(text, ["membership", "member", "reseller", "adp", "pt panel", "tk panel", "ceo panel"])) return "membership";
    if (hasAny(text, ["sewa bot", "bot sewa", "bot whatsapp", "rent bot", "jaga grup", "jadibot", "bot jadi"])) return "sewa_bot";
    if (hasAny(text, ["script", "sc", "source code", "whatsapp md", "bot md", "base bot"])) return "script";
    if (hasAny(text, ["harga", "price", "berapa", "list harga", "daftar harga"])) return "price";
    if (hasAny(text, ["produk", "katalog", "jualan apa", "jual apa", "list produk", "barang apa", "menu", "layanan apa"])) return "products";

    return fuzzyIntent(text);
  }

  function fuzzyIntent(text) {
    const targets = [
      { intent: "products", words: ["produk", "katalog", "barang", "layanan"] },
      { intent: "panel", words: ["panel", "pterodactyl", "ptero"] },
      { intent: "membership", words: ["membership", "reseller", "member"] },
      { intent: "sewa_bot", words: ["bot", "sewa", "jadibot"] },
      { intent: "script", words: ["script", "source", "scode"] },
      { intent: "order", words: ["order", "beli", "pesan"] },
      { intent: "contact", words: ["kontak", "whatsapp", "telegram", "admin"] },
      { intent: "support", words: ["garansi", "support", "bantuan"] }
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

  function createProductSummaryResponse(products, includeAllPrices) {
    if (!products.length) {
      return {
        text: "Untuk list produk dan harga paling update, langsung cek katalog atau chat admin ya kak. Data katalog belum kebaca di halaman ini, jadi aku gak mau ngarang harga.",
        actions: getOrderActions(),
        quickReplies: ["Kontak admin", "Cara order", "Harga panel"]
      };
    }

    const grouped = groupProducts(products);
    const lines = [includeAllPrices ? "List produk dan harga dari katalog saat ini:" : "Produk ALIZZ STORE yang kebaca dari katalog saat ini:"];

    Object.keys(grouped).forEach(function (category) {
      lines.push(`\n${category}:`);
      grouped[category].slice(0, 6).forEach(function (product) {
        const status = isProductAvailable(product) ? "ready" : "habis";
        lines.push(`- ${product.name}: ${product.price} (${status})`);
      });
      if (grouped[category].length > 6) lines.push(`- +${grouped[category].length - 6} produk lainnya di katalog`);
    });

    lines.push("\nUntuk stok paling aman langsung konfirmasi ke admin ya kak, biar gak salah info.");

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
        quickReplies: ["Produk apa aja?", "Kontak admin", "Cara order"]
      };
    }

    const lines = [intro];
    items.slice(0, 12).forEach(function (product) {
      const status = isProductAvailable(product) ? `stok ${Number(product.stock)}` : "stok habis";
      lines.push(`- ${product.name}: ${product.price} (${status})`);
    });

    if (items.length > 12) lines.push(`+ ${items.length - 12} produk lainnya ada di katalog.`);
    lines.push("\nCatatan: stok dari katalog/local browser, bukan cek real-time server. Sebelum bayar tetap konfirmasi ke admin ya kak.");

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
        quickReplies: ["Kontak admin", "Produk apa aja", "Cara order"]
      };
    }

    const available = products.filter(isProductAvailable);
    const soldout = products.length - available.length;

    return {
      text: `Dari katalog lokal saat ini, ada ${available.length} produk tersedia dan ${soldout} produk habis. Tapi ini bukan cek stok real-time server ya kak. Untuk stok paling aman langsung konfirmasi ke admin ya kak, biar gak salah info.`,
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
    if (bot) lines.push(`- Mau langsung pakai tanpa setup ribet: ${bot.name} (${bot.price}).`);
    if (script) lines.push(`- Mau punya base bot sendiri: ${script.name} (${script.price}).`);

    if (!panel && !bot && !script) {
      lines.push("- Mulai dari panel kecil dulu kalau mau belajar/run bot.");
      lines.push("- Pilih sewa bot kalau pengin langsung pakai tanpa setup.");
      lines.push("- Pilih script kalau mau punya base bot sendiri.");
    }

    lines.push("\nKalau bingung pilih, chat admin dan jelasin kebutuhan kamu: buat grup, jualan, JPM, atau belajar bot.");

    return {
      text: lines.join("\n"),
      actions: getOrderActions(),
      quickReplies: ["Harga panel", "Sewa bot", "Script bot", "Cara order"]
    };
  }

  function createUnknownFallbackResponse() {
    return {
      text: UNKNOWN_FALLBACK_MESSAGE,
      actions: getMainActions(),
      quickReplies: DEFAULT_QUICK_REPLIES
    };
  }

  function createOutOfScopeResponse() {
    return {
      text: OUT_OF_SCOPE_MESSAGE,
      actions: getMainActions(),
      quickReplies: DEFAULT_QUICK_REPLIES
    };
  }

  function getProductsSafely() {
    try {
      if (window.ALIZZ_STORE && typeof window.ALIZZ_STORE.getProducts === "function") {
        const products = window.ALIZZ_STORE.getProducts();
        return Array.isArray(products) ? products : [];
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
      return normalizeCategory(product.category) === category && isProductAvailable(product);
    });
  }

  function findProductByName(products, name) {
    const needle = normalizeText(name);
    return products.find(function (product) {
      return normalizeText(product.name) === needle;
    });
  }

  function isProductAvailable(product) {
    if (window.ALIZZ_STORE && typeof window.ALIZZ_STORE.isAvailable === "function") {
      return window.ALIZZ_STORE.isAvailable(product);
    }
    return product && product.status === "available" && Number(product.stock) > 0;
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
      { label: "Lihat Produk", type: "link", url: "/produk/" },
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` }
    ];
  }

  function getOrderActions() {
    return [
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` },
      { label: "Buka Katalog", type: "link", url: "/produk/" }
    ];
  }

  function getDeveloperActions() {
    return [
      { label: "Chat Developer", type: "link", url: createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, GENERAL_DEV_MESSAGE) },
      { label: "Laporkan Bug", type: "link", url: createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, BUG_REPORT_MESSAGE) },
      { label: "Telegram Developer", type: "link", url: `https://t.me/${DEVELOPER_TELEGRAM_USERNAME}` }
    ];
  }

  function getSupportActions() {
    return [
      { label: "Order WhatsApp", type: "link", url: createWhatsAppUrl(ORDER_WHATSAPP_NUMBER, GENERAL_ORDER_MESSAGE) },
      { label: "Telegram Order", type: "link", url: `https://t.me/${ORDER_TELEGRAM_USERNAME}` },
      { label: "Chat Developer", type: "link", url: createWhatsAppUrl(DEVELOPER_WHATSAPP_NUMBER, GENERAL_DEV_MESSAGE) }
    ];
  }

  function isBlockedTopic(text) {
    const blocked = [
      "politik", "partai", "pemilu", "agama", "dewasa", "bokep", "porn", "seks", "sex",
      "kekerasan", "bunuh", "membunuh", "narkoba", "hack", "hacking", "crack", "cracking",
      "ddos", "phishing", "carding", "malware", "virus", "ransomware", "slot", "judi", "pinjol"
    ];

    return blocked.some(function (word) {
      return text.includes(word);
    });
  }

  function hasSensitivePattern(text) {
    const sensitive = ["password", "passwd", "token", "cookie", "secret", "apikey", "api key", "otp", "pin", "session", "auth"];
    return sensitive.some(function (word) {
      return text.includes(word);
    });
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

  function sanitizeForApi(value) {
    return sanitizePlainText(value, 420)
      .replace(/password\s*[:=]?\s*\S+/gi, "password [disembunyikan]")
      .replace(/token\s*[:=]?\s*\S+/gi, "token [disembunyikan]")
      .replace(/cookie\s*[:=]?\s*\S+/gi, "cookie [disembunyikan]")
      .replace(/otp\s*[:=]?\s*\S+/gi, "otp [disembunyikan]");
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
    return Math.min(850, Math.max(320, length * 8));
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
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
