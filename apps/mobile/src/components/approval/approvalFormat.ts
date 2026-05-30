import type { PendingApproval } from "@/types/codex";

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type ApprovalDisplay = {
  title: string;
  subtitle: string;
  detail: string;
  tone: "command" | "file" | "legacy";
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

  if (approval.method === "item/commandExecution/requestApproval" || approval.method === "item/fileChange/requestApproval") {
    // v2 审批请求带有 turnId 和 itemId，和时间线 item key 保持一致。
    return `${approval.params.turnId}:${approval.params.itemId}`;
  }

  return null;
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
