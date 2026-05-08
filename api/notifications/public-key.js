const { json, methodNotAllowed } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) {
    return json(res, 503, {
      ok: false,
      message: "VAPID_PUBLIC_KEY belum dikonfigurasi."
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return json(res, 200, {
    ok: true,
    publicKey
  });
};
