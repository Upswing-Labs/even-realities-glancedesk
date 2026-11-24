/**
 * GlanceDesk EvenHub SDK 0.0.16 576x288 Container Layout & Protobuf Event Helpers
 */

import {
  CreateStartUpPageContainer,
  EventSourceType,
  MenuContainerProperty,
  MenuItemProperty,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import type { HudState } from "./types";

export const CONTAINER_IDS = {
  HEADER: 1,
  BODY: 2,
  FOOTER: 3,
} as const;

export const MENU_ITEM_IDS = {
  VOICE_CMD: 1,
  REFRESH_FEED: 2,
  TELEGRAM_DIGEST: 3,
  ABORT_HOME: 4,
} as const;

export function clampLine(text: string, maxChars = 36): string {
  const clean = String(text ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E·●▲▼]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars - 2).trimEnd()}..`;
}

export function normalizeLines(lines: string[]): [string, string, string, string] {
  const padded = lines.slice(0, 4).map((ln) => clampLine(ln, 36));
  while (padded.length < 4) padded.push("");
  return [
    padded[0] || "GLANCEDESK READY",
    padded[1] || "Hyperliquid + Polymarket + TG",
    padded[2] || "Mode: TESTNET/PAPER ($50 CAP)",
    padded[3] || "[TAP=MIC] [RING=SCROLL]",
  ];
}

export function buildContextualMenu(): MenuContainerProperty {
  return new MenuContainerProperty({
    menuItems: [
      new MenuItemProperty({ itemID: MENU_ITEM_IDS.VOICE_CMD, itemName: "Voice Command" }),
      new MenuItemProperty({ itemID: MENU_ITEM_IDS.REFRESH_FEED, itemName: "Refresh Live Feed" }),
      new MenuItemProperty({ itemID: MENU_ITEM_IDS.TELEGRAM_DIGEST, itemName: "Telegram Digest" }),
      new MenuItemProperty({ itemID: MENU_ITEM_IDS.ABORT_HOME, itemName: "Abort / Home" }),
    ],
  });
}

export function buildG2TextContainers(
  state: HudState,
  lines: string[],
  badge = "TESTNET",
): TextContainerProperty[] {
  const [l1, l2, l3, l4] = normalizeLines(lines);
  return [
    new TextContainerProperty({
      xPosition: 16,
      yPosition: 8,
      width: 544,
      height: 44,
      borderWidth: 0,
      paddingLength: 4,
      containerID: CONTAINER_IDS.HEADER,
      containerName: "gd-header",
      zOrderIndex: 1,
      content: clampLine(`GLANCEDESK · ${state} · ${badge}`, 36),
      textColor: 2,
      isEventCapture: 0,
    }),
    new TextContainerProperty({
      xPosition: 16,
      yPosition: 56,
      width: 544,
      height: 168,
      borderWidth: 1,
      borderColor: 2,
      borderRadius: 6,
      paddingLength: 8,
      containerID: CONTAINER_IDS.BODY,
      containerName: "gd-body",
      zOrderIndex: 2,
      content: [l1, l2, l3].join("\n"),
      textColor: 4,
      isEventCapture: 1,
    }),
    new TextContainerProperty({
      xPosition: 16,
      yPosition: 232,
      width: 544,
      height: 48,
      borderWidth: 0,
      paddingLength: 4,
      containerID: CONTAINER_IDS.FOOTER,
      containerName: "gd-footer",
      zOrderIndex: 3,
      content: l4,
      textColor: 3,
      isEventCapture: 0,
    }),
  ];
}

export function buildStartupPage(state: HudState, lines: string[], badge = "TESTNET"): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: buildG2TextContainers(state, lines, badge),
    menuObject: buildContextualMenu(),
  });
}

export function buildRebuildPage(state: HudState, lines: string[], badge = "TESTNET"): RebuildPageContainer {
  return new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: buildG2TextContainers(state, lines, badge),
    menuObject: buildContextualMenu(),
  });
}

export type NormalizedGesture =
  | { kind: "CLICK"; source?: EventSourceType }
  | { kind: "DOUBLE_CLICK"; source?: EventSourceType }
  | { kind: "SCROLL_UP"; source?: EventSourceType }
  | { kind: "SCROLL_DOWN"; source?: EventSourceType }
  | { kind: "LONG_PRESS"; source?: EventSourceType }
  | { kind: "LONG_PRESS_RELEASE"; source?: EventSourceType }
  | { kind: "MENU_ITEM"; itemID: number }
  | null;

/**
 * Normalize EvenHub hardware events from G2 temples or R1 Ring.
 * IMPORTANT: Protobuf omits zero-value enum fields on the wire, so
 * OsEventTypeList.CLICK_EVENT (ordinal 0) frequently arrives with eventType === undefined!
 */
export function normalizeHardwareGesture(event: EvenHubEvent): NormalizedGesture {
  if (event.menuItemClickEvent?.itemID) {
    return { kind: "MENU_ITEM", itemID: event.menuItemClickEvent.itemID };
  }

  const sys = event.sysEvent;
  const txt = event.textEvent;
  const lst = event.listEvent;
  const source = sys?.eventSource;
  const rawType = sys?.eventType ?? txt?.eventType ?? lst?.eventType;

  // Handle Protobuf zero-value omission for CLICK_EVENT (0)
  if (rawType === OsEventTypeList.CLICK_EVENT || (rawType === undefined && (sys || txt || lst))) {
    return { kind: "CLICK", source };
  }
  if (rawType === OsEventTypeList.SCROLL_TOP_EVENT) {
    return { kind: "SCROLL_UP", source };
  }
  if (rawType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    return { kind: "SCROLL_DOWN", source };
  }
  if (rawType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    return { kind: "DOUBLE_CLICK", source };
  }
  if (rawType === OsEventTypeList.LONG_PRESS_EVENT) {
    return { kind: "LONG_PRESS", source };
  }
  if (rawType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
    return { kind: "LONG_PRESS_RELEASE", source };
  }
  return null;
}
