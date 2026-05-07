const crypto = require("crypto");

const DEFAULT_BASE_URL = "https://qris.zakki.store";
const REQUEST_TIMEOUT_MS = 10000;

class ZakkiError extends Error {
  constructor(message, code, statusCode, details, debug = {}) {
    super(message);
    this.name = "ZakkiError";
    this.code = code || "ZAKKI_ERROR";
    this.statusCode = statusCode || 502;
    this.details = details;
    this.debug = debug;
  }
}

function getBaseUrl() {
  return String(process.env.ZAKKI_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getToken() {
  const token = String(process.env.ZAKKI_API_TOKEN || "").trim();
  if (!token) {
    throw new ZakkiError("Token Zakki belum dikonfigurasi.", "ZAKKI_TOKEN_MISSING", 503, null, getZakkiRuntimeInfo());
  }
  return token;
}

function getTokenSha256Prefix(token = process.env.ZAKKI_API_TOKEN) {
  const value = String(token || "").trim();
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function getZakkiRuntimeInfo() {
  const token = String(process.env.ZAKKI_API_TOKEN || "").trim();
  return {
    baseUrl: getBaseUrl(),
    tokenExists: Boolean(token),
    tokenLength: token.length,
    tokenSha256Prefix: getTokenSha256Prefix(token)
  };
}

function safeString(value, maxLength = 700) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeZakkiResponse(input, depth = 0) {
  if (input == null) return input;
  if (["string", "number", "boolean"].includes(typeof input)) {
    return typeof input === "string" ? safeString(input, 900) : input;
  }
  if (Array.isArray(input)) {
    return input.slice(0, 20).map((item) => sanitizeZakkiResponse(item, depth + 1));
  }
  if (typeof input !== "object") return safeString(input, 300);
  if (depth > 4) return "[object]";

  const blockedKeys = ["token", "secret", "password", "authorization", "cookie", "apikey", "api_key", "key"];
  const output = {};

  Object.entries(input).slice(0, 60).forEach(([key, value]) => {
    const lower = String(key).toLowerCase();
    if (blockedKeys.some((blocked) => lower.includes(blocked))) return;

    if (typeof value === "string") {
      if (lower.includes("qris_image") && value.length > 220) {
        output[key] = `${value.slice(0, 220)}...`;
        return;
      }
      if (lower.includes("qris_content") && value.length > 300) {
        output[key] = `${value.slice(0, 300)}...`;
        return;
      }
      output[key] = safeString(value, 900);
      return;
    }

    output[key] = sanitizeZakkiResponse(value, depth + 1);
  });

  return output;
}

function getZakkiBodySummary(body) {
  if (!body || typeof body !== "object") return { message: safeString(body, 500) || null, code: null };
  const data = body.data && typeof body.data === "object" ? body.data : {};
  return {
    message: safeString(body.message || body.error || data.message || data.error || body.raw || "", 700) || null,
    code: safeString(body.code || body.error_code || data.code || data.error_code || "", 120) || null,
    status: safeString(body.status || body.kategori_status || data.status || data.kategori_status || "", 120) || null
  };
}

function logZakkiFailure(event, payload = {}) {
  const debug = getZakkiRuntimeInfo();
  const bodySummary = getZakkiBodySummary(payload.body);
  console.error(`[${event}]`, JSON.stringify({
    step: payload.step || "zakki_request",
    method: payload.method || null,
    path: payload.path || null,
    responseStatus: payload.responseStatus == null ? null : Number(payload.responseStatus),
    responseMessage: bodySummary.message,
    responseCode: bodySummary.code,
    responseStatusText: bodySummary.status,
    baseUrl: debug.baseUrl,
    tokenLength: debug.tokenLength,
    tokenSha256Prefix: debug.tokenSha256Prefix,
    errorCode: payload.errorCode || null,
    errorMessage: payload.errorMessage ? safeString(payload.errorMessage, 700) : null
  }));
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text.slice(0, 500) };
  }
}

async function zakkiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  const method = options.method || "GET";
  const baseUrl = getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const data = await parseResponse(response);

    if (!response.ok) {
      logZakkiFailure("ZAKKI_REQUEST_FAILED", {
        step: "http_response",
        method,
        path,
        responseStatus: response.status,
        body: data
      });

      const message = data && typeof data === "object" ? data.message || data.error : "Zakki request gagal.";
      const debug = {
        ...getZakkiRuntimeInfo(),
        responseStatus: response.status,
        responseBody: sanitizeZakkiResponse(data)
      };
      if (response.status === 401 || response.status === 403) {
        throw new ZakkiError("Token Zakki tidak valid atau tidak punya akses.", "ZAKKI_UNAUTHORIZED", 502, data, debug);
      }
      if (response.status === 404) {
        throw new ZakkiError("Transaksi Zakki tidak ditemukan.", "ZAKKI_NOT_FOUND", 404, data, debug);
      }
      throw new ZakkiError(message || "Zakki request gagal.", "ZAKKI_HTTP_ERROR", 502, data, debug);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      logZakkiFailure("ZAKKI_REQUEST_FAILED", {
        step: "timeout",
        method,
        path,
        responseStatus: null,
        errorCode: "ZAKKI_TIMEOUT",
        errorMessage: "Koneksi ke Zakki timeout."
      });
      throw new ZakkiError("Koneksi ke Zakki timeout.", "ZAKKI_TIMEOUT", 504, null, getZakkiRuntimeInfo());
    }
    if (error instanceof ZakkiError) throw error;

    logZakkiFailure("ZAKKI_REQUEST_FAILED", {
      step: "network_error",
      method,
      path,
      responseStatus: null,
      errorCode: "ZAKKI_NETWORK_ERROR",
      errorMessage: error && error.message ? error.message : "Koneksi ke Zakki gagal."
    });
    throw new ZakkiError("Koneksi ke Zakki gagal.", "ZAKKI_NETWORK_ERROR", 502, null, getZakkiRuntimeInfo());
  } finally {
    clearTimeout(timeout);
  }
}

async function createTopup(amount) {
  const nominal = Number(amount);
  if (!Number.isInteger(nominal) || nominal < 1000) {
    throw new ZakkiError("Nominal QRIS minimal Rp1.000.", "ZAKKI_INVALID_AMOUNT", 400, null, getZakkiRuntimeInfo());
  }

  return zakkiFetch("/topup", {
    method: "POST",
    body: {
      token: getToken(),
      nominal
    }
  });
}

async function checkTopup(idTransaksi) {
  const id = String(idTransaksi || "").trim();
  if (!id) throw new ZakkiError("ID transaksi Zakki wajib diisi.", "ZAKKI_ID_REQUIRED", 400, null, getZakkiRuntimeInfo());
  return zakkiFetch(`/cektopup?idtopup=${encodeURIComponent(id)}`, { method: "GET" });
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.round(number);
  }
  return null;
}

function normalizeTopupStatus(response) {
  const data = response && typeof response === "object" ? response.data || {} : {};
  const rincian = data && typeof data === "object" ? data.rincian || {} : {};
  const kategoriStatus = String(response?.kategori_status || data?.kategori_status || "").toUpperCase();
  const dataStatus = String(data?.status || response?.status || "").toUpperCase();
  const status = kategoriStatus || dataStatus || "UNKNOWN";
  const totalBayar = firstNumber(
    rincian.total_bayar,
    rincian.nominal_total,
    data.total_bayar,
    data.nominal_total,
    response?.nominal_total,
    response?.nominal
  );

  return {
    paid: kategoriStatus === "SUCCESS" || dataStatus === "SUCCESS",
    status,
    kategori_status: kategoriStatus || null,
    data_status: dataStatus || null,
    id_transaksi: data.id_transaksi || response?.id_transaksi || response?.idtopup || null,
    nominal_request: firstNumber(rincian.nominal_request, data.nominal_request, response?.nominal_request),
    kode_unik: firstNumber(rincian.kode_unik, data.kode_unik, response?.kode_unik),
    total_bayar: totalBayar,
    expired_at: data.expired_at || response?.expired_at || null,
    qris_image: data.qris_image || response?.qris_image || null,
    qris_content: data.qris_content || response?.qris_content || null,
    raw: response || null
  };
}

async function verifyTopupPaid(idTransaksi, expectedTotal) {
  const response = await checkTopup(idTransaksi);
  const normalized = normalizeTopupStatus(response);
  const expected = Number(expectedTotal || 0);

  if (!normalized.paid) {
    return { paid: false, matched: false, normalized, response };
  }

  if (expected > 0 && normalized.total_bayar !== null && Number(normalized.total_bayar) !== expected) {
    return { paid: false, matched: false, normalized, response, reason: "NOMINAL_MISMATCH" };
  }

  return { paid: true, matched: true, normalized, response };
}

function safeZakkiError(error) {
  const code = error && error.code ? error.code : "ZAKKI_ERROR";
  const retryable = ["ZAKKI_TIMEOUT", "ZAKKI_NETWORK_ERROR", "ZAKKI_HTTP_ERROR"].includes(code);
  const message = code === "ZAKKI_TOKEN_MISSING" || code === "ZAKKI_UNAUTHORIZED"
    ? "Pembayaran otomatis belum siap. Silakan hubungi admin."
    : "Pembayaran otomatis sedang gangguan. Silakan coba lagi atau hubungi admin.";

  return {
    code,
    retryable,
    message
  };
}

module.exports = {
  ZakkiError,
  createTopup,
  checkTopup,
  normalizeTopupStatus,
  verifyTopupPaid,
  safeZakkiError,
  getZakkiRuntimeInfo,
  sanitizeZakkiResponse
};
