import type { ServerNotification } from "@codex-mobile/protocol";
import type { Thread, ThreadItem } from "@codex-mobile/protocol/v2";

import { flattenTurns, timelineEntryFromThreadItem, type TimelineEntry } from "@/lib/threadFormat";
import type { JsonRpcIncoming, PendingApproval, PendingUserInputRequest } from "@/types/codex";

import type { DeltaBuffer, LiveEvent } from "./types";
import { appendCommandOutputDelta, bufferAgentMessageDelta, flushBufferedDeltas, removeBufferedDelta } from "./timelineState";

type NotificationHandlers = {
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  setSelectedThread: React.Dispatch<React.SetStateAction<Thread | null>>;
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEntry[]>>;
  setEvents: React.Dispatch<React.SetStateAction<LiveEvent[]>>;
  selectedThreadIdRef: React.MutableRefObject<string | null>;
  deltaBufferRef: React.MutableRefObject<DeltaBuffer>;
  setActiveTurnId: React.Dispatch<React.SetStateAction<string | null>>;
  setApproval: React.Dispatch<React.SetStateAction<PendingApproval | null>>;
  setUserInputRequest: React.Dispatch<React.SetStateAction<PendingUserInputRequest | null>>;
};

export function handleNotification(message: JsonRpcIncoming, handlers: NotificationHandlers) {
  if (!("method" in message)) {
    return;
  }

  const notification = message as ServerNotification;
  const text = summarizeNotification(notification);
  handlers.setEvents((current) => [{ id: `${Date.now()}:${current.length}`, method: notification.method, text }, ...current].slice(0, 80));

  if (notification.method === "thread/started") {
    handlers.setThreads((current) => [notification.params.thread, ...current.filter((thread) => thread.id !== notification.params.thread.id)]);
  }

  if (notification.method === "thread/name/updated") {
    handlers.setThreads((current) =>
      current.map((thread) =>
        thread.id === notification.params.threadId ? { ...thread, name: notification.params.threadName ?? thread.name } : thread,
      ),
    );
  }

  if (notification.method === "item/started" && notification.params.threadId === handlers.selectedThreadIdRef.current) {
    handlers.setTimeline((current) => upsertTimelineEntry(current, notification.params.turnId, notification.params.item, { streaming: true }));
  }

  if (notification.method === "item/completed" && notification.params.threadId === handlers.selectedThreadIdRef.current) {
    removeBufferedDelta(handlers.deltaBufferRef, notification.params.turnId, notification.params.item.id);
    handlers.setTimeline((current) => upsertTimelineEntry(current, notification.params.turnId, notification.params.item));
  }

  if (notification.method === "item/agentMessage/delta" && notification.params.threadId === handlers.selectedThreadIdRef.current) {
    bufferAgentMessageDelta(
      handlers.deltaBufferRef,
      handlers.setTimeline,
      notification.params.turnId,
      notification.params.itemId,
      notification.params.delta,
    );
  }

  if (notification.method === "item/commandExecution/outputDelta" && notification.params.threadId === handlers.selectedThreadIdRef.current) {
    handlers.setTimeline((current) =>
      appendCommandOutputDelta(current, notification.params.turnId, notification.params.itemId, notification.params.delta),
    );
  }

  if (notification.method === "thread/status/changed") {
    handlers.setThreads((current) =>
      current.map((thread) => (thread.id === notification.params.threadId ? { ...thread, status: notification.params.status } : thread)),
    );
    handlers.setSelectedThread((thread) =>
      thread && thread.id === notification.params.threadId ? { ...thread, status: notification.params.status } : thread,
    );
  }

  if (notification.method === "serverRequest/resolved") {
    // 服务端可能因按钮响应、turn 完成或中断主动清掉审批请求，移动端需要同步清理 UI。
    handlers.setApproval((current) => (current?.id === notification.params.requestId ? null : current));
    handlers.setUserInputRequest((current) => (current?.id === notification.params.requestId ? null : current));
  }

  if (notification.method === "turn/started") {
    if (notification.params.threadId === handlers.selectedThreadIdRef.current) {
      handlers.setActiveTurnId(notification.params.turn.id);
      handlers.setSelectedThread((thread) =>
        thread && thread.id === notification.params.threadId ? { ...thread, status: { type: "active", activeFlags: [] } } : thread,
      );
      handlers.setThreads((current) =>
        current.map((thread) => (thread.id === notification.params.threadId ? { ...thread, status: { type: "active", activeFlags: [] } } : thread)),
      );
      handlers.setTimeline((current) => upsertTimelineEntries(current, flattenTurns([notification.params.turn])));
    }
  }

  if (notification.method === "turn/completed") {
    if (notification.params.threadId === handlers.selectedThreadIdRef.current) {
      flushBufferedDeltas(handlers.deltaBufferRef, handlers.setTimeline);
      handlers.setActiveTurnId((current) => (current === notification.params.turn.id ? null : current));
      handlers.setSelectedThread((thread) => (thread && thread.id === notification.params.threadId ? { ...thread, status: { type: "idle" } } : thread));
      handlers.setThreads((current) =>
        current.map((thread) => (thread.id === notification.params.threadId ? { ...thread, status: { type: "idle" } } : thread)),
      );
      handlers.setTimeline((current) => upsertTimelineEntries(current, flattenTurns([notification.params.turn])));
    }
  }
}

function upsertTimelineEntries(current: TimelineEntry[], entries: TimelineEntry[]) {
  return entries.reduce((next, entry) => upsertTimelineEntryObject(next, entry), current);
}

function upsertTimelineEntry(
  current: TimelineEntry[],
  turnId: string,
  item: ThreadItem,
  options: { streaming?: boolean } = {},
) {
  return upsertTimelineEntryObject(current, timelineEntryFromThreadItem(turnId, item, options));
}

function upsertTimelineEntryObject(current: TimelineEntry[], entry: TimelineEntry) {
  const index = current.findIndex((candidate) => candidate.id === entry.id);

  if (index === -1) {
    return [...current, entry];
  }

  return current.map((candidate, candidateIndex) => (candidateIndex === index ? mergeTimelineEntry(candidate, entry) : candidate));
}

function mergeTimelineEntry(current: TimelineEntry, next: TimelineEntry) {
  if (current.variant !== "command" || next.variant !== "command") {
    return next;
  }

  const existingOutput = current.commandOutput || "";
  const nextOutput = next.commandOutput || "";

  if (nextOutput) {
    return next;
  }

  return {
    ...next,
    body: next.body || current.body,
    commandOutput: existingOutput,
  };
}

function summarizeNotification(notification: ServerNotification) {
  switch (notification.method) {
    case "item/agentMessage/delta":
      return notification.params.delta;
    case "item/commandExecution/outputDelta":
      return notification.params.delta;
    case "turn/started":
      return `Turn started: ${notification.params.turn.id}`;
    case "turn/completed":
      return `Turn completed: ${notification.params.turn.status}`;
    case "turn/diff/updated":
      return `Diff updated: ${notification.params.diff.length} chars`;
    case "thread/status/changed":
      return `Thread status: ${notification.params.status.type}`;
    default:
      return JSON.stringify(notification.params).slice(0, 300);
  }
}
