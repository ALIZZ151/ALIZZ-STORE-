const { json, methodNotAllowed } = require("../../lib/auth");
const { readJsonBody, sanitizeString, selectRows, updateRows } = require("../../lib/supabase");
const { getClientIp, checkRequestRateLimit } = require("../../lib/rateLimit");
const { verifyRecoveryToken, encryptPanelCredentials, decryptPanelCredentials } = require("../../lib/orderSecurity");
const { createPterodactylUser, createPterodactylServer, assertPterodactylServerConfig, safePterodactylError } = require("../../lib/pterodactyl");
const { addOrderEvent, publicOrderPayload } = require("../../lib/orderFlow");

function rateLimit(req, res) {
  const limit = checkRequestRateLimit(getClientIp(req), {
    scope: "orders:submit-panel",
    windowMs: 10 * 60 * 1000,
    max: 8
  });
  if (!limit.limited) return false;
  json(res, 429, { success: false, message: "Terlalu banyak percobaan. Coba lagi nanti." }, {
    "Retry-After": String(limit.retryAfterSeconds)
  });
  return true;
}

function safePanelId(value) {
  return value == null ? null : String(value).slice(0, 80);
}

function safeDomain() {
  return process.env.PTERODACTYL_DOMAIN || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (rateLimit(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req, 16 * 1024);
  } catch (error) {
    return json(res, 400, { success: false, message: "Payload tidak valid." });
  }

  const orderId = sanitizeString(body.order_id || body.orderId, 80);
  const token = sanitizeString(body.recovery_token || body.recoveryToken || body.token, 300);
  const username = sanitizeString(body.username, 64).toLowerCase();
  const password = String(body.password || "");

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return json(res, 400, { success: false, message: "Username harus huruf kecil/angka/underscore, 3-32 karakter." });
  }

  if (password.length < 8) {
    return json(res, 400, { success: false, message: "Password panel minimal 8 karakter." });
  }

  const rows = await selectRows("orders", { id: `eq.${orderId}` }, { limit: 1 });
  let order = rows[0];

  if (!order || !verifyRecoveryToken(token, order.recovery_token_hash)) {
    return json(res, 403, { success: false, message: "Order tidak ditemukan atau token recovery salah." });
  }

  if (order.payment_status !== "paid") {
    return json(res, 409, { success: false, message: "Pembayaran belum terverifikasi." });
  }

  if (order.product_type !== "panel") {
    return json(res, 400, { success: false, message: "Order ini bukan produk Panel." });
  }

  if (order.panel_server_id || order.fulfillment_status === "fulfilled") {
    const credentials = decryptPanelCredentials(order);
    return json(res, 200, {
      success: true,
      idempotent: true,
      order: publicOrderPayload(order),
      panel: {
        domain: safeDomain() || credentials?.domain || null,
        username: credentials?.username || order.customer_username || username,
        password: credentials?.password || null,
        password_available: Boolean(credentials?.password),
        package: credentials?.package || order.product_name,
        panel_user_id: order.panel_user_id || null,
        panel_server_id: order.panel_server_id || null,
        warning: credentials?.password
          ? "Panel sudah pernah dibuat. Data hanya ditampilkan karena token order valid."
          : "Panel sudah pernah dibuat, tetapi password tidak tersedia karena encryption key belum dikonfigurasi saat order dibuat."
      }
    });
  }

  const claimed = await updateRows("orders", {
    id: `eq.${order.id}`,
    fulfillment_status: "eq.none"
  }, {
    fulfillment_status: "processing",
    customer_username: username,
    updated_at: new Date().toISOString()
  });

  if (!claimed.length) {
    const latest = await selectRows("orders", { id: `eq.${order.id}` }, { limit: 1 });
    order = latest[0] || order;
    return json(res, 409, {
      success: false,
      message: order.panel_server_id ? "Panel sudah dibuat." : "Pembuatan panel sedang diproses. Jangan klik dua kali."
    });
  }

  order = claimed[0];
  await addOrderEvent(order.id, "panel_credentials_submitted", "Customer submit username/password panel. Password tidak disimpan plaintext.", { username });

  try {
    assertPterodactylServerConfig(order.selected_plan);
    const user = await createPterodactylUser({ username, password });
    const userId = user?.id || user?.attributes?.id;
    if (!userId) throw new Error("Pterodactyl user id tidak ditemukan.");

    const server = await createPterodactylServer({
      userId,
      selectedPlan: order.selected_plan,
      username
    });
    const serverId = server?.id || server?.identifier || server?.uuid || server?.attributes?.id;

    const panelPayload = {
      domain: safeDomain(),
      username,
      password,
      package: order.product_name,
      panel_user_id: safePanelId(userId),
      panel_server_id: safePanelId(serverId)
    };
    const encrypted = encryptPanelCredentials(panelPayload);
    const credentialPatch = encrypted.encrypted ? {
      encrypted_panel_credentials: encrypted.encrypted_panel_credentials,
      encryption_iv: encrypted.encryption_iv,
      encryption_auth_tag: encrypted.encryption_auth_tag
    } : {};

    const updated = await updateRows("orders", { id: `eq.${order.id}` }, {
      fulfillment_status: "fulfilled",
      order_status: "fulfilled",
      panel_user_id: safePanelId(userId),
      panel_server_id: safePanelId(serverId),
      fulfilled_at: new Date().toISOString(),
      error_message: null,
      manual_note: encrypted.encrypted ? null : encrypted.warning,
      updated_at: new Date().toISOString(),
      ...credentialPatch
    });
    order = updated[0] || order;

    await addOrderEvent(order.id, "panel_created", "Panel berhasil dibuat di Pterodactyl.", {
      panel_user_id: safePanelId(userId),
      panel_server_id: safePanelId(serverId),
      credentials_encrypted: Boolean(encrypted.encrypted)
    });

    return json(res, 200, {
      success: true,
      order: publicOrderPayload(order),
      panel: {
        ...panelPayload,
        password_available: true,
        warning: encrypted.encrypted
          ? "Simpan data akun ini. Data hanya dapat dibuka ulang dari riwayat pembelian di perangkat/browser ini selama token order masih tersedia."
          : "Simpan data ini sekarang. PANEL_CREDENTIALS_ENCRYPTION_KEY belum valid, jadi password tidak disimpan dan tidak bisa dibuka ulang."
      }
    });
  } catch (error) {
    const safe = safePterodactylError(error);
    await updateRows("orders", { id: `eq.${order.id}` }, {
      fulfillment_status: "manual_required",
      order_status: "manual_required",
      error_message: safe.code,
      manual_note: "Pembuatan panel otomatis gagal. Admin perlu cek manual.",
      updated_at: new Date().toISOString()
    }).catch(() => []);
    await addOrderEvent(order.id, "panel_create_failed", "Pterodactyl gagal membuat panel otomatis.", { code: safe.code });

    return json(res, 502, {
      success: false,
      message: safe.message,
      public_code: order.public_code,
      manual_required: true
    });
  }
};
