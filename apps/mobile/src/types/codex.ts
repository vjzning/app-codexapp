import type { RequestId } from "@codex-mobile/protocol";
import type { ServerNotification, ServerRequest } from "@codex-mobile/protocol";

export type JsonRpcId = RequestId;

export type JsonRpcResponse<T = unknown> =
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      result: T;
    }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: {
        code: number;
        message: string;
        data?: unknown;
      };
    };

export type JsonRpcIncoming =
  | JsonRpcResponse
  | ({
      jsonrpc?: "2.0";
    } & ServerNotification)
  | ({
      jsonrpc?: "2.0";
    } & ServerRequest);

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed" | "error";

export type ReadinessStatus =
  | { ok: true; status: number; body: string }
  | { ok: false; error: string };

export type PendingApproval = Extract<
  ServerRequest,
  {
    method:
      | "item/commandExecution/requestApproval"
      | "item/fileChange/requestApproval"
      | "execCommandApproval"
      | "applyPatchApproval";
  }
>;

export type PendingUserInputRequest = Extract<
  ServerRequest,
  {
    method: "item/tool/requestUserInput";
  }
>;
