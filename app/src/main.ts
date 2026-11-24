/**
 * GlanceDesk — Even Realities G2 Main Application Entrypoint
 * Built against @evenrealities/even_hub_sdk@0.0.16 (576x288 4-bit green display,
 * 4-mic 16kHz mono PCM audio capture, R1 Ring + Temple gesture routing).
 */

import {
  AudioInputSource,
  AudioSpeakerRole,
  DeviceConnectType,
  StartUpPageCreateResult,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import {
  buildRebuildPage,
  buildStartupPage,
  CONTAINER_IDS,
  MENU_ITEM_IDS,
  normalizeHardwareGesture,
  normalizeLines,
} from "./hud_layout";
import type {
  ExecuteReceiptResponse,
  GlanceFeedResponse,
  HudState,
  VoiceIntentResponse,
} from "./types";

const DEFAULT_API_BASE =
  (globalThis as unknown as { __GLANCEDESK_API__?: string }).__GLANCEDESK_API__ ||
  "https://upswing-glancedesk.workers.dev";

const MAX_CAPTURE_MS = 6500;
const MAX_PCM_BYTES = 16000 * 2 * 7; // 7s @ 16kHz mono 16-bit PCM

class GlanceDeskG2Controller {
  private bridge: EvenAppBridge | null = null;
  private startupCreated = false;
  private hudState: HudState = "GLANCE_FEED";
  private cardIndex = 0;
  private feed: GlanceFeedResponse | null = null;
  private pendingIntent: VoiceIntentResponse | null = null;
  private lastReceipt: ExecuteReceiptResponse | null = null;
  private activeMicSource: AudioInputSource = AudioInputSource.Glasses;
  private recording = false;
  private recStartedAt = 0;
  private pcmChunks: Uint8Array[] = [];
  private pcmTotalBytes = 0;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly apiBase: string) {}

  async start(): Promise<void> {
    this.mirrorToWebView([
      "GLANCEDESK BOOTING...",
      "Connecting EvenAppBridge v0.0.16",
      "Loading Hyperliquid + Polymarket",
      "[TAP=MIC] [RING=SCROLL]",
    ]);

    try {
      this.bridge = await Promise.race([
        waitForEvenAppBridge(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
    } catch {
      this.bridge = null;
    }

    if (this.bridge) {
      this.bridge.onLaunchSource((source) => {
        console.info("[GlanceDesk] Launch source:", source);
      });
      this.bridge.onDeviceStatusChanged((status) => {
        if (status.connectType === DeviceConnectType.Disconnected) {
          void this.stopMicAndReset();
        }
      });
      this.bridge.onEvenHubEvent((event) => {
        void this.handleEvenHubEvent(event);
      });
    }

    await this.refreshFeed();
    await this.renderHud();
  }

  private mirrorToWebView(lines: string[]): void {
    const el = document.getElementById("hudMirror");
    if (el) {
      el.textContent = `[${this.hudState}]\n${lines.join("\n")}`;
    }
  }

  private currentLinesAndBadge(): { lines: string[]; badge: string } {
    if (this.hudState === "GLANCE_FEED" && this.feed?.hud_cards?.length) {
      const card = this.feed.hud_cards[this.cardIndex % this.feed.hud_cards.length];
      return { lines: card.lines, badge: card.title };
    }
    if (this.hudState === "VOICE_CAPTURE") {
      const secs = ((Date.now() - this.recStartedAt) / 1000).toFixed(1);
      const kb = (this.pcmTotalBytes / 1024).toFixed(1);
      return {
        lines: [
          `[● REC] Speak command (${secs}s)`,
          `Mic:${this.activeMicSource.toUpperCase()} · ${kb}KB · 16kHz`,
          "Short ETH $25 / Reply TG...",
          "[TAP=SEND] [HOLD=ABORT]",
        ],
        badge: "MIC LIVE",
      };
    }
    if (this.hudState === "CONFIRM_SAFETY" && this.pendingIntent) {
      return {
        lines: this.pendingIntent.hud_confirmation_lines,
        badge: "SAFETY GATE",
      };
    }
    if (this.hudState === "RECEIPT" && this.lastReceipt) {
      return {
        lines: this.lastReceipt.hud_lines,
        badge: this.lastReceipt.ok ? "FILLED" : "BLOCKED",
      };
    }
    return {
      lines: [
        "GLANCEDESK · EVEN G2",
        "Waiting for live feed...",
        "Testnet/Paper Cap: $50",
        "[TAP=MIC] [RING=SCROLL]",
      ],
      badge: "BOOT",
    };
  }

  private async renderHud(): Promise<void> {
    const { lines, badge } = this.currentLinesAndBadge();
    const normalized = normalizeLines(lines);
    this.mirrorToWebView(normalized);

    if (!this.bridge) return;

    if (!this.startupCreated) {
      const res = await this.bridge.createStartUpPageContainer(
        buildStartupPage(this.hudState, normalized, badge),
      );
      this.startupCreated = res === StartUpPageCreateResult.success;
      return;
    }

    // Fast incremental upgrade for body & footer, or full rebuild on state changes
    const rebuilt = await this.bridge.rebuildPageContainer(
      buildRebuildPage(this.hudState, normalized, badge),
    );
    if (!rebuilt) {
      await this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: CONTAINER_IDS.BODY,
          containerName: "gd-body",
          content: normalized.slice(0, 3).join("\n"),
          textColor: 4,
        }),
      );
    }
  }

  async refreshFeed(): Promise<void> {
    try {
      const res = await fetch(`${this.apiBase}/api/v1/feed`);
      if (res.ok) {
        this.feed = (await res.json()) as GlanceFeedResponse;
      }
    } catch (err) {
      console.warn("[GlanceDesk] Feed fetch fallback:", err);
    }
  }

  private async startVoiceCapture(): Promise<void> {
    if (this.recording) return;
    this.recording = true;
    this.hudState = "VOICE_CAPTURE";
    this.recStartedAt = Date.now();
    this.pcmChunks = [];
    this.pcmTotalBytes = 0;

    if (this.bridge && this.startupCreated) {
      // Official SDK rule: Glasses MIC requires createStartUpPageContainer to have succeeded first
      let ok = await this.bridge.audioControl(true, AudioInputSource.Glasses);
      this.activeMicSource = AudioInputSource.Glasses;
      if (!ok) {
        ok = await this.bridge.audioControl(true, AudioInputSource.Phone);
        this.activeMicSource = AudioInputSource.Phone;
      }
      if (!ok) {
        this.recording = false;
        this.hudState = "GLANCE_FEED";
        await this.renderHud();
        return;
      }
    }

    await this.renderHud();
    this.captureTimer = setTimeout(() => {
      void this.finishVoiceCaptureAndParse();
    }, MAX_CAPTURE_MS);
  }

  private async stopMicAndReset(): Promise<void> {
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
    this.recording = false;
    this.pcmChunks = [];
    this.pcmTotalBytes = 0;
    this.pendingIntent = null;
    this.hudState = "GLANCE_FEED";
    if (this.bridge) {
      await this.bridge.audioControl(false).catch(() => false);
    }
    await this.renderHud();
  }

  private async finishVoiceCaptureAndParse(): Promise<void> {
    if (!this.recording) return;
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
    this.recording = false;
    if (this.bridge) {
      await this.bridge.audioControl(false).catch(() => false);
    }

    const merged = new Uint8Array(this.pcmTotalBytes);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.pcmChunks = [];
    this.pcmTotalBytes = 0;

    try {
      const res = await fetch(`${this.apiBase}/api/v1/voice-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "audio/pcm",
          "X-Sample-Rate": "16000",
        },
        body: merged,
      });
      const intent = (await res.json()) as VoiceIntentResponse;
      this.pendingIntent = intent;
      this.hudState = intent.action === "CANCEL" ? "GLANCE_FEED" : "CONFIRM_SAFETY";
    } catch {
      this.hudState = "GLANCE_FEED";
    }
    await this.renderHud();
  }

  private async confirmAndExecute(): Promise<void> {
    if (!this.pendingIntent) return;
    if (!this.pendingIntent.requires_confirmation) {
      this.pendingIntent = null;
      this.hudState = "GLANCE_FEED";
      await this.renderHud();
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/api/v1/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: this.pendingIntent,
          confirmed: true,
        }),
      });
      this.lastReceipt = (await res.json()) as ExecuteReceiptResponse;
      this.hudState = "RECEIPT";
      await this.refreshFeed();
    } catch {
      this.lastReceipt = {
        ok: false,
        error: "Edge execution unreachable",
        hud_lines: [
          "EXECUTION FAILED",
          "Edge API unreachable",
          "No testnet order placed",
          "[TAP=RETURN TO FEED]",
        ],
      };
      this.hudState = "RECEIPT";
    }
    await this.renderHud();
  }

  private async handleEvenHubEvent(event: EvenHubEvent): Promise<void> {
    // 1. Streamed 16kHz PCM audio frames from Even G2 4-mic array
    if (event.audioEvent && this.recording) {
      const audio = event.audioEvent;
      // Prefer wearer's own voice when G2 self-speaker classification marks Other
      if (audio.speakerRole === AudioSpeakerRole.Other) return;
      if (this.pcmTotalBytes + audio.audioPcm.byteLength <= MAX_PCM_BYTES) {
        this.pcmChunks.push(audio.audioPcm);
        this.pcmTotalBytes += audio.audioPcm.byteLength;
      }
      return;
    }

    // 2. Temple & R1 Ring hardware gestures + contextual OS menu
    const gesture = normalizeHardwareGesture(event);
    if (!gesture) return;

    if (gesture.kind === "MENU_ITEM") {
      if (gesture.itemID === MENU_ITEM_IDS.VOICE_CMD) {
        await this.startVoiceCapture();
      } else if (gesture.itemID === MENU_ITEM_IDS.REFRESH_FEED) {
        await this.refreshFeed();
        this.hudState = "GLANCE_FEED";
        await this.renderHud();
      } else if (gesture.itemID === MENU_ITEM_IDS.TELEGRAM_DIGEST) {
        this.cardIndex = 3;
        this.hudState = "GLANCE_FEED";
        await this.renderHud();
      } else if (gesture.itemID === MENU_ITEM_IDS.ABORT_HOME) {
        await this.stopMicAndReset();
      }
      return;
    }

    if (gesture.kind === "LONG_PRESS" || gesture.kind === "DOUBLE_CLICK") {
      await this.stopMicAndReset();
      return;
    }

    if (gesture.kind === "SCROLL_UP" || gesture.kind === "SCROLL_DOWN") {
      if (this.hudState === "GLANCE_FEED" || this.hudState === "RECEIPT") {
        const delta = gesture.kind === "SCROLL_DOWN" ? 1 : 3;
        this.cardIndex = (this.cardIndex + delta) % 4;
        this.hudState = "GLANCE_FEED";
        await this.renderHud();
      }
      return;
    }

    if (gesture.kind === "CLICK") {
      if (this.hudState === "GLANCE_FEED") {
        await this.startVoiceCapture();
      } else if (this.hudState === "VOICE_CAPTURE") {
        await this.finishVoiceCaptureAndParse();
      } else if (this.hudState === "CONFIRM_SAFETY") {
        await this.confirmAndExecute();
      } else {
        this.hudState = "GLANCE_FEED";
        await this.renderHud();
      }
    }
  }
}

const controller = new GlanceDeskG2Controller(DEFAULT_API_BASE);
void controller.start();
