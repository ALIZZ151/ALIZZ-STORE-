const { json, methodNotAllowed } = require("../../lib/auth");
const { readJsonBody, sanitizeString, selectRows } = require("../../lib/supabase");
const { getClientIp, checkRequestRateLimit } = require("../../lib/rateLimit");
const { verifyRecoveryToken } = require("../../lib/orderSecurity");
const { verifyAndMarkPaid, publicOrderPayload, addOrderEvent } = require("../../lib/orderFlow");
const { getMembershipLinks } = require("../../lib/products");

function rateLimit(req, res) {
  const limit = checkRequestRateLimit(getClientIp(req), {
    scope: "orders:status",
    windowMs: 60 * 1000,
    max: 30
  });
  if (!limit.limited) return false;
  json(res, 429, { success: false, message: "Terlalu banyak cek status. Coba lagi sebentar." }, {
    "Retry-After": String(limit.retryAfterSeconds)
  });
  return true;
}

async function getInput(req) {
  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    return {
      order_id: url.searchParams.get("order_id") || url.searchParams.get("orderId"),
      token: url.searchParams.get("token") || url.searchParams.get("recovery_token")
    };
  }
  return readJsonBody(req, 12 * 1024);
}

function nextStepFor(order) {
  if (order.order_status === "manual_required" || order.fulfillment_status === "failed" || order.fulfillment_status === "manual_required") return "manual_required";
  if (order.payment_status !== "paid") return "pay";
  if (order.product_category === "Membership") return "membership_links";
  if (order.product_category === "Panel" && order.fulfillment_status === "fulfilled") return "fulfilled";
  if (order.product_category === "Panel") return "submit_credentials";
  return "done";
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, ["GET", "POST"]);
  if (rateLimit(req, res)) return;

  let input;
  try {
    input = await getInput(req);
  } catch (error) {
    return json(res, 400, { success: false, message: "Payload tidak valid." });
  }

  const orderId = sanitizeString(input.order_id || input.orderId, 80);
  const token = sanitizeString(input.token || input.recovery_token || input.recoveryToken, 300);

  if (!orderId || !token) {
    return json(res, 400, { success: false, message: "Order ID dan recovery token wajib diisi." });
  }

  const rows = await selectRows("orders", { id: `eq.${orderId}` }, { limit: 1 });
  let order = rows[0];

  if (!order || !verifyRecoveryToken(token, order.recovery_token_hash)) {
    return json(res, 401, { success: false, message: "Order tidak ditemukan atau token recovery salah." });
  }

  try {
    if (order.payment_status !== "paid" && order.zakki_id_transaksi) {
      const result = await verifyAndMarkPaid(order, "customer_status_check");
      order = result.order || order;
    }
  } catch (error) {
    await addOrderEvent(order.id, "payment_status_check_failed", "Cek status Zakki gagal.", { code: error.code || "ZAKKI_ERROR" });
  }

  const payload = {
    success: true,
    order: publicOrderPayload(order),
    next_step: nextStepFor(order),
    payment: {
      total_bayar: order.zakki_total_bayar,
      expired_at: order.zakki_expired_at,
      qris_image: order.payment_status === "paid" ? null : order.zakki_qris_image,
      qris_content: order.payment_status === "paid" ? null : order.zakki_qris_content
    }
  };

  if (order.product_category === "Membership" && order.payment_status === "paid") {
    payload.membership_links = getMembershipLinks();
  }

  if (order.product_category === "Panel" && order.payment_status === "paid" && order.fulfillment_status !== "fulfilled") {
    payload.panel = {
      next_step: "submit_credentials",
      username_rules: "huruf kecil, angka, underscore, 3-32 karakter",
      password_rules: "minimal 8 karakter"
    };
  }

  if (order.product_category === "Panel" && order.fulfillment_status === "fulfilled") {
    payload.panel = {
      domain: process.env.PTERODACTYL_DOMAIN || null,
      username: order.customer_username || null,
      panel_user_id: order.panel_user_id || null,
      panel_server_id: order.panel_server_id || null,
      password_available: false,
      warning: "Password tidak disimpan. Jika hilang, hubungi admin dengan public_code order."
    };
  }

  return json(res, 200, payload);
};
