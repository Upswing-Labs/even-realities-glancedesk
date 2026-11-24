/**
 * GlanceDesk — Live Market & Telegram Feed Normalizers
 * - Polymarket Gamma API (parses JSON-stringified outcomePrices/outcomes)
 * - Hyperliquid Testnet API (POST /info {"type":"allMids"})
 * - Telegram Bot API (configurable TELEGRAM_API_BASE + env token, zero hardcoded secrets)
 */

import { SUPPORTED_PERP_SYMBOLS } from "./constants.mjs";
import { clampHudLine, sanitizeHudText } from "./hud_formatter.mjs";

export const DEFAULT_POLYMARKET_GAMMA_URL =
  "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10";
export const DEFAULT_HYPERLIQUID_TESTNET_URL = "https://api.hyperliquid-testnet.xyz/info";
export const DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org";

/** Clean curated fallback snapshot when an upstream API times out or is DNS-blocked */
export const FALLBACK_POLYMARKET_MARKETS = Object.freeze([
  {
    id: "pm-btc-100k",
    slug: "btc-100k-eoy",
    question: "Will Bitcoin reach $100k before year end?",
    shortTitle: "BTC > $100k EOY",
    yesPrice: 0.62,
    noPrice: 0.38,
    yesPct: 62,
    noPct: 38,
    volume24hr: 4_820_000,
    source: "fallback_snapshot",
  },
  {
    id: "pm-fed-cut",
    slug: "fed-rate-cut-december",
    question: "Will the Fed cut rates by 25 bps at the next FOMC?",
    shortTitle: "Fed 25bp Cut",
    yesPrice: 0.71,
    noPrice: 0.29,
    yesPct: 71,
    noPct: 29,
    volume24hr: 3_150_000,
    source: "fallback_snapshot",
  },
  {
    id: "pm-eth-etf",
    slug: "eth-staking-etf-approval",
    question: "Will spot ETH staking ETF inflows top $1B this month?",
    shortTitle: "ETH ETF > $1B",
    yesPrice: 0.44,
    noPrice: 0.56,
    yesPct: 44,
    noPct: 56,
    volume24hr: 1_940_000,
    source: "fallback_snapshot",
  },
]);

export const FALLBACK_HYPERLIQUID_MIDS = Object.freeze({
  BTC: 60244.0,
  ETH: 1696.55,
  SOL: 70.94,
  HYPE: 71.86,
  TON: 1.8,
  AVAX: 6.83,
  DOGE: 0.0565,
  ARB: 0.42,
  SUI: 0.6727,
  BNB: 550.2,
});

export const DEFAULT_TELEGRAM_DIGEST = Object.freeze([
  {
    id: "tg-101",
    chat: "Alpha Desk",
    sender: "Elena",
    text: "ETH funding flipping negative on Hyperliquid testnet, watch 1700",
    ts: "1m ago",
  },
  {
    id: "tg-102",
    chat: "Macro Alerts",
    sender: "MacroBot",
    text: "Polymarket Fed 25bp Cut jumped +6c to 71c on $3.1M 24h vol",
    ts: "4m ago",
  },
  {
    id: "tg-103",
    chat: "Upswing Ops",
    sender: "Marcus",
    text: "Need quick ack on TON testnet demo wallet before 19:00 UTC",
    ts: "9m ago",
  },
]);

function safeParseJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val !== "string") return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function shortenMarketQuestion(question) {
  const clean = sanitizeHudText(question || "Prediction Market")
    .replace(/^Will\s+/i, "")
    .replace(/\?+$/, "")
    .trim();
  return clampHudLine(clean, 24);
}

/**
 * Normalize Polymarket Gamma API `/markets` payload.
 * Handles Gamma's JSON-encoded string `outcomePrices` (e.g. '["0.65","0.35"]').
 */
export function normalizePolymarketMarkets(rawList, source = "polymarket_gamma_live") {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [...FALLBACK_POLYMARKET_MARKETS];
  }
  const normalized = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const prices = safeParseJsonArray(item.outcomePrices);
    const rawYes = Number(prices[0]);
    const rawNo = Number(prices[1]);
    const yesPrice = Number.isFinite(rawYes) && rawYes >= 0 && rawYes <= 1 ? rawYes : 0.5;
    const noPrice =
      Number.isFinite(rawNo) && rawNo >= 0 && rawNo <= 1
        ? rawNo
        : Number((1 - yesPrice).toFixed(4));
    const vol = Number(item.volume24hr ?? item.volumeNum ?? item.volume ?? 0);
    const question = sanitizeHudText(item.question || item.title || "Active Market");
    normalized.push({
      id: String(item.id || item.conditionId || item.slug || `pm-${normalized.length + 1}`),
      slug: String(item.slug || ""),
      question,
      shortTitle: shortenMarketQuestion(question),
      yesPrice: Number(yesPrice.toFixed(4)),
      noPrice: Number(noPrice.toFixed(4)),
      yesPct: Math.round(yesPrice * 100),
      noPct: Math.round(noPrice * 100),
      volume24hr: Number.isFinite(vol) ? vol : 0,
      source,
    });
  }
  normalized.sort((a, b) => b.volume24hr - a.volume24hr);
  return normalized.length > 0 ? normalized.slice(0, 6) : [...FALLBACK_POLYMARKET_MARKETS];
}

/**
 * Normalize Hyperliquid Testnet `allMids` object into numeric mids for tracked perp symbols.
 */
export function normalizeHyperliquidMids(rawMids, source = "hyperliquid_testnet_live") {
  if (!rawMids || typeof rawMids !== "object") {
    return {
      source: "fallback_snapshot",
      mids: { ...FALLBACK_HYPERLIQUID_MIDS },
      count: Object.keys(FALLBACK_HYPERLIQUID_MIDS).length,
    };
  }
  const mids = {};
  for (const sym of SUPPORTED_PERP_SYMBOLS) {
    const val = Number(rawMids[sym]);
    if (Number.isFinite(val) && val > 0) {
      mids[sym] = val;
    }
  }
  if (Object.keys(mids).length === 0) {
    return {
      source: "fallback_snapshot",
      mids: { ...FALLBACK_HYPERLIQUID_MIDS },
      count: Object.keys(FALLBACK_HYPERLIQUID_MIDS).length,
    };
  }
  return {
    source,
    mids,
    count: Object.keys(mids).length,
  };
}

/**
 * Build a Telegram Bot API method URL from configurable origin + token without hardcoding credentials.
 */
export function buildTelegramMethodUrl(apiBase, botToken, methodName) {
  const base = String(apiBase || DEFAULT_TELEGRAM_API_BASE).replace(/\/+$/, "");
  const cleanMethod = String(methodName || "getMe").replace(/[^a-zA-Z0-9_]/g, "");
  const encodedToken = encodeURIComponent(String(botToken || "").trim());
  const url = new URL(base);
  url.pathname = `/bot${encodedToken}/${cleanMethod}`;
  return url.toString();
}

export function normalizeTelegramUpdates(rawResult) {
  const updates = Array.isArray(rawResult?.result) ? rawResult.result : [];
  const messages = [];
  for (const upd of updates.slice(-10).reverse()) {
    const msg = upd?.message || upd?.channel_post;
    if (!msg || !msg.text) continue;
    messages.push({
      id: `tg-${upd.update_id}`,
      chatId: msg.chat?.id ? String(msg.chat.id) : undefined,
      chat: sanitizeHudText(msg.chat?.title || msg.chat?.username || "Telegram"),
      sender: sanitizeHudText(msg.from?.first_name || msg.from?.username || "User"),
      text: sanitizeHudText(msg.text),
      ts: msg.date ? new Date(msg.date * 1000).toISOString().slice(11, 16) + "Z" : "live",
    });
  }
  return messages;
}

async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPolymarketFeed({
  fetchImpl = fetch,
  url = DEFAULT_POLYMARKET_GAMMA_URL,
  timeoutMs = 4500,
} = {}) {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      url,
      { headers: { Accept: "application/json", "User-Agent": "GlanceDesk-EvenG2/1.0" } },
      timeoutMs,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      source: "polymarket_gamma_live",
      markets: normalizePolymarketMarkets(data, "polymarket_gamma_live"),
    };
  } catch (err) {
    return {
      source: "fallback_snapshot",
      warning: err?.message || "Polymarket Gamma unreachable",
      markets: [...FALLBACK_POLYMARKET_MARKETS],
    };
  }
}

export async function fetchHyperliquidTestnetFeed({
  fetchImpl = fetch,
  url = DEFAULT_HYPERLIQUID_TESTNET_URL,
  timeoutMs = 4500,
} = {}) {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ type: "allMids" }),
      },
      timeoutMs,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeHyperliquidMids(data, "hyperliquid_testnet_live");
  } catch (err) {
    return {
      source: "fallback_snapshot",
      warning: err?.message || "Hyperliquid Testnet unreachable",
      mids: { ...FALLBACK_HYPERLIQUID_MIDS },
      count: Object.keys(FALLBACK_HYPERLIQUID_MIDS).length,
    };
  }
}

export async function fetchTelegramDigest({
  fetchImpl = fetch,
  apiBase = DEFAULT_TELEGRAM_API_BASE,
  botToken = "",
  extraMessages = [],
  timeoutMs = 3500,
} = {}) {
  if (!botToken) {
    const combined = [...extraMessages, ...DEFAULT_TELEGRAM_DIGEST].slice(0, 8);
    return {
      mode: "paper_preview",
      unreadCount: combined.length,
      messages: combined,
    };
  }
  try {
    const url = buildTelegramMethodUrl(apiBase, botToken, "getUpdates");
    const res = await fetchWithTimeout(fetchImpl, url, { method: "GET" }, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const liveMsgs = normalizeTelegramUpdates(json);
    const combined = [...extraMessages, ...liveMsgs];
    return {
      mode: "live_bot",
      unreadCount: combined.length,
      messages: combined.length > 0 ? combined : [...DEFAULT_TELEGRAM_DIGEST],
    };
  } catch (err) {
    const combined = [...extraMessages, ...DEFAULT_TELEGRAM_DIGEST].slice(0, 8);
    return {
      mode: "live_bot_fallback",
      warning: err?.message || "Telegram getUpdates unavailable",
      unreadCount: combined.length,
      messages: combined,
    };
  }
}

export async function sendTelegramMessage({
  fetchImpl = fetch,
  apiBase = DEFAULT_TELEGRAM_API_BASE,
  botToken = "",
  chatId = "",
  text = "",
  timeoutMs = 4000,
} = {}) {
  const cleanText = String(text || "").trim().slice(0, 1000);
  if (!botToken || !chatId) {
    return {
      delivered: false,
      mode: "paper_preview",
      reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured; stored in local receipt log.",
      preview_text: cleanText,
    };
  }
  try {
    const url = buildTelegramMethodUrl(apiBase, botToken, "sendMessage");
    const res = await fetchWithTimeout(
      fetchImpl,
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: cleanText,
          disable_web_page_preview: true,
        }),
      },
      timeoutMs,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return {
        delivered: false,
        mode: "live_bot_error",
        status: res.status,
        error: data?.description || `HTTP ${res.status}`,
      };
    }
    return {
      delivered: true,
      mode: "live_bot",
      message_id: data?.result?.message_id ?? null,
    };
  } catch (err) {
    return {
      delivered: false,
      mode: "live_bot_error",
      error: err?.message || "Telegram sendMessage failed",
    };
  }
}
