/**
 * GlanceDesk — Testnet/Paper Execution Ledger & Hard Risk Guard
 * Guarantees zero mainnet capital risk, strict human-in-the-loop confirmation,
 * daily notional caps, and optional Telegram Bot execution receipts.
 */

import { INTENTS, SAFETY_LIMITS } from "./constants.mjs";
import { sendTelegramMessage } from "./feeds.mjs";
import { buildReceiptHud, formatUsd, sanitizeHudText } from "./hud_formatter.mjs";

export class PaperExecutionLedger {
  constructor(options = {}) {
    this.initialEquityUsd = Number(options.initialEquityUsd || SAFETY_LIMITS.defaultPaperEquityUsd);
    this.equityUsd = this.initialEquityUsd;
    this.maxOrderUsd = Number(options.maxOrderUsd || SAFETY_LIMITS.maxOrderUsd);
    this.maxDailyNotionalUsd = Number(options.maxDailyNotionalUsd || SAFETY_LIMITS.maxDailyNotionalUsd);
    this.dailyNotionalUsd = 0;
    this.seq = 8491;
    this.receipts = [];
    this.sentTelegramReplies = [];
  }

  getSummary() {
    return {
      execution_mode: SAFETY_LIMITS.executionMode,
      equity_usd: Number(this.equityUsd.toFixed(2)),
      daily_notional_usd: Number(this.dailyNotionalUsd.toFixed(2)),
      remaining_daily_cap_usd: Number(Math.max(0, this.maxDailyNotionalUsd - this.dailyNotionalUsd).toFixed(2)),
      max_order_usd: this.maxOrderUsd,
      receipt_count: this.receipts.length,
      recent_receipts: this.receipts.slice(0, 10),
    };
  }

  _nextId(prefix) {
    this.seq += 1;
    return `#${prefix}-${this.seq}`;
  }

  async execute(command, context = {}) {
    const {
      confirmed = false,
      marketContext = {},
      fetchImpl = fetch,
      telegramApiBase,
      telegramBotToken = "",
      telegramChatId = "",
    } = context;

    if (!command || typeof command !== "object") {
      return this._reject("Missing command payload");
    }

    if (command.action === INTENTS.BLOCKED_SAFETY) {
      return this._reject(command.reason || "Blocked by safety guard");
    }

    if (command.action === INTENTS.CANCEL) {
      return {
        ok: true,
        status: "CANCELLED",
        action: INTENTS.CANCEL,
        receiptId: this._nextId("AB"),
        hud_lines: [
          "COMMAND ABORTED",
          "Zero testnet orders sent",
          `Paper Bal ${formatUsd(this.equityUsd, 0)}`,
          "[TAP=FEED] [RING=SCROLL]",
        ],
      };
    }

    if (SAFETY_LIMITS.requireExplicitTapConfirmation && confirmed !== true) {
      return this._reject("Human-in-the-loop confirmation required (confirmed: true)");
    }

    // Telegram 1-Tap Voice Reply Execution
    if (command.action === INTENTS.REPLY_TELEGRAM) {
      const target = sanitizeHudText(command.target_chat || "Alpha Desk");
      const replyText = sanitizeHudText(command.reply_text || "");
      if (!replyText) {
        return this._reject("Telegram reply text cannot be empty");
      }
      const receiptId = this._nextId("TG");
      const tgFormatted = `[GlanceDesk G2 · ${receiptId}] -> ${target}: ${replyText}`;
      const tgResult = await sendTelegramMessage({
        fetchImpl,
        apiBase: telegramApiBase,
        botToken: telegramBotToken,
        chatId: telegramChatId,
        text: tgFormatted,
      });

      const receipt = {
        ok: true,
        receiptId,
        execution_mode: SAFETY_LIMITS.executionMode,
        action: INTENTS.REPLY_TELEGRAM,
        target_chat: target,
        reply_text: replyText,
        telegram: tgResult,
        timestamp: new Date().toISOString(),
      };
      receipt.hud_lines = buildReceiptHud(receipt);
      this.sentTelegramReplies.unshift({
        id: receiptId,
        chat: target,
        sender: "You (G2 Voice)",
        text: replyText,
        ts: "just now",
      });
      this.receipts.unshift(receipt);
      this.receipts = this.receipts.slice(0, 25);
      return receipt;
    }

    // Trade / Bet Orders: enforce strict paper/testnet risk limits
    if (command.action !== INTENTS.PLACE_HYPERLIQUID && command.action !== INTENTS.BUY_POLYMARKET) {
      return this._reject(`Unsupported executable action: ${command.action}`);
    }

    const sizeUsd = Number(command.size_usd);
    if (!Number.isFinite(sizeUsd) || sizeUsd < SAFETY_LIMITS.minOrderUsd) {
      return this._reject(`Order size must be >= $${SAFETY_LIMITS.minOrderUsd}`);
    }
    if (sizeUsd > this.maxOrderUsd) {
      return this._reject(`Order size $${sizeUsd} exceeds hard testnet cap of $${this.maxOrderUsd}`);
    }
    if (this.dailyNotionalUsd + sizeUsd > this.maxDailyNotionalUsd) {
      return this._reject(
        `Daily testnet notional cap ($${this.maxDailyNotionalUsd}) would be exceeded`,
      );
    }

    let fillPrice = Number(command.estimated_price);
    let prefix = "HL";
    let venue = "Hyperliquid Testnet (Paper)";

    if (command.action === INTENTS.PLACE_HYPERLIQUID) {
      const sym = String(command.symbol_or_market || "ETH").toUpperCase();
      const liveMid = marketContext?.hyperliquid?.mids?.[sym];
      const basePrice = Number.isFinite(Number(liveMid)) && Number(liveMid) > 0 ? Number(liveMid) : fillPrice || 1696.55;
      // 3 bps realistic simulated testnet taker slippage
      const slipMult = command.side === "SHORT" ? 0.9997 : 1.0003;
      fillPrice = Number((basePrice * slipMult).toFixed(basePrice >= 100 ? 2 : 4));
      prefix = "HL";
      venue = "Hyperliquid Testnet (Paper)";
    } else {
      const pmList = marketContext?.polymarket || [];
      const found = pmList.find((m) => m.id === command.market_id || m.shortTitle === command.symbol_or_market) || pmList[0];
      const sidePrice = command.side === "NO" ? found?.noPrice : found?.yesPrice;
      fillPrice = Number((Number.isFinite(Number(sidePrice)) ? Number(sidePrice) : fillPrice || 0.5).toFixed(4));
      prefix = "PM";
      venue = "Polymarket Paper Ledger";
    }

    const receiptId = this._nextId(prefix);
    this.dailyNotionalUsd = Number((this.dailyNotionalUsd + sizeUsd).toFixed(2));
    this.equityUsd = Number(Math.max(0, this.equityUsd - sizeUsd).toFixed(2));

    const tgReceiptText =
      command.action === INTENTS.PLACE_HYPERLIQUID
        ? `[GlanceDesk G2 · ${receiptId}] ${command.side} ${command.symbol_or_market} $${sizeUsd} @ $${fillPrice} (${venue})`
        : `[GlanceDesk G2 · ${receiptId}] BET ${command.side} $${sizeUsd} on "${command.symbol_or_market}" @ ${Math.round(fillPrice * 100)}c (${venue})`;

    const tgResult = await sendTelegramMessage({
      fetchImpl,
      apiBase: telegramApiBase,
      botToken: telegramBotToken,
      chatId: telegramChatId,
      text: tgReceiptText,
    });

    const receipt = {
      ok: true,
      receiptId,
      execution_mode: SAFETY_LIMITS.executionMode,
      venue,
      action: command.action,
      symbol_or_market: command.symbol_or_market,
      side: command.side,
      size_usd: sizeUsd,
      fill_price: fillPrice,
      remaining_equity_usd: this.equityUsd,
      daily_notional_usd: this.dailyNotionalUsd,
      telegram: tgResult,
      timestamp: new Date().toISOString(),
    };
    receipt.hud_lines = buildReceiptHud(receipt);
    this.receipts.unshift(receipt);
    this.receipts = this.receipts.slice(0, 25);
    return receipt;
  }

  _reject(error) {
    const resp = {
      ok: false,
      execution_mode: SAFETY_LIMITS.executionMode,
      error,
    };
    resp.hud_lines = buildReceiptHud(resp);
    return resp;
  }
}
