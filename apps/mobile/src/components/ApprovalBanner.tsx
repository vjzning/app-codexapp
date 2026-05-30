import { ApprovalCard } from "@/components/approval/ApprovalCard";
import type { ApprovalDecision } from "@/components/approval/approvalFormat";
import type { PendingApproval } from "@/types/codex";

type Props = {
  approval: PendingApproval | null;
  compact?: boolean;
  onResolve: (decision: ApprovalDecision) => void;
};

export function ApprovalBanner({ approval, compact = false, onResolve }: Props) {
  return <ApprovalCard approval={approval} compact={compact} onResolve={onResolve} />;
}
