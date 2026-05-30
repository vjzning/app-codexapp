import type { Thread } from "@codex-mobile/protocol/v2";

import { appendTimelineBody, type TimelineEntry } from "@/lib/threadFormat";

import type { DeltaBuffer, PendingEntry } from "./types";

export const DELTA_FLUSH_INTERVAL_MS = 120;

export function mergePendingEntries(timeline: TimelineEntry[], pendingEntries: PendingEntry[], threadId: string | null) {
  if (!threadId) {
    return timeline;
  }

  const consumedByText = new Map<string, number>();
  const visiblePending = pendingEntries.filter((entry) => {
    if (entry.threadId !== threadId) {
      return false;
    }

    return !hasServerEcho(timeline, entry, consumedByText);
  });
  return [...timeline, ...visiblePending];
}

export function reconcilePendingEntries(pendingEntries: PendingEntry[], timeline: TimelineEntry[], threadId: string) {
  const consumedByText = new Map<string, number>();
  return pendingEntries.filter((entry) => entry.threadId !== threadId || !hasServerEcho(timeline, entry, consumedByText));
}

function hasServerEcho(timeline: TimelineEntry[], entry: PendingEntry, consumedByText: Map<string, number>) {
  const normalized = normalizeMessageText(entry.sourceText);
  const consumed = consumedByText.get(normalized) ?? 0;
  const echoed = countUserText(timeline, entry.sourceText) > entry.baselineCount + consumed;

  if (echoed) {
    consumedByText.set(normalized, consumed + 1);
  }

  return echoed;
}

export function countUserText(timeline: TimelineEntry[], text: string) {
  const normalized = normalizeMessageText(text);
  return timeline.filter((entry) => entry.role === "user" && normalizeMessageText(entry.body) === normalized).length;
}

function normalizeMessageText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

export function isSameTimeline(current: TimelineEntry[], next: TimelineEntry[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let i = 0; i < current.length; i += 1) {
    if (current[i]?.id !== next[i]?.id || current[i]?.body !== next[i]?.body) {
      return false;
    }
  }

  return true;
}

export function clearDeltaTimer(bufferRef: React.MutableRefObject<DeltaBuffer>) {
  if (!bufferRef.current.timer) {
    return;
  }

  clearTimeout(bufferRef.current.timer);
  bufferRef.current.timer = null;
}

export function bufferAgentMessageDelta(
  bufferRef: React.MutableRefObject<DeltaBuffer>,
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEntry[]>>,
  turnId: string,
  itemId: string,
  delta: string,
) {
  const key = `${turnId}:${itemId}`;
  const existing = bufferRef.current.chunks.get(key);
  bufferRef.current.chunks.set(key, {
    turnId,
    itemId,
    delta: `${existing?.delta ?? ""}${delta}`,
  });

  if (bufferRef.current.timer) {
    return;
  }

  bufferRef.current.timer = setTimeout(() => {
    flushBufferedDeltas(bufferRef, setTimeline);
  }, DELTA_FLUSH_INTERVAL_MS);
}

export function flushBufferedDeltas(
  bufferRef: React.MutableRefObject<DeltaBuffer>,
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEntry[]>>,
) {
  clearDeltaTimer(bufferRef);

  if (bufferRef.current.chunks.size === 0) {
    return;
  }

  const chunks = [...bufferRef.current.chunks.values()];
  bufferRef.current.chunks.clear();
  setTimeline((current) =>
    chunks.reduce((next, chunk) => applyAgentMessageDelta(next, chunk.turnId, chunk.itemId, chunk.delta), current),
  );
}

export function removeBufferedDelta(bufferRef: React.MutableRefObject<DeltaBuffer>, turnId: string, itemId: string) {
  bufferRef.current.chunks.delete(`${turnId}:${itemId}`);
}

function applyAgentMessageDelta(current: TimelineEntry[], turnId: string, itemId: string, delta: string) {
  const entryId = `${turnId}:${itemId}`;
  const index = current.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    const entry: TimelineEntry = {
      id: entryId,
      turnId,
      role: "assistant",
      title: "Codex",
      body: appendTimelineBody("", delta),
      streaming: true,
    };

    return [...current, entry];
  }

  return current.map((entry, entryIndex) =>
    entryIndex === index
      ? {
          ...entry,
          body: appendTimelineBody(entry.body, delta),
          streaming: true,
        }
      : entry,
  );
}

export function uniqueCwds(threads: Thread[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const thread of threads) {
    if (!thread.cwd || seen.has(thread.cwd)) {
      continue;
    }

    seen.add(thread.cwd);
    result.push(thread.cwd);
  }

  return result;
}
