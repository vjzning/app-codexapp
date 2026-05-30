import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import type {
  Thread,
  ThreadReadResponse,
  ThreadStartResponse,
  ToolRequestUserInputResponse,
} from "@codex-mobile/protocol/v2";

import { JsonRpcClient } from "@/lib/jsonRpcClient";
import { flattenTurns, timelineEntryFromCommandApproval, type TimelineEntry } from "@/lib/threadFormat";
import type { ConnectionState, PendingApproval, PendingUserInputRequest, ReadinessStatus } from "@/types/codex";
import type { ComposerMention } from "@/types/composer";

import {
  archiveThread,
  ensureThreadResumed,
  formatReadinessLog,
  getInProgressTurnId,
  loadApps,
  loadModels,
  loadSkills,
  loadThreads,
  loadTurnPage,
  normalizeConnection,
  setThreadName,
  startReview,
  startTurn,
  steerTurn,
  unarchiveThread,
} from "./codex-app-server/api";
import { buildTurnInput } from "./codex-app-server/composer";
import { handleNotification } from "./codex-app-server/notifications";
import {
  clearDeltaTimer,
  countUserText,
  isSameTimeline,
  mergeTimelineSnapshot,
  mergePendingEntries,
  reconcilePendingEntries,
  uniqueCwds,
} from "./codex-app-server/timelineState";
import type { DeltaBuffer, LiveEvent, NormalizedConnection, PendingEntry, PickerData } from "./codex-app-server/types";

const DETAIL_REFRESH_INTERVAL_MS = 3000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 10000;

export type CodexAppServerState = ReturnType<typeof useCodexAppServer>;

export function useCodexAppServer() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<Thread[]>([]);
  const [showArchivedThreads, setShowArchivedThreads] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [approval, setApproval] = useState<PendingApproval | null>(null);
  const [userInputRequest, setUserInputRequest] = useState<PendingUserInputRequest | null>(null);
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null);
  const [isOpeningThread, setIsOpeningThread] = useState(false);
  const [isRefreshingThreads, setIsRefreshingThreads] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshingThread, setIsRefreshingThread] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isInterruptingTurn, setIsInterruptingTurn] = useState(false);
  const [isLoadingPickerData, setIsLoadingPickerData] = useState(false);
  const [olderTurnsCursor, setOlderTurnsCursor] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [pickerData, setPickerData] = useState<PickerData>({
    models: [],
    skills: [],
    apps: [],
  });
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);

  const clientRef = useRef<JsonRpcClient | null>(null);
  const pendingCounterRef = useRef(1);
  const lastConnectionRef = useRef<NormalizedConnection | null>(null);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const selectedThreadIdRef = useRef<string | null>(null);
  const deltaBufferRef = useRef<DeltaBuffer>({
    timer: null,
    chunks: new Map(),
  });

  const client = useMemo(() => {
    const instance = new JsonRpcClient({
      onStateChange: (nextState) => {
        setState(nextState);
        if (nextState === "closed" || nextState === "error" || nextState === "idle") {
          setActiveTurnId(null);
          setApproval(null);
          setUserInputRequest(null);
        }
      },
      onNotification: (message) => {
        handleNotification(message, {
          setThreads,
          setSelectedThread,
          setTimeline,
          setEvents,
          selectedThreadIdRef,
          deltaBufferRef,
          setActiveTurnId,
          setApproval,
          setUserInputRequest,
        });
      },
      onApproval: (request) => {
        setApproval(request);
        if (request.method === "item/commandExecution/requestApproval" && request.params.threadId === selectedThreadIdRef.current) {
          setTimeline((current) => upsertTimelineEntry(current, timelineEntryFromCommandApproval(request.params)));
        }
      },
      onUserInputRequest: setUserInputRequest,
      onLog: (line) => {
        setLogs((current) => [line, ...current].slice(0, 30));
        if (isErrorLog(line)) {
          setRecentError(line);
        }
      },
    });
    clientRef.current = instance;
    return instance;
  }, []);

  const visibleTimeline = useMemo(
    () => mergePendingEntries(timeline, pendingEntries, selectedThread?.id ?? null),
    [timeline, pendingEntries, selectedThread?.id],
  );
  const recentCwds = useMemo(() => uniqueCwds(threads), [threads]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThread?.id ?? null;
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!selectedThread || isOpeningThread || state !== "connected") {
      return;
    }

    const timer = setInterval(() => {
      void refreshSelectedThread({ silent: true });
    }, DETAIL_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [selectedThread?.id, isOpeningThread, state]);

  useEffect(() => {
    if (state !== "connected") {
      return;
    }

    clearReconnectTimer(reconnectTimerRef);
    reconnectAttemptRef.current = 0;
    setRecentError(null);
    void refreshThreads();
    if (selectedThread) {
      void refreshSelectedThread({ silent: true });
    }
  }, [state]);

  useEffect(() => {
    if (state !== "connected") {
      return;
    }

    void refreshPickerData();
  }, [selectedThread?.id, state]);

  useEffect(() => {
    if (state !== "closed" && state !== "error") {
      return;
    }

    if (manualDisconnectRef.current || !lastConnectionRef.current) {
      return;
    }

    scheduleReconnect();
  }, [state]);

  useEffect(
    () => () => {
      clearReconnectTimer(reconnectTimerRef);
      clearDeltaTimer(deltaBufferRef);
    },
    [],
  );

  const connect = (url: string, token = "") => {
    setReadiness(null);
    setRecentError(null);
    clearReconnectTimer(reconnectTimerRef);
    manualDisconnectRef.current = false;
    reconnectAttemptRef.current = 0;

    try {
      const target = normalizeConnection(url, token);
      lastConnectionRef.current = target;
      client.connect(target.socketUrl, target.authToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastConnectionRef.current = null;
      setRecentError(message);
      setLogs((current) => [`connect failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const disconnect = () => {
    manualDisconnectRef.current = true;
    clearReconnectTimer(reconnectTimerRef);
    client.disconnect();
    setState("closed");
  };

  const scheduleReconnect = () => {
    const target = lastConnectionRef.current;

    if (!target) {
      return;
    }

    if (reconnectTimerRef.current) {
      setState("reconnecting");
      return;
    }

    const attempt = reconnectAttemptRef.current + 1;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS);
    reconnectAttemptRef.current = attempt;

    setState("reconnecting");
    setLogs((current) => [`连接断开，${Math.round(delay / 1000)} 秒后自动重连（第 ${attempt} 次）`, ...current].slice(0, 30));

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;

      if (manualDisconnectRef.current || !lastConnectionRef.current) {
        return;
      }

      // 自动重连复用上一次规范化后的地址，避免 SecureStore 或输入框里的旧 query 干扰。
      client.connect(target.socketUrl, target.authToken);
    }, delay);
  };

  const closeThread = () => {
    selectedThreadIdRef.current = null;
    clearDeltaTimer(deltaBufferRef);
    deltaBufferRef.current.chunks.clear();
    setSelectedThread(null);
    setTimeline([]);
    setIsOpeningThread(false);
    setIsLoadingMore(false);
    setIsRefreshingThread(false);
    setIsInterruptingTurn(false);
    setOlderTurnsCursor(null);
    setActiveTurnId(null);
  };

  const refreshThreads = async (options: { archived?: boolean } = {}) => {
    if (isRefreshingThreads) {
      return;
    }

    setIsRefreshingThreads(true);
    try {
      const archived = options.archived ?? showArchivedThreads;
      const data = await loadThreads(client, archived);
      if (archived) {
        setArchivedThreads(data);
      } else {
        setThreads(data);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`thread refresh failed: ${message}`);
      setLogs((current) => [`thread refresh failed: ${message}`, ...current].slice(0, 30));
    } finally {
      setIsRefreshingThreads(false);
    }
  };

  const toggleArchivedThreads = async () => {
    const next = !showArchivedThreads;
    setShowArchivedThreads(next);
    await refreshThreads({ archived: next });
  };

  const openThread = async (thread: Thread) => {
    selectedThreadIdRef.current = thread.id;
    setSelectedThread(thread);
    setTimeline([]);
    setIsOpeningThread(true);
    setOlderTurnsCursor(null);
    setActiveTurnId(null);

    try {
      const resumedThread = await ensureThreadResumed(client, thread);
      if (selectedThreadIdRef.current !== thread.id) {
        return;
      }
      setSelectedThread(resumedThread);
      const page = await loadTurnPage(client, resumedThread.id, null);
      if (selectedThreadIdRef.current !== thread.id) {
        return;
      }
      const pageTimeline = flattenTurns(page.turns);
      setActiveTurnId(getInProgressTurnId(page.turns));
      setTimeline(pageTimeline);
      setOlderTurnsCursor(page.nextCursor);
      setPendingEntries((current) => reconcilePendingEntries(current, pageTimeline, resumedThread.id));
    } finally {
      if (selectedThreadIdRef.current === thread.id) {
        setIsOpeningThread(false);
      }
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedThread || !olderTurnsCursor || isLoadingMore) {
      return;
    }

    const threadId = selectedThread.id;
    setIsLoadingMore(true);
    try {
      const page = await loadTurnPage(client, threadId, olderTurnsCursor);
      if (selectedThreadIdRef.current !== threadId) {
        return;
      }
      setTimeline((current) => [...flattenTurns(page.turns), ...current]);
      setOlderTurnsCursor(page.nextCursor);
    } finally {
      if (selectedThreadIdRef.current === threadId) {
        setIsLoadingMore(false);
      }
    }
  };

  const sendMessage = async (text: string, mentions: ComposerMention[] = []) => {
    const trimmed = text.trim();

    if (!selectedThread || !trimmed) {
      return;
    }

    const sourceThread = selectedThread;
    const pendingId = addPendingMessage(sourceThread.id, trimmed, countUserText(timeline, trimmed));

    try {
      const resumedThread = await sendMessageToThread(sourceThread, trimmed, mentions);
      if (selectedThreadIdRef.current === sourceThread.id) {
        setSelectedThread(resumedThread);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`send failed: ${message}`);
      setLogs((current) => [`send failed: ${message}`, ...current].slice(0, 30));
      setPendingEntries((current) =>
        current.map((entry) => (entry.id === pendingId ? { ...entry, pending: false, failed: true, title: "发送失败" } : entry)),
      );
    }
  };

  const sendMessageToThread = async (thread: Thread, text: string, mentions: ComposerMention[] = []) => {
    const resumedThread = await ensureThreadResumed(client, thread);
    const input = buildTurnInput(text, mentions);

    if (activeTurnId && selectedThread?.status.type === "active" && selectedThreadIdRef.current === resumedThread.id) {
      await steerTurn(client, resumedThread.id, activeTurnId, input);
      return resumedThread;
    }

    await startTurn(client, resumedThread.id, input, { model: selectedModelId });
    return resumedThread;
  };

  const runShellCommand = async (command: string) => {
    const trimmed = command.trim();

    if (!selectedThread || !trimmed) {
      return;
    }

    try {
      const resumedThread = await ensureThreadResumed(client, selectedThread);
      if (selectedThreadIdRef.current === selectedThread.id) {
        setSelectedThread(resumedThread);
      }
      await client.request("thread/shellCommand", {
        threadId: resumedThread.id,
        command: trimmed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`shell command failed: ${message}`);
      setLogs((current) => [`shell command failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const addPendingMessage = (threadId: string, text: string, baselineCount: number) => {
    const pendingId = `pending:${threadId}:${Date.now()}:${pendingCounterRef.current}`;
    pendingCounterRef.current += 1;

    setPendingEntries((current) => [
      ...current,
      {
        id: pendingId,
        role: "user",
        title: "You",
        body: text,
        timestampMs: Date.now(),
        threadId,
        sourceText: text,
        baselineCount,
        pending: true,
      },
    ]);

    return pendingId;
  };

  const createThread = async (cwd: string, message: string, mentions: ComposerMention[] = []) => {
    const trimmedCwd = cwd.trim();
    const trimmedMessage = message.trim();

    if (!trimmedCwd || !trimmedMessage || isCreatingThread) {
      return;
    }

    setIsCreatingThread(true);
    setRecentError(null);

    try {
      const result = await client.request<ThreadStartResponse>("thread/start", {
        cwd: trimmedCwd,
        model: selectedModelId ?? undefined,
        experimentalRawEvents: false,
        persistExtendedHistory: false,
      });

      setThreads((current) => [result.thread, ...current.filter((thread) => thread.id !== result.thread.id)]);
      setSelectedThread(result.thread);
      setTimeline([]);
      setOlderTurnsCursor(null);
      addPendingMessage(result.thread.id, trimmedMessage, 0);

      await sendMessageToThread(result.thread, trimmedMessage, mentions);
      await openThread(result.thread);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      setRecentError(`create failed: ${messageText}`);
      setLogs((current) => [`create failed: ${messageText}`, ...current].slice(0, 30));
    } finally {
      setIsCreatingThread(false);
    }
  };

  const refreshPickerData = async () => {
    if (state !== "connected" || isLoadingPickerData) {
      return;
    }

    setIsLoadingPickerData(true);

    try {
      const cwd = selectedThread?.cwd ?? recentCwds[0] ?? null;
      const [models, skills, apps] = await Promise.all([loadModels(client), loadSkills(client, cwd), loadApps(client, selectedThread?.id ?? null)]);
      setPickerData({ models, skills, apps });
      setSelectedModelId((current) => current ?? models.find((model) => model.isDefault)?.model ?? models[0]?.model ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`picker refresh failed: ${message}`);
      setLogs((current) => [`picker refresh failed: ${message}`, ...current].slice(0, 30));
    } finally {
      setIsLoadingPickerData(false);
    }
  };

  const renameThread = async (name: string) => {
    const trimmed = name.trim();

    if (!selectedThread || !trimmed) {
      return;
    }

    const threadId = selectedThread.id;

    try {
      await setThreadName(client, threadId, trimmed);
      setSelectedThread((current) => (current?.id === threadId ? { ...current, name: trimmed } : current));
      setThreads((current) => current.map((thread) => (thread.id === threadId ? { ...thread, name: trimmed } : thread)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`rename failed: ${message}`);
      setLogs((current) => [`rename failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const archiveSelectedThread = async () => {
    if (!selectedThread) {
      return;
    }

    const threadId = selectedThread.id;

    try {
      await archiveThread(client, threadId);
      setThreads((current) => current.filter((thread) => thread.id !== threadId));
      closeThread();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`archive failed: ${message}`);
      setLogs((current) => [`archive failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const restoreThread = async (thread: Thread) => {
    try {
      const response = await unarchiveThread(client, thread.id);
      setArchivedThreads((current) => current.filter((candidate) => candidate.id !== thread.id));
      setThreads((current) => [response.thread, ...current.filter((candidate) => candidate.id !== response.thread.id)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`unarchive failed: ${message}`);
      setLogs((current) => [`unarchive failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const startCurrentReview = async () => {
    if (!selectedThread || activeTurnId) {
      return;
    }

    try {
      const resumedThread = await ensureThreadResumed(client, selectedThread);
      const response = await startReview(client, resumedThread.id);
      setSelectedThread(resumedThread);
      setActiveTurnId(response.turn.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`review failed: ${message}`);
      setLogs((current) => [`review failed: ${message}`, ...current].slice(0, 30));
    }
  };

  const resolveApproval = async (decision: "accept" | "acceptForSession" | "decline" | "cancel") => {
    if (!approval) {
      return;
    }

    await client.resolveApproval(approval, decision);
    setApproval(null);
  };

  const resolveUserInputRequest = async (response: ToolRequestUserInputResponse) => {
    if (!userInputRequest) {
      return;
    }

    await client.resolveUserInputRequest(userInputRequest, response);
    setUserInputRequest(null);
  };

  const probeReadiness = async (url: string, token = "") => {
    try {
      const target = normalizeConnection(url, token);
      const result = await client.probeReadiness(target.socketUrl, target.authToken);
      setReadiness(result);
      setLogs((current) => [formatReadinessLog(result), ...current].slice(0, 30));
      if (!result.ok) {
        setRecentError(result.error);
      }
      return result;
    } catch (error) {
      const result: ReadinessStatus = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      setReadiness(result);
      setRecentError(result.error);
      setLogs((current) => [formatReadinessLog(result), ...current].slice(0, 30));
      return result;
    }
  };

  const interruptTurn = async () => {
    if (!selectedThread || !activeTurnId || isInterruptingTurn) {
      return;
    }

    setIsInterruptingTurn(true);

    try {
      await client.request("turn/interrupt", {
        threadId: selectedThread.id,
        turnId: activeTurnId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`interrupt failed: ${message}`);
      setLogs((current) => [`interrupt failed: ${message}`, ...current].slice(0, 30));
    } finally {
      setIsInterruptingTurn(false);
    }
  };

  const refreshSelectedThread = async (options: { silent?: boolean } = {}) => {
    if (!selectedThread) {
      return;
    }

    const threadId = selectedThread.id;

    if (!options.silent) {
      setIsRefreshingThread(true);
    }

    try {
      const threadResponse = await client.request<ThreadReadResponse>("thread/read", {
        threadId,
        includeTurns: false,
      });
      if (selectedThreadIdRef.current !== threadId) {
        return;
      }
      const page = await loadTurnPage(client, threadResponse.thread.id, null);
      if (selectedThreadIdRef.current !== threadId) {
        return;
      }
      const nextTimeline = flattenTurns(page.turns);
      setSelectedThread(threadResponse.thread);
      setActiveTurnId(getInProgressTurnId(page.turns));
      setThreads((current) =>
        current.map((thread) => (thread.id === threadResponse.thread.id ? { ...thread, status: threadResponse.thread.status } : thread)),
      );
      setOlderTurnsCursor(page.nextCursor);
      setTimeline((current) => {
        const mergedTimeline = mergeTimelineSnapshot(current, nextTimeline);
        return isSameTimeline(current, mergedTimeline) ? current : mergedTimeline;
      });
      setPendingEntries((current) => reconcilePendingEntries(current, nextTimeline, threadResponse.thread.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRecentError(`refresh failed: ${message}`);
      setLogs((current) => [`refresh failed: ${message}`, ...current].slice(0, 30));
    } finally {
      if (!options.silent && selectedThreadIdRef.current === threadId) {
        setIsRefreshingThread(false);
      }
    }
  };

  return {
    state,
    logs,
    recentError,
    threads,
    archivedThreads,
    displayedThreads: showArchivedThreads ? archivedThreads : threads,
    showArchivedThreads,
    recentCwds,
    selectedThread,
    timeline: visibleTimeline,
    events,
    approval,
    userInputRequest,
    readiness,
    isOpeningThread,
    isRefreshingThreads,
    isLoadingMore,
    isRefreshingThread,
    isCreatingThread,
    isInterruptingTurn,
    isLoadingPickerData,
    selectedModelId,
    pickerData,
    isResponding: Boolean(activeTurnId) || selectedThread?.status.type === "active",
    statusLabel: activeTurnId ? "正在回复..." : getThreadStatusLabel(selectedThread),
    hasMoreMessages: Boolean(olderTurnsCursor),
    connect,
    disconnect,
    closeThread,
    probeReadiness,
    refreshThreads,
    toggleArchivedThreads,
    openThread,
    loadOlderMessages,
    refreshSelectedThread,
    refreshPickerData,
    createThread,
    sendMessage,
    setSelectedModelId,
    renameThread,
    archiveSelectedThread,
    restoreThread,
    startCurrentReview,
    runShellCommand,
    interruptTurn,
    resolveApproval,
    resolveUserInputRequest,
  };
}

function upsertTimelineEntry(current: TimelineEntry[], entry: TimelineEntry) {
  const index = current.findIndex((candidate) => candidate.id === entry.id);

  if (index === -1) {
    return [...current, entry];
  }

  return current.map((candidate, candidateIndex) =>
    candidateIndex === index
      ? {
          ...entry,
          body: entry.body || candidate.body,
          commandOutput: candidate.commandOutput || entry.commandOutput,
        }
      : candidate,
  );
}

function getThreadStatusLabel(thread: Thread | null) {
  if (!thread) {
    return null;
  }

  if (thread.status.type === "active") {
    if (thread.status.activeFlags.includes("waitingOnApproval")) {
      return "等待审批...";
    }

    if (thread.status.activeFlags.includes("waitingOnUserInput")) {
      return "等待输入...";
    }

    return "正在回复...";
  }

  if (thread.status.type === "systemError") {
    return "系统错误";
  }

  return null;
}

function isErrorLog(line: string) {
  return /error|failed|closed|403|拒绝|失败/i.test(line);
}

function clearReconnectTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (!timerRef.current) {
    return;
  }

  clearTimeout(timerRef.current);
  timerRef.current = null;
}
