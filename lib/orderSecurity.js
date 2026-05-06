const crypto = require("crypto");

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) {
    const error = new Error("SESSION_SECRET minimal 32 karakter wajib dikonfigurasi.");
    error.statusCode = 503;
    throw error;
  }
  return secret;
}

function createRecoveryToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashRecoveryToken(token) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(String(token || ""))
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyRecoveryToken(token, storedHash) {
  if (!token || !storedHash) return false;
  return safeEqual(hashRecoveryToken(token), storedHash);
}

function createPublicCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `ALZ-${date}-${suffix}`;
}

function getCredentialKey() {
  const raw = String(process.env.PANEL_CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");

  try {
    const base64 = Buffer.from(raw, "base64");
    if (base64.length === 32) return base64;
  } catch (error) {}

  if (raw.length >= 32) return crypto.createHash("sha256").update(raw).digest();
  return null;
}

function encryptPanelCredentials(credentials) {
  const key = getCredentialKey();
  if (!key) {
    return {
      encrypted: false,
      warning: "PANEL_CREDENTIALS_ENCRYPTION_KEY belum valid. Data panel ditampilkan sekali saja dan tidak disimpan plaintext."
    };
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify(credentials || {});
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: true,
    encrypted_panel_credentials: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_auth_tag: authTag.toString("base64")
  };
}

function decryptPanelCredentials(order) {
  const key = getCredentialKey();
  if (!key || !order || !order.encrypted_panel_credentials || !order.encryption_iv || !order.encryption_auth_tag) return null;

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(order.encryption_iv, "base64"));
    decipher.setAuthTag(Buffer.from(order.encryption_auth_tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(order.encrypted_panel_credentials, "base64")),
      decipher.final()
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  createRecoveryToken,
  hashRecoveryToken,
  verifyRecoveryToken,
  createPublicCode,
  encryptPanelCredentials,
  decryptPanelCredentials
};
