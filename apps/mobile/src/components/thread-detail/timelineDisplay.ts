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
  return groupCommandExecutionsInTurn(groupFileChangesInTurn(entries, options), options);
}

function groupFileChangesInTurn(entries: TimelineEntry[], options: Options) {
  const fileEntries = entries.filter((entry) => entry.fileChanges?.length);
  const shouldPreserve = hasPreservedEntry(fileEntries, options);

  if (fileEntries.length === 0 || shouldPreserve) {
    return entries;
  }

  const anchorIndex = findFinalAssistantIndex(entries);
  if (anchorIndex === -1) {
    return entries.filter((entry) => !entry.fileChanges?.length);
  }

  const mergedFileChanges = mergeFileChangesByPath(fileEntries.flatMap((entry) => entry.fileChanges ?? []));
  const syntheticEntry = createMergedFileChangeEntry(entries[anchorIndex], fileEntries, mergedFileChanges);
  const output: TimelineEntry[] = [];

  entries.forEach((entry, index) => {
    if (!entry.fileChanges?.length) {
      output.push(entry);
    }

    if (index === anchorIndex) {
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
  if (anchorIndex === -1) {
    return entries;
  }

  const syntheticEntry = createMergedCommandEntry(entries[anchorIndex], commandEntries);
  const output: TimelineEntry[] = [];

  entries.forEach((entry, index) => {
    if (entry.variant !== "command") {
      output.push(entry);
    }

    if (index === anchorIndex) {
      output.push(syntheticEntry);
    }
  });

  return output;
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

function isFailedCommandEntry(entry: TimelineEntry) {
  return entry.commandStatus === "failed" || entry.commandStatus === "declined" || Boolean(entry.commandExitCode && entry.commandExitCode !== 0);
}

function hasPreservedEntry(entries: TimelineEntry[], options: Options) {
  const ids = new Set([options.preserveEntryId, ...(options.preserveEntryIds ?? [])].filter(Boolean));
  return entries.some((entry) => ids.has(entry.id));
}
