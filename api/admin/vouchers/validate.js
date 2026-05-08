const { json, methodNotAllowed } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  sanitizeMetadata,
  selectRows,
  insertRow,
  getSafeError
} = require("../../lib/supabase");

function normalizeCode(value) {
  return sanitizeString(value, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function matchesScope(voucher, product) {
  const scope = voucher.product_scope || "all";
  if (scope === "all") return true;

  const scopeValue = String(voucher.scope_value || "").toLowerCase();
  if (!scopeValue) return false;

  if (scope === "category") return String(product.category || "").toLowerCase() === scopeValue;
  if (scope === "product") return String(product.id || product.productId || "").toLowerCase() === scopeValue;

  return false;
}

function calculateDiscount(voucher, subtotal) {
  if (voucher.type === "percent") {
    return Math.min(subtotal, Math.floor((subtotal * Number(voucher.value || 0)) / 100));
  }

  return Math.min(subtotal, Math.floor(Number(voucher.value || 0)));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  let body;
  try {
    body = await readJsonBody(req, 24 * 1024);
  } catch (error) {
    return json(res, 400, { ok: false, valid: false, message: "Payload tidak valid." });
  }

  const code = normalizeCode(body.code);
  const subtotal = Math.max(0, Number(body.subtotal || body.total || 0));
  const product = {
    id: sanitizeString(body.productId || body.product_id, 120),
    category: sanitizeString(body.category || body.productCategory || body.product_category, 120),
    name: sanitizeString(body.productName || body.product_name, 180)
  };

  if (!code) return json(res, 400, { ok: false, valid: false, message: "Kode voucher wajib diisi." });
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return json(res, 400, { ok: false, valid: false, message: "Subtotal tidak valid." });
  }

  try {
    const rows = await selectRows("vouchers", {
      code: `eq.${code}`
    }, {
      select: "*",
      limit: 1
    });

    const voucher = rows[0];
    const now = new Date();

    if (!voucher) return json(res, 200, { ok: true, valid: false, message: "Kode voucher tidak ditemukan." });
    if (!voucher.is_active) return json(res, 200, { ok: true, valid: false, message: "Voucher sudah tidak aktif." });
    if (voucher.start_at && new Date(voucher.start_at) > now) {
      return json(res, 200, { ok: true, valid: false, message: "Voucher belum mulai." });
    }
    if (voucher.end_at && new Date(voucher.end_at) < now) {
      return json(res, 200, { ok: true, valid: false, message: "Voucher sudah expired." });
    }
    if (voucher.max_uses && Number(voucher.used_count || 0) >= Number(voucher.max_uses)) {
      return json(res, 200, { ok: true, valid: false, message: "Limit penggunaan voucher sudah habis." });
    }
    if (Number(voucher.min_order || 0) > subtotal) {
      return json(res, 200, {
        ok: true,
        valid: false,
        message: `Minimal order ${rupiah(voucher.min_order)}.`
      });
    }
    if (!matchesScope(voucher, product)) {
      return json(res, 200, { ok: true, valid: false, message: "Voucher tidak berlaku untuk produk ini." });
    }

    const discount = calculateDiscount(voucher, subtotal);
    const totalAfterDiscount = Math.max(0, subtotal - discount);

    await insertRow("voucher_usages", {
      voucher_id: voucher.id,
      voucher_code: voucher.code,
      product_id: product.id || null,
      product_name: product.name || null,
      subtotal,
      discount,
      total_after_discount: totalAfterDiscount,
      status: "validated",
      metadata: sanitizeMetadata(body.metadata || {}, 15)
    });

    return json(res, 200, {
      ok: true,
      valid: true,
      voucher: {
        code: voucher.code,
        type: voucher.type,
        value: Number(voucher.value),
        product_scope: voucher.product_scope,
        scope_value: voucher.scope_value
      },
      discount,
      totalAfterDiscount,
      formatted: {
        subtotal: rupiah(subtotal),
        discount: rupiah(discount),
        totalAfterDiscount: rupiah(totalAfterDiscount)
      }
    });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      valid: false,
      message: "Gagal validasi voucher.",
      detail: getSafeError(error)
    });
  }
};