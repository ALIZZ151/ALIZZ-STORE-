const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const { selectRows } = require("../../lib/supabase");

function hasEnv(name) {
  return Boolean(String(process.env[name] || "").trim());
}

async function checkOrdersTable() {
  if (!hasEnv("SUPABASE_URL") || !hasEnv("SUPABASE_SERVICE_ROLE_KEY")) return false;
  try {
    await selectRows("orders", {}, { select: "id", limit: 1 });
    return true;
  } catch (error) {
    console.error("[ORDER_CONFIG_ORDERS_TABLE_CHECK_FAILED]", JSON.stringify({
      message: error && error.message ? String(error.message).slice(0, 500) : "Unknown error",
      statusCode: error && error.statusCode ? Number(error.statusCode) : undefined,
      code: error && error.details && error.details.code ? String(error.details.code).slice(0, 80) : undefined,
      details: error && error.details && error.details.details ? String(error.details.details).slice(0, 500) : undefined
    }));
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  const checks = {
    supabaseUrl: hasEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    sessionSecretValid: String(process.env.SESSION_SECRET || "").length >= 32,
    zakkiToken: hasEnv("ZAKKI_API_TOKEN"),
    zakkiBaseUrl: hasEnv("ZAKKI_API_BASE_URL"),
    ordersTableCheck: await checkOrdersTable()
  };

  return json(res, 200, { ok: true, checks });
};
