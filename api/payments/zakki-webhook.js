const { json, methodNotAllowed } = require("../../lib/auth");
const { readJsonBody, sanitizeString, insertRow, updateRows, selectRows } = require("../../lib/supabase");
const { verifyAndMarkPaid, addOrderEvent } = require("../../lib/orderFlow");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  let payload;
  try {
    payload = await readJsonBody(req, 64 * 1024);
  } catch (error) {
    return json(res, 200, { ok: true });
  }

  const idTransaksi = sanitizeString(payload.id_transaksi || payload.idtopup || payload.id, 160);
  let callbackRow = null;

  try {
    callbackRow = await insertRow("payment_callbacks", {
      provider: "zakki",
      provider_transaction_id: idTransaksi || null,
      payload,
      verified: false
    });
  } catch (error) {
    // Tetap 200 agar Zakki tidak retry agresif; error internal dilihat dari logs Vercel/Supabase.
  }

  if (!idTransaksi) {
    return json(res, 200, { ok: true });
  }

  try {
    const rows = await selectRows("orders", { zakki_id_transaksi: `eq.${idTransaksi}` }, { limit: 1 });
    const order = rows[0];
    if (!order) {
      return json(res, 200, { ok: true });
    }

    const result = await verifyAndMarkPaid(order, "zakki_webhook");
    if (callbackRow && result.paid) {
      await updateRows("payment_callbacks", { id: `eq.${callbackRow.id}` }, { verified: true });
    }
    await addOrderEvent(order.id, "zakki_webhook_received", "Webhook Zakki diterima dan diverifikasi ulang.", {
      verified: Boolean(result.paid),
      callback_id: callbackRow?.id || null
    });
  } catch (error) {
    // Jangan expose stack trace atau error mentah ke Zakki/customer.
  }

  return json(res, 200, { ok: true });
};
