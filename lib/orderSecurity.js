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

module.exports = {
  createRecoveryToken,
  hashRecoveryToken,
  verifyRecoveryToken,
  createPublicCode
};
