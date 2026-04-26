const {
  isAuthConfigured,
  json,
  methodNotAllowed,
  readJsonBody,
  verifyPassword,
  createSessionCookie
} = require("../lib/auth");
const {
  getClientIp,
  checkRateLimit,
  recordFailure,
  clearFailures
} = require("../lib/rateLimit");

const GENERIC_LOGIN_ERROR = "Login gagal. Cek username atau password.";
const LOCKOUT_LOGIN_ERROR = "Terlalu banyak percobaan login. Coba lagi beberapa menit.";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  const clientIp = getClientIp(req);
  const identifier = `login:${clientIp}`;
  const rateLimit = checkRateLimit(identifier);

  if (rateLimit.limited) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return json(res, 429, { ok: false, message: LOCKOUT_LOGIN_ERROR });
  }

  if (!isAuthConfigured()) {
    return json(res, 503, {
      ok: false,
      message: "Login admin belum dikonfigurasi."
    });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    recordFailure(identifier);
    return json(res, 400, { ok: false, message: GENERIC_LOGIN_ERROR });
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const usernameMatches = username === process.env.ADMIN_USERNAME;
  const passwordMatches = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);

  if (!usernameMatches || !passwordMatches) {
    const failedLimit = recordFailure(identifier);

    if (failedLimit.limited) {
      res.setHeader("Retry-After", String(failedLimit.retryAfterSeconds));
      return json(res, 429, { ok: false, message: LOCKOUT_LOGIN_ERROR });
    }

    return json(res, 401, { ok: false, message: GENERIC_LOGIN_ERROR });
  }

  clearFailures(identifier);
  res.setHeader("Set-Cookie", createSessionCookie(req, username));
  return json(res, 200, { ok: true });
};
