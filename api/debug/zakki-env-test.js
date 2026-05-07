const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const { createTopup, getZakkiRuntimeInfo, sanitizeZakkiResponse, safeZakkiError } = require("../../lib/zakki");

function getPublicZakkiEnvInfo() {
  const info = getZakkiRuntimeInfo();
  return {
    zakkiBaseUrl: info.baseUrl,
    tokenExists: info.tokenExists,
    tokenLength: info.tokenLength,
    tokenSha256Prefix: info.tokenSha256Prefix,
    nodeEnv: process.env.NODE_ENV || "",
    vercelEnv: process.env.VERCEL_ENV || ""
  };
}

function safeErrorDetails(error) {
  const debug = error && error.debug && typeof error.debug === "object" ? error.debug : {};
  const responseBody = debug.responseBody && typeof debug.responseBody === "object" ? debug.responseBody : null;
  return {
    code: error && error.code ? String(error.code).slice(0, 120) : "ZAKKI_ERROR",
    message: error && error.message ? String(error.message).slice(0, 700) : "Zakki test gagal.",
    statusCode: error && error.statusCode ? Number(error.statusCode) : 502,
    responseStatus: debug.responseStatus == null ? null : Number(debug.responseStatus),
    response: responseBody ? sanitizeZakkiResponse(responseBody) : null
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  const env = getPublicZakkiEnvInfo();

  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      ...env
    });
  }

  if (!env.tokenExists || !env.zakkiBaseUrl) {
    return json(res, 500, {
      ok: false,
      message: "Zakki ENV belum lengkap.",
      ...env,
      test: {
        success: false,
        error: "ZAKKI_ENV_MISSING"
      }
    });
  }

  try {
    const response = await createTopup(1000);
    return json(res, 200, {
      ok: true,
      message: "Test create QRIS Zakki berhasil.",
      ...env,
      test: {
        success: true,
        nominal: 1000,
        response: sanitizeZakkiResponse(response)
      }
    });
  } catch (error) {
    const safe = safeZakkiError(error);
    const details = safeErrorDetails(error);
    console.error("[ZAKKI_ENV_TEST_FAILED]", JSON.stringify({
      step: "debug_zakki_env_test_create_topup",
      baseUrl: env.zakkiBaseUrl,
      tokenLength: env.tokenLength,
      tokenSha256Prefix: env.tokenSha256Prefix,
      code: details.code,
      responseStatus: details.responseStatus,
      message: details.message
    }));

    return json(res, details.statusCode >= 400 && details.statusCode < 600 ? details.statusCode : 502, {
      ok: false,
      message: safe.message,
      ...env,
      test: {
        success: false,
        error: details
      }
    });
  }
};
