const { json, methodNotAllowed } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  insertRow,
  updateRows,
  selectRows,
  dateDaysAgo,
  getSafeError
} = require("../../lib/supabase");

async function telegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum diisi.");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || "Telegram API error.");
  }

  return data;
}

async function reply(chatId, text) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

function isAdmin(chatId) {
  const adminChatId = String(process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  return adminChatId && String(chatId) === adminChatId;
}

function parseCommand(text) {
  const value = sanitizeString(text, 2000);
  const [commandRaw, ...rest] = value.split(/\s+/);
  return {
    command: String(commandRaw || "").split("@")[0].toLowerCase(),
    args: rest,
    rawArgs: value.slice(String(commandRaw || "").length).trim()
  };
}

function startText() {
  return [
    "👋 <b>ALIZZ STORE Admin Bot</b>",
    "",
    "Command:",
    "/myid - lihat chat id",
    "/stat - ringkasan pengunjung",
    "/voucher - list voucher aktif",
    "/buatvoucher KODE percent/fixed VALUE MAX_USES EXPIRED_YYYY-MM-DD",
    "/hapusvoucher KODE - nonaktifkan voucher",
    "/ceknotif - statistik notifikasi",
    "/notif TITLE | BODY | URL - broadcast push notification"
  ].join("\n");
}

function normalizeCode(value) {
  return sanitizeString(value, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function countWhere(events, predicate) {
  return events.filter(predicate).length;
}

function uniqueVisitors(events) {
  return new Set(events.map((event) => event.visitor_id_hash).filter(Boolean)).size;
}

async function handleStat(chatId) {
  const today = startOfDay(new Date());
  const weekAgo = dateDaysAgo(7);
  const events = await selectRows("analytics_events", {
    created_at: `gte.${dateDaysAgo(35)}`
  }, {
    select: "event_name,visitor_id_hash,product_id,product_name,metadata,created_at",
    order: "created_at.desc",
    limit: 10000
  });

  const todayEvents = events.filter((event) => event.created_at >= today);
  const weekEvents = events.filter((event) => event.created_at >= weekAgo);
  const orderToday = countWhere(todayEvents, (event) => event.event_name === "order_whatsapp_click");

  const topMap = new Map();
  events.filter((event) => event.event_name === "product_view").forEach((event) => {
    const key = event.product_name || (event.metadata && event.metadata.productName) || event.product_id || "Tidak diketahui";
    topMap.set(key, (topMap.get(key) || 0) + 1);
  });
  const top = Array.from(topMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const lines = [
    "📊 <b>Statistik ALIZZ STORE</b>",
    `Pengunjung hari ini: ${uniqueVisitors(todayEvents)}`,
    `Pengunjung minggu ini: ${uniqueVisitors(weekEvents)}`,
    `Page view hari ini: ${countWhere(todayEvents, (event) => event.event_name === "page_view")}`,
    `Klik order hari ini: ${orderToday}`,
    "",
    "Produk rame:"
  ];

  if (top.length) top.forEach(([name, total], index) => lines.push(`${index + 1}. ${name} — ${total} view`));
  else lines.push("Belum ada data.");

  await reply(chatId, lines.join("\n"));
}

async function handleVoucherList(chatId) {
  const vouchers = await selectRows("vouchers", {
    is_active: "eq.true"
  }, {
    select: "code,type,value,max_uses,used_count,end_at,product_scope,scope_value",
    order: "created_at.desc",
    limit: 20
  });

  if (!vouchers.length) {
    await reply(chatId, "Belum ada voucher aktif.");
    return;
  }

  const lines = ["🎟️ <b>Voucher Aktif</b>"];
  vouchers.forEach((voucher) => {
    const discount = voucher.type === "percent" ? `${Number(voucher.value)}%` : `Rp${Number(voucher.value).toLocaleString("id-ID")}`;
    lines.push(`- ${voucher.code}: ${discount} (${voucher.used_count || 0}/${voucher.max_uses || "∞"})`);
  });
  await reply(chatId, lines.join("\n"));
}

async function handleCreateVoucher(chatId, args) {
  if (args.length < 5) {
    await reply(chatId, "Format salah.\nContoh:\n/buatvoucher ALIZZ10 percent 10 100 2026-12-31");
    return;
  }

  const code = normalizeCode(args[0]);
  const type = sanitizeString(args[1], 20).toLowerCase();
  const value = Number(args[2]);
  const maxUses = Number(args[3]);
  const expired = args[4];

  if (!code || !["percent", "fixed"].includes(type) || !Number.isFinite(value) || value <= 0) {
    await reply(chatId, "Data voucher tidak valid.");
    return;
  }

  const endDate = new Date(`${expired}T23:59:59+07:00`);
  if (Number.isNaN(endDate.getTime())) {
    await reply(chatId, "Tanggal expired tidak valid. Pakai YYYY-MM-DD.");
    return;
  }

  const existing = await selectRows("vouchers", { code: `eq.${code}` }, { select: "id,code", limit: 1 });
  if (existing.length) {
    await reply(chatId, `Voucher ${code} sudah ada.`);
    return;
  }

  await insertRow("vouchers", {
    code,
    type,
    value,
    max_uses: Number.isFinite(maxUses) && maxUses > 0 ? Math.floor(maxUses) : null,
    min_order: 0,
    product_scope: "all",
    scope_value: null,
    start_at: new Date().toISOString(),
    end_at: endDate.toISOString(),
    is_active: true,
    metadata: { source: "telegram" }
  });

  await reply(chatId, `✅ Voucher ${code} berhasil dibuat.`);
}

async function handleDeleteVoucher(chatId, args) {
  const code = normalizeCode(args[0]);
  if (!code) {
    await reply(chatId, "Format: /hapusvoucher KODE");
    return;
  }

  const updated = await updateRows("vouchers", { code: `eq.${code}` }, {
    is_active: false,
    disabled_at: new Date().toISOString()
  });

  await reply(chatId, updated.length ? `✅ Voucher ${code} dinonaktifkan.` : `Voucher ${code} tidak ditemukan.`);
}

async function handleNotificationStats(chatId) {
  const events = await selectRows("analytics_events", {
    event_name: "in.(notification_prompt_shown,notification_permission_granted,notification_permission_denied,notification_permission_skipped)"
  }, {
    select: "event_name,created_at",
    limit: 10000
  }).catch(() => []);

  const subscriptions = await selectRows("push_subscriptions", { is_active: "eq.true" }, { select: "id", limit: 10000 }).catch(() => []);
  const broadcasts = await selectRows("broadcast_notifications", {}, { select: "sent_count,failed_count", limit: 1000 }).catch(() => []);

  const sent = broadcasts.reduce((sum, item) => sum + Number(item.sent_count || 0), 0);
  const failed = broadcasts.reduce((sum, item) => sum + Number(item.failed_count || 0), 0);

  await reply(chatId, [
    "🔔 <b>Statistik Notifikasi</b>",
    `Prompt shown: ${countWhere(events, (e) => e.event_name === "notification_prompt_shown")}`,
    `Granted: ${countWhere(events, (e) => e.event_name === "notification_permission_granted")}`,
    `Denied/Skipped: ${countWhere(events, (e) => e.event_name === "notification_permission_denied" || e.event_name === "notification_permission_skipped")}`,
    `Subscriber aktif: ${subscriptions.length}`,
    `Broadcast sent: ${sent}`,
    `Broadcast failed: ${failed}`
  ].join("\n"));
}

async function handlePushNotification(chatId, rawArgs) {
  const parts = rawArgs.split("|").map((item) => sanitizeString(item, 300).trim());
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    await reply(chatId, "Format:\n/notif TITLE | BODY | URL");
    return;
  }

  try {
    const { sendBroadcast } = require("../notifications/broadcast");
    const result = await sendBroadcast({
      title: parts[0],
      body: parts[1],
      url: parts[2],
      metadata: { source: "telegram" }
    }, "telegram");
    await reply(chatId, `✅ Notifikasi dikirim.\nSubscriber: ${result.total}\nTerkirim: ${result.sent}\nGagal: ${result.failed}`);
  } catch (error) {
    await reply(chatId, `Gagal kirim notifikasi: ${sanitizeString(error.message, 160)}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  let update;
  try {
    update = await readJsonBody(req, 128 * 1024);
  } catch (error) {
    return json(res, 400, { ok: false, message: "Invalid Telegram payload." });
  }

  const message = update.message || update.edited_message || {};
  const chatId = message.chat && message.chat.id;
  const text = sanitizeString(message.text || "", 2000);

  if (!chatId || !text) return json(res, 200, { ok: true });

  const parsed = parseCommand(text);
  const admin = isAdmin(chatId);

  try {
    await insertRow("telegram_bot_logs", {
      chat_id: String(chatId),
      command: parsed.command,
      message_text: text,
      status: admin || parsed.command === "/myid" ? "accepted" : "denied"
    }).catch(() => {});

    if (parsed.command === "/myid") {
      await reply(chatId, `Chat ID kamu:\n<code>${chatId}</code>`);
      return json(res, 200, { ok: true });
    }

    if (!admin) {
      await reply(chatId, "Akses ditolak.");
      return json(res, 200, { ok: true });
    }

    if (parsed.command === "/start") await reply(chatId, startText());
    else if (parsed.command === "/stat") await handleStat(chatId);
    else if (parsed.command === "/voucher") await handleVoucherList(chatId);
    else if (parsed.command === "/buatvoucher") await handleCreateVoucher(chatId, parsed.args);
    else if (parsed.command === "/hapusvoucher") await handleDeleteVoucher(chatId, parsed.args);
    else if (parsed.command === "/ceknotif") await handleNotificationStats(chatId);
    else if (parsed.command === "/notif") await handlePushNotification(chatId, parsed.rawArgs);
    else await reply(chatId, "Command tidak dikenal.\n\n" + startText());

    return json(res, 200, { ok: true });
  } catch (error) {
    await reply(chatId, `Error: ${sanitizeString(getSafeError(error), 160)}`).catch(() => {});
    return json(res, 200, { ok: false, message: getSafeError(error) });
  }
};
