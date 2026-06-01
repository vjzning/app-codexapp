import type { FileUpdateChange, TurnPlanStep } from "@codex-mobile/protocol/v2";

import {
  applyMcpToolCallProgress,
  applyReasoningDelta,
  applyThreadCompacted,
  applyFileChangePatchUpdated,
  applyPlanDelta,
  applyTurnDiffUpdated,
  applyTurnPlanUpdated,
} from "./timelineState";

const plan: TurnPlanStep[] = [
  { step: "检查协议", status: "completed" },
  { step: "接入通知", status: "inProgress" },
];

const fileChanges: FileUpdateChange[] = [
  {
    path: "apps/mobile/App.tsx",
    kind: { type: "update", move_path: null },
    diff: "--- a/apps/mobile/App.tsx\n+++ b/apps/mobile/App.tsx\n+const ok = true;",
  },
];

const afterPlan = applyTurnPlanUpdated([], "turn-1", "按计划推进", plan);
afterPlan[0]?.title satisfies string | undefined;

const afterPlanDelta = applyPlanDelta(afterPlan, "turn-1", "plan-item", "增量计划");
afterPlanDelta[0]?.streaming satisfies boolean | undefined;

const afterDiff = applyTurnDiffUpdated(afterPlanDelta, "turn-1", fileChanges[0]?.diff ?? "");
afterDiff[0]?.fileChanges?.[0]?.status satisfies "added" | "deleted" | "updated" | "moved" | undefined;

const afterPatch = applyFileChangePatchUpdated(afterDiff, "turn-1", "file-item", fileChanges);
afterPatch[0]?.fileChanges?.[0]?.path satisfies string | undefined;

const afterReasoning = applyReasoningDelta(afterPatch, "turn-1", "reasoning-item", "推理中", "Reasoning");
afterReasoning[0]?.title satisfies string | undefined;

const afterMcp = applyMcpToolCallProgress(afterReasoning, "turn-1", "mcp-item", "正在读取资源");
afterMcp[0]?.body satisfies string | undefined;

const afterCompacted = applyThreadCompacted(afterMcp, "turn-1");
afterCompacted[0]?.role satisfies "user" | "assistant" | "tool" | "system" | undefined;
