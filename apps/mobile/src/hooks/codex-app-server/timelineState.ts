import type { FileUpdateChange, Thread, TurnPlanStep } from "@codex-mobile/protocol/v2";

import {
  appendTimelineBody,
  timelineEntryFromFileChangePatch,
  timelineEntryFromTurnDiff,
  timelineEntryFromTurnPlan,
  type TimelineEntry,
} from "@/lib/threadFormat";

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

export function mergeTimelineSnapshot(current: TimelineEntry[], snapshot: TimelineEntry[]) {
  const snapshotTurnIds = new Set(snapshot.map((entry) => entry.turnId).filter(Boolean));
  const snapshotIds = new Set(snapshot.map((entry) => entry.id));
  const olderLoadedEntries = current.filter((entry) => entry.turnId && !snapshotTurnIds.has(entry.turnId));
  const missingToolEntries = current.filter((entry) => shouldPreserveMissingToolEntry(entry) && !snapshotIds.has(entry.id));
  const mergedSnapshot = [...olderLoadedEntries, ...snapshot];

  if (missingToolEntries.length === 0) {
    return mergedSnapshot;
  }

  return missingToolEntries.reduce((next, entry) => insertEntryAfterTurn(next, entry), mergedSnapshot);
}

function shouldPreserveMissingToolEntry(entry: TimelineEntry) {
  // 历史快照不返回 commandExecution 时，只保留仍在运行的实时命令，避免文件变更成为“当前页有、重进消失”的本地幽灵项。
  return entry.variant === "command" && entry.commandStatus === "inProgress";
}

function insertEntryAfterTurn(entries: TimelineEntry[], entry: TimelineEntry) {
  if (!entry.turnId) {
    return [...entries, entry];
  }

  let insertIndex = -1;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.turnId === entry.turnId) {
      insertIndex = index + 1;
      break;
    }
  }

  if (insertIndex === -1) {
    return [...entries, entry];
  }

  return [...entries.slice(0, insertIndex), entry, ...entries.slice(insertIndex)];
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

export function appendCommandOutputDelta(current: TimelineEntry[], turnId: string, itemId: string, delta: string) {
  const entryId = `${turnId}:${itemId}`;
  const index = current.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    const entry: TimelineEntry = {
      id: entryId,
      turnId,
      role: "tool",
      variant: "command",
      title: "正在运行 命令",
      body: appendTimelineBody("", delta),
      commandText: "命令",
      commandStatus: "inProgress",
      commandExitCode: null,
      commandOutput: delta,
    };

    return [...current, entry];
  }

  return current.map((entry, entryIndex) =>
    entryIndex === index
      ? {
          ...entry,
          body: appendTimelineBody(entry.body, delta),
          commandOutput: `${entry.commandOutput ?? ""}${delta}`,
        }
      : entry,
  );
}

export function applyTurnPlanUpdated(current: TimelineEntry[], turnId: string, explanation: string | null, plan: TurnPlanStep[]) {
  return upsertTimelineEntry(current, timelineEntryFromTurnPlan(turnId, explanation, plan));
}

export function applyPlanDelta(current: TimelineEntry[], turnId: string, itemId: string, delta: string) {
  const entryId = `${turnId}:${itemId}`;
  const index = current.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    const entry: TimelineEntry = {
      id: entryId,
      turnId,
      role: "assistant",
      title: "Plan",
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

export function applyTurnDiffUpdated(current: TimelineEntry[], turnId: string, diff: string) {
  if (!diff.trim()) {
    return current.filter((entry) => entry.id !== `${turnId}:turn-diff`);
  }

  return upsertTimelineEntry(current, timelineEntryFromTurnDiff(turnId, diff));
}

export function applyFileChangePatchUpdated(current: TimelineEntry[], turnId: string, itemId: string, changes: FileUpdateChange[]) {
  if (changes.length === 0) {
    return current;
  }

  return upsertTimelineEntry(current, timelineEntryFromFileChangePatch(turnId, itemId, changes));
}

export function applyReasoningDelta(current: TimelineEntry[], turnId: string, itemId: string, delta: string, title = "Reasoning") {
  return appendOrCreateTextEntry(current, {
    turnId,
    itemId,
    role: "assistant",
    title,
    delta,
  });
}

export function applyMcpToolCallProgress(current: TimelineEntry[], turnId: string, itemId: string, message: string) {
  return appendOrCreateTextEntry(current, {
    turnId,
    itemId,
    role: "tool",
    title: "MCP 工具进度",
    delta: message.endsWith("\n") ? message : `${message}\n`,
  });
}

export function applyThreadCompacted(current: TimelineEntry[], turnId: string) {
  return upsertTimelineEntry(current, {
    id: `${turnId}:context-compacted`,
    turnId,
    role: "system",
    title: "上下文已压缩",
    body: "当前会话上下文已压缩，后续回复会基于压缩后的上下文继续。",
  });
}

function appendOrCreateTextEntry(
  current: TimelineEntry[],
  params: { turnId: string; itemId: string; role: TimelineEntry["role"]; title: string; delta: string },
) {
  const entryId = `${params.turnId}:${params.itemId}`;
  const index = current.findIndex((entry) => entry.id === entryId);

  if (index === -1) {
    const entry: TimelineEntry = {
      id: entryId,
      turnId: params.turnId,
      role: params.role,
      title: params.title,
      body: appendTimelineBody("", params.delta),
      streaming: true,
    };

    return [...current, entry];
  }

  return current.map((entry, entryIndex) =>
    entryIndex === index
      ? {
          ...entry,
          body: appendTimelineBody(entry.body, params.delta),
          streaming: true,
        }
      : entry,
  );
}

function upsertTimelineEntry(current: TimelineEntry[], entry: TimelineEntry) {
  const index = current.findIndex((candidate) => candidate.id === entry.id);

  if (index === -1) {
    return [...current, entry];
  }

  return current.map((candidate, candidateIndex) => (candidateIndex === index ? entry : candidate));
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
