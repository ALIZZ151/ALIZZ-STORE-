const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const attempts = new Map();

function now() {
  return Date.now();
}

function getHeader(req, name) {
  const headers = req.headers || {};
  const lowerName = String(name).toLowerCase();
  const directValue = headers[lowerName];

  if (directValue !== undefined) return directValue;

  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === lowerName);
  return matchedKey ? headers[matchedKey] : undefined;
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  if (value === undefined || value === null) return "";
  return String(value);
}

function normalizeIp(value) {
  const normalized = firstHeaderValue(value).trim();
  return normalized || "unknown";
}

function getForwardedIp(value) {
  return normalizeIp(firstHeaderValue(value).split(",")[0]);
}

function normalizeIdentifier(identifier) {
  const normalized = String(identifier || "").trim();
  return normalized || "unknown";
}

function getClientIp(req) {
  // Cloudflare-ready: pakai cf-connecting-ip jika domain nanti dilewatkan via Cloudflare.
  const cloudflareIp = normalizeIp(getHeader(req, "cf-connecting-ip"));
  if (cloudflareIp !== "unknown") return cloudflareIp;

  const forwardedIp = getForwardedIp(getHeader(req, "x-forwarded-for"));
  if (forwardedIp !== "unknown") return forwardedIp;

  const realIp = normalizeIp(getHeader(req, "x-real-ip"));
  if (realIp !== "unknown") return realIp;

  const socketIp = normalizeIp(req.socket?.remoteAddress);
  if (socketIp !== "unknown") return socketIp;

  const connectionIp = normalizeIp(req.connection?.remoteAddress);
  if (connectionIp !== "unknown") return connectionIp;

  return "unknown";
}

function cleanup(identifier) {
  const key = normalizeIdentifier(identifier);
  const entry = attempts.get(key);
  if (!entry) return null;

  const currentTime = now();
  if (entry.lockedUntil && entry.lockedUntil > currentTime) return entry;
  if (entry.firstAttemptAt + WINDOW_MS > currentTime) return entry;

  attempts.delete(key);
  return null;
}

function checkRateLimit(identifier) {
  const entry = cleanup(identifier);
  if (!entry) return { limited: false, retryAfterSeconds: 0 };

  if (entry.lockedUntil && entry.lockedUntil > now()) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now()) / 1000)
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function recordFailure(identifier) {
  const key = normalizeIdentifier(identifier);
  const currentTime = now();
  const entry = cleanup(key) || {
    count: 0,
    firstAttemptAt: currentTime,
    lockedUntil: 0
  };

  entry.count += 1;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = currentTime + LOCK_MS;
  }

  attempts.set(key, entry);
  return checkRateLimit(key);
}

function clearFailures(identifier) {
  attempts.delete(normalizeIdentifier(identifier));
}

module.exports = {
  getClientIp,
  checkRateLimit,
  recordFailure,
  clearFailures,
  WINDOW_MS,
  LOCK_MS,
  MAX_FAILED_ATTEMPTS
};
