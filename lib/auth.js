const crypto = require("crypto");

const SESSION_COOKIE_NAME = "alizz_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 4;
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_HASH_DIGEST = "sha256";

function isAuthConfigured() {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD_HASH &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32
  );
}

function json(res, statusCode, payload, extraHeaders = {}) {
  res.statusCode = statusCode;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allowedMethods) {
  json(res, 405, { ok: false, message: "Method not allowed." }, {
    Allow: allowedMethods.join(", ")
  });
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return base64UrlEncode(
    crypto.createHmac("sha256", process.env.SESSION_SECRET).update(value).digest()
  );
}

function createSessionToken(username) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  }));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqualString(sign(payload), signature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);

    if (!parsed.sub || !parsed.exp || Number(parsed.exp) <= now) return null;
    if (parsed.sub !== process.env.ADMIN_USERNAME) return null;

    return parsed;
  } catch (error) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) return cookies;

    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getSession(req) {
  if (!isAuthConfigured()) return null;
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

function requireAdmin(req) {
  const session = getSession(req);
  return Boolean(session && session.sub === process.env.ADMIN_USERNAME);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join("; ");
}

function isProductionRequest(req) {
  const proto = req.headers["x-forwarded-proto"];
  return process.env.NODE_ENV === "production" || proto === "https";
}

function createSessionCookie(req, username) {
  return serializeCookie(SESSION_COOKIE_NAME, createSessionToken(username), {
    httpOnly: true,
    secure: isProductionRequest(req),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

function clearSessionCookie(req) {
  return serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionRequest(req),
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0)
  });
}

function createPasswordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(
    String(password),
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_BYTES,
    PASSWORD_HASH_DIGEST
  );

  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${base64UrlEncode(hash)}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  const parts = String(storedHash).split("$");
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) return false;

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHash = parts[3];

  if (!Number.isSafeInteger(iterations) || iterations < 100000 || !salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.pbkdf2Sync(
    String(password),
    salt,
    iterations,
    PASSWORD_HASH_BYTES,
    PASSWORD_HASH_DIGEST
  );

  const expectedBuffer = base64UrlDecode(expectedHash);
  if (expectedBuffer.length !== actualHash.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, actualHash);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 16 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) return resolve({});

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });

    req.on("error", reject);
  });
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  isAuthConfigured,
  json,
  methodNotAllowed,
  getSession,
  requireAdmin,
  createSessionCookie,
  clearSessionCookie,
  verifyPassword,
  createPasswordHash,
  readJsonBody
};
