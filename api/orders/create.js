const { json, methodNotAllowed } = require("../../lib/auth");
const { readJsonBody, sanitizeString, insertRow, updateRows } = require("../../lib/supabase");
const { getClientIp, checkRequestRateLimit } = require("../../lib/rateLimit");
const { createRecoveryToken, hashRecoveryToken, createPublicCode } = require("../../lib/orderSecurity");
const { createTopup, normalizeTopupStatus, safeZakkiError } = require("../../lib/zakki");
const { resolveOrderProduct, buildWhatsAppOrderUrl } = require("../../lib/products");
const { addOrderEvent } = require("../../lib/orderFlow");

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
    return json(res, 400, { success: false, message: "Payload tidak valid." });
  }

  const productType = sanitizeString(body.product_type || body.productType, 40).toLowerCase();
  const selectedPlan = sanitizeString(body.selected_plan || body.selectedPlan, 80).toLowerCase();
  const selectedRank = sanitizeString(body.selected_rank || body.selectedRank, 40).toLowerCase();
  const product = resolveOrderProduct({ product_type: productType, selected_plan: selectedPlan, selected_rank: selectedRank });

  if (!product) {
    return json(res, 400, {
      success: false,
      message: "Checkout otomatis hanya tersedia untuk Panel PTERODACTYL dan Membership Panel.",
      manual_order: true,
      whatsapp_url: buildWhatsAppOrderUrl({ name: "produk ALIZZ STORE" })
    });
  }

  if (!Number.isInteger(product.amount) || product.amount < 1000) {
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
    return json(res, error.statusCode || 500, {
      success: false,
      message: "Gagal membuat order. Coba lagi atau hubungi admin."
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
    await updateRows("orders", { id: `eq.${order.id}` }, {
      payment_status: "failed",
      order_status: "manual_required",
      manual_note: "Zakki error saat create QRIS. Arahkan customer ke WhatsApp admin.",
      error_message: safe.code,
      updated_at: new Date().toISOString()
    }).catch(() => []);
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
