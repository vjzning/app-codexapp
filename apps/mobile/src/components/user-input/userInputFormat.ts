import type { PendingUserInputRequest } from "@/types/codex";

export function getUserInputTimelineEntryId(request: PendingUserInputRequest | null) {
  if (!request) {
    return null;
  }

  return `${request.params.turnId}:${request.params.itemId}`;
}
