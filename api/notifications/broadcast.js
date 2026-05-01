const webPush = require("web-push");
const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  sanitizeUrl,
  sanitizeMetadata,
  selectRows,
  insertRow,
  updateRows,
  getSafeError
} = require("../../lib/supabase");

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@alizz-store.local";

  if (!publicKey || !privateKey) {
    const error = new Error("VAPID key belum dikonfigurasi.");
    error.statusCode = 503;
    throw error;
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

async function sendBroadcast(payload, source = "admin") {
  configureWebPush();

  const title = sanitizeString(payload.title, 120);
  const body = sanitizeString(payload.body, 240);
  const targetUrl = sanitizeUrl(payload.url || payload.target_url || "/produk/", 700) || "/produk/";
  const iconUrl = sanitizeUrl(payload.icon_url || payload.iconUrl || "/alizz-pp.jpg", 700) || "/alizz-pp.jpg";
  const imageUrl = sanitizeUrl(payload.image_url || payload.imageUrl || "", 700) || null;

  if (!title || !body) {
    const error = new Error("Title dan body wajib diisi.");
    error.statusCode = 400;
    throw error;
  }

  const history = await insertRow("broadcast_notifications", {
    title,
    body,
    target_url: targetUrl,
    icon_url: iconUrl,
    image_url: imageUrl,
    source,
    metadata: sanitizeMetadata(payload.metadata || {}, 20),
    sent_count: 0,
    failed_count: 0
  });

  const subscriptions = await selectRows("push_subscriptions", {
    is_active: "eq.true"
  }, {
    select: "id,endpoint,p256dh,auth,content_encoding",
    limit: 10000
  });

  let sent = 0;
  let failed = 0;

  const notificationPayload = JSON.stringify({
    title,
    body,
    url: targetUrl,
    icon: iconUrl,
    image: imageUrl || undefined
  });

  for (const item of subscriptions) {
    try {
      await webPush.sendNotification({
        endpoint: item.endpoint,
        keys: {
          p256dh: item.p256dh,
          auth: item.auth
        }
      }, notificationPayload);
      sent += 1;
    } catch (error) {
      failed += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await updateRows("push_subscriptions", { id: `eq.${item.id}` }, {
          is_active: false,
          disabled_at: new Date().toISOString()
        }).catch(() => {});
      }
    }
  }

  await updateRows("broadcast_notifications", { id: `eq.${history.id}` }, {
    sent_count: sent,
    failed_count: failed,
    completed_at: new Date().toISOString()
  });

  return { id: history.id, sent, failed, total: subscriptions.length };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  try {
    const body = await readJsonBody(req, 32 * 1024);
    const result = await sendBroadcast(body, "admin");
    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      message: "Gagal mengirim broadcast.",
      detail: getSafeError(error)
    });
  }
};

module.exports.sendBroadcast = sendBroadcast;
