const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const { selectRows, dateDaysAgo, getSafeError } = require("../../lib/supabase");

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function startOfMonth(date = new Date()) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function countWhere(events, predicate) {
  return events.filter(predicate).length;
}

function uniqueVisitors(events) {
  return new Set(events.map((event) => event.visitor_id_hash).filter(Boolean)).size;
}

function topBy(events, eventName, keyName, limit = 8) {
  const map = new Map();

  events.filter((event) => event.event_name === eventName).forEach((event) => {
    const key = event[keyName] || (event.metadata && event.metadata[keyName]) || "Tidak diketahui";
    const label = event.product_name || key;
    const item = map.get(key) || { key, label, total: 0 };
    item.total += 1;
    map.set(key, item);
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, limit);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  try {
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = dateDaysAgo(7);
    const monthStart = startOfMonth(now);

    const events = await selectRows("analytics_events", {
      created_at: `gte.${dateDaysAgo(35)}`
    }, {
      select: "id,event_name,visitor_id_hash,page_path,product_id,product_name,product_category,metadata,created_at",
      order: "created_at.desc",
      limit: 10000
    });

    const todayEvents = events.filter((event) => event.created_at >= today);
    const weekEvents = events.filter((event) => event.created_at >= weekAgo);
    const monthEvents = events.filter((event) => event.created_at >= monthStart);

    return json(res, 200, {
      ok: true,
      range: {
        today,
        weekAgo,
        monthStart
      },
      totals: {
        visitorsToday: uniqueVisitors(todayEvents),
        visitorsWeek: uniqueVisitors(weekEvents),
        visitorsMonth: uniqueVisitors(monthEvents),
        visitorsTotalWindow: uniqueVisitors(events),
        uniqueVisitorsToday: uniqueVisitors(todayEvents),
        pageViewsTotalWindow: countWhere(events, (event) => event.event_name === "page_view"),
        pageViewsToday: countWhere(todayEvents, (event) => event.event_name === "page_view"),
        whatsappOrderClicks: countWhere(events, (event) => event.event_name === "order_whatsapp_click"),
        telegramOrderClicks: countWhere(events, (event) => event.event_name === "order_telegram_click"),
        developerWhatsappClicks: countWhere(events, (event) => event.event_name === "developer_whatsapp_click"),
        testimonialChannelClicks: countWhere(events, (event) => event.event_name === "testimonial_channel_click"),
        chatbotOpen: countWhere(events, (event) => event.event_name === "chatbot_open")
      },
      topProductsViewed: topBy(events, "product_view", "product_id", 10),
      topOrderClicks: topBy(events, "order_whatsapp_click", "product_id", 10)
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      message: "Gagal mengambil summary analytics.",
      detail: getSafeError(error)
    });
  }
};