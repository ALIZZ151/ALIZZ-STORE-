const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");
const {
  readJsonBody,
  sanitizeString,
  sanitizeMetadata,
  selectRows,
  insertRow,
  updateRows,
  getSafeError
} = require("../../lib/supabase");

const VALID_TYPES = new Set(["percent", "fixed"]);
const VALID_SCOPES = new Set(["all", "category", "product"]);

function normalizeCode(value) {
  return sanitizeString(value, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function buildVoucherPayload(body, isCreate = true) {
  const type = sanitizeString(body.type, 20).toLowerCase();
  const productScope = sanitizeString(body.product_scope || body.productScope || "all", 20).toLowerCase();
  const payload = {};

  if (isCreate || body.code !== undefined) {
    const code = normalizeCode(body.code);
    if (!code || code.length < 3) throw new Error("Kode voucher minimal 3 karakter.");
    payload.code = code;
  }

  if (isCreate || body.type !== undefined) {
    if (!VALID_TYPES.has(type)) throw new Error("Type voucher harus percent atau fixed.");
    payload.type = type;
  }

  if (isCreate || body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Value voucher tidak valid.");
    if (type === "percent" && value > 100) throw new Error("Diskon persen maksimal 100.");
    payload.value = value;
  }

  if (isCreate || body.max_uses !== undefined || body.maxUses !== undefined) {
    const maxUses = Number(body.max_uses || body.maxUses || 0);
    payload.max_uses = Number.isFinite(maxUses) && maxUses > 0 ? Math.floor(maxUses) : null;
  }

  if (isCreate || body.min_order !== undefined || body.minOrder !== undefined) {
    const minOrder = Number(body.min_order || body.minOrder || 0);
    payload.min_order = Number.isFinite(minOrder) && minOrder > 0 ? minOrder : 0;
  }

  if (isCreate || body.product_scope !== undefined || body.productScope !== undefined) {
    if (!VALID_SCOPES.has(productScope)) throw new Error("Product scope tidak valid.");
    payload.product_scope = productScope;
  }

  if (isCreate || body.scope_value !== undefined || body.scopeValue !== undefined) {
    payload.scope_value = sanitizeString(body.scope_value || body.scopeValue || "", 180) || null;
  }

  if (isCreate || body.start_at !== undefined || body.startAt !== undefined) {
    payload.start_at = parseDate(body.start_at || body.startAt) || new Date().toISOString();
  }

  if (isCreate || body.end_at !== undefined || body.endAt !== undefined) {
    payload.end_at = parseDate(body.end_at || body.endAt);
  }

  if (body.is_active !== undefined || body.isActive !== undefined) {
    payload.is_active = Boolean(body.is_active !== undefined ? body.is_active : body.isActive);
  } else if (isCreate) {
    payload.is_active = true;
  }

  payload.metadata = sanitizeMetadata(body.metadata || {}, 20);
  return payload;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method)) {
    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  }

  if (!requireAdmin(req)) return json(res, 401, { ok: false, message: "Unauthorized." });

  try {
    if (req.method === "GET") {
      const includeInactive = req.query && String(req.query.includeInactive || "") === "true";
      const filters = includeInactive ? {} : { is_active: "eq.true" };

      const vouchers = await selectRows("vouchers", filters, {
        select: "*",
        order: "created_at.desc",
        limit: 500
      });

      return json(res, 200, { ok: true, vouchers });
    }

    const body = await readJsonBody(req, 32 * 1024);

    if (req.method === "POST") {
      const payload = buildVoucherPayload(body, true);
      const existing = await selectRows("vouchers", {
        code: `eq.${payload.code}`
      }, {
        select: "id,code",
        limit: 1
      });

      if (existing.length) return json(res, 409, { ok: false, message: "Kode voucher sudah ada." });

      const voucher = await insertRow("vouchers", payload);
      return json(res, 201, { ok: true, voucher });
    }

    const code = normalizeCode(body.code || (req.query && req.query.code));
    if (!code) return json(res, 400, { ok: false, message: "Kode voucher wajib diisi." });

    if (req.method === "DELETE") {
      const updated = await updateRows("vouchers", {
        code: `eq.${code}`
      }, {
        is_active: false,
        disabled_at: new Date().toISOString()
      });

      return json(res, 200, { ok: true, voucher: updated[0] || null });
    }

    if (req.method === "PUT") {
      const payload = buildVoucherPayload({ ...body, code }, false);
      delete payload.code;

      const updated = await updateRows("vouchers", {
        code: `eq.${code}`
      }, payload);

      return json(res, 200, { ok: true, voucher: updated[0] || null });
    }

    return methodNotAllowed(res, ["GET", "POST", "PUT", "DELETE"]);
  } catch (error) {
    return json(res, error.statusCode || 400, {
      ok: false,
      message: getSafeError(error)
    });
  }
};