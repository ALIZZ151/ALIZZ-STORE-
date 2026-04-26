const { json, methodNotAllowed, clearSessionCookie } = require("../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  res.setHeader("Set-Cookie", clearSessionCookie(req));
  return json(res, 200, { ok: true });
};
