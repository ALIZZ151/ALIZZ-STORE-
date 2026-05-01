const { json, methodNotAllowed } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  sanitizeMetadata,
  hashVisitorId,
  selectRows,
  insertRow,
  updateRows,
  getSafeError
} = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const body = await readJsonBody(req, 48 * 1024);
    const subscription = body.subscription || body;
    const endpoint = sanitizeString(subscription.endpoint, 900);
    const p256dh = sanitizeString(subscription.keys && subscription.keys.p256dh, 300);
    const auth = sanitizeString(subscription.keys && subscription.keys.auth, 300);

    if (!endpoint || !p256dh || !auth) {
      return json(res, 400, { ok: false, message: "Subscription tidak valid." });
    }

    const visitorId = sanitizeString(body.visitorId, 160);
    const existing = await selectRows("push_subscriptions", {
      endpoint: `eq.${endpoint}`
    }, {
      select: "id,endpoint",
      limit: 1
    });

    const row = {
      endpoint,
      p256dh,
      auth,
      content_encoding: sanitizeString(subscription.encoding || "aes128gcm", 40) || "aes128gcm",
      visitor_id_hash: visitorId ? hashVisitorId(visitorId) : null,
      user_agent: sanitizeString(req.headers["user-agent"] || "", 400) || null,
      metadata: sanitizeMetadata(body.metadata || {}, 20),
      is_active: true,
      last_seen_at: new Date().toISOString(),
      disabled_at: null
    };

    if (existing.length) {
      const updated = await updateRows("push_subscriptions", { endpoint: `eq.${endpoint}` }, row);
      return json(res, 200, { ok: true, subscription: updated[0] || null });
    }

    const created = await insertRow("push_subscriptions", row);
    return json(res, 201, { ok: true, subscription: created });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      message: "Gagal menyimpan subscription.",
      detail: getSafeError(error)
    });
  }
};
