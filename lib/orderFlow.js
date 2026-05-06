const { insertRow, updateRows } = require("./supabase");
const { verifyTopupPaid } = require("./zakki");

function safeOrderError(error) {
  if (!error) return "Unknown error.";
  return String(error.message || error.code || "Unknown error.").replace(/[\r\n\t]/g, " ").slice(0, 300);
}

async function addOrderEvent(orderId, eventType, message, metadata = {}) {
  if (!orderId) return null;
  try {
    return await insertRow("order_events", {
      order_id: orderId,
      event_type: String(eventType || "event").slice(0, 80),
      message: message ? String(message).slice(0, 500) : null,
      metadata: metadata && typeof metadata === "object" ? metadata : {}
    });
  } catch (error) {
    return null;
  }
}

async function markOrderPaid(order, normalized, source) {
  const now = new Date().toISOString();
  const patch = {
    payment_status: "paid",
    order_status: order.product_type === "membership" ? "paid_membership_ready" : "paid_pending_fulfillment",
    paid_at: order.paid_at || now,
    updated_at: now,
    error_message: null
  };

  const updated = await updateRows("orders", { id: `eq.${order.id}` }, patch);
  const next = updated[0] || { ...order, ...patch };
  await addOrderEvent(order.id, "payment_paid", "Pembayaran terverifikasi dari Zakki.", {
    source: source || "status_check",
    zakki_status: normalized?.status || null,
    zakki_total_bayar: normalized?.total_bayar || null
  });
  return next;
}

async function verifyAndMarkPaid(order, source) {
  if (!order || !order.zakki_id_transaksi) return { order, changed: false, paid: false };
  if (order.payment_status === "paid") return { order, changed: false, paid: true };

  const verification = await verifyTopupPaid(order.zakki_id_transaksi, order.zakki_total_bayar);
  if (!verification.paid) {
    if (verification.reason === "NOMINAL_MISMATCH") {
      await updateRows("orders", { id: `eq.${order.id}` }, {
        order_status: "manual_required",
        error_message: "Zakki SUCCESS tapi nominal tidak cocok. Perlu cek manual admin.",
        updated_at: new Date().toISOString()
      });
      await addOrderEvent(order.id, "payment_nominal_mismatch", "Nominal Zakki tidak cocok dengan order.", {
        expected: order.zakki_total_bayar,
        actual: verification.normalized?.total_bayar || null,
        source: source || "status_check"
      });
    }
    return { order, changed: false, paid: false, verification };
  }

  const updatedOrder = await markOrderPaid(order, verification.normalized, source);
  return { order: updatedOrder, changed: true, paid: true, verification };
}

function publicOrderPayload(order) {
  return {
    id: order.id,
    public_code: order.public_code,
    product_type: order.product_type,
    product_name: order.product_name,
    selected_plan: order.selected_plan || null,
    selected_rank: order.selected_rank || null,
    amount: order.amount,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    order_status: order.order_status,
    created_at: order.created_at,
    paid_at: order.paid_at,
    fulfilled_at: order.fulfilled_at,
    customer_username: order.customer_username || null,
    panel_user_id: order.panel_user_id || null,
    panel_server_id: order.panel_server_id || null,
    error_message: order.error_message || null,
    manual_note: order.manual_note || null
  };
}

module.exports = {
  safeOrderError,
  addOrderEvent,
  markOrderPaid,
  verifyAndMarkPaid,
  publicOrderPayload
};
