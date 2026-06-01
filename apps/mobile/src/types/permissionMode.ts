import type { ApprovalsReviewer, SandboxMode, SandboxPolicy } from "@codex-mobile/protocol/v2";

export type PermissionModeId = "standard" | "auto" | "full";

export type PermissionModeConfig = {
  id: PermissionModeId;
  label: string;
  description: string;
  sandbox: SandboxMode;
  approvalsReviewer: ApprovalsReviewer;
};

export const PERMISSION_MODES: PermissionModeConfig[] = [
  {
    id: "standard",
    label: "标准",
    description: "工作区写入，敏感操作由你确认",
    sandbox: "workspace-write",
    approvalsReviewer: "user",
  },
  {
    id: "auto",
    label: "自动审批",
    description: "工作区写入，由自动审查处理审批",
    sandbox: "workspace-write",
    approvalsReviewer: "auto_review",
  },
  {
    id: "full",
    label: "全部权限",
    description: "danger full access，仍保留审批策略",
    sandbox: "danger-full-access",
    approvalsReviewer: "user",
  },
];

export const DEFAULT_PERMISSION_MODE_ID: PermissionModeId = "standard";

export function getPermissionMode(id: PermissionModeId) {
  return PERMISSION_MODES.find((mode) => mode.id === id) ?? PERMISSION_MODES[0];
}

export function getPermissionModeSandboxPolicy(id: PermissionModeId, cwd: string): SandboxPolicy {
  if (id === "full") {
    return { type: "dangerFullAccess" };
  }

  // turn/start 需要完整 SandboxPolicy；用当前会话 cwd 作为写入根，避免空 writableRoots 收窄到不可写。
  return {
    type: "workspaceWrite",
    writableRoots: [cwd],
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
}
