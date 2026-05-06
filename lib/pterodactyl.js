const { PANEL_PRICES } = require("./products");

const REQUEST_TIMEOUT_MS = 12000;

class PterodactylError extends Error {
  constructor(message, code, statusCode, details) {
    super(message);
    this.name = "PterodactylError";
    this.code = code || "PTERODACTYL_ERROR";
    this.statusCode = statusCode || 502;
    this.details = details;
  }
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new PterodactylError(`${name} belum dikonfigurasi.`, "PTERODACTYL_CONFIG_MISSING", 503);
  }
  return value;
}

function getDomain() {
  const domain = requiredEnv("PTERODACTYL_DOMAIN").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(domain)) return `https://${domain}`;
  return domain;
}

function getApplicationKey() {
  return requiredEnv("PTERODACTYL_APPLICATION_API_KEY");
}

function getIntEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return number;
}

function parseEggEnvironment() {
  const raw = String(process.env.PTERODACTYL_EGG_ENV_JSON || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw new PterodactylError("PTERODACTYL_EGG_ENV_JSON tidak valid.", "PTERODACTYL_BAD_ENV_JSON", 503);
  }
}

async function pterodactylFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getDomain()}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "Application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApplicationKey()}`,
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (error) { data = { raw: text.slice(0, 500) }; }
    }

    if (!response.ok) {
      const apiMessage = data?.errors?.[0]?.detail || data?.message || "Pterodactyl API gagal.";
      throw new PterodactylError(apiMessage, "PTERODACTYL_HTTP_ERROR", response.status, data);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new PterodactylError("Koneksi Pterodactyl timeout.", "PTERODACTYL_TIMEOUT", 504);
    }
    if (error instanceof PterodactylError) throw error;
    throw new PterodactylError("Koneksi Pterodactyl gagal.", "PTERODACTYL_NETWORK_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function resolvePanelPlan(productId) {
  const plan = PANEL_PRICES[String(productId || "")];
  if (!plan) throw new PterodactylError("Paket panel tidak dikenali.", "PTERODACTYL_PLAN_NOT_FOUND", 400);

  const allowUnlimitedZero = String(process.env.PTERODACTYL_ALLOW_UNLIMITED_ZERO || "false").toLowerCase() === "true";
  if (plan.memory === 0 && !allowUnlimitedZero) {
    throw new PterodactylError(
      "Paket UNLI butuh konfirmasi bahwa memory/disk/cpu 0 berarti unlimited di node Pterodactyl ini.",
      "PTERODACTYL_UNLIMITED_NOT_CONFIRMED",
      409
    );
  }

  const defaultDisk = getIntEnv("PTERODACTYL_DEFAULT_DISK_MB", 10240);
  const defaultCpu = getIntEnv("PTERODACTYL_DEFAULT_CPU_PERCENT", 100);

  return {
    productId,
    name: plan.name,
    memory: plan.memory,
    disk: plan.memory === 0 ? 0 : defaultDisk,
    cpu: plan.memory === 0 ? 0 : defaultCpu,
    swap: 0,
    io: 500
  };
}

function buildPanelEmail(username) {
  const safeUser = String(username || "panel").replace(/[^a-z0-9_]/g, "").slice(0, 32) || "panel";
  const domain = String(process.env.PTERODACTYL_USER_EMAIL_DOMAIN || "alizz-store.local").replace(/[^a-zA-Z0-9.-]/g, "") || "alizz-store.local";
  return `${safeUser}+${Date.now()}@${domain}`;
}

function assertPterodactylServerConfig(productId) {
  resolvePanelPlan(productId);
  const dockerImage = String(process.env.PTERODACTYL_EGG_DOCKER_IMAGE || "").trim();
  const startup = String(process.env.PTERODACTYL_STARTUP_CMD || "").trim();
  parseEggEnvironment();
  requiredEnv("PTERODACTYL_DOMAIN");
  requiredEnv("PTERODACTYL_APPLICATION_API_KEY");
  if (!dockerImage || !startup) {
    throw new PterodactylError(
      "Docker image/startup egg belum dikonfigurasi. Isi PTERODACTYL_EGG_DOCKER_IMAGE, PTERODACTYL_STARTUP_CMD, dan PTERODACTYL_EGG_ENV_JSON sesuai egg panel kamu.",
      "PTERODACTYL_EGG_TODO",
      503
    );
  }
  return true;
}

async function createPterodactylUser({ username, email, password }) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(cleanUsername)) {
    throw new PterodactylError("Username panel tidak valid.", "PTERODACTYL_BAD_USERNAME", 400);
  }

  const payload = {
    username: cleanUsername,
    email: email || buildPanelEmail(cleanUsername),
    first_name: cleanUsername,
    last_name: "ALIZZ",
    password: String(password || "")
  };

  const data = await pterodactylFetch("/api/application/users", {
    method: "POST",
    body: payload
  });

  return data?.attributes || data;
}

function getAvailableAllocation() {
  // Aman default: pakai deploy object Pterodactyl agar panel memilih allocation tersedia di location.
  return null;
}

async function createPterodactylServer({ userId, productId, username }) {
  const plan = resolvePanelPlan(productId);
  const eggEnv = parseEggEnvironment();
  const dockerImage = String(process.env.PTERODACTYL_EGG_DOCKER_IMAGE || "").trim();
  const startup = String(process.env.PTERODACTYL_STARTUP_CMD || "").trim();

  if (!dockerImage || !startup) {
    throw new PterodactylError(
      "Docker image/startup egg belum dikonfigurasi. Isi PTERODACTYL_EGG_DOCKER_IMAGE, PTERODACTYL_STARTUP_CMD, dan PTERODACTYL_EGG_ENV_JSON sesuai egg panel kamu.",
      "PTERODACTYL_EGG_TODO",
      503
    );
  }

  const payload = {
    name: `${username}-${productId}`.slice(0, 191),
    user: Number(userId),
    egg: getIntEnv("PTERODACTYL_EGG_ID", 17),
    docker_image: dockerImage,
    startup,
    environment: eggEnv,
    limits: {
      memory: plan.memory,
      swap: plan.swap,
      disk: plan.disk,
      io: plan.io,
      cpu: plan.cpu
    },
    feature_limits: {
      databases: getIntEnv("PTERODACTYL_FEATURE_DATABASES", 0),
      backups: getIntEnv("PTERODACTYL_FEATURE_BACKUPS", 0),
      allocations: getIntEnv("PTERODACTYL_FEATURE_ALLOCATIONS", 1)
    },
    deploy: {
      locations: [getIntEnv("PTERODACTYL_LOCATION_ID", 1)],
      dedicated_ip: false,
      port_range: []
    },
    start_on_completion: true
  };

  const data = await pterodactylFetch("/api/application/servers", {
    method: "POST",
    body: payload
  });

  return data?.attributes || data;
}

function safePterodactylError(error) {
  return {
    code: error && error.code ? error.code : "PTERODACTYL_ERROR",
    message: "Panel belum bisa dibuat otomatis. Hubungi admin dengan kode order kamu."
  };
}

module.exports = {
  PterodactylError,
  createPterodactylUser,
  createPterodactylServer,
  assertPterodactylServerConfig,
  resolvePanelPlan,
  getAvailableAllocation,
  safePterodactylError
};
