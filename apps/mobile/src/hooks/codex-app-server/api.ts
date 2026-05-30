import type {
  AppsListResponse,
  ModelListResponse,
  ReviewStartResponse,
  SkillsListResponse,
  Thread,
  ThreadListResponse,
  ThreadResumeResponse,
  ThreadTurnsListResponse,
  ThreadUnarchiveResponse,
  Turn,
  TurnStartResponse,
  TurnSteerResponse,
  UserInput,
} from "@codex-mobile/protocol/v2";

import { JsonRpcClient } from "@/lib/jsonRpcClient";
import type { ReadinessStatus } from "@/types/codex";

import type { NormalizedConnection } from "./types";

export const DETAIL_TURN_PAGE_SIZE = 4;

export async function ensureThreadResumed(client: JsonRpcClient, thread: Thread) {
  if (thread.status.type !== "notLoaded") {
    return thread;
  }

  const resumed = await client.request<ThreadResumeResponse>("thread/resume", {
    threadId: thread.id,
    excludeTurns: true,
    persistExtendedHistory: false,
  });

  return resumed.thread;
}

export async function startTurn(client: JsonRpcClient, threadId: string, input: UserInput[], options: { model?: string | null } = {}) {
  await client.request<TurnStartResponse>("turn/start", {
    threadId,
    model: options.model ?? undefined,
    input,
  });
}

export async function steerTurn(client: JsonRpcClient, threadId: string, turnId: string, input: UserInput[]) {
  await client.request<TurnSteerResponse>("turn/steer", {
    threadId,
    expectedTurnId: turnId,
    input,
  });
}

export async function setThreadName(client: JsonRpcClient, threadId: string, name: string) {
  await client.request("thread/name/set", { threadId, name });
}

export async function archiveThread(client: JsonRpcClient, threadId: string) {
  await client.request("thread/archive", { threadId });
}

export async function unarchiveThread(client: JsonRpcClient, threadId: string) {
  return client.request<ThreadUnarchiveResponse>("thread/unarchive", { threadId });
}

export async function loadThreads(client: JsonRpcClient, archived: boolean) {
  const response = await client.request<ThreadListResponse>("thread/list", {
    limit: 30,
    sortKey: "updated_at",
    sortDirection: "desc",
    archived,
  });

  return response.data;
}

export async function loadModels(client: JsonRpcClient) {
  const response = await client.request<ModelListResponse>("model/list", {
    limit: 50,
    includeHidden: false,
  });

  return response.data;
}

export async function loadSkills(client: JsonRpcClient, cwd: string | null) {
  if (!cwd) {
    return [];
  }

  const response = await client.request<SkillsListResponse>("skills/list", {
    cwds: [cwd],
    forceReload: false,
  });

  return response.data.flatMap((entry) => entry.skills).filter((skill) => skill.enabled);
}

export async function loadApps(client: JsonRpcClient, threadId: string | null) {
  const response = await client.request<AppsListResponse>("app/list", {
    threadId,
    limit: 50,
    forceRefetch: false,
  });

  return response.data.filter((app) => app.isAccessible && app.isEnabled);
}

export async function startReview(client: JsonRpcClient, threadId: string) {
  return client.request<ReviewStartResponse>("review/start", {
    threadId,
    delivery: "inline",
    target: { type: "uncommittedChanges" },
  });
}

export async function loadTurnPage(client: JsonRpcClient, threadId: string, cursor: string | null) {
  // 当前 app-server 已支持 turn 分页，但 items 单独分页接口还未实现，所以这里直接取 full。
  const turnsResponse = await client.request<ThreadTurnsListResponse>("thread/turns/list", {
    threadId,
    cursor,
    limit: DETAIL_TURN_PAGE_SIZE,
    sortDirection: "desc",
    itemsView: "full",
  });

  return {
    turns: [...turnsResponse.data].reverse(),
    nextCursor: turnsResponse.nextCursor,
  };
}

export function getInProgressTurnId(turns: Turn[]) {
  return turns.find((turn) => turn.status === "inProgress")?.id ?? null;
}

export function normalizeConnection(url: string, token: string): NormalizedConnection {
  const trimmedUrl = url.trim();
  const trimmedToken = token.trim();

  if (!trimmedUrl) {
    throw new Error("请先填写 WebSocket 地址");
  }

  try {
    const parsed = new URL(trimmedUrl);
    const isRelayTarget = parsed.searchParams.has("relay_token") || parsed.port === "4501" || parsed.protocol === "wss:";

    if (isRelayTarget) {
      if (trimmedToken) {
        // relay 只能从 query 读取 token，移动端不要依赖 WebSocket 自定义 header。
        parsed.searchParams.set("relay_token", trimmedToken);
      }

      return {
        socketUrl: parsed.toString(),
      };
    }

    return {
      socketUrl: parsed.toString(),
      authToken: trimmedToken || undefined,
    };
  } catch {
    throw new Error("WebSocket 地址不合法");
  }
}

export function formatReadinessLog(result: ReadinessStatus) {
  if (result.ok) {
    return `readyz ok: ${result.status}`;
  }

  return `readyz failed: ${result.error}`;
}
