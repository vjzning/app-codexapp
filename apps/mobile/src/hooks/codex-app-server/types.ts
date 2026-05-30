import type { TimelineEntry } from "@/lib/threadFormat";
import type { Model, PluginSummary, SkillMetadata } from "@codex-mobile/protocol/v2";

export type LiveEvent = {
  id: string;
  method: string;
  text: string;
};

export type PendingEntry = TimelineEntry & {
  threadId: string;
  sourceText: string;
  baselineCount: number;
};

export type NormalizedConnection = {
  socketUrl: string;
  authToken?: string;
};

export type DeltaBuffer = {
  timer: ReturnType<typeof setTimeout> | null;
  chunks: Map<string, { turnId: string; itemId: string; delta: string }>;
};

export type PickerData = {
  models: Model[];
  skills: SkillMetadata[];
  plugins: PluginSummary[];
};
