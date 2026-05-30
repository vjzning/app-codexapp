import type { ClientRequest } from "@codex-mobile/protocol";
import type { CommandExecutionRequestApprovalResponse } from "@codex-mobile/protocol/v2";
import type { FileChangeRequestApprovalResponse } from "@codex-mobile/protocol/v2";
import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";

import type { ConnectionState, JsonRpcId, JsonRpcIncoming, PendingApproval, PendingUserInputRequest, ReadinessStatus } from "@/types/codex";

type RequestResult<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

type ClientEvents = {
  onStateChange: (state: ConnectionState) => void;
  onNotification: (message: JsonRpcIncoming) => void;
  onApproval: (request: PendingApproval) => void;
  onUserInputRequest: (request: PendingUserInputRequest) => void;
  onLog: (line: string) => void;
};

type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";
type ReactNativeWebSocketCtor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> },
) => WebSocket;

const APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "execCommandApproval",
  "applyPatchApproval",
]);
const USER_INPUT_METHODS = new Set(["item/tool/requestUserInput"]);
const INITIALIZE_TIMEOUT_MS = 8000;

export class JsonRpcClient {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "idle";
  private nextId = 1;
  private pending = new Map<JsonRpcId, RequestResult<unknown>>();

  constructor(private readonly events: ClientEvents) {}

  connect(url: string, token?: string) {
    this.disconnect();

    this.setState("connecting");
    const options = token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined;
    const WebSocketCtor = WebSocket as unknown as ReactNativeWebSocketCtor;
    const socket = options ? new WebSocketCtor(url, undefined, options) : new WebSocketCtor(url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return;
      }
      this.events.onLog("websocket open; initializing");
      void this.initialize(socket);
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.handleMessage(event.data);
    };

    socket.onerror = (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.events.onLog(`websocket error: ${JSON.stringify(event)}`);
      this.setState("error");
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.events.onLog(`websocket closed: ${event.code} ${event.reason || ""}`.trim());
      if (String(event.reason || "").includes("403 Forbidden")) {
        // iPhone / Expo Go 里如果 readyz 正常但握手 403，通常是 WebSocket 没把 Authorization 头带出去。
        this.events.onLog("握手被 403 拒绝：如果是真机直连，请改用 relay 地址，token 输入框留空。");
      }
      this.setState("closed");
      this.rejectPending(new Error("Codex app-server connection closed"));
    };
  }

  async probeReadiness(url: string, token?: string): Promise<ReadinessStatus> {
    const httpUrl = buildReadinessUrl(url);
    try {
      const response = await fetch(
        httpUrl,
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          : undefined,
      );
      const body = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}${body ? ` ${body}` : ""}`,
        };
      }

      return {
        ok: true,
        status: response.status,
        body,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
    this.rejectPending(new Error("Disconnected"));
  }

  async request<T>(method: ClientRequest["method"], params: unknown): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.markSocketUnavailable("request attempted while socket is not open");
      throw new Error("Codex app-server is not connected");
    }

    const id = this.nextId++;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });

    this.socket.send(JSON.stringify(message));
    return promise;
  }

  async resolveApproval(request: PendingApproval, decision: ApprovalDecision) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.markSocketUnavailable("approval attempted while socket is not open");
      throw new Error("Codex app-server is not connected");
    }

    // Codex 的审批是 server -> client request；移动端必须用同一个 id 回包。
    const result = buildApprovalResponse(request, decision);
    this.socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result,
      }),
    );
  }

  async resolveUserInputRequest(request: PendingUserInputRequest, response: ToolRequestUserInputResponse) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.markSocketUnavailable("user input attempted while socket is not open");
      throw new Error("Codex app-server is not connected");
    }

    // tool/requestUserInput 同样是 server -> client request，必须用原 request id 回包。
    this.socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: response,
      }),
    );
  }

  private async initialize(socket: WebSocket) {
    try {
      await withTimeout(
        this.request("initialize", {
          clientInfo: {
            name: "codex-mobile-remote",
            title: "Codex Mobile Remote",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
            requestAttestation: false,
          },
        }),
        INITIALIZE_TIMEOUT_MS,
        "initialize timed out",
      );

      if (this.socket !== socket) {
        return;
      }

      socket.send(JSON.stringify({ jsonrpc: "2.0", method: "initialized" }));
      this.events.onLog("initialized");
      this.setState("connected");
    } catch (error) {
      this.events.onLog(error instanceof Error ? error.message : String(error));
      this.setState("error");
    }
  }

  private setState(state: ConnectionState) {
    this.state = state;
    this.events.onStateChange(state);
  }

  private markSocketUnavailable(reason: string) {
    this.events.onLog(reason);
    if (this.state === "connected" || this.state === "connecting" || this.state === "reconnecting") {
      this.setState("closed");
    }
    this.rejectPending(new Error("Codex app-server is not connected"));
  }

  private handleMessage(raw: unknown) {
    try {
      const message = JSON.parse(String(raw)) as JsonRpcIncoming;

      if ("id" in message && ("result" in message || "error" in message)) {
        this.resolveResponse(message);
        return;
      }

      if ("method" in message && APPROVAL_METHODS.has(message.method)) {
        this.events.onApproval(message as PendingApproval);
        return;
      }

      if ("method" in message && USER_INPUT_METHODS.has(message.method)) {
        this.events.onUserInputRequest(message as PendingUserInputRequest);
        return;
      }

      this.events.onNotification(message);
    } catch (error) {
      this.events.onLog(error instanceof Error ? error.message : String(error));
    }
  }

  private resolveResponse(message: JsonRpcIncoming) {
    if (!("id" in message)) {
      return;
    }

    const entry = this.pending.get(message.id);
    if (!entry) {
      return;
    }

    this.pending.delete(message.id);

    if ("error" in message) {
      entry.reject(new Error(message.error.message));
      return;
    }

    if ("result" in message) {
      entry.resolve(message.result);
    }
  }

  private rejectPending(error: Error) {
    for (const entry of this.pending.values()) {
      entry.reject(error);
    }
    this.pending.clear();
  }
}

function buildReadinessUrl(socketUrl: string) {
  const parsed = new URL(socketUrl);
  parsed.protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  parsed.pathname = "/readyz";
  return parsed.toString();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function buildApprovalResponse(request: PendingApproval, decision: ApprovalDecision) {
  switch (request.method) {
    case "item/commandExecution/requestApproval":
      return { decision } satisfies CommandExecutionRequestApprovalResponse;
    case "item/fileChange/requestApproval":
      return { decision } satisfies FileChangeRequestApprovalResponse;
    case "execCommandApproval":
      return { decision: decision === "accept" || decision === "acceptForSession" ? "approved" : "denied" };
    case "applyPatchApproval":
      return { decision: decision === "accept" || decision === "acceptForSession" ? "approved" : "denied" };
  }
}
