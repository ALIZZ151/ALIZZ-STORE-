const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const { getRequestOrigin, getSafeError } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return json(res, 503, { ok: false, message: "TELEGRAM_BOT_TOKEN belum diisi." });

  const origin = process.env.SITE_URL || getRequestOrigin(req);
  const webhookUrl = `${String(origin).replace(/\/+$/, "")}/api/telegram/webhook`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "edited_message"]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      return json(res, 500, { ok: false, message: data.description || "Gagal set webhook." });
    }

    return json(res, 200, {
      ok: true,
      webhookUrl,
      telegram: data
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      message: "Gagal set webhook Telegram.",
      detail: getSafeError(error)
    });
  }
};
