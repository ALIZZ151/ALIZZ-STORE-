const { isAuthConfigured, json, methodNotAllowed, getSession } = require("../lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const session = getSession(req);

  return json(res, 200, {
    ok: true,
    configured: isAuthConfigured(),
    authenticated: Boolean(session),
    username: session ? session.sub : null
  });
};
