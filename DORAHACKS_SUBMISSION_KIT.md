# GlanceDesk — DoraHacks Submission Kit

**Event:** Heads Up: Even Realities Hackathon (DoraHacks · TVM Ventures × Daos Hub)  
**URL:** `https://dorahacks.io/hackathon/even-realities`  
**Deadline:** `2026-11-29 19:59 UTC` | **Demo Day:** `2026-12-03` (Remote OK) | **Payout:** USDT on TON within 7 days of Demo Day (Zero KYC)

---

## 1. Track & Bounty Selection (Copy-Paste Ready)

- **Project Name:** `GlanceDesk`
- **Tagline (<= 50 chars):** `Hands-free G2 voice trading & Telegram HUD`
- **Primary Track:** `Crypto & DeFi` (`$1,250` 1st / `$375` 2nd)
- **Secondary Track:** `Messaging & News` (`$1,250` 1st / `$375` 2nd)
- **Special Bounty Opt-In:** **`Best Telegram Integration`** (`$1,000` cash bonus)
- **Grand Prize Eligible:** Yes (`$2,000`)
- **Team / Org:** `Upswing-Labs`

---

## 2. DoraHacks Project Description (Copy-Paste)

### Problem
Active crypto traders and Telegram-native founders check their phones 80+ times a day just to glance at perp levels, Polymarket odds shifts, and urgent Telegram desk pings—breaking focus in meetings, transit, or away from monitors. Phone-first trading apps and chat feeds fail completely when pasted onto smart glasses because dense charts and long threads are illegible on a `576×288` monochrome green waveguide.

### Solution — GlanceDesk for Even Realities G2
**GlanceDesk** is a purpose-built **Read & Write** heads-up terminal for **Even Realities G2** glasses and the **Even R1 Ring** that unifies **live Polymarket Gamma odds**, **live Hyperliquid Testnet perp mids**, and **Telegram Alpha messages** into a crisp **4-line monochrome green HUD**—and lets you act on any alert in **under 3 seconds** using voice + a single confirmation tap:

1. **State 1 — Glance Feed (Read):** Flick the **R1 Ring** (`SCROLL_TOP_EVENT` / `SCROLL_BOTTOM_EVENT`) to cycle 4 zero-clutter cards (`Overview`, `Polymarket`, `Hyperliquid Testnet`, `Telegram Alpha`).
2. **State 2 — Voice Capture (Write):** Tap once (`CLICK_EVENT`) to open the Even G2 4-mic array (`audioControl(true, AudioInputSource.Glasses)` -> 16 kHz mono s16le PCM) and speak naturally:
   - *"Short ETH 25 dollars"* (Hyperliquid Testnet paper fill)
   - *"Bet 15 dollars YES on Bitcoin 100k"* (Polymarket paper bet)
   - *"Reply to Alpha Desk: Locked in, watching ETH 1700"* (1-tap Telegram voice reply)
   - *"Summarize alerts"* (instant consolidated digest)
3. **State 3 — 1-Tap Safety Gate:** Sub-350 ms GPU `Faster-Whisper large-v3-turbo` + Silero VAD (Google Colab A100/L4/T4) parses the command into a high-contrast 4-line safety card (`SHORT ETH $25 TESTNET? / Entry ~$1,697 · Risk 1.0% / [TAP=CONFIRM] [HOLD=ABORT]`). Mainnet, withdrawal, and seed-phrase requests are deterministically blocked.
4. **State 4 — Instant Receipt & Telegram Sync:** One tap confirms execution on the paper/testnet ledger (`#HL-8492`) and dispatches an auditable receipt straight to Telegram (`SENT TO TG`).

### Technical Stack (Built on Real EvenHub SDK `0.0.16` & CLI `0.2.0`)
- **Even G2 App (`app/`):** TypeScript app built strictly against `@evenrealities/even_hub_sdk@0.0.16` (`waitForEvenAppBridge`, `createStartUpPageContainer`, `rebuildPageContainer`, `textContainerUpgrade`, `audioControl`, `AudioSpeakerRole` wearer filtering, Protobuf zero-value `CLICK_EVENT` handling, `LONG_PRESS_EVENT` abort, and contextual OS menu), packaged cleanly via `evenhub pack app.json dist -o glancedesk.ehpk`.
- **Cloudflare Workers Edge (`upswing-glancedesk`):** `$0` Free Tier backend serving live Polymarket Gamma + Hyperliquid Testnet + Telegram digest endpoints AND a **zero-install Browser 576×288 Waveguide Simulator** so judges can test live voice/text flows immediately.
- **1-Click GPU ASR Server (`colab/GlanceDesk_Whisper_Colab_GPU.ipynb`):** Runs `Faster-Whisper large-v3-turbo` (`float16`) + Silero VAD exposed over HTTPS via `cloudflared`, with automatic edge deterministic fallback when the Colab tunnel is sleeping.

---

## 3. Judging Criteria Alignment Matrix

| Criterion | Weight | How GlanceDesk Wins Full Marks |
|---|---:|---|
| **Usefulness on G2** | **30%** | Solves real daily phone-checking friction (live Hyperliquid Testnet mids + Polymarket odds + Telegram alpha) with genuine glanceability while walking or in meetings. |
| **Read & Write Fast Voice + Tap Action** | **25%** | Complete end-to-end Read -> Speak -> Confirm -> Execute loop: voice trade (`PLACE_HYPERLIQUID`), prediction bet (`BUY_POLYMARKET`), and 1-tap voice-drafted Telegram reply (`REPLY_TELEGRAM`) in `< 3s`. |
| **Technical Execution** | **20%** | Real `@evenrealities/even_hub_sdk@0.0.16` & `evenhub-cli@0.2.0` `.ehpk` manifest, live public APIs, Google Colab GPU `Faster-Whisper` + Silero VAD, `$0` Cloudflare Worker, 100% passing test suite. |
| **Display & Voice UX** | **15%** | Strict `576×288` 4-bit green typography (`<= 4` lines, `<= 36` chars/line), SDK `textColor` hierarchy (`2/3/4`), R1 ring card cycling, wearer `AudioSpeakerRole` filtering, and `LONG_PRESS_EVENT` abort. |
| **Business / Safety** | **10%** | `TESTNET_PAPER_ONLY` architecture, `$50` hard order cap, `$250` daily cap, mandatory 1-tap human-in-the-loop confirmation, mainnet/withdrawal hard block, zero secrets in repo. |

---

## 4. Demo Video Script (`2 min 40 sec` — Strictly `< 3 min`)

| Time | Visual on Screen | Narration / Key Beat |
|---|---|---|
| **0:00–0:20** | Split screen: GlanceDesk 576×288 Monochrome Green Waveguide Simulator + EvenHub Simulator side-by-side. | *"Traders and founders check their phones 80 times a day for prices, Polymarket odds, and Telegram pings. Meet **GlanceDesk**—a 4-line Read & Write voice terminal built natively for Even Realities G2 and the R1 Ring."* |
| **0:20–0:50** | Click `▼ RING DN` through all 4 Glance Feed cards (`Overview`, `Polymarket`, `Hyperliquid Testnet`, `Telegram Alpha`) showing live prices & SDK 0.0.16 Container JSON updating. | *"Every screen obeys G2 optics: 576×288, 4-bit green, max 4 lines, 36 chars. Flick the R1 ring to glance live Polymarket Gamma odds, live Hyperliquid Testnet mids, and unread Telegram alpha—zero clutter."* |
| **0:50–1:30** | Click `● TAP / OK` -> `[● REC]` -> speak/trigger *"Short ETH 25 dollars"* -> State 3 Safety Card appears (`SHORT ETH $25 TESTNET? / Entry ~$1,697 · Risk 1.0% / [TAP=CONFIRM] [HOLD=ABORT]`) -> tap `● TAP / OK` -> State 4 `FILLED #HL-8492 · SENT TO TG`. | *"Tap once to stream 16 kHz PCM from the G2 4-mic array to our GPU Faster-Whisper large-v3-turbo server on Colab. In under 350 milliseconds, GlanceDesk renders a strict human-in-the-loop safety card. One tap confirms on our paper testnet ledger and posts the receipt straight to Telegram."* |
| **1:30–2:05** | Trigger *"Bet 15 dollars YES on Bitcoin 100k"* -> Confirm -> then trigger *"Reply to Alpha Desk: Locked in, watching ETH 1700"* -> Confirm -> show live Telegram message/receipt arriving! | *"Same 2-tap muscle memory works across Polymarket paper bets AND our Telegram integration: glance an urgent Telegram alert, speak your reply, tap once to send—phone stays in your pocket."* |
| **2:05–2:30** | Trigger *"Short ETH 500 mainnet"* -> HUD flashes `BLOCKED · SAFETY GUARD` + trigger `✕ HOLD ABORT` on a pending card. Show `evenhub pack app.json dist -o glancedesk.ehpk` succeeding in terminal. | *"Safety is enforced server-side: mainnet and withdrawal commands are hard-blocked, paper orders are capped at $50, and holding the temple aborts instantly. It packs cleanly into a valid `.ehpk` using EvenHub CLI 0.2.0."* |
| **2:30–2:40** | End card: GitHub repo URL, live Cloudflare Workers Simulator URL, `Upswing-Labs`. | *"GlanceDesk runs on $0 Cloudflare Workers + 1-click Colab GPU. Try the live 576×288 browser simulator right now—thank you!"* |

---

## 5. Pre-Submission & TON USDT Payout Checklist

- [ ] Push `products/even_realities_glancedesk/` to a **public GitHub repository** under `Upswing-Labs`.
- [ ] Deploy Cloudflare Worker (`npx wrangler deploy`) and verify live `https://upswing-glancedesk.<subdomain>.workers.dev/` simulator + `/health` + `/api/v1/feed`.
- [ ] Optional: Configure `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` via `wrangler secret put` so judges see live Telegram bot delivery during Demo Day.
- [ ] Optional: Launch `colab/GlanceDesk_Whisper_Colab_GPU.ipynb` on Colab GPU and bind `COLAB_WHISPER_URL` before Demo Day recording.
- [ ] Build `.ehpk` package (`cd app && evenhub pack app.json dist -o glancedesk.ehpk`) and attach/link release artifact.
- [ ] Record `< 3 min` demo video (1080p, crisp audio, following Section 4 timeline) and upload to YouTube/Loom.
- [ ] Submit on `https://dorahacks.io/hackathon/even-realities` **before `2026-11-29 19:59 UTC`** selecting `Crypto & DeFi` + `Messaging & News` + `Best Telegram Integration`.
- [ ] Prepare non-custodial **TON wallet address** (supporting Jetton USDT on TON, e.g., Tonkeeper) for zero-KYC prize payout by **Dec 10, 2026** (within 7 days of Dec 3 Demo Day).
