import type {
  Thread,
  ThreadResumeResponse,
  ThreadTurnsListResponse,
  Turn,
  TurnStartResponse,
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

export async function startTurn(client: JsonRpcClient, threadId: string, text: string) {
  await client.request<TurnStartResponse>("turn/start", {
    threadId,
    input: [
      {
        type: "text",
        text,
        text_elements: [],
      },
    ],
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
