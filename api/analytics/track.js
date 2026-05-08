const crypto = require("crypto");
const { json, methodNotAllowed } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  sanitizeUrl,
  sanitizeMetadata,
  hashVisitorId,
  getClientIp,
  insertRow,
  getSafeError
} = require("../../lib/supabase");

const ALLOWED_EVENTS = new Set([
  "page_view",
  "product_view",
  "order_whatsapp_click",
  "order_telegram_click",
  "developer_whatsapp_click",
  "testimonial_channel_click",
  "chatbot_open",
  "promo_popup_click"
]);

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  let body;
  try {
    body = await readJsonBody(req, 24 * 1024);
  } catch (error) {
    return json(res, 400, { ok: false, message: "Payload tidak valid." });
  }

  const eventName = sanitizeString(body.eventName || body.event, 80);
  if (!ALLOWED_EVENTS.has(eventName)) {
    return json(res, 400, { ok: false, message: "Event tidak dikenali." });
  }

  const visitorId = sanitizeString(body.visitorId, 160) || `${getClientIp(req)}:${req.headers["user-agent"] || ""}`;
  const metadata = sanitizeMetadata(body.metadata || {}, 30);
  const productId = sanitizeString(body.productId || metadata.productId, 120) || null;
  const productName = sanitizeString(body.productName || metadata.productName, 180) || null;
  const productCategory = sanitizeString(body.productCategory || metadata.productCategory, 100) || null;
  const pagePath = sanitizeString(body.pagePath || body.path || req.headers.referer || "", 500) || null;
  const pageUrl = sanitizeUrl(body.pageUrl || "", 800) || null;
  const referrer = sanitizeUrl(body.referrer || req.headers.referer || "", 800) || null;
  const userAgent = sanitizeString(req.headers["user-agent"] || "", 400) || null;
  const ipHash = hashValue(getClientIp(req));

  try {
    const row = await insertRow("analytics_events", {
      event_name: eventName,
      visitor_id_hash: hashVisitorId(visitorId),
      session_id_hash: body.sessionId ? hashVisitorId(`session:${sanitizeString(body.sessionId, 160)}`) : null,
      page_path: pagePath,
      page_url: pageUrl,
      referrer,
      product_id: productId,
      product_name: productName,
      product_category: productCategory,
      metadata,
      user_agent: userAgent,
      ip_hash: ipHash
    });

    return json(res, 200, {
      ok: true,
      id: row && row.id ? row.id : null
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      message: "Gagal menyimpan analytics.",
      detail: getSafeError(error)
    });
  }
};