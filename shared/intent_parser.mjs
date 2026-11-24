/**
 * GlanceDesk — Deterministic Voice/Text Intent Parser & Safety Guard
 * Mirrors the Colab GPU Faster-Whisper server's JSON contract 1:1 so the
 * Cloudflare Worker works seamlessly both with Colab GPU Whisper AND in
 * zero-cold-start fallback mode when the Colab tunnel is sleeping.
 */

import {
  FORBIDDEN_SAFETY_PATTERNS,
  INTENTS,
  SAFETY_LIMITS,
  SYMBOL_ALIASES,
} from "./constants.mjs";
import { buildConfirmationHud, sanitizeHudText } from "./hud_formatter.mjs";

const WORD_NUMBERS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  "twenty five": 25,
  "twenty-five": 25,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
});

function extractUsdSize(text, fallback = 25) {
  const dollarMatch = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (dollarMatch) return Number(dollarMatch[1]);

  const unitMatch = text.match(/\b(\d+(?:\.\d{1,2})?)\s*(?:usd|usdc|usdt|dollars?|bucks?)\b/i);
  if (unitMatch) return Number(unitMatch[1]);

  const trailingMatch = text.match(/\b(?:for|size|of|with|bet|buy|short|long|sell)\s+(?:[a-z]+\s+){0,2}(\d+(?:\.\d{1,2})?)\b/i);
  if (trailingMatch) return Number(trailingMatch[1]);

  const lower = text.toLowerCase();
  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s*(?:dollars?|bucks?|usd|usdc|usdt)?\\b`, "i").test(lower)) {
      if (new RegExp(`\\b${word}\\s*(?:dollars?|bucks?|usd|usdc|usdt)\\b`, "i").test(lower)) {
        return value;
      }
    }
  }
  return fallback;
}

function resolveSymbol(text) {
  const lower = text.toLowerCase();
  for (const [alias, ticker] of Object.entries(SYMBOL_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(lower)) {
      return ticker;
    }
  }
  return null;
}

function matchPolymarketMarket(text, markets = []) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const m of markets) {
    const haystack = `${m.shortTitle || ""} ${m.question || ""} ${m.slug || ""}`.toLowerCase();
    const tokens = haystack
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !["will", "the", "for", "and", "before", "end", "this", "year"].includes(t));
    let score = 0;
    for (const tok of new Set(tokens)) {
      if (lower.includes(tok)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best && bestScore >= 1) return best;
  return markets[0] || {
    id: "pm-btc-100k",
    shortTitle: "BTC > $100k EOY",
    question: "Will Bitcoin reach $100k by end of year?",
    yesPrice: 0.62,
    noPrice: 0.38,
    yesPct: 62,
    noPct: 38,
  };
}

function applySizeSafetyCap(requestedUsd, maxUsd = SAFETY_LIMITS.maxOrderUsd) {
  const numeric = Number(requestedUsd);
  const safeRequested = Number.isFinite(numeric) && numeric > 0 ? numeric : 25;
  const clamped = Math.max(SAFETY_LIMITS.minOrderUsd, Math.min(safeRequested, maxUsd));
  return {
    requested_usd: safeRequested,
    size_usd: Number(clamped.toFixed(2)),
    capped: safeRequested > maxUsd,
    max_usd: maxUsd,
  };
}

/**
 * Parse a spoken or typed command into a strict GlanceDesk structured intent.
 */
export function parseVoiceIntent(rawText, options = {}) {
  const started = Date.now();
  const transcript = sanitizeHudText(rawText || "");
  const maxOrderUsd = Number(options.maxOrderUsd || SAFETY_LIMITS.maxOrderUsd);
  const marketContext = options.marketContext || {};

  if (!transcript) {
    const empty = {
      ok: false,
      transcript: "",
      action: INTENTS.UNKNOWN,
      symbol_or_market: null,
      side: null,
      size_usd: 0,
      reply_text: null,
      target_chat: null,
      confidence: 0,
      requires_confirmation: false,
      safety_caps: {
        mode: SAFETY_LIMITS.executionMode,
        max_usd: maxOrderUsd,
        capped: false,
      },
      hud_confirmation_lines: buildConfirmationHud({ action: INTENTS.UNKNOWN, transcript: "" }),
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
    return empty;
  }

  // 1. Hard Safety Guard: block mainnet, withdrawals, seed phrases, or draining attempts
  for (const pattern of FORBIDDEN_SAFETY_PATTERNS) {
    if (pattern.test(transcript)) {
      const blocked = {
        ok: false,
        transcript,
        action: INTENTS.BLOCKED_SAFETY,
        symbol_or_market: null,
        side: null,
        size_usd: 0,
        reply_text: null,
        target_chat: null,
        confidence: 1.0,
        requires_confirmation: false,
        reason: "Blocked: GlanceDesk is TESTNET/PAPER ONLY (no mainnet or withdrawals).",
        safety_caps: {
          mode: SAFETY_LIMITS.executionMode,
          max_usd: maxOrderUsd,
          capped: false,
        },
        latency_ms: Math.max(1, Date.now() - started),
        engine: options.engine || "deterministic-edge-parser",
      };
      blocked.hud_confirmation_lines = buildConfirmationHud(blocked, marketContext);
      return blocked;
    }
  }

  const lower = transcript.toLowerCase();

  // 2. CANCEL / ABORT
  if (/^(?:cancel|abort|stop|nevermind|never\s+mind|stand\s+down|dismiss|close)\b/i.test(lower)) {
    return {
      ok: true,
      transcript,
      action: INTENTS.CANCEL,
      symbol_or_market: null,
      side: null,
      size_usd: 0,
      reply_text: null,
      target_chat: null,
      confidence: 0.99,
      requires_confirmation: false,
      safety_caps: { mode: SAFETY_LIMITS.executionMode, max_usd: maxOrderUsd, capped: false },
      hud_confirmation_lines: [
        "ACTION ABORTED",
        "Returned to Glance Feed",
        "Zero orders executed",
        "[TAP=MIC] [RING=SCROLL]",
      ],
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
  }

  // 3. REPLY_TELEGRAM (Telegram voice-drafted reply loop)
  const tgMatch =
    transcript.match(/^(?:reply|respond)\s+(?:to\s+)?(?:telegram\s+)?([^:,-]{1,28}?)\s*(?::|,|-|\bsaying\b|\bthat\b)\s*(.+)$/i) ||
    transcript.match(/^(?:tell|message|text|ping|dm)\s+(?:telegram\s+)?([^:,-]{1,28}?)\s*(?::|,|-|\bsaying\b|\bthat\b|\s)\s*(.+)$/i) ||
    transcript.match(/^(?:send\s+(?:to\s+)?telegram|telegram\s+reply|tg\s+reply)\s*(?::|,|-)?\s*(.+)$/i);

  if (tgMatch) {
    const hasExplicitTarget = tgMatch.length === 3 && !/^(?:send\s+(?:to\s+)?telegram|telegram\s+reply|tg\s+reply)/i.test(transcript);
    const targetChat = hasExplicitTarget ? sanitizeHudText(tgMatch[1]) || "Alpha Desk" : "Alpha Desk";
    const replyBody = sanitizeHudText(hasExplicitTarget ? tgMatch[2] : tgMatch[1]);
    const intent = {
      ok: true,
      transcript,
      action: INTENTS.REPLY_TELEGRAM,
      symbol_or_market: "TELEGRAM",
      side: "SEND",
      size_usd: 0,
      target_chat: targetChat,
      reply_text: replyBody,
      confidence: 0.94,
      requires_confirmation: true,
      safety_caps: { mode: SAFETY_LIMITS.executionMode, max_usd: maxOrderUsd, capped: false },
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
    intent.hud_confirmation_lines = buildConfirmationHud(intent, marketContext);
    return intent;
  }

  // 4. SUMMARIZE_ALERTS
  if (/\b(?:summarize|summary|digest|alerts?|what\s+moved|brief\s+me|status|update\s+me|read\s+telegram|inbox)\b/i.test(lower)) {
    const intent = {
      ok: true,
      transcript,
      action: INTENTS.SUMMARIZE_ALERTS,
      symbol_or_market: "ALL_FEEDS",
      side: "READ",
      size_usd: 0,
      target_chat: null,
      reply_text: null,
      confidence: 0.95,
      requires_confirmation: false,
      safety_caps: { mode: SAFETY_LIMITS.executionMode, max_usd: maxOrderUsd, capped: false },
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
    intent.hud_confirmation_lines = buildConfirmationHud(intent, marketContext);
    return intent;
  }

  // 5. BUY_POLYMARKET (explicit prediction-market keywords or YES/NO bet)
  const isPolymarket =
    /\b(?:polymarket|bet|wager|odds|prediction|forecast)\b/i.test(lower) ||
    /\b(?:buy|take|put)\b.*\b(?:yes|no)\b/i.test(lower);

  if (isPolymarket) {
    const side = /\bno\b/i.test(lower) ? "NO" : "YES";
    const rawSize = extractUsdSize(transcript, 15);
    const cap = applySizeSafetyCap(rawSize, maxOrderUsd);
    const matched = matchPolymarketMarket(transcript, marketContext?.polymarket || []);
    const estPrice = side === "YES" ? matched.yesPrice ?? 0.5 : matched.noPrice ?? 0.5;
    const intent = {
      ok: true,
      transcript,
      action: INTENTS.BUY_POLYMARKET,
      symbol_or_market: matched.shortTitle || matched.question,
      market_id: matched.id || "pm-default",
      side,
      size_usd: cap.size_usd,
      estimated_price: estPrice,
      reply_text: null,
      target_chat: null,
      confidence: 0.93,
      requires_confirmation: true,
      safety_caps: {
        mode: SAFETY_LIMITS.executionMode,
        max_usd: cap.max_usd,
        requested_usd: cap.requested_usd,
        capped: cap.capped,
      },
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
    intent.hud_confirmation_lines = buildConfirmationHud(intent, marketContext);
    return intent;
  }

  // 6. PLACE_HYPERLIQUID (perpetual directional trade on Hyperliquid Testnet)
  const isLong = /\b(?:long|buy|bid)\b/i.test(lower);
  const isShort = /\b(?:short|sell|fade|hedge)\b/i.test(lower);
  const symbol = resolveSymbol(transcript);

  if ((isLong || isShort) && symbol) {
    const side = isShort ? "SHORT" : "LONG";
    const rawSize = extractUsdSize(transcript, 25);
    const cap = applySizeSafetyCap(rawSize, maxOrderUsd);
    const mid = marketContext?.hyperliquid?.mids?.[symbol] ?? null;
    const intent = {
      ok: true,
      transcript,
      action: INTENTS.PLACE_HYPERLIQUID,
      symbol_or_market: symbol,
      side,
      size_usd: cap.size_usd,
      estimated_price: mid,
      reply_text: null,
      target_chat: null,
      confidence: 0.96,
      requires_confirmation: true,
      safety_caps: {
        mode: SAFETY_LIMITS.executionMode,
        max_usd: cap.max_usd,
        requested_usd: cap.requested_usd,
        capped: cap.capped,
      },
      latency_ms: Math.max(1, Date.now() - started),
      engine: options.engine || "deterministic-edge-parser",
    };
    intent.hud_confirmation_lines = buildConfirmationHud(intent, marketContext);
    return intent;
  }

  // 7. Unknown fallback
  const unknown = {
    ok: false,
    transcript,
    action: INTENTS.UNKNOWN,
    symbol_or_market: symbol,
    side: null,
    size_usd: 0,
    reply_text: null,
    target_chat: null,
    confidence: 0.25,
    requires_confirmation: false,
    safety_caps: { mode: SAFETY_LIMITS.executionMode, max_usd: maxOrderUsd, capped: false },
    latency_ms: Math.max(1, Date.now() - started),
    engine: options.engine || "deterministic-edge-parser",
  };
  unknown.hud_confirmation_lines = buildConfirmationHud(unknown, marketContext);
  return unknown;
}
