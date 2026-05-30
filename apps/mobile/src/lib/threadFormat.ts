import type { CommandExecutionRequestApprovalParams, FileUpdateChange, Thread, ThreadItem, Turn, UserInput } from "@codex-mobile/protocol/v2";

export type TimelineEntry = {
  id: string;
  turnId?: string;
  role: "user" | "assistant" | "tool" | "system";
  variant?: "command" | "commandGroup";
  title: string;
  metaLabel?: string;
  timestampMs?: number;
  body: string;
  commandText?: string;
  commandStatus?: "inProgress" | "completed" | "failed" | "declined";
  commandExitCode?: number | null;
  commandOutput?: string;
  commandEntries?: TimelineEntry[];
  attachments?: TimelineAttachment[];
  fileChanges?: TimelineFileChange[];
  pending?: boolean;
  failed?: boolean;
  streaming?: boolean;
};

export type TimelineAttachment = {
  type: "image";
  uri: string;
  originalUri?: string;
  label: string;
};

export type TimelineFileChange = {
  path: string;
  status: "added" | "deleted" | "updated" | "moved";
  kind: string;
  diff: string;
  additions: number;
  deletions: number;
};

const MAX_TIMELINE_BODY_CHARS = 4000;

export function formatTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString();
}

export function threadTitle(thread: Thread) {
  return thread.name || thread.preview || thread.cwd || thread.id;
}

export function threadProjectLabel(thread: Thread) {
  const cwd = thread.cwd || "";
  const projectName = cwd.split("/").filter(Boolean).at(-1) || cwd || thread.name || thread.id;
  const branch = thread.gitInfo?.branch;
  return branch ? `${projectName} (${branch})` : projectName;
}

export function flattenTurns(turns: Turn[]) {
  return turns.flatMap((turn) => {
    const seenIds = new Map<string, number>();
    const lastAgentMessageIndex = findLastAgentMessageIndex(turn.items);
    return turn.items.map((item, index) =>
      itemToTimelineEntry(turn.id, item, seenIds, {
        timestampMs: getItemTimestampMs(item, turn),
        turnDurationMs: index === lastAgentMessageIndex ? turn.durationMs : null,
      }),
    );
  });
}

export function timelineEntryFromThreadItem(
  turnId: string,
  item: ThreadItem,
  options: { streaming?: boolean; timestampMs?: number | null; turnDurationMs?: number | null } = {},
) {
  return itemToTimelineEntry(turnId, item, undefined, options);
}

export function timelineEntryFromCommandApproval(params: CommandExecutionRequestApprovalParams): TimelineEntry {
  const command = params.command?.trim() || "命令";

  return {
    id: `${params.turnId}:${params.itemId}`,
    turnId: params.turnId,
    role: "tool",
    variant: "command",
    title: formatCommandExecutionTitle("inProgress", command),
    timestampMs: params.startedAtMs,
    body: params.reason ? `等待允许：${params.reason}` : "",
    commandText: command,
    commandStatus: "inProgress",
    commandExitCode: null,
    commandOutput: "",
  };
}

export function appendTimelineBody(body: string, delta: string) {
  return clipTimelineBody(`${body}${delta}`);
}

function itemToTimelineEntry(
  turnId: string,
  item: ThreadItem,
  seenIds?: Map<string, number>,
  options: { streaming?: boolean; timestampMs?: number | null; turnDurationMs?: number | null } = {},
): TimelineEntry {
  const entryId = buildTimelineEntryId(turnId, item, seenIds);

  switch (item.type) {
    case "userMessage":
      return { ...formatUserMessageEntry(entryId, item.content, options.timestampMs), turnId };
    case "agentMessage":
      return {
        id: entryId,
        turnId,
        role: "assistant",
        title: "Codex",
        metaLabel: formatDurationMeta(options.turnDurationMs),
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody(item.text),
        streaming: options.streaming,
      };
    case "reasoning":
      return {
        id: entryId,
        turnId,
        role: "assistant",
        title: "Reasoning",
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody([...item.summary, ...item.content].join("\n")),
      };
    case "commandExecution":
      return {
        id: entryId,
        turnId,
        role: "tool",
        variant: "command",
        title: formatCommandExecutionTitle(item.status, item.command),
        metaLabel: formatDurationMeta(item.durationMs),
        timestampMs: options.timestampMs ?? undefined,
        body: formatCommandExecutionOutput(item.aggregatedOutput || ""),
        commandText: item.command,
        commandStatus: item.status,
        commandExitCode: item.exitCode,
        commandOutput: item.aggregatedOutput || "",
      };
    case "fileChange":
      return {
        id: entryId,
        turnId,
        role: "tool",
        title: `已编辑 ${item.changes.length} 个文件`,
        timestampMs: options.timestampMs ?? undefined,
        body: formatFileChangesSummary(item.changes),
        fileChanges: item.changes.map(formatTimelineFileChange),
      };
    case "plan":
      return {
        id: entryId,
        turnId,
        role: "assistant",
        title: "Plan",
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody(item.text),
      };
    case "mcpToolCall":
      return {
        id: entryId,
        turnId,
        role: "tool",
        title: item.status,
        metaLabel: formatDurationMeta(item.durationMs),
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody(`${item.server}/${item.tool}`),
      };
    case "dynamicToolCall":
      return {
        id: entryId,
        turnId,
        role: "tool",
        title: item.status,
        metaLabel: formatDurationMeta(item.durationMs),
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody(item.namespace ? `${item.namespace}/${item.tool}` : item.tool),
      };
    default:
      return {
        // item.id 在不同 turn 之间不保证全局唯一，时间线 key 必须带上 turnId。
        id: entryId,
        turnId,
        role: "system",
        title: item.type,
        timestampMs: options.timestampMs ?? undefined,
        body: clipTimelineBody(JSON.stringify(item, null, 2)),
      };
  }
}

function getItemTimestampMs(item: ThreadItem, turn: Turn) {
  if (item.type === "userMessage") {
    return secondsToMs(turn.startedAt);
  }

  return secondsToMs(turn.completedAt ?? turn.startedAt);
}

function secondsToMs(seconds: number | null | undefined) {
  return seconds ? seconds * 1000 : undefined;
}

function findLastAgentMessageIndex(items: ThreadItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.type === "agentMessage") {
      return index;
    }
  }

  return -1;
}

function formatUserMessageEntry(id: string, content: UserInput[], timestampMs?: number | null): TimelineEntry {
  const bodyParts: string[] = [];
  const attachments: TimelineAttachment[] = [];

  for (const input of content) {
    if (input.type === "image") {
      attachments.push({
        type: "image",
        uri: input.url,
        label: "图片",
      });
      continue;
    }

    if (input.type === "localImage") {
      attachments.push({
        type: "image",
        uri: input.path,
        label: "本地图片",
      });
      continue;
    }

    bodyParts.push(formatUserInputText(input));
  }

  return {
    id,
    role: "user",
    title: "You",
    timestampMs: timestampMs ?? undefined,
    body: clipTimelineBody(bodyParts.filter(Boolean).join("\n")),
    attachments,
  };
}

function formatUserInputText(input: UserInput) {
  switch (input.type) {
    case "text":
      return input.text;
    case "skill":
      return `@${input.name}`;
    case "mention":
      return `@${input.name}`;
    case "image":
    case "localImage":
      return "";
  }
}

function formatCommandExecutionTitle(status: "inProgress" | "completed" | "failed" | "declined", command: string) {
  const shortCommand = command.trim() || "命令";

  switch (status) {
    case "inProgress":
      return `正在运行 ${shortCommand}`;
    case "completed":
      return `已运行 ${shortCommand}`;
    case "failed":
      return `运行失败 ${shortCommand}`;
    case "declined":
      return `已拒绝 ${shortCommand}`;
  }
}

function formatCommandExecutionOutput(output: string) {
  if (!output.trim()) {
    return "";
  }

  return clipTimelineBody(summarizeToolOutput(output));
}

function formatDurationMeta(durationMs: number | null | undefined) {
  if (!durationMs || durationMs < 0) {
    return undefined;
  }

  return `已处理 ${formatDuration(durationMs)}`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function summarizeToolOutput(output: string) {
  const trimmed = output.trim();

  if (trimmed.length <= 1800) {
    return trimmed;
  }

  // 工具输出经常很长，移动端默认保留头尾，完整内容仍可在桌面端看。
  const head = trimmed.slice(0, 900);
  const tail = trimmed.slice(-700);
  return `${head}\n\n...[omitted ${trimmed.length - head.length - tail.length} chars]...\n\n${tail}`;
}

function formatFileChangesSummary(changes: FileUpdateChange[]) {
  if (changes.length === 0) {
    return "No file changes";
  }

  const totals = changes.reduce(
    (next, change) => {
      const stats = countDiffStats(change.diff);
      return {
        additions: next.additions + stats.additions,
        deletions: next.deletions + stats.deletions,
      };
    },
    { additions: 0, deletions: 0 },
  );

  return `已编辑 ${changes.length} 个文件  +${totals.additions} -${totals.deletions}`;
}

function formatTimelineFileChange(change: FileUpdateChange): TimelineFileChange {
  const stats = countDiffStats(change.diff);
  return {
    path: change.path,
    status: formatPatchStatus(change),
    kind: formatPatchKind(change),
    diff: change.diff,
    additions: stats.additions,
    deletions: stats.deletions,
  };
}

function countDiffStats(diff: string) {
  let additions = 0;
  let deletions = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function formatPatchKind(change: FileUpdateChange) {
  switch (change.kind.type) {
    case "add":
      return "新增";
    case "delete":
      return "删除";
    case "update":
      return change.kind.move_path ? "移动" : "修改";
  }
}

function formatPatchStatus(change: FileUpdateChange): TimelineFileChange["status"] {
  switch (change.kind.type) {
    case "add":
      return "added";
    case "delete":
      return "deleted";
    case "update":
      return change.kind.move_path ? "moved" : "updated";
  }
}

export function clipTimelineBody(text: string) {
  if (text.length <= MAX_TIMELINE_BODY_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_TIMELINE_BODY_CHARS)}\n\n...[truncated ${text.length - MAX_TIMELINE_BODY_CHARS} chars]`;
}

function buildTimelineEntryId(turnId: string, item: ThreadItem, seenIds?: Map<string, number>) {
  const baseId = `${turnId}:${item.id || item.type}`;

  if (!seenIds) {
    return baseId;
  }

  const count = seenIds.get(baseId) ?? 0;
  seenIds.set(baseId, count + 1);

  return count === 0 ? baseId : `${baseId}:${count}`;
}
