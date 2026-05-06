const DEFAULT_BASE_URL = "https://qris.zakki.store";
const REQUEST_TIMEOUT_MS = 10000;

class ZakkiError extends Error {
  constructor(message, code, statusCode, details) {
    super(message);
    this.name = "ZakkiError";
    this.code = code || "ZAKKI_ERROR";
    this.statusCode = statusCode || 502;
    this.details = details;
  }
}

function getBaseUrl() {
  return String(process.env.ZAKKI_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getToken() {
  const token = String(process.env.ZAKKI_API_TOKEN || "").trim();
  if (!token) throw new ZakkiError("Token Zakki belum dikonfigurasi.", "ZAKKI_TOKEN_MISSING", 503);
  return token;
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

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      method: options.method || "GET",
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
      const message = data && typeof data === "object" ? data.message || data.error : "Zakki request gagal.";
      if (response.status === 401 || response.status === 403) {
        throw new ZakkiError("Token Zakki tidak valid atau tidak punya akses.", "ZAKKI_UNAUTHORIZED", 502, data);
      }
      if (response.status === 404) {
        throw new ZakkiError("Transaksi Zakki tidak ditemukan.", "ZAKKI_NOT_FOUND", 404, data);
      }
      throw new ZakkiError(message || "Zakki request gagal.", "ZAKKI_HTTP_ERROR", 502, data);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ZakkiError("Koneksi ke Zakki timeout.", "ZAKKI_TIMEOUT", 504);
    }
    if (error instanceof ZakkiError) throw error;
    throw new ZakkiError("Koneksi ke Zakki gagal.", "ZAKKI_NETWORK_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function createTopup(amount) {
  const nominal = Number(amount);
  if (!Number.isInteger(nominal) || nominal < 1000) {
    throw new ZakkiError("Nominal QRIS minimal Rp1.000.", "ZAKKI_INVALID_AMOUNT", 400);
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
  if (!id) throw new ZakkiError("ID transaksi Zakki wajib diisi.", "ZAKKI_ID_REQUIRED", 400);
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
  safeZakkiError
};
