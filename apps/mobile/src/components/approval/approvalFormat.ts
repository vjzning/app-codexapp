import type { PendingApproval } from "@/types/codex";
import type {
  CommandExecutionRequestApprovalResponse,
  FileChangeRequestApprovalResponse,
  FileSystemPath,
  FileSystemSpecialPath,
  GrantedPermissionProfile,
  PermissionsRequestApprovalResponse,
  RequestPermissionProfile,
} from "@codex-mobile/protocol/v2";

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type ApprovalDisplay = {
  title: string;
  subtitle: string;
  detail: string;
  tone: "command" | "file" | "permission" | "legacy";
};

export function formatApprovalDisplay(approval: PendingApproval): ApprovalDisplay {
  if (approval.method === "item/commandExecution/requestApproval") {
    const command = approval.params.command || "命令执行";
    return {
      title: "需要允许命令",
      subtitle: command,
      detail: [approval.params.cwd ? `目录：${approval.params.cwd}` : null, approval.params.reason ? `原因：${approval.params.reason}` : null]
        .filter(Boolean)
        .join("\n"),
      tone: "command",
    };
  }

  if (approval.method === "item/fileChange/requestApproval") {
    return {
      title: "需要允许文件修改",
      subtitle: approval.params.grantRoot ? `写入范围：${approval.params.grantRoot}` : "文件变更",
      detail: approval.params.reason ? `原因：${approval.params.reason}` : "",
      tone: "file",
    };
  }

  if (approval.method === "item/permissions/requestApproval") {
    const details = [
      `目录：${approval.params.cwd}`,
      approval.params.reason ? `原因：${approval.params.reason}` : null,
      ...formatPermissionDetails(approval.params.permissions),
    ].filter(Boolean);

    return {
      title: "需要允许权限",
      subtitle: formatPermissionSubtitle(approval.params.permissions),
      detail: details.join("\n"),
      tone: "permission",
    };
  }

  if (approval.method === "execCommandApproval") {
    const command = approval.params.command.join(" ");
    return {
      title: "需要允许命令",
      subtitle: command,
      detail: [approval.params.cwd ? `目录：${approval.params.cwd}` : null, approval.params.reason ? `原因：${approval.params.reason}` : null]
        .filter(Boolean)
        .join("\n"),
      tone: "legacy",
    };
  }

  if (approval.method === "applyPatchApproval") {
    const files = Object.entries(approval.params.fileChanges)
      .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => Boolean(entry[1]))
      .map(([path, change]) => `${formatLegacyFileChange(change.type)} ${path}`);

    return {
      title: "需要允许文件修改",
      subtitle: approval.params.grantRoot ? `写入范围：${approval.params.grantRoot}` : "应用文件补丁",
      detail: [
        approval.params.reason ? `原因：${approval.params.reason}` : null,
        files.length ? `文件：\n${files.slice(0, 8).join("\n")}${files.length > 8 ? `\n...还有 ${files.length - 8} 个文件` : ""}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      tone: "legacy",
    };
  }

  return {
    title: "需要确认",
    subtitle: "审批请求",
    detail: "暂不支持的审批类型",
    tone: "legacy",
  };
}

export function getApprovalTimelineEntryId(approval: PendingApproval | null) {
  if (!approval) {
    return null;
  }

  if (
    approval.method === "item/commandExecution/requestApproval" ||
    approval.method === "item/fileChange/requestApproval" ||
    approval.method === "item/permissions/requestApproval"
  ) {
    // v2 审批请求带有 turnId 和 itemId，和时间线 item key 保持一致。
    return `${approval.params.turnId}:${approval.params.itemId}`;
  }

  return null;
}

export function buildApprovalResponse(
  approval: Extract<PendingApproval, { method: "item/permissions/requestApproval" }>,
  decision: ApprovalDecision,
): PermissionsRequestApprovalResponse;
export function buildApprovalResponse(approval: PendingApproval, decision: ApprovalDecision): unknown;
export function buildApprovalResponse(approval: PendingApproval, decision: ApprovalDecision) {
  switch (approval.method) {
    case "item/commandExecution/requestApproval":
      return { decision } satisfies CommandExecutionRequestApprovalResponse;
    case "item/fileChange/requestApproval":
      return { decision } satisfies FileChangeRequestApprovalResponse;
    case "item/permissions/requestApproval":
      return buildPermissionsApprovalResponse(approval, decision);
    case "execCommandApproval":
      return { decision: decision === "accept" || decision === "acceptForSession" ? "approved" : "denied" };
    case "applyPatchApproval":
      return { decision: decision === "accept" || decision === "acceptForSession" ? "approved" : "denied" };
  }
}

function buildPermissionsApprovalResponse(
  approval: Extract<PendingApproval, { method: "item/permissions/requestApproval" }>,
  decision: ApprovalDecision,
) {
  const accepted = decision === "accept" || decision === "acceptForSession";

  // 权限审批协议没有 decision 字段；拒绝时返回空权限，避免授予任何额外访问。
  return {
    permissions: accepted ? toGrantedPermissions(approval.params.permissions) : {},
    scope: decision === "acceptForSession" ? "session" : "turn",
  } satisfies PermissionsRequestApprovalResponse;
}

function toGrantedPermissions(permissions: RequestPermissionProfile): GrantedPermissionProfile {
  return {
    ...(permissions.network ? { network: permissions.network } : {}),
    ...(permissions.fileSystem ? { fileSystem: permissions.fileSystem } : {}),
  };
}

function formatPermissionSubtitle(permissions: RequestPermissionProfile) {
  const parts: string[] = [];

  if (permissions.network?.enabled) {
    parts.push("网络访问");
  }

  const fileSystem = permissions.fileSystem;
  const fileCount = (fileSystem?.entries?.length ?? 0) + (fileSystem?.read?.length ?? 0) + (fileSystem?.write?.length ?? 0);
  if (fileCount > 0) {
    parts.push(`文件访问 ${fileCount} 项`);
  }

  return parts.length ? parts.join(" / ") : "额外权限";
}

function formatPermissionDetails(permissions: RequestPermissionProfile) {
  const details: string[] = [];

  if (permissions.network?.enabled) {
    details.push("网络：允许访问网络");
  }

  const fileSystem = permissions.fileSystem;
  if (!fileSystem) {
    return details;
  }

  if (fileSystem.entries?.length) {
    details.push(
      `文件：\n${fileSystem.entries
        .slice(0, 8)
        .map((entry) => `${formatFileSystemAccess(entry.access)} ${formatFileSystemPath(entry.path)}`)
        .join("\n")}${fileSystem.entries.length > 8 ? `\n...还有 ${fileSystem.entries.length - 8} 项` : ""}`,
    );
  }

  if (fileSystem.read?.length) {
    details.push(`读取：\n${fileSystem.read.slice(0, 6).join("\n")}${fileSystem.read.length > 6 ? `\n...还有 ${fileSystem.read.length - 6} 项` : ""}`);
  }

  if (fileSystem.write?.length) {
    details.push(`写入：\n${fileSystem.write.slice(0, 6).join("\n")}${fileSystem.write.length > 6 ? `\n...还有 ${fileSystem.write.length - 6} 项` : ""}`);
  }

  return details;
}

function formatFileSystemAccess(access: "read" | "write" | "none") {
  switch (access) {
    case "read":
      return "读取";
    case "write":
      return "写入";
    case "none":
      return "无访问";
  }
}

function formatFileSystemPath(path: FileSystemPath) {
  switch (path.type) {
    case "path":
      return path.path;
    case "glob_pattern":
      return path.pattern;
    case "special":
      return formatSpecialPath(path.value);
  }
}

function formatSpecialPath(path: FileSystemSpecialPath) {
  switch (path.kind) {
    case "root":
      return "根目录";
    case "minimal":
      return "最小权限目录";
    case "project_roots":
      return path.subpath ? `项目根目录/${path.subpath}` : "项目根目录";
    case "tmpdir":
      return "临时目录";
    case "slash_tmp":
      return "/tmp";
    case "unknown":
      return path.subpath ? `${path.path}/${path.subpath}` : path.path;
  }
}

function formatLegacyFileChange(type: "add" | "delete" | "update") {
  switch (type) {
    case "add":
      return "新增";
    case "delete":
      return "删除";
    case "update":
      return "修改";
  }
}
