const https = require("https");
const http = require("http");
const { json, methodNotAllowed, requireAdmin } = require("../../lib/auth");

const TARGET_URL = "https://qris.zakki.store/cekmyip";
const REQUEST_TIMEOUT_MS = 10000;

function safeString(value, maxLength = 1500) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseBody(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      raw: safeString(text, 1500)
    };
  }
}

function requestZakkiCekMyIp() {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(TARGET_URL);
    const transport = parsedUrl.protocol === "http:" ? http : https;

    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "curl/8.0.0",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      },
      (response) => {
        let responseText = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          responseText += chunk;
          if (responseText.length > 1024 * 1024) {
            req.destroy(new Error("Zakki cekmyip response terlalu besar."));
          }
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: {
              contentType: response.headers["content-type"] || null,
              server: response.headers.server || null,
              cfRay: response.headers["cf-ray"] || null
            },
            body: parseBody(responseText)
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("ZAKKI_CEKMYIP_TIMEOUT"));
    });

    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  if (!requireAdmin(req)) {
    return json(res, 401, {
      ok: false,
      message: "Unauthorized."
    });
  }

  try {
    const result = await requestZakkiCekMyIp();

    console.log("[ZAKKI_CEKMYIP_SUCCESS]", JSON.stringify({
      statusCode: result.statusCode,
      contentType: result.headers.contentType,
      server: result.headers.server,
      cfRay: result.headers.cfRay
    }));

    return json(res, 200, {
      ok: true,
      target: TARGET_URL,
      nodeEnv: process.env.NODE_ENV || "",
      vercelEnv: process.env.VERCEL_ENV || "",
      vercelRegion: process.env.VERCEL_REGION || "",
      zakki: result
    });
  } catch (error) {
    console.error("[ZAKKI_CEKMYIP_FAILED]", JSON.stringify({
      message: safeString(error && error.message ? error.message : "Zakki cekmyip gagal."),
      nodeEnv: process.env.NODE_ENV || "",
      vercelEnv: process.env.VERCEL_ENV || "",
      vercelRegion: process.env.VERCEL_REGION || ""
    }));

    return json(res, 502, {
      ok: false,
      message: "Gagal cek IP backend ke Zakki.",
      target: TARGET_URL,
      nodeEnv: process.env.NODE_ENV || "",
      vercelEnv: process.env.VERCEL_ENV || "",
      vercelRegion: process.env.VERCEL_REGION || ""
    });
  }
};