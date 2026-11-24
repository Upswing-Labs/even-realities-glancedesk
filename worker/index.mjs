/**
 * GlanceDesk — Cloudflare Workers Edge Backend ($0 Free Tier, Zero Hardcoded Secrets)
 * Routes:
 *   GET  /                         -> Standalone 576x288 Monochrome Green G2 Simulator UI
 *   GET  /health                   -> Health, Colab Whisper status, Telegram mode, safety caps
 *   GET  /api/v1/feed              -> Live Polymarket Gamma + Hyperliquid Testnet + Telegram digest
 *   POST /api/v1/voice-intent      -> Raw 16kHz PCM / audio -> Colab GPU Faster-Whisper (with deterministic fallback)
 *   POST /api/v1/execute           -> Confirmed paper/testnet execution + Telegram Bot receipt
 *   GET  /api/v1/telegram/inbox    -> Telegram alpha messages + sent G2 voice replies
 *   POST /api/v1/telegram/webhook  -> Optional live Telegram webhook ingestion
 */

import { APP_META, G2_DISPLAY, HUD_STATES, SAFETY_LIMITS } from "../shared/constants.mjs";
import { PaperExecutionLedger } from "../shared/executor.mjs";
import {
  DEFAULT_HYPERLIQUID_TESTNET_URL,
  DEFAULT_POLYMARKET_GAMMA_URL,
  DEFAULT_TELEGRAM_API_BASE,
  fetchHyperliquidTestnetFeed,
  fetchPolymarketFeed,
  fetchTelegramDigest,
} from "../shared/feeds.mjs";
import {
  buildConfirmationHud,
  buildEvenHubPagePayload,
  buildGlanceFeedCards,
  sanitizeHudText,
} from "../shared/hud_formatter.mjs";
import { parseVoiceIntent } from "../shared/intent_parser.mjs";
import { renderSimulatorHtml } from "./simulator_ui.mjs";

const CORS_HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sample-Rate, X-GlanceDesk-Token",
  "X-Content-Type-Options": "nosniff",
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function estimatePcmStats(bytes, sampleRate = 16000) {
  const byteLen = bytes?.byteLength || 0;
  const samples = Math.floor(byteLen / 2);
  const durationMs = sampleRate > 0 ? Math.round((samples / sampleRate) * 1000) : 0;
  let sumSq = 0;
  if (samples > 0) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
    const step = Math.max(1, Math.floor(samples / 512));
    let count = 0;
    for (let i = 0; i < samples; i += step) {
      const s = view.getInt16(i * 2, true) / 32768;
      sumSq += s * s;
      count += 1;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    return { byteLen, samples, durationMs, rms: Number(rms.toFixed(4)) };
  }
  return { byteLen, samples: 0, durationMs: 0, rms: 0 };
}

async function forwardAudioToColabWhisper({
  fetchImpl,
  colabUrl,
  colabToken,
  body,
  contentType,
  sampleRate,
  timeoutMs = 6000,
}) {
  const cleanBase = String(colabUrl || "").replace(/\/+$/, "");
  const endpoint = `${cleanBase}/v1/voice-intent`;
  const headers = { "Content-Type": contentType || "audio/pcm" };
  if (sampleRate) headers["X-Sample-Rate"] = String(sampleRate);
  if (colabToken) headers["X-GlanceDesk-Token"] = colabToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ok: false, error: `Colab Whisper returned HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || "Colab Whisper tunnel unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

export function createGlanceDeskHandler(options = {}) {
  const defaultFetch = options.fetchImpl || fetch;
  const ledger = options.ledger || new PaperExecutionLedger();
  const webhookMessages = [];
  let feedCache = { ts: 0, data: null };

  async function loadLiveFeed(env = {}, fetchImpl = defaultFetch, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && feedCache.data && now - feedCache.ts < 12_000) {
      return feedCache.data;
    }

    const polyUrl = env.POLYMARKET_GAMMA_URL || DEFAULT_POLYMARKET_GAMMA_URL;
    const hlUrl = env.HYPERLIQUID_TESTNET_URL || DEFAULT_HYPERLIQUID_TESTNET_URL;
    const tgBase = env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API_BASE;
    const tgToken = env.TELEGRAM_BOT_TOKEN || "";

    const [poly, hl, tg] = await Promise.all([
      fetchPolymarketFeed({ fetchImpl, url: polyUrl }),
      fetchHyperliquidTestnetFeed({ fetchImpl, url: hlUrl }),
      fetchTelegramDigest({
        fetchImpl,
        apiBase: tgBase,
        botToken: tgToken,
        extraMessages: [...ledger.sentTelegramReplies, ...webhookMessages],
      }),
    ]);

    const assembled = {
      ok: true,
      app: APP_META.name,
      execution_mode: SAFETY_LIMITS.executionMode,
      timestamp: new Date().toISOString(),
      polymarket_source: poly.source,
      polymarket: poly.markets,
      hyperliquid: hl,
      telegram: tg,
      ledger: {
        ...ledger.getSummary(),
        max_daily_notional_usd: Number(env.MAX_DAILY_NOTIONAL_USD || SAFETY_LIMITS.maxDailyNotionalUsd),
      },
    };
    assembled.hud_cards = buildGlanceFeedCards(assembled);
    assembled.evenhub_container = buildEvenHubPagePayload({
      state: HUD_STATES.GLANCE_FEED,
      lines: assembled.hud_cards[0].lines,
      badge: "LIVE",
    });

    feedCache = { ts: now, data: assembled };
    return assembled;
  }

  return async function handleRequest(request, env = {}) {
    const url = new URL(request.url);
    const fetchImpl = options.fetchImpl || fetch;
    const maxOrderUsd = Number(env.MAX_TRADE_USD || SAFETY_LIMITS.maxOrderUsd);
    const maxDailyUsd = Number(env.MAX_DAILY_NOTIONAL_USD || SAFETY_LIMITS.maxDailyNotionalUsd);
    ledger.maxOrderUsd = maxOrderUsd;
    ledger.maxDailyNotionalUsd = maxDailyUsd;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/simulator")) {
      return new Response(renderSimulatorHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          ...CORS_HEADERS,
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "upswing-glancedesk",
        org: APP_META.org,
        version: APP_META.version,
        execution_mode: SAFETY_LIMITS.executionMode,
        g2_display: {
          width: G2_DISPLAY.widthPx,
          height: G2_DISPLAY.heightPx,
          bit_depth: G2_DISPLAY.bitDepth,
          sdk_version: APP_META.minSdkVersion,
        },
        colab_whisper_configured: Boolean(env.COLAB_WHISPER_URL),
        telegram_mode: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? "live_bot" : "paper_preview",
        safety_limits: {
          max_order_usd: maxOrderUsd,
          max_daily_notional_usd: maxDailyUsd,
          require_explicit_tap_confirmation: SAFETY_LIMITS.requireExplicitTapConfirmation,
        },
        endpoints: [
          "/",
          "/health",
          "/api/v1/feed",
          "/api/v1/voice-intent",
          "/api/v1/execute",
          "/api/v1/telegram/inbox",
          "/api/v1/telegram/webhook",
        ],
      });
    }

    if (request.method === "GET" && url.pathname === "/api/v1/feed") {
      const refresh = url.searchParams.get("refresh") === "1";
      const feed = await loadLiveFeed(env, fetchImpl, refresh);
      return jsonResponse(feed);
    }

    if (request.method === "GET" && url.pathname === "/api/v1/telegram/inbox") {
      const feed = await loadLiveFeed(env, fetchImpl, false);
      return jsonResponse({
        ok: true,
        mode: feed.telegram.mode,
        unreadCount: feed.telegram.unreadCount,
        messages: feed.telegram.messages,
        sent_from_glasses: ledger.sentTelegramReplies.slice(0, 10),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/v1/telegram/webhook") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const hdr = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
        if (hdr !== env.TELEGRAM_WEBHOOK_SECRET) {
          return jsonResponse({ ok: false, error: "Invalid Telegram webhook secret" }, 401);
        }
      }
      const update = await request.json().catch(() => null);
      const msg = update?.message || update?.channel_post;
      if (msg?.text) {
        webhookMessages.unshift({
          id: `tg-wh-${update.update_id || Date.now()}`,
          chatId: msg.chat?.id ? String(msg.chat.id) : undefined,
          chat: sanitizeHudText(msg.chat?.title || msg.chat?.username || "Telegram"),
          sender: sanitizeHudText(msg.from?.first_name || msg.from?.username || "Sender"),
          text: sanitizeHudText(msg.text),
          ts: "live",
        });
        webhookMessages.splice(15);
        feedCache.ts = 0;
      }
      return jsonResponse({ ok: true, ingested: Boolean(msg?.text) });
    }

    if (request.method === "POST" && url.pathname === "/api/v1/voice-intent") {
      const started = Date.now();
      const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
      const feed = await loadLiveFeed(env, fetchImpl, false);
      const marketContext = {
        polymarket: feed.polymarket,
        hyperliquid: feed.hyperliquid,
        telegram: feed.telegram,
        paperEquityUsd: ledger.equityUsd,
      };

      // Case A: JSON request ({ text } or { audio_pcm_b64 })
      if (contentType.includes("application/json")) {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") {
          return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
        }

        if (body.audio_pcm_b64 && env.COLAB_WHISPER_URL) {
          const forwarded = await forwardAudioToColabWhisper({
            fetchImpl,
            colabUrl: env.COLAB_WHISPER_URL,
            colabToken: env.COLAB_API_TOKEN || "",
            body: JSON.stringify(body),
            contentType: "application/json",
          });
          if (forwarded.ok && forwarded.data?.transcript) {
            const parsed = parseVoiceIntent(forwarded.data.transcript, {
              maxOrderUsd,
              marketContext,
              engine: forwarded.data.engine || "colab-faster-whisper-large-v3-turbo",
            });
            parsed.asr_ms = forwarded.data.asr_ms ?? null;
            parsed.latency_ms = Math.max(1, Date.now() - started);
            parsed.evenhub_container = buildEvenHubPagePayload({
              state: HUD_STATES.CONFIRM_SAFETY,
              lines: parsed.hud_confirmation_lines,
              badge: "GPU ASR",
            });
            return jsonResponse(parsed);
          }
        }

        const textInput = String(body.text || body.transcript || "").trim();
        if (!textInput) {
          return jsonResponse({
            ok: false,
            error: "Provide `text` or configure `COLAB_WHISPER_URL` for raw audio transcription.",
            colab_whisper_configured: Boolean(env.COLAB_WHISPER_URL),
          }, 400);
        }

        const parsed = parseVoiceIntent(textInput, {
          maxOrderUsd,
          marketContext,
          engine: env.COLAB_WHISPER_URL ? "deterministic-edge-fallback" : "deterministic-edge-parser",
        });
        parsed.latency_ms = Math.max(1, Date.now() - started);
        parsed.evenhub_container = buildEvenHubPagePayload({
          state: parsed.action === "CANCEL" ? HUD_STATES.GLANCE_FEED : HUD_STATES.CONFIRM_SAFETY,
          lines: parsed.hud_confirmation_lines,
          badge: "SAFETY",
        });
        return jsonResponse(parsed);
      }

      // Case B: Raw 16kHz PCM audio or multipart/audio upload
      const rawBuf = await request.arrayBuffer();
      const rawBytes = new Uint8Array(rawBuf);
      const sampleRate = Number(request.headers.get("X-Sample-Rate") || G2_DISPLAY.audioSampleRateHz);
      const pcmStats = estimatePcmStats(rawBytes, sampleRate);

      if (env.COLAB_WHISPER_URL) {
        const forwarded = await forwardAudioToColabWhisper({
          fetchImpl,
          colabUrl: env.COLAB_WHISPER_URL,
          colabToken: env.COLAB_API_TOKEN || "",
          body: rawBytes,
          contentType: contentType || "audio/pcm",
          sampleRate,
        });
        if (forwarded.ok) {
          const transcript = forwarded.data.transcript || "";
          const parsed = parseVoiceIntent(transcript, {
            maxOrderUsd,
            marketContext,
            engine: forwarded.data.engine || "colab-faster-whisper-large-v3-turbo",
          });
          parsed.asr_ms = forwarded.data.asr_ms ?? forwarded.data.latency_ms ?? null;
          parsed.vad_speech_ms = forwarded.data.vad_speech_ms ?? pcmStats.durationMs;
          parsed.pcm_stats = pcmStats;
          parsed.latency_ms = Math.max(1, Date.now() - started);
          parsed.evenhub_container = buildEvenHubPagePayload({
            state: HUD_STATES.CONFIRM_SAFETY,
            lines: parsed.hud_confirmation_lines,
            badge: "GPU ASR",
          });
          return jsonResponse(parsed);
        }

        return jsonResponse(
          {
            ok: false,
            colab_whisper_offline: true,
            error: forwarded.error,
            pcm_stats: pcmStats,
            hint: "Colab GPU Whisper tunnel is asleep or unreachable. Re-run colab/GlanceDesk_Whisper_Colab_GPU.ipynb or send JSON { text } fallback.",
            hud_confirmation_lines: buildConfirmationHud({
              action: "UNKNOWN",
              transcript: "Colab GPU asleep - retry/text",
            }),
            latency_ms: Math.max(1, Date.now() - started),
          },
          503,
        );
      }

      return jsonResponse(
        {
          ok: false,
          colab_whisper_offline: true,
          error: "COLAB_WHISPER_URL is not configured for raw binary PCM audio.",
          pcm_stats: pcmStats,
          hint: "Start colab/GlanceDesk_Whisper_Colab_GPU.ipynb and set COLAB_WHISPER_URL, or send JSON { text } for deterministic edge parsing.",
          hud_confirmation_lines: buildConfirmationHud({
            action: "UNKNOWN",
            transcript: `PCM ${pcmStats.byteLen}B · Set Colab URL`,
          }),
          latency_ms: Math.max(1, Date.now() - started),
        },
        200,
      );
    }

    if (request.method === "POST" && url.pathname === "/api/v1/execute") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
      }

      const feed = await loadLiveFeed(env, fetchImpl, false);
      const command = body.intent && typeof body.intent === "object" ? body.intent : body;
      const confirmed = body.confirmed === true;

      const receipt = await ledger.execute(command, {
        confirmed,
        marketContext: {
          polymarket: feed.polymarket,
          hyperliquid: feed.hyperliquid,
          telegram: feed.telegram,
          paperEquityUsd: ledger.equityUsd,
        },
        fetchImpl,
        telegramApiBase: env.TELEGRAM_API_BASE || DEFAULT_TELEGRAM_API_BASE,
        telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
        telegramChatId: env.TELEGRAM_CHAT_ID || "",
      });

      feedCache.ts = 0;
      const status = receipt.ok ? 200 : 400;
      receipt.evenhub_container = buildEvenHubPagePayload({
        state: HUD_STATES.RECEIPT,
        lines: receipt.hud_lines,
        badge: receipt.ok ? "DONE" : "DENIED",
      });
      return jsonResponse(receipt, status);
    }

    return jsonResponse({ ok: false, error: `Not found: ${url.pathname}` }, 404);
  };
}

const defaultHandler = createGlanceDeskHandler();

export default {
  async fetch(request, env, ctx) {
    return defaultHandler(request, env, ctx);
  },
};
