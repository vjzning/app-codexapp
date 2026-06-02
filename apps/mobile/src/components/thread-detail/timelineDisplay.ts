import type { TimelineEntry, TimelineFileChange } from "@/lib/threadFormat";

type Options = {
  preserveEntryId?: string | null;
  preserveEntryIds?: Array<string | null | undefined>;
};

export function prepareThreadDetailTimeline(entries: TimelineEntry[], options: Options = {}) {
  const result: TimelineEntry[] = [];
  let group: TimelineEntry[] = [];
  let activeTurnId: string | undefined;

  const flushGroup = () => {
    if (group.length === 0) {
      return;
    }

    result.push(...groupToolEntriesInTurn(group, options));
    group = [];
    activeTurnId = undefined;
  };

  for (const entry of entries) {
    if (!entry.turnId) {
      flushGroup();
      result.push(entry);
      continue;
    }

    if (activeTurnId && activeTurnId !== entry.turnId) {
      flushGroup();
    }

    activeTurnId = entry.turnId;
    group.push(entry);
  }

  flushGroup();
  return result;
}

export const groupCompletedTurnFileChanges = prepareThreadDetailTimeline;

function groupToolEntriesInTurn(entries: TimelineEntry[], options: Options) {
  const groupedTools = groupWebSearchEntriesInTurn(groupCommandExecutionsInTurn(groupFileChangesInTurn(entries, options), options), options);
  return groupCompletedTurnProcessEntries(groupedTools, options);
}

function groupFileChangesInTurn(entries: TimelineEntry[], options: Options) {
  const fileEntries = entries.filter((entry) => entry.fileChanges?.length);
  const shouldPreserve = hasPreservedEntry(fileEntries, options);

  if (fileEntries.length === 0 || shouldPreserve) {
    return entries;
  }

  const anchorIndex = findFinalAssistantIndex(entries);
  const insertIndex = anchorIndex === -1 ? entries.length - 1 : anchorIndex;

  if (insertIndex === -1) {
    return entries;
  }

  const anchorEntry = entries[insertIndex];
  if (!anchorEntry) {
    return entries;
  }

  const mergedFileChanges = mergeFileChangesByPath(fileEntries.flatMap((entry) => entry.fileChanges ?? []));
  const syntheticEntry = createMergedFileChangeEntry(anchorEntry, fileEntries, mergedFileChanges);
  const fileEntryIds = new Set(fileEntries.map((entry) => entry.id));

  if (anchorIndex === -1) {
    return [...entries.filter((entry) => !fileEntryIds.has(entry.id)), syntheticEntry];
  }

  const output: TimelineEntry[] = [];

  entries.forEach((entry, index) => {
    if (!fileEntryIds.has(entry.id)) {
      output.push(entry);
    }

    if (anchorIndex !== -1 && index === insertIndex) {
      output.push(syntheticEntry);
    }
  });

  return output;
}

function groupCommandExecutionsInTurn(entries: TimelineEntry[], options: Options) {
  const commandEntries = entries.filter((entry) => entry.variant === "command");
  const shouldPreserve = hasPreservedEntry(commandEntries, options);

  if (commandEntries.length < 2 || shouldPreserve || commandEntries.some((entry) => entry.commandStatus === "inProgress")) {
    return entries;
  }

  const anchorIndex = findFinalAssistantIndex(entries);
  const fallbackAnchorIndex = entries.findIndex((entry) => entry.variant === "command");
  const insertIndex = anchorIndex === -1 ? fallbackAnchorIndex : anchorIndex;

  if (insertIndex === -1) {
    return entries;
  }

  const anchorEntry = entries[insertIndex];
  if (!anchorEntry) {
    return entries;
  }

  const syntheticEntry = createMergedCommandEntry(anchorEntry, commandEntries);
  const commandEntryIds = new Set(commandEntries.map((entry) => entry.id));
  const output: TimelineEntry[] = [];

  entries.forEach((entry, index) => {
    if (anchorIndex === -1 && index === insertIndex) {
      output.push(syntheticEntry);
      return;
    }

    if (!commandEntryIds.has(entry.id)) {
      output.push(entry);
    }

    if (anchorIndex !== -1 && index === insertIndex) {
      output.push(syntheticEntry);
    }
  });

  return output;
}

function groupWebSearchEntriesInTurn(entries: TimelineEntry[], options: Options) {
  const searchEntries = entries.filter((entry) => entry.webSearchActions?.length);
  const shouldPreserve = hasPreservedEntry(searchEntries, options);

  if (searchEntries.length === 0 || shouldPreserve || searchEntries.some((entry) => entry.streaming)) {
    return entries;
  }

  const anchorIndex = entries.findIndex((entry) => entry.webSearchActions?.length);
  const anchorEntry = entries[anchorIndex];
  if (!anchorEntry) {
    return entries;
  }

  const syntheticEntry = createMergedWebSearchEntry(anchorEntry, searchEntries);
  const output: TimelineEntry[] = [];

  entries.forEach((entry, index) => {
    if (index === anchorIndex) {
      output.push(syntheticEntry);
      return;
    }

    if (!entry.webSearchActions?.length) {
      output.push(entry);
    }
  });

  return output;
}

function groupCompletedTurnProcessEntries(entries: TimelineEntry[], options: Options) {
  const finalAssistantIndex = findFinalAssistantIndex(entries);
  const anchorIndex = finalAssistantIndex === -1 ? findStreamingAssistantIndex(entries) : finalAssistantIndex;

  if (anchorIndex === -1) {
    return entries;
  }

  const processEntries = entries.filter((entry, index) => index !== anchorIndex && isCollapsibleProcessEntry(entry, options));

  if (processEntries.length === 0) {
    return entries;
  }

  const anchorEntry = entries[anchorIndex];
  if (!anchorEntry) {
    return entries;
  }

  const syntheticEntry = createTurnProcessEntry(anchorEntry, processEntries);
  const processEntryIds = new Set(processEntries.map((entry) => entry.id));
  const output: TimelineEntry[] = [];
  let insertedProcessGroup = false;

  entries.forEach((entry, index) => {
    if (index === anchorIndex && !insertedProcessGroup) {
      output.push(syntheticEntry);
      insertedProcessGroup = true;
    }

    if (!processEntryIds.has(entry.id)) {
      output.push(entry);
    }
  });

  return output;
}

function isCollapsibleProcessEntry(entry: TimelineEntry, options: Options) {
  if (entry.role === "user") {
    return false;
  }

  if (entry.fileChanges?.length) {
    return false;
  }

  if (hasPreservedEntry([entry], options)) {
    return false;
  }

  if (entry.pending || entry.failed || entry.streaming) {
    return false;
  }

  if (entry.variant === "command" && entry.commandStatus === "inProgress") {
    return false;
  }

  return entry.role === "assistant" || entry.role === "tool" || entry.role === "system";
}

function findFinalAssistantIndex(entries: TimelineEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.role === "assistant" && entry.title === "Codex" && !entry.streaming) {
      return index;
    }
  }

  return -1;
}

function findStreamingAssistantIndex(entries: TimelineEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.role === "assistant" && entry.title === "Codex" && entry.streaming) {
      return index;
    }
  }

  return -1;
}

function createMergedFileChangeEntry(anchorEntry: TimelineEntry, fileEntries: TimelineEntry[], fileChanges: TimelineFileChange[]): TimelineEntry {
  const firstFileEntry = fileEntries[0];
  const totals = fileChanges.reduce(
    (next, change) => ({
      additions: next.additions + change.additions,
      deletions: next.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 },
  );

  return {
    id: `${anchorEntry.turnId}:fileChanges:summary`,
    turnId: anchorEntry.turnId,
    role: "tool",
    title: `已编辑 ${fileChanges.length} 个文件`,
    timestampMs: firstFileEntry?.timestampMs ?? anchorEntry.timestampMs,
    body: `已编辑 ${fileChanges.length} 个文件${totals.additions || totals.deletions ? `  +${totals.additions} -${totals.deletions}` : ""}`,
    fileChanges,
    streaming: fileEntries.some((entry) => entry.streaming),
  };
}

function mergeFileChangesByPath(fileChanges: TimelineFileChange[]) {
  const merged = new Map<string, TimelineFileChange>();

  for (const change of fileChanges) {
    const existing = merged.get(change.path);

    if (!existing) {
      merged.set(change.path, change);
      continue;
    }

    merged.set(change.path, {
      ...change,
      additions: existing.additions + change.additions,
      deletions: existing.deletions + change.deletions,
      diff: [existing.diff, change.diff].filter(Boolean).join("\n"),
      kind: existing.status === "added" ? existing.kind : change.kind,
      status: existing.status === "added" ? existing.status : change.status,
    });
  }

  return [...merged.values()];
}

function createMergedCommandEntry(anchorEntry: TimelineEntry, commandEntries: TimelineEntry[]): TimelineEntry {
  const failedCount = commandEntries.filter(isFailedCommandEntry).length;
  const title = failedCount > 0 ? `已运行 ${commandEntries.length} 条命令，${failedCount} 条失败` : `已运行 ${commandEntries.length} 条命令`;

  return {
    id: `${anchorEntry.turnId}:commands:summary`,
    turnId: anchorEntry.turnId,
    role: "tool",
    variant: "commandGroup",
    title,
    timestampMs: commandEntries[0]?.timestampMs ?? anchorEntry.timestampMs,
    body: title,
    commandEntries,
  };
}

function createMergedWebSearchEntry(anchorEntry: TimelineEntry, searchEntries: TimelineEntry[]): TimelineEntry {
  const actions = searchEntries.flatMap((entry) => entry.webSearchActions ?? []);
  const title = `已搜索网页 ${actions.length} 次`;

  return {
    id: `${anchorEntry.turnId}:webSearch:summary`,
    turnId: anchorEntry.turnId,
    role: "tool",
    variant: "webSearchGroup",
    title,
    timestampMs: searchEntries[0]?.timestampMs ?? anchorEntry.timestampMs,
    body: actions.map((action) => action.detail).join("\n"),
    webSearchActions: actions,
  };
}

function createTurnProcessEntry(finalAssistant: TimelineEntry, processEntries: TimelineEntry[]): TimelineEntry {
  const title = "已处理";

  return {
    id: `${finalAssistant.turnId}:process:summary`,
    turnId: finalAssistant.turnId,
    role: "tool",
    variant: "turnProcessGroup",
    title,
    timestampMs: processEntries[0]?.timestampMs ?? finalAssistant.timestampMs,
    body: title,
    processEntries,
  };
}

function isFailedCommandEntry(entry: TimelineEntry) {
  return entry.commandStatus === "failed" || entry.commandStatus === "declined" || Boolean(entry.commandExitCode && entry.commandExitCode !== 0);
}

function hasPreservedEntry(entries: TimelineEntry[], options: Options) {
  const ids = new Set([options.preserveEntryId, ...(options.preserveEntryIds ?? [])].filter(Boolean));
  return entries.some((entry) => ids.has(entry.id));
}
