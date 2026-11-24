/**
 * GlanceDesk — 576x288 4-Bit Monochrome Green Waveguide HUD Formatter
 * Enforces Even Realities G2 readability (<= 4 lines, <= 36 chars/line) and
 * validates EvenHub SDK 0.0.16 page container rules before sending to bridge.
 */

import { G2_DISPLAY, HUD_STATES, INTENTS } from "./constants.mjs";

const textEncoder = new TextEncoder();

/**
 * Normalize text for monochrome green micro-LED readability:
 * collapses whitespace, strips emoji/unsupported unicode, preserves ASCII + middle-dot.
 */
export function sanitizeHudText(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[•]/g, "·")
    .replace(/[—–]/g, "-")
    .replace(/[^\x20-\x7E·●▲▼]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Truncate a single HUD line cleanly to <= maxChars (default 36 for 576px width).
 */
export function clampHudLine(line, maxChars = G2_DISPLAY.maxLineChars) {
  const clean = sanitizeHudText(line);
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, maxChars);
  return `${clean.slice(0, maxChars - 2).trimEnd()}..`;
}

/**
 * Ensure an array of HUD lines strictly conforms to <= 4 lines and <= 36 chars/line.
 */
export function normalizeHudLines(lines, maxLines = G2_DISPLAY.maxHudLines, maxChars = G2_DISPLAY.maxLineChars) {
  const arr = Array.isArray(lines) ? lines : [String(lines ?? "")];
  const out = [];
  for (const item of arr) {
    if (out.length >= maxLines) break;
    const clamped = clampHudLine(item, maxChars);
    if (clamped.length > 0) out.push(clamped);
  }
  while (out.length < 1) {
    out.push("GLANCEDESK READY · TAP MIC");
  }
  return out;
}

export function formatUsd(amount, decimals = 2) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1000 && decimals === 0) {
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
  if (Math.abs(n) >= 1) {
    return `$${n.toFixed(decimals).replace(/\.00$/, "")}`;
  }
  return `$${n.toFixed(4)}`;
}

export function formatCompactVolume(vol) {
  const n = Number(vol);
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Build the 4 scrollable cards for State 1 (GLANCE_FEED).
 */
export function buildGlanceFeedCards(feed) {
  const polyTop = feed?.polymarket?.[0];
  const hl = feed?.hyperliquid?.mids || {};
  const tg = feed?.telegram || {};
  const unread = Number(tg.unreadCount ?? tg.messages?.length ?? 0);
  const latestTg = tg.messages?.[0];

  const btcStr = hl.BTC ? formatUsd(hl.BTC, 0) : "--";
  const ethStr = hl.ETH ? formatUsd(hl.ETH, 0) : "--";
  const solStr = hl.SOL ? formatUsd(hl.SOL, 1) : "--";
  const hypeStr = hl.HYPE ? formatUsd(hl.HYPE, 2) : "--";

  const polyShort = polyTop
    ? `${clampHudLine(polyTop.shortTitle || polyTop.question, 22)} ${polyTop.yesPct}%`
    : "POLYMARKET LIVE FEED";

  const overviewCard = {
    id: "overview",
    title: "GLANCE FEED",
    lines: normalizeHudLines([
      `PM: ${polyShort}`,
      `HL: BTC ${btcStr} · ETH ${ethStr}`,
      `TG: ${unread} unread · ${latestTg ? clampHudLine(latestTg.sender, 12) : "inbox"}`,
      "[TAP=MIC] [RING=SCROLL 1/4]",
    ]),
  };

  const polyCard = {
    id: "polymarket",
    title: "POLYMARKET",
    lines: normalizeHudLines([
      `PM: ${clampHudLine(polyTop?.shortTitle || polyTop?.question || "Top Prediction Market", 31)}`,
      `YES ${polyTop?.yesPct ?? 50}c · NO ${polyTop?.noPct ?? 50}c · 24h ${formatCompactVolume(polyTop?.volume24hr || 0)}`,
      feed?.polymarket?.[1]
        ? `2: ${clampHudLine(feed.polymarket[1].shortTitle || feed.polymarket[1].question, 24)} ${feed.polymarket[1].yesPct}%`
        : "PAPER BET ONLY · MAX $50",
      "[TAP=VOICE BET] [RING 2/4]",
    ]),
  };

  const hlCard = {
    id: "hyperliquid",
    title: "HYPERLIQUID TESTNET",
    lines: normalizeHudLines([
      `HL TESTNET · BTC ${btcStr}`,
      `ETH ${ethStr} · SOL ${solStr}`,
      `HYPE ${hypeStr} · Mode PAPER`,
      "[TAP=VOICE TRADE] [RING 3/4]",
    ]),
  };

  const tgCard = {
    id: "telegram",
    title: "TELEGRAM ALPHA",
    lines: normalizeHudLines([
      `TG ALPHA (${unread} unread)`,
      latestTg ? `${clampHudLine(latestTg.sender, 10)}: ${clampHudLine(latestTg.text, 23)}` : "No unread Telegram alerts",
      tg.messages?.[1]
        ? `${clampHudLine(tg.messages[1].sender, 10)}: ${clampHudLine(tg.messages[1].text, 23)}`
        : "Say: reply to alpha desk...",
      "[TAP=VOICE REPLY] [RING 4/4]",
    ]),
  };

  return [overviewCard, polyCard, hlCard, tgCard];
}

/**
 * State 2 — VOICE_CAPTURE 4-line HUD.
 */
export function buildVoiceCaptureHud({ elapsedMs = 0, pcmBytes = 0, source = "glasses", speakerRole = "self" } = {}) {
  const secs = (Math.max(0, Number(elapsedMs) || 0) / 1000).toFixed(1);
  const kb = (Math.max(0, Number(pcmBytes) || 0) / 1024).toFixed(1);
  return normalizeHudLines([
    `[● REC] Speak command (${secs}s)`,
    `Mic:${String(source).toUpperCase().slice(0, 7)} · ${kb}KB · ${String(speakerRole).toUpperCase()}`,
    "Try: Short ETH $25 / Reply TG",
    "[TAP=SEND] [HOLD=ABORT]",
  ]);
}

/**
 * State 3 — CONFIRM_SAFETY 4-line human-in-the-loop safety card.
 */
export function buildConfirmationHud(intent, marketContext = {}) {
  if (!intent || intent.action === INTENTS.BLOCKED_SAFETY) {
    return normalizeHudLines([
      "BLOCKED · SAFETY GUARD",
      clampHudLine(intent?.reason || "Mainnet/unsafe action denied", 36),
      "Testnet paper cap: $50 max",
      "[TAP=RETURN TO FEED]",
    ]);
  }

  if (intent.action === INTENTS.PLACE_HYPERLIQUID) {
    const sym = intent.symbol_or_market || "ETH";
    const side = intent.side || "LONG";
    const size = Number(intent.size_usd || 25);
    const mid = marketContext?.hyperliquid?.mids?.[sym] ?? intent.estimated_price ?? null;
    const equity = Number(marketContext?.paperEquityUsd || 2500);
    const riskPct = ((size / equity) * 100).toFixed(1);
    const entryStr = mid ? `Entry ~${formatUsd(mid, mid >= 100 ? 0 : 2)}` : "Entry LIVE MID";
    return normalizeHudLines([
      `${side} ${sym} ${formatUsd(size, 0)} TESTNET?`,
      `${entryStr} · Risk ${riskPct}%`,
      `Conf ${Math.round((intent.confidence || 0.9) * 100)}% · Cap $50 PAPER`,
      "[TAP=CONFIRM] [HOLD=ABORT]",
    ]);
  }

  if (intent.action === INTENTS.BUY_POLYMARKET) {
    const side = intent.side || "YES";
    const size = Number(intent.size_usd || 15);
    const label = clampHudLine(intent.symbol_or_market || "Top Market", 16);
    const odds = intent.estimated_price ? `${Math.round(intent.estimated_price * 100)}c` : "LIVE";
    return normalizeHudLines([
      `BET ${side} ${formatUsd(size, 0)} PAPER?`,
      `${label} @ ${odds}`,
      `Polymarket Paper · Max $50`,
      "[TAP=CONFIRM] [HOLD=ABORT]",
    ]);
  }

  if (intent.action === INTENTS.REPLY_TELEGRAM) {
    const target = clampHudLine(intent.target_chat || "Alpha Desk", 16);
    const body = clampHudLine(intent.reply_text || "Ack", 32);
    return normalizeHudLines([
      `SEND TG -> ${target}?`,
      `"${body}"`,
      `Conf ${Math.round((intent.confidence || 0.9) * 100)}% · 1-Tap Voice Reply`,
      "[TAP=SEND TG] [HOLD=ABORT]",
    ]);
  }

  if (intent.action === INTENTS.SUMMARIZE_ALERTS) {
    const cards = buildGlanceFeedCards(marketContext);
    return normalizeHudLines([
      "ALERT DIGEST · LIVE",
      cards[0].lines[0],
      cards[0].lines[1],
      "[TAP=FEED] [HOLD=CLOSE]",
    ]);
  }

  return normalizeHudLines([
    "COMMAND NOT RECOGNIZED",
    clampHudLine(intent?.transcript || "Speak clearly and retry", 34),
    "Say: Short ETH $25 / Reply TG",
    "[TAP=RETRY] [HOLD=FEED]",
  ]);
}

/**
 * State 4 — RECEIPT 4-line HUD after execution.
 */
export function buildReceiptHud(receipt) {
  if (!receipt || !receipt.ok) {
    return normalizeHudLines([
      "EXECUTION REJECTED",
      clampHudLine(receipt?.error || "Safety gate failed", 36),
      "No testnet/paper order sent",
      "[TAP=RETURN TO FEED]",
    ]);
  }

  const tgTag = receipt.telegram?.delivered
    ? "SENT TO TG"
    : receipt.telegram?.mode === "paper_preview"
      ? "TG LOGGED"
      : "LOCAL LOG";

  if (receipt.action === INTENTS.REPLY_TELEGRAM) {
    return normalizeHudLines([
      `SENT ${receipt.receiptId} · ${tgTag}`,
      `To: ${clampHudLine(receipt.target_chat || "Alpha Desk", 28)}`,
      `"${clampHudLine(receipt.reply_text || "", 32)}"`,
      "[TAP=FEED] [RING=NEXT]",
    ]);
  }

  if (receipt.action === INTENTS.BUY_POLYMARKET) {
    return normalizeHudLines([
      `FILLED ${receipt.receiptId} · ${tgTag}`,
      `${receipt.side} ${formatUsd(receipt.size_usd, 0)} @ ${Math.round((receipt.fill_price || 0.5) * 100)}c`,
      `${clampHudLine(receipt.symbol_or_market || "Market", 20)} · PAPER`,
      "[TAP=FEED] [RING=NEXT]",
    ]);
  }

  return normalizeHudLines([
    `FILLED ${receipt.receiptId} · ${tgTag}`,
    `${receipt.side} ${receipt.symbol_or_market} ${formatUsd(receipt.size_usd, 0)} @ ${formatUsd(receipt.fill_price, receipt.fill_price >= 100 ? 2 : 4)}`,
    `Testnet Paper · Bal ${formatUsd(receipt.remaining_equity_usd ?? 2500, 0)}`,
    "[TAP=FEED] [RING=NEXT]",
  ]);
}

/**
 * Build a spec-compliant @evenrealities/even_hub_sdk@0.0.16 page container payload
 * for the 576x288 G2 display with:
 * - Header status bar (textColor 2 = dim green)
 * - Primary 4-line glanceable content box (textColor 4 = max brightness, isEventCapture: 1)
 * - Footer action hint bar (textColor 3)
 * - Contextual OS menu (<= 10 items, unique non-zero IDs, <= 32 UTF-8 bytes)
 */
export function buildEvenHubPagePayload({ state = HUD_STATES.GLANCE_FEED, lines, badge = "TESTNET" }) {
  const hudLines = normalizeHudLines(lines);
  const headerLine = clampHudLine(`GLANCEDESK · ${state} · ${badge}`, 36);
  const bodyContent = hudLines.slice(0, 3).join("\n");
  const footerContent = hudLines[3] || "[TAP=ACTION] [HOLD=ABORT]";

  const payload = {
    containerTotalNum: 3,
    textObject: [
      {
        xPosition: 16,
        yPosition: 8,
        width: 544,
        height: 44,
        borderWidth: 0,
        paddingLength: 4,
        containerID: 1,
        containerName: "gd-header",
        zOrderIndex: 1,
        content: headerLine,
        textColor: 2,
        isEventCapture: 0,
      },
      {
        xPosition: 16,
        yPosition: 56,
        width: 544,
        height: 168,
        borderWidth: 1,
        borderColor: 2,
        borderRadius: 6,
        paddingLength: 8,
        containerID: 2,
        containerName: "gd-body",
        zOrderIndex: 2,
        content: bodyContent,
        textColor: 4,
        isEventCapture: 1,
      },
      {
        xPosition: 16,
        yPosition: 232,
        width: 544,
        height: 48,
        borderWidth: 0,
        paddingLength: 4,
        containerID: 3,
        containerName: "gd-footer",
        zOrderIndex: 3,
        content: footerContent,
        textColor: 3,
        isEventCapture: 0,
      },
    ],
    menuObject: {
      menuItems: [
        { itemID: 1, itemName: "Voice Command" },
        { itemID: 2, itemName: "Refresh Live Feed" },
        { itemID: 3, itemName: "Telegram Digest" },
        { itemID: 4, itemName: "Abort / Home" },
      ],
    },
  };

  return payload;
}

/**
 * Local validator mirroring @evenrealities/even_hub_sdk@0.0.16 validation rules
 * (zOrderIndex uniqueness, isEventCapture === 1, textColor 0..4, menu limits, bounds within 576x288).
 */
export function validateEvenHubContainerPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["Payload must be an object"] };
  }
  const textObjs = Array.isArray(payload.textObject) ? payload.textObject : [];
  const listObjs = Array.isArray(payload.listObject) ? payload.listObject : [];
  const imgObjs = Array.isArray(payload.imageObject) ? payload.imageObject : [];
  const all = [...listObjs, ...textObjs, ...imgObjs];

  if (payload.containerTotalNum !== all.length || all.length < 1 || all.length > G2_DISPLAY.maxContainersPerPage) {
    errors.push(`containerTotalNum (${payload.containerTotalNum}) must match actual containers (${all.length}) in 1..12`);
  }
  if (textObjs.length > G2_DISPLAY.maxTextContainers) {
    errors.push(`textObject count (${textObjs.length}) exceeds max ${G2_DISPLAY.maxTextContainers}`);
  }

  let eventCaptureCount = 0;
  const zOrders = new Set();
  const hasAnyZ = all.some((c) => c.zOrderIndex !== undefined);

  for (const c of all) {
    if (c.isEventCapture === 1) eventCaptureCount += 1;
    if (hasAnyZ) {
      if (!Number.isInteger(c.zOrderIndex)) {
        errors.push(`Container ${c.containerName || c.containerID} missing integer zOrderIndex`);
      } else if (zOrders.has(c.zOrderIndex)) {
        errors.push(`Duplicate zOrderIndex: ${c.zOrderIndex}`);
      } else {
        zOrders.add(c.zOrderIndex);
      }
    }
    if (
      typeof c.xPosition === "number" &&
      typeof c.width === "number" &&
      c.xPosition + c.width > G2_DISPLAY.widthPx
    ) {
      errors.push(`Container ${c.containerName} overflows G2 width 576px`);
    }
    if (
      typeof c.yPosition === "number" &&
      typeof c.height === "number" &&
      c.yPosition + c.height > G2_DISPLAY.heightPx
    ) {
      errors.push(`Container ${c.containerName} overflows G2 height 288px`);
    }
  }

  if (eventCaptureCount !== 1) {
    errors.push(`Exactly 1 container must set isEventCapture=1 (found ${eventCaptureCount})`);
  }

  for (const t of textObjs) {
    if (t.textColor !== undefined) {
      if (!Number.isInteger(t.textColor) || t.textColor < 0 || t.textColor > 4) {
        errors.push(`Invalid textColor ${t.textColor} on ${t.containerName} (must be 0..4)`);
      }
    }
  }

  if (payload.menuObject?.menuItems) {
    const items = payload.menuObject.menuItems;
    if (items.length > G2_DISPLAY.maxMenuItems) {
      errors.push(`Too many menuItems (${items.length} > ${G2_DISPLAY.maxMenuItems})`);
    }
    const ids = new Set();
    for (const item of items) {
      if (!Number.isInteger(item.itemID) || item.itemID <= 0) {
        errors.push(`Invalid menu itemID: ${item.itemID}`);
      } else if (ids.has(item.itemID)) {
        errors.push(`Duplicate menu itemID: ${item.itemID}`);
      } else {
        ids.add(item.itemID);
      }
      const bytes = textEncoder.encode(String(item.itemName || "")).length;
      if (bytes === 0 || bytes > G2_DISPLAY.maxMenuItemBytes) {
        errors.push(`Menu itemName "${item.itemName}" UTF-8 bytes (${bytes}) outside 1..32`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
