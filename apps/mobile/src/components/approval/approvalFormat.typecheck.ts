import type { PendingApproval } from "@/types/codex";
import { buildApprovalResponse, formatApprovalDisplay, getApprovalTimelineEntryId } from "./approvalFormat";

const permissionApproval = {
  method: "item/permissions/requestApproval",
  id: 1,
  params: {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId: "item-1",
    startedAtMs: 1,
    cwd: "/tmp/project",
    reason: "需要访问项目外文件",
    permissions: {
      network: { enabled: true },
      fileSystem: {
        read: ["/tmp/project"],
        write: ["/tmp/project/out"],
        entries: [
          {
            path: { type: "path", path: "/tmp/project/out" },
            access: "write",
          },
        ],
      },
    },
  },
} satisfies PendingApproval;

const display = formatApprovalDisplay(permissionApproval);
display.tone satisfies "command" | "file" | "permission" | "legacy";
getApprovalTimelineEntryId(permissionApproval) satisfies string | null;

const turnResponse = buildApprovalResponse(permissionApproval, "accept");
turnResponse.scope satisfies "turn" | "session";
turnResponse.permissions.fileSystem?.entries?.[0]?.access satisfies "read" | "write" | "none" | undefined;

const sessionResponse = buildApprovalResponse(permissionApproval, "acceptForSession");
sessionResponse.scope satisfies "turn" | "session";

const declinedResponse = buildApprovalResponse(permissionApproval, "decline");
declinedResponse.permissions satisfies {};
