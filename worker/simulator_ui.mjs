/**
 * GlanceDesk — Standalone Browser 576x288 4-Bit Monochrome Green Waveguide Simulator
 * Lets DoraHacks judges test all 4 G2 states, R1 ring scrolling, live Polymarket +
 * Hyperliquid Testnet prices, real browser microphone (16kHz PCM + Web Speech fallback),
 * 1-tap safety confirmation, and Telegram voice replies directly in any browser!
 */

export function renderSimulatorHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GlanceDesk · Even Realities G2 576×288 Waveguide Simulator</title>
  <style>
    :root {
      --bg: #050807;
      --panel: #0b110e;
      --border: #193022;
      --g0: #020a04;
      --g1: #0b2b14;
      --g2: #1c6b35;
      --g3: #33b85e;
      --g4: #4dff88;
      --muted: #7aa387;
      --warn: #ffbe4d;
      --danger: #ff6b6b;
      --mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 16px 40px;
      background: radial-gradient(circle at top, #0d1d14 0%, var(--bg) 55%);
      color: #d8f5e1;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .wrap { max-width: 1080px; margin: 0 auto; }
    header {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      gap: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--border); padding-bottom: 14px;
    }
    h1 { margin: 0; font-size: 1.35rem; letter-spacing: 0.04em; color: var(--g4); font-family: var(--mono); }
    .subtitle { font-size: 0.86rem; color: var(--muted); margin-top: 4px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge {
      font-family: var(--mono); font-size: 0.72rem; padding: 4px 9px; border-radius: 999px;
      border: 1px solid var(--border); background: #09140e; color: var(--g3);
    }
    .badge.warn { color: var(--warn); border-color: #4a3a16; }

    .stage {
      display: grid; grid-template-columns: minmax(0, 620px) minmax(260px, 1fr); gap: 18px;
      align-items: start; margin-bottom: 20px;
    }
    @media (max-width: 920px) { .stage { grid-template-columns: 1fr; } }

    .glasses-frame {
      background: linear-gradient(180deg, #111915, #070c09);
      border: 1px solid #244530; border-radius: 18px; padding: 16px;
      box-shadow: 0 0 40px rgba(77, 255, 136, 0.08), inset 0 1px 0 rgba(77, 255, 136, 0.14);
    }
    .bezel-meta {
      display: flex; justify-content: space-between; align-items: center;
      font-family: var(--mono); font-size: 0.72rem; color: var(--muted); margin-bottom: 10px;
    }
    .state-pill {
      color: var(--g4); background: rgba(77, 255, 136, 0.12);
      border: 1px solid rgba(77, 255, 136, 0.35); padding: 2px 8px; border-radius: 6px;
    }
    .waveguide-shell {
      position: relative; width: 100%; max-width: 576px; aspect-ratio: 2 / 1;
      margin: 0 auto; background: var(--g0); border-radius: 10px; overflow: hidden;
      border: 2px solid #1d4a2b;
      box-shadow: 0 0 28px rgba(77, 255, 136, 0.18), inset 0 0 36px rgba(28, 107, 53, 0.25);
    }
    canvas#g2Canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
    .scanlines {
      pointer-events: none; position: absolute; inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.0) 0px,
        rgba(0, 0, 0, 0.0) 2px,
        rgba(0, 0, 0, 0.22) 3px
      );
    }

    .hw-controls {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 14px;
    }
    @media (max-width: 560px) { .hw-controls { grid-template-columns: repeat(2, 1fr); } }
    button {
      cursor: pointer; font-family: var(--mono); font-size: 0.78rem; padding: 10px 8px;
      border-radius: 10px; border: 1px solid #265438; background: #0c1d13; color: var(--g4);
      transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease;
    }
    button:hover { background: #143220; border-color: var(--g3); }
    button:active { transform: translateY(1px); }
    button.primary { background: #154528; border-color: var(--g4); font-weight: 700; }
    button.danger { background: #261212; border-color: #7d2e2e; color: #ff9c9c; }
    button.recording { background: #3b1010; border-color: #ff5555; color: #ffcccc; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,85,85,0.4); } 50% { box-shadow: 0 0 14px 2px rgba(255,85,85,0.5); } }

    .panel {
      background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 14px;
    }
    .panel h2 {
      margin: 0 0 10px; font-size: 0.85rem; font-family: var(--mono); color: var(--g3);
      text-transform: uppercase; letter-spacing: 0.06em; display: flex; justify-content: space-between;
    }
    .voice-form { display: flex; gap: 8px; margin-bottom: 10px; }
    input[type="text"] {
      flex: 1; background: #060d09; border: 1px solid #234731; color: #e2ffec;
      border-radius: 8px; padding: 9px 10px; font-family: var(--mono); font-size: 0.82rem;
    }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip {
      font-size: 0.72rem; padding: 6px 9px; border-radius: 8px; background: #08150d;
      border: 1px solid #1f422c; color: #9de5b4;
    }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
    @media (max-width: 860px) { .grid-3 { grid-template-columns: 1fr; } }

    .list { display: flex; flex-direction: column; gap: 8px; font-family: var(--mono); font-size: 0.76rem; }
    .row {
      background: #07100b; border: 1px solid #152b1d; border-radius: 8px; padding: 8px 10px;
      display: flex; justify-content: space-between; gap: 8px; align-items: center;
    }
    .row .val { color: var(--g4); font-weight: 700; white-space: nowrap; }
    .row .sub { color: var(--muted); font-size: 0.7rem; }
    pre {
      margin: 0; background: #050b07; border: 1px solid #152b1d; border-radius: 8px;
      padding: 10px; overflow: auto; max-height: 220px; font-family: var(--mono);
      font-size: 0.72rem; color: #8adba4;
    }
    .status-line { font-family: var(--mono); font-size: 0.74rem; color: var(--muted); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>GLANCEDESK · EVEN G2 WAVEGUIDE SIMULATOR</h1>
        <div class="subtitle">Upswing-Labs · Crypto &amp; DeFi + Messaging &amp; News + Best Telegram Integration · 576×288 4-Bit Green</div>
      </div>
      <div class="badges">
        <span class="badge" id="badgeSdk">SDK v0.0.16</span>
        <span class="badge" id="badgeWhisper">WHISPER: CHECKING</span>
        <span class="badge" id="badgeTg">TELEGRAM: CHECKING</span>
        <span class="badge warn">TESTNET / PAPER ONLY · $50 CAP</span>
      </div>
    </header>

    <section class="stage">
      <div class="glasses-frame">
        <div class="bezel-meta">
          <span>EVEN REALITIES G2 · 576×288 · 4-BIT MICRO-LED</span>
          <span class="state-pill" id="statePill">STATE 1: GLANCE_FEED</span>
        </div>
        <div class="waveguide-shell">
          <canvas id="g2Canvas" width="576" height="288" aria-label="Even Realities G2 576x288 Monochrome Green Display"></canvas>
          <div class="scanlines"></div>
        </div>
        <div class="hw-controls">
          <button id="btnRingUp" title="R1 Ring Scroll Up (SCROLL_TOP_EVENT=1)">▲ RING UP</button>
          <button id="btnRingDown" title="R1 Ring Scroll Down (SCROLL_BOTTOM_EVENT=2)">▼ RING DN</button>
          <button id="btnTap" class="primary" title="Single Tap Temple / Confirm (CLICK_EVENT=0)">● TAP / OK</button>
          <button id="btnMic" title="Capture 16kHz Mono PCM Voice Command">🎙 MIC REC</button>
          <button id="btnHold" class="danger" title="Long Press Abort (LONG_PRESS_EVENT=9)">✕ HOLD ABORT</button>
        </div>
        <div class="status-line" id="statusLine">Booting GlanceDesk live feeds...</div>
      </div>

      <div class="panel">
        <h2>Voice &amp; Intent Console <span id="latencyBadge">-- ms</span></h2>
        <form class="voice-form" id="voiceForm">
          <input id="voiceInput" type="text" placeholder="Type or speak: Short ETH $25 / Bet $15 YES BTC / Reply Alpha Desk: on it" />
          <button type="submit" class="primary">PARSE</button>
        </form>
        <div class="presets">
          <button type="button" class="chip" data-cmd="Short ETH 25 dollars">Short ETH $25</button>
          <button type="button" class="chip" data-cmd="Long BTC 40 dollars">Long BTC $40</button>
          <button type="button" class="chip" data-cmd="Bet 15 dollars YES on Bitcoin 100k">Polymarket $15 YES</button>
          <button type="button" class="chip" data-cmd="Reply to Alpha Desk: Locked in, hedging ETH at 1700">1-Tap TG Reply</button>
          <button type="button" class="chip" data-cmd="Summarize alerts">Summarize Alerts</button>
          <button type="button" class="chip" data-cmd="Short ETH 500 dollars mainnet">Test Safety Block</button>
        </div>
        <div class="status-line" style="margin-bottom:8px;">
          4-State Loop: <b>1. Glance Feed</b> → <b>2. Voice Capture</b> → <b>3. 1-Tap Safety Card</b> → <b>4. Receipt + TG</b>
        </div>
        <h2 style="margin-top:12px;">EvenHub SDK 0.0.16 Container JSON</h2>
        <pre id="sdkJson">{}</pre>
      </div>
    </section>

    <section class="grid-3">
      <div class="panel">
        <h2>Hyperliquid Testnet Mids <span id="hlSource">--</span></h2>
        <div class="list" id="hlList"></div>
      </div>
      <div class="panel">
        <h2>Polymarket Gamma Odds <span id="pmSource">--</span></h2>
        <div class="list" id="pmList"></div>
      </div>
      <div class="panel">
        <h2>Telegram Alpha &amp; Receipts <span id="tgMode">--</span></h2>
        <div class="list" id="tgList"></div>
      </div>
    </section>
  </div>

  <script type="module">
    const canvas = document.getElementById("g2Canvas");
    const ctx = canvas.getContext("2d");
    const statePill = document.getElementById("statePill");
    const statusLine = document.getElementById("statusLine");
    const latencyBadge = document.getElementById("latencyBadge");
    const sdkJsonEl = document.getElementById("sdkJson");

    const state = {
      hudState: "GLANCE_FEED",
      cardIndex: 0,
      feed: null,
      pendingIntent: null,
      lastReceipt: null,
      recording: false,
      recStartedAt: 0,
      pcmBytes: 0,
      mediaStream: null,
      audioCtx: null,
      pcmChunks: [],
      speechRec: null,
    };

    const BRIGHTNESS = ["#020a04", "#0d3518", "#1f7a3c", "#34c263", "#4dff88"];

    function drawWaveguide(headerText, lines, footerText, isRec = false) {
      ctx.fillStyle = BRIGHTNESS[0];
      ctx.fillRect(0, 0, 576, 288);

      // Header bar (containerID: 1, textColor: 2)
      ctx.fillStyle = BRIGHTNESS[2];
      ctx.font = 'bold 16px "JetBrains Mono", Menlo, Consolas, monospace';
      ctx.fillText((headerText || "GLANCEDESK · G2").slice(0, 38), 18, 30);

      // Subtle divider
      ctx.strokeStyle = BRIGHTNESS[1];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 44);
      ctx.lineTo(560, 44);
      ctx.stroke();

      // Main border box (containerID: 2, borderColor: 2, textColor: 4)
      ctx.strokeStyle = isRec ? BRIGHTNESS[4] : BRIGHTNESS[2];
      ctx.lineWidth = 1.5;
      ctx.strokeRect(16, 56, 544, 168);

      const safeLines = (lines || []).slice(0, 3);
      ctx.font = 'bold 22px "JetBrains Mono", Menlo, Consolas, monospace';
      safeLines.forEach((ln, idx) => {
        ctx.fillStyle = idx === 0 ? BRIGHTNESS[4] : idx === 1 ? BRIGHTNESS[3] : BRIGHTNESS[2];
        ctx.fillText(String(ln).slice(0, 36), 28, 102 + idx * 46);
      });

      // Footer bar (containerID: 3, textColor: 3)
      ctx.fillStyle = BRIGHTNESS[3];
      ctx.font = '17px "JetBrains Mono", Menlo, Consolas, monospace';
      ctx.fillText(String(footerText || "[TAP=MIC] [RING=SCROLL]").slice(0, 38), 18, 262);
    }

    function renderCurrentHud() {
      let lines = ["GLANCEDESK LOADING...", "Fetching live markets", "Hyperliquid + Polymarket", "[TAP=MIC] [RING=SCROLL]"];
      let badge = "TESTNET";

      if (state.hudState === "GLANCE_FEED" && state.feed?.hud_cards?.length) {
        const card = state.feed.hud_cards[state.cardIndex % state.feed.hud_cards.length];
        lines = card.lines;
        badge = card.title;
        statePill.textContent = "STATE 1: GLANCE_FEED (" + (state.cardIndex + 1) + "/4)";
      } else if (state.hudState === "VOICE_CAPTURE") {
        const secs = ((Date.now() - state.recStartedAt) / 1000).toFixed(1);
        const kb = (state.pcmBytes / 1024).toFixed(1);
        lines = [
          "[● REC] Speak command (" + secs + "s)",
          "Mic:PCM 16kHz · " + kb + "KB · SELF",
          "Try: Short ETH $25 / Reply TG",
          "[TAP=SEND] [HOLD=ABORT]",
        ];
        badge = "MIC LIVE";
        statePill.textContent = "STATE 2: VOICE_CAPTURE";
      } else if (state.hudState === "CONFIRM_SAFETY" && state.pendingIntent) {
        lines = state.pendingIntent.hud_confirmation_lines || lines;
        badge = "SAFETY GATE";
        statePill.textContent = "STATE 3: CONFIRM_SAFETY";
      } else if (state.hudState === "RECEIPT" && state.lastReceipt) {
        lines = state.lastReceipt.hud_lines || lines;
        badge = "RECEIPT";
        statePill.textContent = "STATE 4: RECEIPT";
      }

      drawWaveguide(
        "GLANCEDESK · " + state.hudState + " · " + badge,
        lines.slice(0, 3),
        lines[3] || "[TAP=ACTION] [HOLD=ABORT]",
        state.hudState === "VOICE_CAPTURE"
      );

      const containerPreview = {
        containerTotalNum: 3,
        textObject: [
          { containerID: 1, containerName: "gd-header", xPosition: 16, yPosition: 8, width: 544, height: 44, zOrderIndex: 1, textColor: 2, isEventCapture: 0, content: "GLANCEDESK · " + state.hudState },
          { containerID: 2, containerName: "gd-body", xPosition: 16, yPosition: 56, width: 544, height: 168, zOrderIndex: 2, textColor: 4, isEventCapture: 1, content: lines.slice(0, 3).join("\\n") },
          { containerID: 3, containerName: "gd-footer", xPosition: 16, yPosition: 232, width: 544, height: 48, zOrderIndex: 3, textColor: 3, isEventCapture: 0, content: lines[3] || "" }
        ],
        menuObject: {
          menuItems: [
            { itemID: 1, itemName: "Voice Command" },
            { itemID: 2, itemName: "Refresh Live Feed" },
            { itemID: 3, itemName: "Telegram Digest" },
            { itemID: 4, itemName: "Abort / Home" }
          ]
        }
      };
      sdkJsonEl.textContent = JSON.stringify(containerPreview, null, 2);
    }

    async function loadHealthAndFeed() {
      try {
        const [hRes, fRes] = await Promise.all([fetch("/health"), fetch("/api/v1/feed")]);
        const health = await hRes.json();
        const feed = await fRes.json();
        state.feed = feed;

        document.getElementById("badgeWhisper").textContent =
          "WHISPER: " + (health.colab_whisper_configured ? "COLAB GPU" : "EDGE FALLBACK");
        document.getElementById("badgeTg").textContent =
          "TELEGRAM: " + (health.telegram_mode === "live_bot" ? "LIVE BOT" : "PAPER PREVIEW");

        document.getElementById("hlSource").textContent = feed.hyperliquid.source;
        const hlList = document.getElementById("hlList");
        hlList.innerHTML = "";
        for (const sym of ["BTC", "ETH", "SOL", "HYPE", "TON"]) {
          const px = feed.hyperliquid.mids[sym];
          if (!px) continue;
          const el = document.createElement("div");
          el.className = "row";
          el.innerHTML = '<span>' + sym + '-PERP <span class="sub">TESTNET</span></span><span class="val">$' + Number(px).toLocaleString("en-US") + '</span>';
          hlList.appendChild(el);
        }

        document.getElementById("pmSource").textContent = feed.polymarket_source;
        const pmList = document.getElementById("pmList");
        pmList.innerHTML = "";
        (feed.polymarket || []).slice(0, 4).forEach((m) => {
          const el = document.createElement("div");
          el.className = "row";
          el.innerHTML = '<span>' + m.shortTitle + '<div class="sub">Vol24h $' + Math.round(m.volume24hr).toLocaleString("en-US") + '</div></span><span class="val">YES ' + m.yesPct + '¢</span>';
          pmList.appendChild(el);
        });

        document.getElementById("tgMode").textContent = feed.telegram.mode;
        const tgList = document.getElementById("tgList");
        tgList.innerHTML = "";
        (feed.telegram.messages || []).slice(0, 4).forEach((msg) => {
          const el = document.createElement("div");
          el.className = "row";
          el.innerHTML = '<span><b>' + msg.sender + '</b> (' + msg.chat + ')<div class="sub">' + msg.text + '</div></span><span class="sub">' + msg.ts + '</span>';
          tgList.appendChild(el);
        });

        statusLine.textContent = "Live feeds synced · Paper Equity $" + feed.ledger.equity_usd + " · Daily Used $" + feed.ledger.daily_notional_usd + "/$" + feed.ledger.max_daily_notional_usd;
        renderCurrentHud();
      } catch (err) {
        statusLine.textContent = "Feed sync warning: " + err.message;
      }
    }

    async function sendTextIntent(text) {
      const t0 = performance.now();
      statusLine.textContent = 'Parsing voice intent: "' + text + '"...';
      const res = await fetch("/api/v1/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      latencyBadge.textContent = Math.round(performance.now() - t0) + " ms";
      state.pendingIntent = data;

      if (data.action === "CANCEL") {
        state.hudState = "GLANCE_FEED";
        statusLine.textContent = "Cancelled — returned to Glance Feed.";
      } else {
        state.hudState = "CONFIRM_SAFETY";
        statusLine.textContent =
          data.action === "BLOCKED_SAFETY"
            ? "Safety Guard Blocked: " + data.reason
            : "Safety Card Ready (" + data.action + "). Press TAP / OK to confirm or HOLD ABORT to cancel.";
      }
      renderCurrentHud();
    }

    async function confirmPendingIntent() {
      if (!state.pendingIntent) return;
      if (!state.pendingIntent.requires_confirmation) {
        state.hudState = "GLANCE_FEED";
        state.pendingIntent = null;
        renderCurrentHud();
        return;
      }
      const t0 = performance.now();
      statusLine.textContent = "Executing confirmed testnet/paper action...";
      const res = await fetch("/api/v1/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: state.pendingIntent, confirmed: true }),
      });
      const receipt = await res.json();
      latencyBadge.textContent = Math.round(performance.now() - t0) + " ms";
      state.lastReceipt = receipt;
      state.hudState = "RECEIPT";
      statusLine.textContent = receipt.ok
        ? "Executed " + receipt.receiptId + " (" + receipt.execution_mode + ") · TG: " + (receipt.telegram?.mode || "logged")
        : "Rejected: " + receipt.error;
      renderCurrentHud();
      await loadHealthAndFeed();
    }

    function downsampleTo16kPcm(float32, inputRate) {
      const ratio = inputRate / 16000;
      const outLen = Math.floor(float32.length / ratio);
      const pcm = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const s = Math.max(-1, Math.min(1, float32[Math.floor(i * ratio)] || 0));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return new Uint8Array(pcm.buffer);
    }

    async function startMicCapture() {
      if (state.recording) return;
      state.recording = true;
      state.hudState = "VOICE_CAPTURE";
      state.recStartedAt = Date.now();
      state.pcmBytes = 0;
      state.pcmChunks = [];
      document.getElementById("btnMic").classList.add("recording");
      statusLine.textContent = "Recording 16kHz mono PCM (Even G2 format)... tap TAP/OK or MIC again to send.";
      renderCurrentHud();

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.lang = "en-US";
          rec.interimResults = false;
          rec.onresult = (ev) => {
            const transcript = ev.results?.[0]?.[0]?.transcript;
            if (transcript) {
              document.getElementById("voiceInput").value = transcript;
              stopMicCapture(transcript);
            }
          };
          rec.onerror = () => {};
          rec.start();
          state.speechRec = rec;
        } catch {}
      }

      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const proc = audioCtx.createScriptProcessor(4096, 1, 1);
          proc.onaudioprocess = (ev) => {
            if (!state.recording) return;
            const pcm = downsampleTo16kPcm(ev.inputBuffer.getChannelData(0), audioCtx.sampleRate);
            state.pcmChunks.push(pcm);
            state.pcmBytes += pcm.byteLength;
            renderCurrentHud();
          };
          source.connect(proc);
          proc.connect(audioCtx.destination);
          state.mediaStream = stream;
          state.audioCtx = audioCtx;
        } catch {
          statusLine.textContent = "Mic permission unavailable — type a command or click a preset chip.";
        }
      }
    }

    async function stopMicCapture(transcriptOverride = "") {
      if (!state.recording) return;
      state.recording = false;
      document.getElementById("btnMic").classList.remove("recording");
      try { state.speechRec?.stop(); } catch {}
      try { state.mediaStream?.getTracks().forEach((t) => t.stop()); } catch {}
      try { await state.audioCtx?.close(); } catch {}
      state.speechRec = null;
      state.mediaStream = null;
      state.audioCtx = null;

      if (transcriptOverride) {
        await sendTextIntent(transcriptOverride);
        return;
      }

      if (state.pcmBytes > 0) {
        const merged = new Uint8Array(state.pcmBytes);
        let offset = 0;
        for (const c of state.pcmChunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        const t0 = performance.now();
        const res = await fetch("/api/v1/voice-intent", {
          method: "POST",
          headers: { "Content-Type": "audio/pcm", "X-Sample-Rate": "16000" },
          body: merged,
        });
        const data = await res.json();
        latencyBadge.textContent = Math.round(performance.now() - t0) + " ms";
        if (data.ok) {
          state.pendingIntent = data;
          state.hudState = "CONFIRM_SAFETY";
          statusLine.textContent = "Colab Faster-Whisper parsed: " + data.transcript;
        } else {
          state.hudState = "GLANCE_FEED";
          statusLine.textContent = data.hint || data.error || "Audio received (" + state.pcmBytes + "B). Connect Colab Whisper URL or type command.";
        }
        renderCurrentHud();
      } else {
        state.hudState = "GLANCE_FEED";
        renderCurrentHud();
      }
    }

    document.getElementById("btnRingUp").addEventListener("click", () => {
      state.hudState = "GLANCE_FEED";
      state.cardIndex = (state.cardIndex + 3) % 4;
      renderCurrentHud();
    });
    document.getElementById("btnRingDown").addEventListener("click", () => {
      state.hudState = "GLANCE_FEED";
      state.cardIndex = (state.cardIndex + 1) % 4;
      renderCurrentHud();
    });
    document.getElementById("btnTap").addEventListener("click", async () => {
      if (state.hudState === "GLANCE_FEED") {
        await startMicCapture();
      } else if (state.hudState === "VOICE_CAPTURE") {
        await stopMicCapture(document.getElementById("voiceInput").value.trim());
      } else if (state.hudState === "CONFIRM_SAFETY") {
        await confirmPendingIntent();
      } else {
        state.hudState = "GLANCE_FEED";
        renderCurrentHud();
      }
    });
    document.getElementById("btnMic").addEventListener("click", async () => {
      if (state.recording) await stopMicCapture(document.getElementById("voiceInput").value.trim());
      else await startMicCapture();
    });
    document.getElementById("btnHold").addEventListener("click", async () => {
      if (state.recording) await stopMicCapture("");
      state.pendingIntent = null;
      state.hudState = "GLANCE_FEED";
      statusLine.textContent = "LONG_PRESS_EVENT -> Aborted cleanly to Glance Feed.";
      renderCurrentHud();
    });

    document.getElementById("voiceForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const val = document.getElementById("voiceInput").value.trim();
      if (!val) return;
      await sendTextIntent(val);
    });

    document.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cmd = btn.getAttribute("data-cmd") || "";
        document.getElementById("voiceInput").value = cmd;
        await sendTextIntent(cmd);
      });
    });

    renderCurrentHud();
    loadHealthAndFeed();
  </script>
</body>
</html>`;
}
