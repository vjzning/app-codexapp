import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";
import { memo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";

import { ApprovalCard } from "@/components/approval/ApprovalCard";
import type { ApprovalDecision } from "@/components/approval/approvalFormat";
import { UserInputRequestCard } from "@/components/user-input/UserInputRequestCard";
import type { TimelineAttachment, TimelineEntry, TimelineFileChange } from "@/lib/threadFormat";
import type { PendingApproval, PendingUserInputRequest } from "@/types/codex";

import { AttachmentGallery } from "./AttachmentGallery";
import { CommandExecutionCard } from "./CommandExecutionCard";
import { CommandGroupCard } from "./CommandGroupCard";
import { FileChangeCard } from "./FileChangeCard";
import { formatMessageTime } from "./utils";

type Props = {
  entry: TimelineEntry;
  workspacePath: string;
  approval?: PendingApproval | null;
  approvalEntryId?: string | null;
  userInputRequest?: PendingUserInputRequest | null;
  userInputEntryId?: string | null;
  onOpenAttachment: (attachment: TimelineAttachment) => void;
  onOpenCommandOutput: (entry: TimelineEntry) => void;
  onOpenFileChange: (fileChange: TimelineFileChange) => void;
  onResolveApproval?: (decision: ApprovalDecision) => void;
  onResolveUserInputRequest?: (response: ToolRequestUserInputResponse) => void;
};

export const MessageBubble = memo(function MessageBubble({
  entry,
  workspacePath,
  approval = null,
  approvalEntryId = null,
  userInputRequest = null,
  userInputEntryId = null,
  onOpenAttachment,
  onOpenCommandOutput,
  onOpenFileChange,
  onResolveApproval,
  onResolveUserInputRequest,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const shouldCollapse = entry.body.length > 1200;
  const fallbackBody = entry.streaming ? "正在生成..." : "(empty)";
  const visibleBody = shouldCollapse && !expanded ? `${entry.body.slice(0, 1200)}\n\n...[tap to expand]` : entry.body || fallbackBody;
  const isFileChange = Boolean(entry.fileChanges?.length);
  const isCommandCard = entry.variant === "command";
  const isCommandGroup = entry.variant === "commandGroup";
  const isToolCard = entry.role === "tool" && (isFileChange || isCommandGroup);
  const canCopy = entry.role === "user" && Boolean(entry.body.trim());
  const shouldRenderMarkdown = entry.role === "assistant" && entry.title === "Codex";
  const showBubbleHeader = entry.role !== "user" || Boolean(entry.metaLabel || entry.streaming || entry.pending || entry.failed);
  const matchedApproval = approval && onResolveApproval && approvalEntryId === entry.id ? approval : null;
  const matchedUserInputRequest = userInputRequest && onResolveUserInputRequest && userInputEntryId === entry.id ? userInputRequest : null;

  const copyMessage = async () => {
    if (!canCopy) {
      return;
    }

    await Clipboard.setStringAsync(entry.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={[styles.messageRow, entry.role === "user" ? styles.messageRowUser : styles.messageRowOther, (isToolCard || isCommandCard) && styles.messageRowFull]}>
      <Pressable
        disabled={!shouldCollapse || isFileChange || isCommandCard || isCommandGroup}
        onPress={() => setExpanded((current) => !current)}
        style={[
          styles.bubble,
          isToolCard || isCommandCard ? styles.toolCardBubble : entry.role === "user" ? styles.userBubble : styles.agentBubble,
          entry.pending && styles.pendingBubble,
          entry.failed && styles.failedBubble,
          entry.streaming && styles.streamingBubble,
        ]}
      >
        {isCommandCard ? <CommandExecutionCard entry={entry} onOpenOutput={onOpenCommandOutput} /> : null}
        {isCommandGroup ? <CommandGroupCard entry={entry} onOpenOutput={onOpenCommandOutput} /> : null}
        {isCommandCard && matchedApproval && onResolveApproval ? <ApprovalCard approval={matchedApproval} onResolve={onResolveApproval} /> : null}
        {isCommandCard && matchedUserInputRequest && onResolveUserInputRequest ? (
          <UserInputRequestCard request={matchedUserInputRequest} onSubmit={onResolveUserInputRequest} />
        ) : null}
        {isToolCard || isCommandCard || !showBubbleHeader ? null : (
          <View style={styles.bubbleHeader}>
            {entry.role !== "user" ? <Text style={styles.bubbleTitle}>{entry.title}</Text> : null}
            {entry.metaLabel ? <Text style={[styles.metaText, entry.role === "user" && styles.userMetaText]}>{entry.metaLabel}</Text> : null}
            {entry.streaming ? <Text style={styles.streamingText}>生成中</Text> : null}
            {entry.pending ? <Text style={styles.pendingText}>发送中</Text> : null}
            {entry.failed ? <Text style={styles.failedText}>失败</Text> : null}
          </View>
        )}
        {!isCommandCard && !isCommandGroup && entry.attachments?.length ? <AttachmentGallery entry={entry} onOpenAttachment={onOpenAttachment} /> : null}
        {!isCommandCard && entry.fileChanges?.length ? (
          <>
            <FileChangeCard changes={entry.fileChanges} onOpenFileChange={onOpenFileChange} workspacePath={workspacePath} />
            {matchedApproval && onResolveApproval ? <ApprovalCard approval={matchedApproval} onResolve={onResolveApproval} /> : null}
            {matchedUserInputRequest && onResolveUserInputRequest ? (
              <UserInputRequestCard request={matchedUserInputRequest} onSubmit={onResolveUserInputRequest} />
            ) : null}
          </>
        ) : isCommandCard || isCommandGroup ? null : (
          <>
            {entry.body || !entry.attachments?.length ? (
              shouldRenderMarkdown ? (
                <Markdown style={markdownStyles}>{visibleBody}</Markdown>
              ) : (
              <Text style={[styles.bubbleBody, entry.role === "user" && styles.userBubbleBody]}>{visibleBody}</Text>
              )
            ) : null}
            {shouldCollapse ? <Text style={styles.expandHint}>{expanded ? "收起" : "展开全文"}</Text> : null}
            {entry.role === "user" ? (
              <View style={styles.userMessageFooter}>
                {entry.timestampMs ? <Text style={styles.userTimeText}>{formatMessageTime(entry.timestampMs)}</Text> : <View />}
                {canCopy ? (
                  <Pressable onPress={() => void copyMessage()} style={styles.copyButton}>
                    <Text style={styles.copyButtonText}>{copied ? "已复制" : "复制"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {matchedUserInputRequest && onResolveUserInputRequest ? (
              <UserInputRequestCard request={matchedUserInputRequest} onSubmit={onResolveUserInputRequest} />
            ) : null}
          </>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: "row",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageRowFull: {
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 18,
    gap: 5,
    maxWidth: "84%",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#2454d6",
    borderBottomRightRadius: 6,
  },
  pendingBubble: {
    opacity: 0.72,
  },
  failedBubble: {
    backgroundColor: "#fff1f1",
    borderColor: "#f0b8b8",
    borderWidth: 1,
  },
  streamingBubble: {
    borderColor: "#9fb4d8",
  },
  agentBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 6,
    borderColor: "#d8dee8",
    borderWidth: 1,
  },
  toolCardBubble: {
    backgroundColor: "transparent",
    borderRadius: 0,
    maxWidth: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: "100%",
  },
  bubbleHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bubbleTitle: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
  },
  metaText: {
    color: "#7b8797",
    fontSize: 11,
    fontWeight: "700",
  },
  userMetaText: {
    color: "#dce7ff",
  },
  userMessageFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    minHeight: 22,
  },
  userTimeText: {
    color: "#dce7ff",
    fontSize: 11,
    fontWeight: "700",
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 22,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  copyButtonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  pendingText: {
    color: "#6b7788",
    fontSize: 11,
    fontWeight: "700",
  },
  failedText: {
    color: "#9b2222",
    fontSize: 11,
    fontWeight: "800",
  },
  streamingText: {
    color: "#2454d6",
    fontSize: 11,
    fontWeight: "800",
  },
  bubbleBody: {
    color: "#182230",
    fontSize: 14,
    lineHeight: 21,
  },
  userBubbleBody: {
    color: "#ffffff",
  },
  expandHint: {
    color: "#516071",
    fontSize: 11,
    fontWeight: "700",
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: "#182230",
    fontSize: 14,
    lineHeight: 21,
  },
  paragraph: {
    marginBottom: 8,
    marginTop: 0,
  },
  text: {
    color: "#182230",
  },
  strong: {
    fontWeight: "900",
  },
  em: {
    fontStyle: "italic",
  },
  bullet_list: {
    marginBottom: 8,
    marginTop: 0,
  },
  ordered_list: {
    marginBottom: 8,
    marginTop: 0,
  },
  list_item: {
    marginBottom: 4,
  },
  code_inline: {
    backgroundColor: "#eef2f7",
    borderRadius: 5,
    color: "#1f3a5f",
    fontFamily: "Menlo",
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  fence: {
    backgroundColor: "#111827",
    borderRadius: 8,
    color: "#e5e7eb",
    fontFamily: "Menlo",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 4,
    padding: 10,
  },
  code_block: {
    backgroundColor: "#111827",
    borderRadius: 8,
    color: "#e5e7eb",
    fontFamily: "Menlo",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 4,
    padding: 10,
  },
  blockquote: {
    backgroundColor: "#f4f7fb",
    borderLeftColor: "#9fb4d8",
    borderLeftWidth: 3,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  link: {
    color: "#2454d6",
    fontWeight: "800",
  },
  heading1: {
    color: "#182230",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  heading2: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  heading3: {
    color: "#182230",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 6,
  },
});
