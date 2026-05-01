(function () {
  const CHAT_STORAGE_KEY = "alizz_chatbot_session_v1";
  const CHAT_STORAGE_VERSION = 1;
  const MAX_MESSAGES = 90;

  function storageAvailable() {
    try {
      const testKey = "__alizz_chatbot_storage_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  function sanitizeText(value, maxLength) {
    const limit = Number(maxLength) > 0 ? Number(maxLength) : 900;
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function sanitizeAction(action) {
    if (!action || typeof action !== "object") return null;

    const label = sanitizeText(action.label, 60);
    const url = sanitizeText(action.url, 600);
    const type = ["link", "reply"].includes(action.type) ? action.type : "link";
    const value = sanitizeText(action.value, 180);

    if (!label) return null;
    if (type === "link" && !/^https:\/\//i.test(url)) return null;
    if (type === "reply" && !value) return null;

    return { label, type, url, value };
  }

  function sanitizeMessage(message) {
    if (!message || typeof message !== "object") return null;

    const role = message.role === "user" ? "user" : "bot";
    const text = sanitizeText(message.text, 1200);
    const timestamp = Number(message.timestamp);
    const id = sanitizeText(message.id, 80) || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const actions = Array.isArray(message.actions)
      ? message.actions.map(sanitizeAction).filter(Boolean).slice(0, 6)
      : [];

    if (!text) return null;

    return {
      id,
      role,
      text,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      actions
    };
  }

  function normalizeMessages(value) {
    const source = Array.isArray(value)
      ? value
      : value && Array.isArray(value.messages)
        ? value.messages
        : [];

    return source
      .map(sanitizeMessage)
      .filter(Boolean)
      .slice(-MAX_MESSAGES);
  }

  function getMessages() {
    if (!storageAvailable()) return [];

    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return normalizeMessages(parsed);
    } catch (error) {
      clearMessages();
      return [];
    }
  }

  function saveMessages(messages) {
    if (!storageAvailable()) return false;

    const sanitized = normalizeMessages(messages);
    const payload = {
      storageVersion: CHAT_STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      messages: sanitized
    };

    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function addMessage(message) {
    const messages = getMessages();
    const sanitized = sanitizeMessage(message);
    if (!sanitized) return messages;

    messages.push(sanitized);
    saveMessages(messages);
    return getMessages();
  }

  function clearMessages() {
    if (!storageAvailable()) return false;

    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  window.ALIZZ_CHATBOT_DB = {
    CHAT_STORAGE_KEY,
    CHAT_STORAGE_VERSION,
    MAX_MESSAGES,
    getMessages,
    saveMessages,
    clearMessages,
    addMessage
  };
})();
