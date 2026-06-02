import type { TimelineEntry } from "@/lib/threadFormat";

import { prepareThreadDetailTimeline } from "./timelineDisplay";

const entries: TimelineEntry[] = [
  {
    id: "turn-1:web-search-1",
    turnId: "turn-1",
    role: "tool",
    title: "已搜索网页",
    body: "OpenAI Codex GitHub app-server",
    webSearchActions: [
      {
        id: "turn-1:web-search-1",
        label: "搜索网页",
        detail: "OpenAI Codex GitHub app-server",
        icon: "search",
      },
    ],
  },
  {
    id: "turn-1:assistant",
    turnId: "turn-1",
    role: "assistant",
    title: "Codex",
    body: "回答内容",
  },
  {
    id: "turn-1:web-search-2",
    turnId: "turn-1",
    role: "tool",
    title: "已搜索网页",
    body: "https://github.com/openai/codex",
    webSearchActions: [
      {
        id: "turn-1:web-search-2",
        label: "打开网页",
        detail: "https://github.com/openai/codex",
        icon: "open",
      },
    ],
  },
];

const grouped = prepareThreadDetailTimeline(entries);
const webSearchGroup = grouped.find(isWebSearchGroup);
webSearchGroup?.variant satisfies "webSearchGroup" | undefined;
webSearchGroup?.webSearchActions?.[0]?.icon satisfies "search" | "open" | "find" | "other" | undefined;

const streaming = prepareThreadDetailTimeline([{ ...entries[0]!, streaming: true }, entries[1]!]);
streaming[0]?.webSearchActions?.[0]?.detail satisfies string | undefined;

const completedTurn = prepareThreadDetailTimeline([
  {
    id: "turn-2:user",
    turnId: "turn-2",
    role: "user",
    title: "You",
    body: "查一下",
  },
  {
    id: "turn-2:reasoning",
    turnId: "turn-2",
    role: "assistant",
    title: "Reasoning",
    body: "分析中",
  },
  {
    id: "turn-2:assistant",
    turnId: "turn-2",
    role: "assistant",
    title: "Codex",
    metaLabel: "已处理 14m 25s",
    body: "最终总结",
  },
]);
const processGroup = completedTurn.find(isTurnProcessGroup);
processGroup?.variant satisfies "turnProcessGroup" | undefined;
processGroup?.processEntries?.[0]?.title satisfies string | undefined;
completedTurn[0]?.role satisfies "user" | "assistant" | "tool" | "system" | undefined;
const processGroupIsBeforeFinalAnswer = completedTurn[1]?.variant === "turnProcessGroup";
processGroupIsBeforeFinalAnswer satisfies boolean;
completedTurn[2]?.title satisfies string | undefined;

const turnWithFileChange = prepareThreadDetailTimeline([
  {
    id: "turn-3:user",
    turnId: "turn-3",
    role: "user",
    title: "You",
    body: "改一下文件",
  },
  {
    id: "turn-3:reasoning",
    turnId: "turn-3",
    role: "assistant",
    title: "Reasoning",
    body: "分析文件修改",
  },
  {
    id: "turn-3:assistant",
    turnId: "turn-3",
    role: "assistant",
    title: "Codex",
    metaLabel: "已处理 2m 10s",
    body: "文件已改好",
  },
  {
    id: "turn-3:fileChanges:summary",
    turnId: "turn-3",
    role: "tool",
    title: "已编辑 1 个文件",
    body: "已编辑 1 个文件  +1 -0",
    fileChanges: [
      {
        path: "apps/mobile/App.tsx",
        status: "updated",
        kind: "修改",
        diff: "--- a/apps/mobile/App.tsx\n+++ b/apps/mobile/App.tsx\n+const ok = true;",
        additions: 1,
        deletions: 0,
      },
    ],
  },
]);
const visibleFileChange = turnWithFileChange.find((entry) => entry.fileChanges?.length);
visibleFileChange?.fileChanges?.[0]?.path satisfies string | undefined;
const fileChangeIsAfterFinalAnswer = turnWithFileChange.findIndex((entry) => entry.fileChanges?.length) > turnWithFileChange.findIndex((entry) => entry.title === "Codex");
fileChangeIsAfterFinalAnswer satisfies boolean;
const fileTurnProcessGroup = turnWithFileChange.find(isTurnProcessGroup);
fileTurnProcessGroup?.processEntries?.[0]?.title satisfies string | undefined;

const inProgressTurnWithFileChange = prepareThreadDetailTimeline([
  {
    id: "turn-4:user",
    turnId: "turn-4",
    role: "user",
    title: "You",
    body: "改文件中",
  },
  {
    id: "turn-4:file-change",
    turnId: "turn-4",
    role: "tool",
    title: "正在编辑 1 个文件",
    body: "已编辑 1 个文件  +1 -0",
    streaming: true,
    fileChanges: [
      {
        path: "apps/mobile/src/lib/threadFormat.ts",
        status: "updated",
        kind: "修改",
        diff: "--- a/apps/mobile/src/lib/threadFormat.ts\n+++ b/apps/mobile/src/lib/threadFormat.ts\n+const ok = true;",
        additions: 1,
        deletions: 0,
      },
    ],
  },
  {
    id: "turn-4:assistant-streaming",
    turnId: "turn-4",
    role: "assistant",
    title: "Codex",
    body: "还在回复",
    streaming: true,
  },
]);
inProgressTurnWithFileChange.find((entry) => entry.fileChanges?.length)?.title satisfies string | undefined;
inProgressTurnWithFileChange.at(-1)?.fileChanges?.[0]?.path satisfies string | undefined;

const inProgressTurnWithCompletedCommands = prepareThreadDetailTimeline([
  {
    id: "turn-5:user",
    turnId: "turn-5",
    role: "user",
    title: "You",
    body: "跑命令中",
  },
  {
    id: "turn-5:cmd-1",
    turnId: "turn-5",
    role: "tool",
    variant: "command",
    title: "已运行 pnpm typecheck",
    body: "",
    commandText: "pnpm typecheck",
    commandStatus: "completed",
  },
  {
    id: "turn-5:cmd-2",
    turnId: "turn-5",
    role: "tool",
    variant: "command",
    title: "已运行 git diff --check",
    body: "",
    commandText: "git diff --check",
    commandStatus: "completed",
  },
  {
    id: "turn-5:assistant-streaming",
    turnId: "turn-5",
    role: "assistant",
    title: "Codex",
    body: "继续回复中",
    streaming: true,
  },
]);
inProgressTurnWithCompletedCommands.find(isTurnProcessGroup)?.processEntries?.find(isCommandGroup)?.commandEntries?.[0]?.commandText satisfies
  | string
  | undefined;

function isWebSearchGroup(entry: TimelineEntry): entry is TimelineEntry & { variant: "webSearchGroup" } {
  return entry.variant === "webSearchGroup";
}

function isTurnProcessGroup(entry: TimelineEntry): entry is TimelineEntry & { variant: "turnProcessGroup" } {
  return entry.variant === "turnProcessGroup";
}

function isCommandGroup(entry: TimelineEntry): entry is TimelineEntry & { variant: "commandGroup" } {
  return entry.variant === "commandGroup";
}
