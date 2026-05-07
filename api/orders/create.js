const { json, methodNotAllowed } = require("../../lib/auth");
const { readJsonBody, sanitizeString, insertRow, updateRows } = require("../../lib/supabase");
const { getClientIp, checkRequestRateLimit } = require("../../lib/rateLimit");
const { createRecoveryToken, hashRecoveryToken, createPublicCode } = require("../../lib/orderSecurity");
const { createTopup, normalizeTopupStatus, safeZakkiError, getZakkiRuntimeInfo } = require("../../lib/zakki");
const { resolveOrderProduct, buildWhatsAppOrderUrl } = require("../../lib/products");
const { addOrderEvent } = require("../../lib/orderFlow");

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "ZAKKI_API_TOKEN",
  "ZAKKI_API_BASE_URL"
];

const SAFE_DEBUG_KEYS = new Set(["tokenLength", "tokenSha256Prefix"]);

function isBlockedLogKey(key) {
  if (SAFE_DEBUG_KEYS.has(String(key))) return false;
  const lower = String(key).toLowerCase();
  const blockedKeys = ["token", "secret", "password", "authorization", "cookie", "key"];
  return blockedKeys.some((blocked) => lower.includes(blocked));
}

function safeLog(event, payload = {}) {
  const output = {};

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (isBlockedLogKey(key)) return;
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
      output[key] = typeof value === "string" ? value.slice(0, 800) : value;
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => String(item).slice(0, 160)).slice(0, 20);
    } else if (typeof value === "object") {
      output[key] = sanitizeLogObject(value);
    }
  });

  console.log(`[${event}]`, JSON.stringify(output));
}

function safeErrorLog(event, payload = {}) {
  const error = payload.error;
  const rest = { ...payload };
  delete rest.error;

  console.error(`[${event}]`, JSON.stringify({
    ...sanitizeLogObject(rest),
    error: error ? sanitizeError(error) : undefined
  }));
}

function sanitizeLogObject(input) {
  const output = {};
  Object.entries(input || {}).slice(0, 30).forEach(([key, value]) => {
    if (isBlockedLogKey(key)) return;
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) {
      output[key] = typeof value === "string" ? value.slice(0, 800) : value;
    } else {
      output[key] = String(value).slice(0, 800);
    }
  });
  return output;
}

function getZakkiResponseSummary(error) {
  const debug = error && error.debug && typeof error.debug === "object" ? error.debug : {};
  const responseBody = debug.responseBody && typeof debug.responseBody === "object" ? debug.responseBody : {};
  const data = responseBody.data && typeof responseBody.data === "object" ? responseBody.data : {};

  return {
    responseStatus: debug.responseStatus == null ? null : Number(debug.responseStatus),
    responseMessage: String(responseBody.message || responseBody.error || data.message || data.error || "").slice(0, 700) || null,
    responseCode: String(responseBody.code || responseBody.error_code || data.code || data.error_code || "").slice(0, 120) || null
  };
}

function sanitizeError(error) {
  const details = error && error.details && typeof error.details === "object" ? error.details : null;
  const debug = error && error.debug && typeof error.debug === "object" ? error.debug : {};
  const zakkiSummary = getZakkiResponseSummary(error);
  return {
    name: error && error.name ? String(error.name).slice(0, 120) : "Error",
    message: error && error.message ? String(error.message).slice(0, 800) : "Unknown error",
    statusCode: error && error.statusCode ? Number(error.statusCode) : undefined,
    code: error && error.code ? String(error.code).slice(0, 120) : details && details.code ? String(details.code).slice(0, 120) : undefined,
    details: details && details.details ? String(details.details).slice(0, 800) : undefined,
    hint: details && details.hint ? String(details.hint).slice(0, 800) : undefined,
    supabaseMessage: details && details.message ? String(details.message).slice(0, 800) : undefined,
    zakkiResponseStatus: zakkiSummary.responseStatus,
    zakkiResponseMessage: zakkiSummary.responseMessage,
    zakkiResponseCode: zakkiSummary.responseCode,
    zakkiBaseUrl: debug.baseUrl || undefined,
    tokenLength: debug.tokenLength == null ? undefined : Number(debug.tokenLength),
    tokenSha256Prefix: debug.tokenSha256Prefix || undefined
  };
}

function validateCreateOrderEnv() {
  const missing = REQUIRED_ENV.filter((name) => !String(process.env[name] || "").trim());
  const invalid = [];

  if (String(process.env.SESSION_SECRET || "").length > 0 && String(process.env.SESSION_SECRET || "").length < 32) {
    invalid.push("SESSION_SECRET_MIN_32_CHARS");
  }

  if (String(process.env.ZAKKI_API_BASE_URL || "").trim()) {
    try {
      const parsed = new URL(String(process.env.ZAKKI_API_BASE_URL).trim());
      if (!/^https?:$/.test(parsed.protocol)) invalid.push("ZAKKI_API_BASE_URL_INVALID_PROTOCOL");
    } catch (error) {
      invalid.push("ZAKKI_API_BASE_URL_INVALID_URL");
    }
  }

  if (missing.length || invalid.length) {
    const error = new Error("Order create env incomplete.");
    error.statusCode = 500;
    error.code = "ORDER_CREATE_ENV_MISSING";
    error.missing = missing;
    error.invalid = invalid;
    throw error;
  }
}

function getInsertFailureMessage(error) {
  const text = [
    error && error.message,
    error && error.details && error.details.message,
    error && error.details && error.details.details,
    error && error.details && error.details.hint
  ].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("relation") && text.includes("orders") && text.includes("does not exist")) {
    return "Database order belum siap. Hubungi admin.";
  }
  if (text.includes("column") && text.includes("does not exist")) {
    return "Database order belum sesuai migration terbaru. Hubungi admin.";
  }
  if (error && (error.statusCode === 401 || error.statusCode === 403)) {
    return "Server database belum dikonfigurasi benar. Hubungi admin.";
  }
  return "Gagal membuat order. Coba lagi atau hubungi admin.";
}

function rateLimit(req, res) {
  const limit = checkRequestRateLimit(getClientIp(req), {
    scope: "orders:create",
    windowMs: 10 * 60 * 1000,
    max: 12
  });
  if (!limit.limited) return false;
  json(res, 429, { success: false, message: "Terlalu banyak request. Coba lagi nanti." }, {
    "Retry-After": String(limit.retryAfterSeconds)
  });
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (rateLimit(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req, 24 * 1024);
  } catch (error) {
    safeErrorLog("ORDER_CREATE_VALIDATION_FAILED", { step: "read_body", error });
    return json(res, 400, { success: false, message: "Payload tidak valid." });
  }

  const productType = sanitizeString(body.product_type || body.productType, 40).toLowerCase();
  const selectedPlan = sanitizeString(body.selected_plan || body.selectedPlan, 80).toLowerCase();
  const selectedRank = sanitizeString(body.selected_rank || body.selectedRank, 40).toLowerCase();

  safeLog("ORDER_CREATE_REQUEST_RECEIVED", {
    step: "request_received",
    product_type: productType,
    selected_plan: selectedPlan,
    selected_rank: selectedRank
  });

  try {
    validateCreateOrderEnv();
  } catch (error) {
    safeErrorLog("ORDER_CREATE_ENV_MISSING", {
      step: "env_validation",
      product_type: productType,
      selected_plan: selectedPlan,
      selected_rank: selectedRank,
      missing_env: error.missing || [],
      invalid_env: error.invalid || [],
      error
    });
    return json(res, 500, { success: false, message: "Server belum dikonfigurasi lengkap. Hubungi admin." });
  }

  const product = resolveOrderProduct({ product_type: productType, selected_plan: selectedPlan, selected_rank: selectedRank });

  if (!product) {
    safeLog("ORDER_CREATE_PRODUCT_NOT_FOUND", {
      step: "product_validation",
      product_type: productType,
      selected_plan: selectedPlan,
      selected_rank: selectedRank
    });
    return json(res, 400, {
      success: false,
      message: "Produk tidak valid. Silakan refresh halaman.",
      manual_order: productType !== "panel" && productType !== "membership",
      whatsapp_url: buildWhatsAppOrderUrl({ name: "produk ALIZZ STORE" })
    });
  }

  if (!Number.isInteger(product.amount) || product.amount < 1000) {
    safeLog("ORDER_CREATE_VALIDATION_FAILED", {
      step: "amount_validation",
      product_type: product.product_type,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null,
      amount: product.amount
    });
    return json(res, 400, { success: false, message: "Harga produk minimal Rp1.000 untuk QRIS otomatis." });
  }

  const recoveryToken = createRecoveryToken();
  let order;

  try {
    order = await insertRow("orders", {
      public_code: createPublicCode(),
      recovery_token_hash: hashRecoveryToken(recoveryToken),
      product_type: product.product_type,
      product_name: product.product_name,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null,
      amount: product.amount,
      payment_provider: "zakki",
      payment_status: "pending",
      fulfillment_status: "none",
      order_status: "pending_payment"
    });

    await addOrderEvent(order.id, "order_created", "Order dibuat dan menunggu QRIS Zakki.", {
      product_type: product.product_type,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null
    });
  } catch (error) {
    safeErrorLog("ORDER_CREATE_SUPABASE_INSERT_FAILED", {
      step: "supabase_insert_order",
      product_type: product.product_type,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null,
      error
    });
    return json(res, error.statusCode === 401 || error.statusCode === 403 ? 500 : (error.statusCode || 500), {
      success: false,
      message: getInsertFailureMessage(error)
    });
  }

  try {
    const topup = await createTopup(product.amount);
    const normalized = normalizeTopupStatus(topup);
    const data = topup && topup.data ? topup.data : {};
    const rincian = data.rincian || {};
    const idTransaksi = data.id_transaksi || normalized.id_transaksi;

    if (!idTransaksi) throw new Error("Response Zakki tidak berisi id_transaksi.");

    const patch = {
      zakki_id_transaksi: idTransaksi,
      zakki_nominal_request: normalized.nominal_request || rincian.nominal_request || product.amount,
      zakki_kode_unik: normalized.kode_unik || rincian.kode_unik || null,
      zakki_total_bayar: normalized.total_bayar || rincian.total_bayar || product.amount,
      zakki_qris_image: normalized.qris_image || data.qris_image || null,
      zakki_qris_content: normalized.qris_content || data.qris_content || null,
      zakki_expired_at: normalized.expired_at || data.expired_at || null,
      updated_at: new Date().toISOString()
    };

    const updated = await updateRows("orders", { id: `eq.${order.id}` }, patch);
    order = updated[0] || { ...order, ...patch };

    await addOrderEvent(order.id, "payment_qris_created", "QRIS Zakki berhasil dibuat.", {
      zakki_id_transaksi: idTransaksi,
      total_bayar: patch.zakki_total_bayar
    });

    safeLog("ORDER_CREATE_SUCCESS", {
      step: "success",
      product_type: product.product_type,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null,
      order_id: order.id,
      public_code: order.public_code,
      total_bayar: order.zakki_total_bayar
    });

    return json(res, 200, {
      success: true,
      order_id: order.id,
      public_code: order.public_code,
      recovery_token: recoveryToken,
      product: {
        product_type: order.product_type,
        product_name: order.product_name,
        selected_plan: order.selected_plan,
        selected_rank: order.selected_rank,
        amount: order.amount
      },
      payment: {
        total_bayar: order.zakki_total_bayar,
        expired_at: order.zakki_expired_at,
        qris_image: order.zakki_qris_image,
        qris_content: order.zakki_qris_content
      }
    });
  } catch (error) {
    const safe = safeZakkiError(error);
    const zakkiDebug = getZakkiRuntimeInfo();
    const zakkiErrorDebug = error && error.debug && typeof error.debug === "object" ? error.debug : {};
    safeErrorLog("ORDER_CREATE_ZAKKI_FAILED", {
      step: "zakki_create_topup",
      product_type: product.product_type,
      selected_plan: product.selected_plan || null,
      selected_rank: product.selected_rank || null,
      order_id: order.id,
      public_code: order.public_code,
      zakki_error_code: safe.code,
      baseUrl: zakkiDebug.baseUrl,
      tokenLength: zakkiDebug.tokenLength,
      tokenSha256Prefix: zakkiDebug.tokenSha256Prefix,
      responseStatus: zakkiErrorDebug.responseStatus == null ? null : Number(zakkiErrorDebug.responseStatus),
      error
    });

    await updateRows("orders", { id: `eq.${order.id}` }, {
      payment_status: "failed",
      order_status: "manual_required",
      manual_note: "Zakki error saat create QRIS. Arahkan customer ke WhatsApp admin.",
      error_message: safe.code,
      updated_at: new Date().toISOString()
    }).catch((updateError) => {
      safeErrorLog("ORDER_CREATE_SUPABASE_INSERT_FAILED", {
        step: "supabase_update_zakki_failed_order",
        product_type: product.product_type,
        selected_plan: product.selected_plan || null,
        selected_rank: product.selected_rank || null,
        order_id: order.id,
        error: updateError
      });
    });
    await addOrderEvent(order.id, "payment_create_failed", "Gagal membuat QRIS Zakki.", { code: safe.code });

    return json(res, 502, {
      success: false,
      order_id: order.id,
      public_code: order.public_code,
      recovery_token: recoveryToken,
      message: safe.message,
      manual_required: true,
      whatsapp_url: buildWhatsAppOrderUrl(product)
    });
  }
};
