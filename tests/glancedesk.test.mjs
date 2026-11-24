/**
 * GlanceDesk — Full Unit & Integration Test Suite (`node --test`)
 * Verifies:
 *  1. Structured Voice/Text Intent Parser & Safety Guards
 *  2. 576x288 4-Bit Monochrome Green HUD Formatting & EvenHub SDK 0.0.16 Container Validation
 *  3. Polymarket Gamma, Hyperliquid Testnet & Telegram Feed Normalizers
 *  4. Testnet/Paper Execution Ledger & Hard Risk Caps ($50 order / $250 daily)
 *  5. Cloudflare Worker Edge Routes + Colab GPU Whisper Forwarding + Fallback
 *  6. EvenHub app.json Manifest & Colab GPU Notebook Structural Checks
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { G2_DISPLAY, HUD_STATES, INTENTS, SAFETY_LIMITS } from "../shared/constants.mjs";
import { PaperExecutionLedger } from "../shared/executor.mjs";
import {
  buildTelegramMethodUrl,
  FALLBACK_HYPERLIQUID_MIDS,
  FALLBACK_POLYMARKET_MARKETS,
  normalizeHyperliquidMids,
  normalizePolymarketMarkets,
  normalizeTelegramUpdates,
} from "../shared/feeds.mjs";
import {
  buildConfirmationHud,
  buildEvenHubPagePayload,
  buildGlanceFeedCards,
  clampHudLine,
  normalizeHudLines,
  validateEvenHubContainerPayload,
} from "../shared/hud_formatter.mjs";
import { parseVoiceIntent } from "../shared/intent_parser.mjs";
import { createGlanceDeskHandler } from "../worker/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_ROOT = path.resolve(__dirname, "..");

const MOCK_CONTEXT = {
  polymarket: [...FALLBACK_POLYMARKET_MARKETS],
  hyperliquid: { source: "mock_testnet", mids: { ...FALLBACK_HYPERLIQUID_MIDS } },
  paperEquityUsd: 2500,
};

test("Intent parser: Hyperliquid Testnet SHORT & LONG commands with hard $50 cap", () => {
  const shortEth = parseVoiceIntent("Short ETH 25 dollars", { marketContext: MOCK_CONTEXT });
  assert.equal(shortEth.ok, true);
  assert.equal(shortEth.action, INTENTS.PLACE_HYPERLIQUID);
  assert.equal(shortEth.symbol_or_market, "ETH");
  assert.equal(shortEth.side, "SHORT");
  assert.equal(shortEth.size_usd, 25);
  assert.equal(shortEth.requires_confirmation, true);
  assert.equal(shortEth.safety_caps.capped, false);
  assert.ok(shortEth.hud_confirmation_lines.length <= 4);
  assert.ok(shortEth.hud_confirmation_lines[0].includes("SHORT ETH $25 TESTNET?"));

  const cappedBtc = parseVoiceIntent("Long Bitcoin $500", { marketContext: MOCK_CONTEXT });
  assert.equal(cappedBtc.ok, true);
  assert.equal(cappedBtc.symbol_or_market, "BTC");
  assert.equal(cappedBtc.side, "LONG");
  assert.equal(cappedBtc.size_usd, SAFETY_LIMITS.maxOrderUsd);
  assert.equal(cappedBtc.safety_caps.capped, true);
  assert.equal(cappedBtc.safety_caps.requested_usd, 500);
});

test("Intent parser: Polymarket YES/NO prediction market bets", () => {
  const pmBet = parseVoiceIntent("Bet 15 dollars YES on Bitcoin 100k", { marketContext: MOCK_CONTEXT });
  assert.equal(pmBet.ok, true);
  assert.equal(pmBet.action, INTENTS.BUY_POLYMARKET);
  assert.equal(pmBet.side, "YES");
  assert.equal(pmBet.size_usd, 15);
  assert.ok(pmBet.symbol_or_market.includes("BTC"));
  assert.equal(pmBet.requires_confirmation, true);

  const pmNo = parseVoiceIntent("Buy 20 NO on Fed rate cut", { marketContext: MOCK_CONTEXT });
  assert.equal(pmNo.ok, true);
  assert.equal(pmNo.action, INTENTS.BUY_POLYMARKET);
  assert.equal(pmNo.side, "NO");
  assert.equal(pmNo.size_usd, 20);
  assert.ok(pmNo.symbol_or_market.toLowerCase().includes("fed"));
});

test("Intent parser: Telegram 1-tap voice reply, alert digest, and cancel", () => {
  const tg = parseVoiceIntent("Reply to Alpha Desk: Locked in, watching ETH 1700", {
    marketContext: MOCK_CONTEXT,
  });
  assert.equal(tg.ok, true);
  assert.equal(tg.action, INTENTS.REPLY_TELEGRAM);
  assert.equal(tg.target_chat, "Alpha Desk");
  assert.equal(tg.reply_text, "Locked in, watching ETH 1700");
  assert.equal(tg.requires_confirmation, true);

  const digest = parseVoiceIntent("Summarize alerts", { marketContext: MOCK_CONTEXT });
  assert.equal(digest.ok, true);
  assert.equal(digest.action, INTENTS.SUMMARIZE_ALERTS);
  assert.equal(digest.requires_confirmation, false);

  const cancel = parseVoiceIntent("Cancel order", { marketContext: MOCK_CONTEXT });
  assert.equal(cancel.ok, true);
  assert.equal(cancel.action, INTENTS.CANCEL);
  assert.equal(cancel.requires_confirmation, false);
});

test("Intent parser: Safety Guard hard-blocks mainnet, withdrawals, and seed phrases", () => {
  const cases = [
    "Short ETH 25 mainnet",
    "Withdraw 100 USDC to wallet",
    "Export my seed phrase now",
    "Use real money to long BTC",
  ];
  for (const cmd of cases) {
    const res = parseVoiceIntent(cmd, { marketContext: MOCK_CONTEXT });
    assert.equal(res.ok, false);
    assert.equal(res.action, INTENTS.BLOCKED_SAFETY);
    assert.equal(res.requires_confirmation, false);
    assert.ok(res.hud_confirmation_lines[0].includes("BLOCKED"));
  }
});

test("HUD Formatter: Enforces <= 4 lines, <= 36 chars, ASCII safety & valid EvenHub SDK 0.0.16 containers", () => {
  const dirty = clampHudLine("🚀🔥 SHORT ETH $25 — super long noisy string that must wrap cleanly without breaking G2 waveguide", 36);
  assert.ok(dirty.length <= 36);
  assert.ok(!dirty.includes("🚀"));

  const lines = normalizeHudLines([
    "LINE 1 WITH EXTREME WIDTH THAT EXCEEDS THIRTY SIX CHARACTERS EASILY",
    "LINE 2",
    "LINE 3",
    "LINE 4",
    "LINE 5 MUST BE DROPPED",
  ]);
  assert.equal(lines.length, G2_DISPLAY.maxHudLines);
  for (const ln of lines) {
    assert.ok(ln.length <= G2_DISPLAY.maxLineChars, `Line exceeded 36 chars: ${ln}`);
  }

  const cards = buildGlanceFeedCards({
    polymarket: FALLBACK_POLYMARKET_MARKETS,
    hyperliquid: { mids: FALLBACK_HYPERLIQUID_MIDS },
    telegram: { unreadCount: 3, messages: [{ sender: "Elena", text: "ETH funding negative" }] },
  });
  assert.equal(cards.length, 4);
  for (const card of cards) {
    assert.ok(card.lines.length <= 4);
    for (const ln of card.lines) assert.ok(ln.length <= 36);
    const container = buildEvenHubPagePayload({
      state: HUD_STATES.GLANCE_FEED,
      lines: card.lines,
      badge: card.title,
    });
    const validation = validateEvenHubContainerPayload(container);
    assert.equal(validation.valid, true, `Container invalid: ${validation.errors.join("; ")}`);
  }

  // Verify validator catches bad textColor or duplicate zOrderIndex
  const badContainer = buildEvenHubPagePayload({ state: HUD_STATES.GLANCE_FEED, lines });
  badContainer.textObject[0].textColor = 9;
  badContainer.textObject[1].zOrderIndex = 1;
  const badCheck = validateEvenHubContainerPayload(badContainer);
  assert.equal(badCheck.valid, false);
  assert.ok(badCheck.errors.some((e) => e.includes("textColor")));
  assert.ok(badCheck.errors.some((e) => e.includes("Duplicate zOrderIndex")));
});

test("Feed normalizers: Polymarket JSON-string outcomePrices, Hyperliquid allMids, Telegram updates", () => {
  const pmRaw = [
    {
      id: "901",
      slug: "btc-100k",
      question: "Will Bitcoin reach $100k by December?",
      outcomePrices: '["0.67", "0.33"]',
      volume24hr: "2500000",
    },
    {
      id: "902",
      slug: "eth-4k",
      question: "Will ETH break $4k?",
      outcomePrices: '["0.31", "0.69"]',
      volume24hr: 4200000,
    },
  ];
  const pmNorm = normalizePolymarketMarkets(pmRaw);
  assert.equal(pmNorm.length, 2);
  // Sorted descending by 24h volume
  assert.equal(pmNorm[0].id, "902");
  assert.equal(pmNorm[0].yesPct, 31);
  assert.equal(pmNorm[1].yesPct, 67);
  assert.equal(pmNorm[1].noPct, 33);

  const hlNorm = normalizeHyperliquidMids({ BTC: "60500.5", ETH: "1710.2", SOL: "72.4", IGNORE_ME: "999" });
  assert.equal(hlNorm.source, "hyperliquid_testnet_live");
  assert.equal(hlNorm.mids.BTC, 60500.5);
  assert.equal(hlNorm.mids.ETH, 1710.2);
  assert.equal(hlNorm.mids.IGNORE_ME, undefined);

  const tgNorm = normalizeTelegramUpdates({
    ok: true,
    result: [
      {
        update_id: 55,
        message: {
          chat: { id: -100123, title: "Alpha Desk" },
          from: { first_name: "Vitalik" },
          text: "Watch L2 blobs today",
          date: 1795400000,
        },
      },
    ],
  });
  assert.equal(tgNorm.length, 1);
  assert.equal(tgNorm[0].sender, "Vitalik");
  assert.equal(tgNorm[0].chat, "Alpha Desk");

  const methodUrl = buildTelegramMethodUrl("https://tg-mock.local", "123:TEST", "sendMessage");
  assert.equal(methodUrl, "https://tg-mock.local/bot123%3ATEST/sendMessage");
});

test("PaperExecutionLedger: Requires tap confirmation, enforces $50 order & $250 daily caps, posts Telegram receipt", async () => {
  const ledger = new PaperExecutionLedger({ initialEquityUsd: 2500, maxOrderUsd: 50, maxDailyNotionalUsd: 100 });
  const tgCalls = [];
  const mockFetch = async (url, init) => {
    tgCalls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 777 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  // Must reject unconfirmed execution
  const unconfirmed = await ledger.execute(
    { action: INTENTS.PLACE_HYPERLIQUID, symbol_or_market: "ETH", side: "SHORT", size_usd: 25 },
    { confirmed: false, marketContext: MOCK_CONTEXT },
  );
  assert.equal(unconfirmed.ok, false);
  assert.ok(unconfirmed.error.includes("confirmation required"));

  // Must reject order above $50 hard cap
  const oversize = await ledger.execute(
    { action: INTENTS.PLACE_HYPERLIQUID, symbol_or_market: "ETH", side: "SHORT", size_usd: 75 },
    { confirmed: true, marketContext: MOCK_CONTEXT },
  );
  assert.equal(oversize.ok, false);
  assert.ok(oversize.error.includes("exceeds hard testnet cap"));

  // Confirmed order succeeds and dispatches Telegram receipt
  const filled = await ledger.execute(
    { action: INTENTS.PLACE_HYPERLIQUID, symbol_or_market: "ETH", side: "SHORT", size_usd: 50 },
    {
      confirmed: true,
      marketContext: MOCK_CONTEXT,
      fetchImpl: mockFetch,
      telegramApiBase: "https://tg-mock.local",
      telegramBotToken: "MOCK_TOKEN",
      telegramChatId: "99999",
    },
  );
  assert.equal(filled.ok, true);
  assert.equal(filled.execution_mode, "TESTNET_PAPER_ONLY");
  assert.ok(filled.receiptId.startsWith("#HL-"));
  assert.equal(filled.telegram.delivered, true);
  assert.equal(filled.telegram.message_id, 777);
  assert.equal(tgCalls.length, 1);
  assert.ok(filled.hud_lines[0].includes("SENT TO TG"));

  // Second $50 hits $100 daily cap exactly, third $10 must be rejected
  const second = await ledger.execute(
    { action: INTENTS.BUY_POLYMARKET, symbol_or_market: "BTC > $100k EOY", market_id: "pm-btc-100k", side: "YES", size_usd: 50 },
    { confirmed: true, marketContext: MOCK_CONTEXT },
  );
  assert.equal(second.ok, true);
  assert.ok(second.receiptId.startsWith("#PM-"));

  const third = await ledger.execute(
    { action: INTENTS.PLACE_HYPERLIQUID, symbol_or_market: "BTC", side: "LONG", size_usd: 10 },
    { confirmed: true, marketContext: MOCK_CONTEXT },
  );
  assert.equal(third.ok, false);
  assert.ok(third.error.includes("Daily testnet notional cap"));

  // Telegram 1-tap voice reply still works ($0 notional)
  const tgReply = await ledger.execute(
    { action: INTENTS.REPLY_TELEGRAM, target_chat: "Alpha Desk", reply_text: "Hedged ETH 50 paper" },
    {
      confirmed: true,
      marketContext: MOCK_CONTEXT,
      fetchImpl: mockFetch,
      telegramApiBase: "https://tg-mock.local",
      telegramBotToken: "MOCK_TOKEN",
      telegramChatId: "99999",
    },
  );
  assert.equal(tgReply.ok, true);
  assert.ok(tgReply.receiptId.startsWith("#TG-"));
  assert.equal(tgCalls.length, 2);
});

test("Cloudflare Worker endpoints: /, /health, /api/v1/feed, /api/v1/voice-intent, /api/v1/execute, /api/v1/telegram/*", async () => {
  const mockFetch = async (url, init = {}) => {
    const s = String(url);
    if (s.includes("gamma-api.polymarket.com")) {
      return new Response(
        JSON.stringify([
          {
            id: "pm-live-1",
            slug: "btc-100k",
            question: "Will Bitcoin break $100k?",
            outcomePrices: '["0.64","0.36"]',
            volume24hr: 5100000,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (s.includes("api.hyperliquid-testnet.xyz")) {
      return new Response(JSON.stringify({ BTC: "61200.0", ETH: "1725.5", SOL: "73.1", HYPE: "72.0", TON: "1.82" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (s.includes("colab-mock.trycloudflare.com/v1/voice-intent")) {
      return new Response(
        JSON.stringify({
          ok: true,
          transcript: "Short ETH 25 dollars",
          asr_ms: 142,
          vad_speech_ms: 980,
          engine: "faster-whisper-large-v3-turbo-float16",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (s.includes("tg-mock.local/bot")) {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 });
  };

  const handler = createGlanceDeskHandler({ fetchImpl: mockFetch });
  const env = {
    TELEGRAM_API_BASE: "https://tg-mock.local",
    TELEGRAM_BOT_TOKEN: "TEST_TOKEN",
    TELEGRAM_CHAT_ID: "12345",
    MAX_TRADE_USD: "50",
    MAX_DAILY_NOTIONAL_USD: "250",
  };

  // 1. Simulator HTML
  const simRes = await handler(new Request("https://glancedesk.test/"), env);
  assert.equal(simRes.status, 200);
  const simHtml = await simRes.text();
  assert.ok(simHtml.includes("576"));
  assert.ok(simHtml.includes("g2Canvas"));

  // 2. Health
  const healthRes = await handler(new Request("https://glancedesk.test/health"), env);
  assert.equal(healthRes.status, 200);
  const health = await healthRes.json();
  assert.equal(health.ok, true);
  assert.equal(health.execution_mode, "TESTNET_PAPER_ONLY");
  assert.equal(health.g2_display.width, 576);
  assert.equal(health.g2_display.height, 288);

  // 3. Live Feed
  const feedRes = await handler(new Request("https://glancedesk.test/api/v1/feed"), env);
  assert.equal(feedRes.status, 200);
  const feed = await feedRes.json();
  assert.equal(feed.polymarket_source, "polymarket_gamma_live");
  assert.equal(feed.hyperliquid.source, "hyperliquid_testnet_live");
  assert.equal(feed.hyperliquid.mids.ETH, 1725.5);
  assert.equal(feed.hud_cards.length, 4);
  assert.equal(validateEvenHubContainerPayload(feed.evenhub_container).valid, true);

  // 4. Deterministic fallback voice-intent via JSON text
  const textIntentRes = await handler(
    new Request("https://glancedesk.test/api/v1/voice-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Short ETH 25 dollars" }),
    }),
    env,
  );
  assert.equal(textIntentRes.status, 200);
  const textIntent = await textIntentRes.json();
  assert.equal(textIntent.action, INTENTS.PLACE_HYPERLIQUID);
  assert.equal(textIntent.estimated_price, 1725.5);
  assert.equal(validateEvenHubContainerPayload(textIntent.evenhub_container).valid, true);

  // 5. Raw 16kHz PCM forwarded to Colab GPU Faster-Whisper tunnel
  const fakePcm = new Uint8Array(3200); // 100ms @ 16kHz s16le mono
  const pcmRes = await handler(
    new Request("https://glancedesk.test/api/v1/voice-intent", {
      method: "POST",
      headers: { "Content-Type": "audio/pcm", "X-Sample-Rate": "16000" },
      body: fakePcm,
    }),
    { ...env, COLAB_WHISPER_URL: "https://colab-mock.trycloudflare.com" },
  );
  assert.equal(pcmRes.status, 200);
  const pcmIntent = await pcmRes.json();
  assert.equal(pcmIntent.ok, true);
  assert.equal(pcmIntent.engine, "faster-whisper-large-v3-turbo-float16");
  assert.equal(pcmIntent.asr_ms, 142);
  assert.equal(pcmIntent.pcm_stats.durationMs, 100);

  // 6. Execute confirmed order + Telegram receipt
  const execRes = await handler(
    new Request("https://glancedesk.test/api/v1/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: pcmIntent, confirmed: true }),
    }),
    env,
  );
  assert.equal(execRes.status, 200);
  const receipt = await execRes.json();
  assert.equal(receipt.ok, true);
  assert.equal(receipt.telegram.delivered, true);
  assert.equal(validateEvenHubContainerPayload(receipt.evenhub_container).valid, true);

  // 7. Telegram webhook ingestion + inbox check
  const whRes = await handler(
    new Request("https://glancedesk.test/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 9001,
        message: { chat: { title: "TON Founders" }, from: { first_name: "Pavel" }, text: "G2 demo looks sharp!" },
      }),
    }),
    env,
  );
  assert.equal(whRes.status, 200);
  const inboxRes = await handler(new Request("https://glancedesk.test/api/v1/telegram/inbox"), env);
  const inbox = await inboxRes.json();
  assert.ok(inbox.messages.some((m) => m.sender === "Pavel"));
});

test("Manifest & Colab Notebook: app/app.json matches EvenHub CLI 0.2.0 schema and ipynb is valid nbformat 4", () => {
  const manifestPath = path.join(PRODUCT_ROOT, "app", "app.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.match(manifest.package_id, /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);
  assert.ok(manifest.name.length <= 20);
  assert.equal(manifest.min_sdk_version, "0.0.16");
  assert.equal(manifest.min_app_version, "2.2.10");
  assert.equal(manifest.entrypoint, "index.html");

  const validPerms = new Set(["g2-microphone", "phone-microphone", "album", "location", "network", "camera"]);
  for (const perm of manifest.permissions) {
    assert.ok(validPerms.has(perm.name), `Invalid EvenHub permission: ${perm.name}`);
  }
  assert.ok(manifest.permissions.some((p) => p.name === "g2-microphone"));
  assert.ok(manifest.permissions.some((p) => p.name === "network"));

  const nbPath = path.join(PRODUCT_ROOT, "colab", "GlanceDesk_Whisper_Colab_GPU.ipynb");
  const nb = JSON.parse(fs.readFileSync(nbPath, "utf8"));
  assert.equal(nb.nbformat, 4);
  const codeCells = nb.cells.filter((c) => c.cell_type === "code");
  assert.ok(codeCells.length >= 6);
});
