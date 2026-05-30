import type { TimelineEntry, TimelineFileChange } from "@/lib/threadFormat";

type Options = {
  preserveEntryId?: string | null;
};

export function groupCompletedTurnFileChanges(entries: TimelineEntry[], options: Options = {}) {
  const result: TimelineEntry[] = [];
  let group: TimelineEntry[] = [];
  let activeTurnId: string | undefined;

  const flushGroup = () => {
    if (group.length === 0) {
      return;
    }

    result.push(...groupFileChangesInTurn(group, options));
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

function groupFileChangesInTurn(entries: TimelineEntry[], options: Options) {
  const fileEntries = entries.filter((entry) => entry.fileChanges?.length);
  const shouldPreserve = Boolean(options.preserveEntryId && fileEntries.some((entry) => entry.id === options.preserveEntryId));

  if (fileEntries.length === 0 || shouldPreserve) {
    return entries;
  }

  const anchorIndex = findFinalAssistantIndex(entries);
  if (anchorIndex === -1) {
    return entries;
  }

  const mergedFileChanges = fileEntries.flatMap((entry) => entry.fileChanges ?? []);
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
