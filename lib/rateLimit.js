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

const requestBuckets = new Map();

function checkRequestRateLimit(identifier, options = {}) {
  const key = `req:${normalizeIdentifier(identifier)}:${normalizeIdentifier(options.scope || "default")}`;
  const currentTime = now();
  const windowMs = Number(options.windowMs || WINDOW_MS);
  const max = Number(options.max || 60);
  const entry = requestBuckets.get(key);

  if (!entry || entry.resetAt <= currentTime) {
    requestBuckets.set(key, { count: 1, resetAt: currentTime + windowMs });
    return { limited: false, retryAfterSeconds: 0, remaining: Math.max(0, max - 1) };
  }

  entry.count += 1;
  requestBuckets.set(key, entry);

  if (entry.count > max) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((entry.resetAt - currentTime) / 1000),
      remaining: 0
    };
  }

  return { limited: false, retryAfterSeconds: 0, remaining: Math.max(0, max - entry.count) };
}

module.exports = {
  getClientIp,
  checkRateLimit,
  recordFailure,
  clearFailures,
  checkRequestRateLimit,
  WINDOW_MS,
  LOCK_MS,
  MAX_FAILED_ATTEMPTS
};
