const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const { readJsonBody, sanitizeString, selectRows } = require("../../lib/supabase");
const { verifyAndMarkPaid } = require("../../lib/orderFlow");

const SELECT_FIELDS = [
  "id",
  "public_code",
  "product_name",
  "product_category",
  "selected_rank",
  "amount",
  "zakki_total_bayar",
  "payment_status",
  "fulfillment_status",
  "order_status",
  "created_at",
  "paid_at",
  "fulfilled_at",
  "customer_username",
  "panel_user_id",
  "panel_server_id",
  "error_message",
  "manual_note",
  "zakki_id_transaksi"
].join(",");

async function listOrders() {
  return selectRows("orders", {}, {
    select: SELECT_FIELDS,
    order: "created_at.desc",
    limit: 80
  });
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(res, ["GET", "POST"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  if (req.method === "GET") {
    const orders = await listOrders();
    return json(res, 200, { ok: true, orders });
  }

  let body;
  try {
    body = await readJsonBody(req, 12 * 1024);
  } catch (error) {
    return json(res, 400, { ok: false, message: "Payload tidak valid." });
  }

  const action = sanitizeString(body.action, 60);
  const orderId = sanitizeString(body.order_id || body.orderId, 80);
  if (action !== "check_payment" || !orderId) {
    return json(res, 400, { ok: false, message: "Action tidak valid." });
  }

  const rows = await selectRows("orders", { id: `eq.${orderId}` }, { limit: 1 });
  const order = rows[0];
  if (!order) return json(res, 404, { ok: false, message: "Order tidak ditemukan." });

  try {
    await verifyAndMarkPaid(order, "admin_check_payment");
  } catch (error) {
    // Biarkan admin lihat status lama; error mentah tidak diexpose.
  }

  const orders = await listOrders();
  return json(res, 200, { ok: true, orders });
};
