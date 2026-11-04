import { isAllowedOption } from "./catalog.js";
const SDK_SCRIPT = "https://www.qvapay.com/miniapps/sdk-sim.js";

export function getQvaPaySdk() {
  return typeof window !== "undefined" ? window.QvaPay ?? null : null;
}

export function waitForQvaPay(timeoutMs = 1200) {
  const current = getQvaPaySdk();
  if (current) return Promise.resolve(current);
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      window.removeEventListener("qvapay:ready", onReady);
      clearTimeout(timer);
      resolve(value);
    };
    const onReady = () => finish(getQvaPaySdk());
    const timer = setTimeout(() => finish(getQvaPaySdk()), timeoutMs);
    window.addEventListener("qvapay:ready", onReady, { once: true });
  });
}

export function applyHostTheme(theme) {
  if (!theme?.colors || !["light", "dark"].includes(theme.mode)) return false;
  const root = document.documentElement;
  const colors = theme.colors;
  root.dataset.hostTheme = theme.mode;
  root.classList.toggle("light", theme.mode === "light");
  if (colors.bg) root.style.setProperty("--bg", colors.bg);
  if (colors.surface) root.style.setProperty("--panel", colors.surface);
  if (colors.text) root.style.setProperty("--text", colors.text);
  if (colors.primary) root.style.setProperty("--accent", colors.primary);
  return true;
}

export async function initializeQvaPay({ onStatus = () => {}, onTheme = applyHostTheme } = {}) {
  const sdk = await waitForQvaPay();
  if (!sdk) {
    onStatus({ embedded: false, message: "Modo web independiente · SDK QvaPay no detectado" });
    return { embedded: false, sdk: null, dispose() {} };
  }

  try {
    if (typeof sdk.ready === "function") await sdk.ready();
    onStatus({ embedded: true, message: "Mini-app abierta dentro de QvaPay" });
    if (typeof sdk.getTheme === "function") {
      const theme = await sdk.getTheme();
      onTheme(theme);
    }
    const themeHandler = theme => onTheme(theme);
    if (typeof sdk.on === "function") sdk.on("themeChanged", themeHandler);
    return {
      embedded: true,
      sdk,
      dispose() {
        if (typeof sdk.off === "function") sdk.off("themeChanged", themeHandler);
      }
    };
  } catch (error) {
    onStatus({ embedded: true, message: "Mini-app detectada · No se pudo sincronizar el tema" });
    return { embedded: true, sdk, error, dispose() {} };
  }
}

export function normalizeAverages(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload).map(([coin, item]) => ({
    coin,
    name: typeof item?.name === "string" ? item.name : coin,
    average: Number(item?.average) || 0,
    averageBuy: Number(item?.average_buy) || 0,
    averageSell: Number(item?.average_sell) || 0,
    count: Number(item?.count) || 0,
    countBuy: Number(item?.count_buy) || 0,
    countSell: Number(item?.count_sell) || 0,
    windowHours: Number(item?.window_hours) || 0,
    updatedAt: item?.updated_at || null
  })).filter(item => isAllowedOption(item.coin) &&
      (item.average > 0 || item.averageBuy > 0 || item.averageSell > 0))
    .sort((a, b) => a.coin.localeCompare(b.coin));
}

export async function fetchP2PAverages({ fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl("https://api.qvapay.com/p2p/averages", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error(`QvaPay respondió HTTP ${response.status}.`);
  const payload = await response.json();
  return normalizeAverages(payload);
}
