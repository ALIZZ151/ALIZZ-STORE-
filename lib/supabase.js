const crypto = require("crypto");

const MAX_BODY_SIZE = 64 * 1024;

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseBaseUrl() {
  return String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
}

function getServiceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
}

function getSafeError(error) {
  if (!error) return "Unknown error.";
  if (typeof error === "string") return error.slice(0, 180);
  return String(error.message || "Unknown error.").slice(0, 180);
}

async function readJsonBody(req, maxBytes = MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) {
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

function sanitizeString(value, maxLength = 500) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeUrl(value, maxLength = 700) {
  const cleaned = sanitizeString(value, maxLength);
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch (error) {
    if (cleaned.startsWith("/")) return cleaned.slice(0, maxLength);
    return "";
  }
}

function sanitizeMetadata(input, maxKeys = 25) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const output = {};

  Object.entries(input).slice(0, maxKeys).forEach(([key, value]) => {
    const safeKey = sanitizeString(key, 60).replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!safeKey) return;

    const lowerKey = safeKey.toLowerCase();
    const blocked = ["password", "token", "cookie", "secret", "authorization", "otp", "pin"];
    if (blocked.some((item) => lowerKey.includes(item))) return;

    if (value == null) {
      output[safeKey] = null;
    } else if (["string", "number", "boolean"].includes(typeof value)) {
      output[safeKey] = typeof value === "string" ? sanitizeString(value, 300) : value;
    } else if (Array.isArray(value)) {
      output[safeKey] = value.slice(0, 12).map((item) => sanitizeString(item, 140));
    } else {
      output[safeKey] = sanitizeString(JSON.stringify(value), 500);
    }
  });

  return output;
}

function hashVisitorId(visitorId) {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "alizz-store-anonymous";
  return crypto.createHash("sha256").update(String(visitorId || "anonymous") + ":" + secret).digest("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
}

function getRequestOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${proto}://${host}` : "";
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

async function supabaseFetch(path, options = {}) {
  if (!isSupabaseConfigured()) {
    const error = new Error("Supabase env belum dikonfigurasi.");
    error.statusCode = 503;
    throw error;
  }

  const url = `${getSupabaseBaseUrl()}/rest/v1/${path.replace(/^\/+/, "")}`;
  const headers = {
    apikey: getServiceKey(),
    Authorization: `Bearer ${getServiceKey()}`,
    "Content-Type": "application/json",
    Prefer: options.prefer || "return=representation",
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const error = new Error(
      typeof data === "object" && data
        ? data.message || data.error || "Supabase request failed."
        : "Supabase request failed."
    );
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function insertRow(table, row) {
  const data = await supabaseFetch(table, {
    method: "POST",
    body: row,
    prefer: "return=representation"
  });
  return Array.isArray(data) ? data[0] : data;
}

async function updateRows(table, filters, patch) {
  const data = await supabaseFetch(`${table}${buildQuery(filters)}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation"
  });
  return Array.isArray(data) ? data : [];
}

async function selectRows(table, filters = {}, options = {}) {
  const params = {
    select: options.select || "*",
    ...filters
  };

  if (options.order) params.order = options.order;
  if (options.limit) params.limit = options.limit;
  if (options.offset) params.offset = options.offset;

  const data = await supabaseFetch(`${table}${buildQuery(params)}`, {
    method: "GET",
    prefer: "return=representation"
  });

  return Array.isArray(data) ? data : [];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString();
}

module.exports = {
  isSupabaseConfigured,
  readJsonBody,
  sanitizeString,
  sanitizeUrl,
  sanitizeMetadata,
  hashVisitorId,
  getClientIp,
  getRequestOrigin,
  getSafeError,
  buildQuery,
  supabaseFetch,
  insertRow,
  updateRows,
  selectRows,
  todayIsoDate,
  dateDaysAgo
};