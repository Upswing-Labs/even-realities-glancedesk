# GlanceDesk — Even Realities G2 Voice-to-Trade & Telegram HUD

> **Heads Up: Even Realities Hackathon (DoraHacks · TVM Ventures × Daos Hub)**  
> **Organization:** Upswing-Labs  
> **Target Tracks:** `Crypto & DeFi` (Primary) · `Messaging & News` (Secondary) · **`Best Telegram Integration`** ($1,000 Bonus)  
> **Safety Mode:** **`TESTNET_PAPER_ONLY`** — Hard `$50` per-order cap, `$250` daily notional cap, mandatory 1-tap human confirmation, zero mainnet keys on device or edge.

GlanceDesk turns the **Even Realities G2** dual micro-LED monochrome green waveguide (`576×288`, 4-bit green) and **R1 Ring** into a sub-second **"Read & Write" heads-up trading and Telegram command desk** powered by **Google Colab GPU (`Faster-Whisper large-v3-turbo` + Silero VAD)** and a **`$0`-infrastructure Cloudflare Worker**.

---

## Why GlanceDesk Fits Even G2 Optics & Ergonomics

1. **Glanceable 4-Line Waveguide UX (`576×288`, 4-bit green):** Zero chart clutter, zero scrolling walls of text. Every screen is strictly bounded to `<= 4` lines and `<= 36` ASCII-safe characters using official `@evenrealities/even_hub_sdk@0.0.16` brightness tiers (`textColor: 2..4`).
2. **True Read & Write Loop (`< 350 ms` GPU ASR + 1-Tap Confirm):**
   - **State 1 — `GLANCE_FEED`:** Scroll 4 ultra-minimal cards via **R1 Ring** (`SCROLL_TOP_EVENT` / `SCROLL_BOTTOM_EVENT`): Overview, Live **Polymarket Gamma** odds, Live **Hyperliquid Testnet** perp mids, and unread **Telegram Alpha** digest.
   - **State 2 — `VOICE_CAPTURE`:** Single tap (`CLICK_EVENT`) opens the Even G2 4-mic array (`audioControl(true, AudioInputSource.Glasses)` with automatic `AudioInputSource.Phone` fallback), streaming 16 kHz mono s16le PCM to the edge -> Colab GPU `Faster-Whisper large-v3-turbo`.
   - **State 3 — `CONFIRM_SAFETY`:** Strict human-in-the-loop safety card (`SHORT ETH $25 TESTNET? / Entry ~$1,697 · Risk 1.0% / Conf 96% · Cap $50 PAPER / [TAP=CONFIRM] [HOLD=ABORT]`). Mainnet, withdrawal, and seed-phrase phrases are hard-blocked.
   - **State 4 — `RECEIPT`:** Instant execution receipt (`FILLED #HL-8492 · SENT TO TG`) posted directly to your Telegram chat (or logged in paper preview mode when no bot token is set).
3. **Zero-Friction Judge Testing (Browser 576×288 Simulator Included):** Visiting `/` on the Cloudflare Worker serves a pixel-accurate **576×288 4-bit phosphor-green G2 Waveguide Simulator** with hardware buttons (`▲ RING UP`, `▼ RING DN`, `● TAP / OK`, `🎙 MIC REC`, `✕ HOLD ABORT`), live market feeds, browser 16 kHz PCM capture, and an EvenHub SDK 0.0.16 container JSON inspector.

---

## Architecture

```
Even G2 Glasses (576×288 4-bit Green + 4-Mic 16kHz PCM + R1 Ring)
        │  @evenrealities/even_hub_sdk@0.0.16 (EvenAppBridge)
        ▼
Cloudflare Worker (`upswing-glancedesk`, $0 Free Tier, Zero Hardcoded Secrets)
  ├── GET  /                      -> 576×288 Monochrome Green Web Simulator + Mic Tester
  ├── GET  /health                -> Hardware & safety policy telemetry
  ├── GET  /api/v1/feed           -> Polymarket Gamma + Hyperliquid Testnet + Telegram Digest
  ├── POST /api/v1/voice-intent   -> Colab GPU Faster-Whisper (fallback: deterministic edge parser)
  ├── POST /api/v1/execute        -> Confirmed Testnet/Paper Execution + Telegram Bot Receipt
  └── GET/POST /api/v1/telegram/* -> Telegram inbox & webhook ingestion
        │
        ├──▶ Google Colab A100/L4/T4 GPU (`colab/GlanceDesk_Whisper_Colab_GPU.ipynb`)
        │     Faster-Whisper large-v3-turbo (fp16) + Silero VAD + cloudflared HTTPS tunnel
        ├──▶ Polymarket Gamma API (`gamma-api.polymarket.com/markets`)
        ├──▶ Hyperliquid Testnet API (`api.hyperliquid-testnet.xyz/info`)
        └──▶ Telegram Bot API (configurable `TELEGRAM_API_BASE` + Wrangler secrets)
```

---

## Repository Structure

```text
even_realities_glancedesk/
├── app/                                  # EvenHub G2 TypeScript App + .ehpk packaging
│   ├── app.json                          # Verified EvenHub CLI 0.2.0 manifest (g2-microphone, network)
│   ├── package.json                      # @evenrealities/even_hub_sdk ^0.0.16
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.ts                       # EvenAppBridge lifecycle, 4-state FSM, 16kHz PCM mic stream
│   │   ├── hud_layout.ts                 # 576x288 containers + Protobuf CLICK_EVENT(0) handler
│   │   └── types.ts
│   └── dist/                             # Pre-built standalone WebView bundle ready for `evenhub pack`
├── colab/
│   └── GlanceDesk_Whisper_Colab_GPU.ipynb # 1-click Colab A100/L4/T4 Faster-Whisper + Silero VAD server
├── shared/
│   ├── constants.mjs                     # G2 display geometry, SDK enums, hard safety caps
│   ├── intent_parser.mjs                 # Deterministic intent parser & safety guard
│   ├── hud_formatter.mjs                 # 4-line 36-char HUD & SDK 0.0.16 container validator
│   ├── feeds.mjs                         # Polymarket Gamma, Hyperliquid Testnet, Telegram normalizers
│   └── executor.mjs                      # Paper/Testnet ledger ($50 order / $250 daily caps)
├── worker/
│   ├── index.mjs                         # Cloudflare Worker edge router
│   └── simulator_ui.mjs                  # Standalone 576x288 green waveguide web simulator
├── tests/
│   └── glancedesk.test.mjs               # Full Node test suite (`npm test`)
├── wrangler.jsonc                        # Cloudflare Workers config (`upswing-glancedesk`)
├── package.json
├── README.md
└── DORAHACKS_SUBMISSION_KIT.md           # DoraHacks submission copy, <3 min demo script & payout checklist
```

---

## Quick Start

### 1. Run the Full Test Suite (Zero External Dependencies)
```bash
npm test
```

### 2. Launch the Edge Backend + 576×288 Browser Waveguide Simulator
```bash
npx wrangler dev
# Open http://127.0.0.1:8787 in any browser
```

### 3. Preview in the Official Even Realities Desktop Simulator
```bash
npm install -g @evenrealities/evenhub-cli @evenrealities/evenhub-simulator
cd app && npm install && npm run dev
# In a second terminal:
evenhub-simulator http://localhost:5173
```

### 4. Package the `.ehpk` Plugin Bundle for Even G2 Hardware
```bash
cd app
evenhub pack app.json dist -o glancedesk.ehpk
```

### 5. Optional: Connect 1-Click Google Colab GPU Faster-Whisper (`< 350 ms`)
1. Open `colab/GlanceDesk_Whisper_Colab_GPU.ipynb` in Google Colab.
2. Select **`Runtime -> Change runtime type -> T4 / L4 / A100 GPU`**, then click **`Runtime -> Run all`**.
3. Copy the printed `https://*.trycloudflare.com` URL and bind it to your Worker:
```bash
npx wrangler secret put COLAB_WHISPER_URL
```
*(When the Colab tunnel is sleeping or unset, GlanceDesk automatically uses its `< 5 ms` deterministic edge parser for text/Web-Speech commands so demos never break.)*

### 6. Optional: Enable Live Telegram Bot Digests & Execution Receipts
Configure your Telegram Bot credentials strictly via Wrangler secrets (never commit tokens):
```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
# Optional webhook secret for POST /api/v1/telegram/webhook:
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```
The Worker reads `TELEGRAM_API_BASE` from `wrangler.jsonc` (`https://api.telegram.org` by default, or any self-hosted Telegram Bot API server) and constructs method paths dynamically.

---

## Deploy to Cloudflare Workers (`$0` Free Tier)
```bash
npx wrangler deploy
```

## Safety & Non-Custodial Guarantees
- **Testnet / Paper Only:** GlanceDesk holds zero mainnet private keys and never signs real-money transactions.
- **Hard Server-Side Risk Caps:** Maximum `$50` per paper order and `$250` daily paper notional.
- **Explicit 1-Tap Confirmation:** Every trade, prediction bet, or Telegram reply pauses on State 3 (`CONFIRM_SAFETY`) until the user explicitly taps the temple/ring (`confirmed: true`); holding (`LONG_PRESS_EVENT`) aborts immediately.
- **Static Guardrails:** Commands mentioning `mainnet`, `withdraw`, `real money`, `seed phrase`, or `private key` are deterministically rejected with `BLOCKED_SAFETY`.
