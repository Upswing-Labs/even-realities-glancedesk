/**
 * GlanceDesk G2 App Types
 */

export type HudState = "GLANCE_FEED" | "VOICE_CAPTURE" | "CONFIRM_SAFETY" | "RECEIPT";

export interface HudCard {
  id: string;
  title: string;
  lines: string[];
}

export interface GlanceFeedResponse {
  ok: boolean;
  execution_mode: string;
  timestamp: string;
  polymarket_source: string;
  polymarket: Array<{
    id: string;
    shortTitle: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    yesPct: number;
    noPct: number;
    volume24hr: number;
  }>;
  hyperliquid: {
    source: string;
    mids: Record<string, number>;
  };
  telegram: {
    mode: string;
    unreadCount: number;
    messages: Array<{ id: string; chat: string; sender: string; text: string; ts: string }>;
  };
  hud_cards: HudCard[];
}

export interface VoiceIntentResponse {
  ok: boolean;
  transcript: string;
  action:
    | "BUY_POLYMARKET"
    | "PLACE_HYPERLIQUID"
    | "REPLY_TELEGRAM"
    | "SUMMARIZE_ALERTS"
    | "CANCEL"
    | "BLOCKED_SAFETY"
    | "UNKNOWN";
  symbol_or_market: string | null;
  side: string | null;
  size_usd: number;
  target_chat?: string | null;
  reply_text?: string | null;
  confidence: number;
  requires_confirmation?: boolean;
  reason?: string;
  hud_confirmation_lines: string[];
  latency_ms?: number;
  engine?: string;
}

export interface ExecuteReceiptResponse {
  ok: boolean;
  receiptId?: string;
  action?: string;
  error?: string;
  hud_lines: string[];
}
