/**
 * GlanceDesk — Even Realities G2 Hardware, Safety & Protocol Constants
 * Verified against @evenrealities/even_hub_sdk@0.0.16 & @evenrealities/evenhub-cli@0.2.0
 */

export const APP_META = Object.freeze({
  name: "GlanceDesk",
  org: "Upswing-Labs",
  packageId: "io.upswinglabs.glancedesk",
  version: "1.0.0",
  minAppVersion: "2.2.10",
  minSdkVersion: "0.0.16",
  executionMode: "TESTNET_PAPER_ONLY",
});

/** Even Realities G2 Dual Micro-LED Monochrome Green Waveguide specs */
export const G2_DISPLAY = Object.freeze({
  widthPx: 576,
  heightPx: 288,
  bitDepth: 4, // 16 shades of monochrome green (textColor levels 0..4 in SDK 0.0.16)
  minTextBrightness: 0,
  maxTextBrightness: 4,
  defaultTextBrightness: 4,
  maxContainersPerPage: 12,
  maxTextContainers: 8,
  maxMenuItems: 10,
  maxMenuItemBytes: 32,
  maxHudLines: 4,
  maxLineChars: 36,
  audioSampleRateHz: 16000,
  audioChannels: 1,
  audioBitDepth: 16, // s16le mono PCM
});

/** Verified OsEventTypeList ordinals from @evenrealities/even_hub_sdk@0.0.16 */
export const OS_EVENT_TYPE = Object.freeze({
  CLICK_EVENT: 0,
  SCROLL_TOP_EVENT: 1,
  SCROLL_BOTTOM_EVENT: 2,
  DOUBLE_CLICK_EVENT: 3,
  FOREGROUND_ENTER_EVENT: 4,
  FOREGROUND_EXIT_EVENT: 5,
  ABNORMAL_EXIT_EVENT: 6,
  SYSTEM_EXIT_EVENT: 7,
  IMU_DATA_REPORT: 8,
  LONG_PRESS_EVENT: 9,
  LONG_PRESS_RELEASE_EVENT: 10,
});

/** Verified EventSourceType ordinals from @evenrealities/even_hub_sdk@0.0.16 */
export const EVENT_SOURCE = Object.freeze({
  DUMMY_NULL: 0,
  GLASSES_R: 1,
  RING: 2,
  GLASSES_L: 3,
});

/** Four glanceable states tailored to G2 waveguide ergonomics */
export const HUD_STATES = Object.freeze({
  GLANCE_FEED: "GLANCE_FEED",
  VOICE_CAPTURE: "VOICE_CAPTURE",
  CONFIRM_SAFETY: "CONFIRM_SAFETY",
  RECEIPT: "RECEIPT",
});

/** Supported voice/text intents */
export const INTENTS = Object.freeze({
  BUY_POLYMARKET: "BUY_POLYMARKET",
  PLACE_HYPERLIQUID: "PLACE_HYPERLIQUID",
  REPLY_TELEGRAM: "REPLY_TELEGRAM",
  SUMMARIZE_ALERTS: "SUMMARIZE_ALERTS",
  CANCEL: "CANCEL",
  BLOCKED_SAFETY: "BLOCKED_SAFETY",
  UNKNOWN: "UNKNOWN",
});

/** Hard paper/testnet-only safety limits (enforced server-side + client-side) */
export const SAFETY_LIMITS = Object.freeze({
  executionMode: "TESTNET_PAPER_ONLY",
  defaultPaperEquityUsd: 2500,
  minOrderUsd: 1,
  maxOrderUsd: 50,
  maxDailyNotionalUsd: 250,
  maxLeverage: 3,
  maxAccountRiskPct: 2.0,
  requireExplicitTapConfirmation: true,
});

/** Supported Hyperliquid Testnet perp symbols for voice commands */
export const SUPPORTED_PERP_SYMBOLS = Object.freeze([
  "BTC",
  "ETH",
  "SOL",
  "HYPE",
  "TON",
  "AVAX",
  "DOGE",
  "ARB",
  "SUI",
  "BNB",
]);

/** Symbol aliases spoken via Whisper ASR */
export const SYMBOL_ALIASES = Object.freeze({
  bitcoin: "BTC",
  btc: "BTC",
  ethereum: "ETH",
  ether: "ETH",
  eth: "ETH",
  solana: "SOL",
  sol: "SOL",
  hyperliquid: "HYPE",
  hype: "HYPE",
  toncoin: "TON",
  ton: "TON",
  avalanche: "AVAX",
  avax: "AVAX",
  dogecoin: "DOGE",
  doge: "DOGE",
  arbitrum: "ARB",
  arb: "ARB",
  sui: "SUI",
  bnb: "BNB",
});

/** Dangerous mainnet / credential / exfil keywords that MUST be hard-blocked */
export const FORBIDDEN_SAFETY_PATTERNS = Object.freeze([
  /\bmainnet\b/i,
  /\breal\s+(?:money|funds|usdt|usdc)\b/i,
  /\bwithdraw(?:al)?\b/i,
  /\btransfer\s+(?:all|everything|wallet)\b/i,
  /\b(?:seed\s*phrase|private\s*key|mnemonic|export\s+key)\b/i,
  /\bdrain\b/i,
]);
