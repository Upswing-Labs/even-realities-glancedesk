/**
 * Prebuilt standalone EvenHub WebView runtime for direct `evenhub pack app.json dist`
 * packaging and zero-build local preview in `@evenrealities/evenhub-simulator`.
 * Uses the native Flutter WebView handler (`evenAppMessage`) compatible with
 * `@evenrealities/even_hub_sdk@0.0.16`.
 */

const API_BASE = globalThis.__GLANCEDESK_API__ || "https://upswing-glancedesk.workers.dev";
const mirror = document.getElementById("hudMirror");

let hudState = "GLANCE_FEED";
let cardIndex = 0;
let feed = null;
let pendingIntent = null;
let lastReceipt = null;
let startupCreated = false;
let recording = false;
let pcmChunks = [];
let pcmBytes = 0;

function callHost(method, params) {
  const fl = globalThis.flutter_inappwebview;
  if (!fl || typeof fl.callHandler !== "function") return Promise.resolve(null);
  return fl.callHandler("evenAppMessage", {
    type: "call_even_app_method",
    method,
    data: params,
  });
}

function buildContainerPayload(lines, badge) {
  const safe = (lines || []).slice(0, 4);
  while (safe.length < 4) safe.push("");
  return {
    containerTotalNum: 3,
    textObject: [
      { xPosition: 16, yPosition: 8, width: 544, height: 44, containerID: 1, containerName: "gd-header", zOrderIndex: 1, content: `GLANCEDESK · ${hudState} · ${badge}`.slice(0, 36), textColor: 2, isEventCapture: 0 },
      { xPosition: 16, yPosition: 56, width: 544, height: 168, borderWidth: 1, borderColor: 2, borderRadius: 6, paddingLength: 8, containerID: 2, containerName: "gd-body", zOrderIndex: 2, content: safe.slice(0, 3).join("\n"), textColor: 4, isEventCapture: 1 },
      { xPosition: 16, yPosition: 232, width: 544, height: 48, containerID: 3, containerName: "gd-footer", zOrderIndex: 3, content: safe[3] || "[TAP=MIC] [RING=SCROLL]", textColor: 3, isEventCapture: 0 },
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
}

async function render() {
  let lines = ["GLANCEDESK · EVEN G2", "Syncing live markets...", "Testnet/Paper Cap: $50", "[TAP=MIC] [RING=SCROLL]"];
  let badge = "LIVE";
  if (hudState === "GLANCE_FEED" && feed?.hud_cards?.length) {
    const c = feed.hud_cards[cardIndex % feed.hud_cards.length];
    lines = c.lines;
    badge = c.title;
  } else if (hudState === "VOICE_CAPTURE") {
    lines = ["[● REC] Speak command...", `PCM 16kHz · ${(pcmBytes / 1024).toFixed(1)}KB`, "Short ETH $25 / Reply TG", "[TAP=SEND] [HOLD=ABORT]"];
    badge = "MIC";
  } else if (hudState === "CONFIRM_SAFETY" && pendingIntent) {
    lines = pendingIntent.hud_confirmation_lines;
    badge = "SAFETY";
  } else if (hudState === "RECEIPT" && lastReceipt) {
    lines = lastReceipt.hud_lines;
    badge = "DONE";
  }

  if (mirror) mirror.textContent = `[${hudState}]\n${lines.join("\n")}`;
  const payload = buildContainerPayload(lines, badge);
  if (!startupCreated) {
    const r = await callHost("createStartUpPageContainer", payload);
    startupCreated = r === 0 || r === "0" || r === null;
  } else {
    await callHost("rebuildPageContainer", payload);
  }
}

async function refreshFeed() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/feed`);
    if (res.ok) feed = await res.json();
  } catch {}
  await render();
}

globalThis._listenEvenAppMessage = async (msg) => {
  const data = msg?.data || msg?.jsonData || msg || {};
  if (data.audioPcm && recording) {
    const arr = data.audioPcm instanceof Uint8Array ? data.audioPcm : new Uint8Array(data.audioPcm);
    pcmChunks.push(arr);
    pcmBytes += arr.byteLength;
    return;
  }
  const evType = data.eventType ?? data.Event_Type;
  if (evType === 9 || evType === 3) {
    recording = false;
    await callHost("audioControl", { isOpen: false });
    hudState = "GLANCE_FEED";
    await render();
    return;
  }
  if (evType === 1 || evType === 2) {
    cardIndex = (cardIndex + (evType === 2 ? 1 : 3)) % 4;
    hudState = "GLANCE_FEED";
    await render();
    return;
  }
  if (evType === 0 || evType === undefined) {
    if (hudState === "GLANCE_FEED") {
      recording = true;
      pcmChunks = [];
      pcmBytes = 0;
      hudState = "VOICE_CAPTURE";
      await callHost("audioControl", { isOpen: true, source: "glasses" });
      await render();
    } else if (hudState === "VOICE_CAPTURE") {
      recording = false;
      await callHost("audioControl", { isOpen: false });
      const merged = new Uint8Array(pcmBytes);
      let off = 0;
      for (const c of pcmChunks) {
        merged.set(c, off);
        off += c.byteLength;
      }
      const res = await fetch(`${API_BASE}/api/v1/voice-intent`, {
        method: "POST",
        headers: { "Content-Type": "audio/pcm", "X-Sample-Rate": "16000" },
        body: merged,
      });
      pendingIntent = await res.json();
      hudState = "CONFIRM_SAFETY";
      await render();
    } else if (hudState === "CONFIRM_SAFETY" && pendingIntent) {
      const res = await fetch(`${API_BASE}/api/v1/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: pendingIntent, confirmed: true }),
      });
      lastReceipt = await res.json();
      hudState = "RECEIPT";
      await render();
    } else {
      hudState = "GLANCE_FEED";
      await render();
    }
  }
};

void refreshFeed();
