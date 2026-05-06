const { json } = require("../../../lib/auth");

module.exports = async function handler(req, res) {
  return json(res, 410, {
    ok: false,
    deprecated: true,
    message: "Fitur ini sudah dinonaktifkan pada ALIZZ STORE."
  });
};
