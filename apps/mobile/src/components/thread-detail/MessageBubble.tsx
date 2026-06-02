import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";
import { Ionicons } from "@expo/vector-icons";
import { memo, useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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
  defaultCollapseWebSearch?: boolean;
  defaultExpandTurnProcess?: boolean;
  compactFileChanges?: boolean;
  compact?: boolean;
  approval?: PendingApproval | null;
  approvalEntryId?: string | null;
  userInputRequest?: PendingUserInputRequest | null;
  userInputEntryId?: string | null;
  onOpenAttachment: (attachment: TimelineAttachment) => void;
  onOpenAllFileChanges: (fileChanges: TimelineFileChange[]) => void;
  onOpenCommandOutput: (entry: TimelineEntry) => void;
  onOpenFileChange: (fileChange: TimelineFileChange) => void;
  onResolveApproval?: (decision: ApprovalDecision) => void;
  onResolveUserInputRequest?: (response: ToolRequestUserInputResponse) => void;
};

export const MessageBubble = memo(function MessageBubble({
  entry,
  workspacePath,
  defaultCollapseWebSearch = false,
  defaultExpandTurnProcess = false,
  compactFileChanges = false,
  compact = false,
  approval = null,
  approvalEntryId = null,
  userInputRequest = null,
  userInputEntryId = null,
  onOpenAttachment,
  onOpenAllFileChanges,
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
  const isWebSearchGroup = entry.variant === "webSearchGroup" || Boolean(entry.webSearchActions?.length);
  const isTurnProcessGroup = entry.variant === "turnProcessGroup";
  const [webSearchExpanded, setWebSearchExpanded] = useState(!defaultCollapseWebSearch);
  const [turnProcessExpanded, setTurnProcessExpanded] = useState(defaultExpandTurnProcess);
  const isToolCard = entry.role === "tool" && (isFileChange || isCommandGroup || isWebSearchGroup || isTurnProcessGroup);
  const canCopy = entry.role === "user" && Boolean(entry.body.trim());
  const shouldRenderMarkdown = entry.role === "assistant" && entry.title === "Codex";
  const shouldShowBubbleTitle = entry.role !== "user" && !shouldRenderMarkdown;
  const shouldShowMetaLabel = Boolean(entry.metaLabel && !shouldRenderMarkdown);
  const showPendingSpinner = entry.role === "user" && entry.pending && !entry.failed;
  const showPendingText = entry.pending && !showPendingSpinner;
  const showBubbleHeader = shouldShowBubbleTitle || Boolean(shouldShowMetaLabel || entry.streaming || showPendingText || entry.failed);
  const matchedApproval = approval && onResolveApproval && approvalEntryId === entry.id ? approval : null;
  const matchedUserInputRequest = userInputRequest && onResolveUserInputRequest && userInputEntryId === entry.id ? userInputRequest : null;

  useEffect(() => {
    if (isWebSearchGroup && defaultCollapseWebSearch) {
      setWebSearchExpanded(false);
    }
  }, [defaultCollapseWebSearch, isWebSearchGroup]);

  useEffect(() => {
    if (isTurnProcessGroup) {
      setTurnProcessExpanded(defaultExpandTurnProcess);
    }
  }, [defaultExpandTurnProcess, isTurnProcessGroup]);

  const copyMessage = async () => {
    if (!canCopy) {
      return;
    }

    await Clipboard.setStringAsync(entry.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <View style={[styles.messageRow, entry.role === "user" ? styles.messageRowUser : styles.messageRowOther, (isToolCard || isCommandCard) && styles.messageRowFull, compact && styles.messageRowCompact]}>
      {showPendingSpinner ? (
        <View style={styles.pendingSpinner}>
          <ActivityIndicator color="#2454d6" size="small" />
        </View>
      ) : null}
      <Pressable
        disabled={((!shouldCollapse || isFileChange || isCommandCard || isCommandGroup) && !isWebSearchGroup && !isTurnProcessGroup) || (compact && !isWebSearchGroup)}
        onPress={() => {
          if (isTurnProcessGroup) {
            setTurnProcessExpanded((current) => !current);
            return;
          }

          if (isWebSearchGroup) {
            setWebSearchExpanded((current) => !current);
            return;
          }

          setExpanded((current) => !current);
        }}
        style={[
          styles.bubble,
          isToolCard || isCommandCard ? styles.toolCardBubble : entry.role === "user" ? styles.userBubble : styles.agentBubble,
          compact && styles.compactBubble,
          entry.pending && styles.pendingBubble,
          entry.failed && styles.failedBubble,
          entry.streaming && styles.streamingBubble,
        ]}
      >
        {isCommandCard ? <CommandExecutionCard entry={entry} onOpenOutput={onOpenCommandOutput} /> : null}
        {isCommandGroup ? <CommandGroupCard entry={entry} onOpenOutput={onOpenCommandOutput} /> : null}
        {isWebSearchGroup ? <WebSearchSummary entry={entry} expanded={webSearchExpanded} /> : null}
        {isTurnProcessGroup ? (
          <TurnProcessSummary
            compact={compact}
            entry={entry}
            expanded={turnProcessExpanded}
            onOpenAttachment={onOpenAttachment}
            onOpenAllFileChanges={onOpenAllFileChanges}
            onOpenCommandOutput={onOpenCommandOutput}
            onOpenFileChange={onOpenFileChange}
            workspacePath={workspacePath}
          />
        ) : null}
        {isCommandCard && matchedApproval && onResolveApproval ? <ApprovalCard approval={matchedApproval} onResolve={onResolveApproval} /> : null}
        {isCommandCard && matchedUserInputRequest && onResolveUserInputRequest ? (
          <UserInputRequestCard request={matchedUserInputRequest} onSubmit={onResolveUserInputRequest} />
        ) : null}
        {isToolCard || isCommandCard || !showBubbleHeader ? null : (
          <View style={styles.bubbleHeader}>
            {shouldShowBubbleTitle ? <Text style={styles.bubbleTitle}>{entry.title}</Text> : null}
            {shouldShowMetaLabel ? <Text style={[styles.metaText, entry.role === "user" && styles.userMetaText]}>{entry.metaLabel}</Text> : null}
            {entry.streaming ? <Text style={styles.streamingText}>生成中</Text> : null}
            {showPendingText ? <Text style={styles.pendingText}>发送中</Text> : null}
            {entry.failed ? <Text style={styles.failedText}>失败</Text> : null}
          </View>
        )}
        {!isCommandCard && !isCommandGroup && entry.attachments?.length ? <AttachmentGallery entry={entry} onOpenAttachment={onOpenAttachment} /> : null}
        {!isCommandCard && entry.fileChanges?.length ? (
          <>
            <FileChangeCard
              changes={entry.fileChanges}
              compact={compactFileChanges}
              onOpenAllFileChanges={onOpenAllFileChanges}
              onOpenFileChange={onOpenFileChange}
              workspacePath={workspacePath}
            />
            {matchedApproval && onResolveApproval ? <ApprovalCard approval={matchedApproval} onResolve={onResolveApproval} /> : null}
            {matchedUserInputRequest && onResolveUserInputRequest ? (
              <UserInputRequestCard request={matchedUserInputRequest} onSubmit={onResolveUserInputRequest} />
            ) : null}
          </>
        ) : isCommandCard || isCommandGroup || isWebSearchGroup || isTurnProcessGroup ? null : (
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
                  // 用户消息 footer 空间有限，复制用图标避免和时间挤在一起。
                  <Pressable onPress={() => void copyMessage()} style={styles.copyButton}>
                    <Ionicons color="#ffffff" name={copied ? "checkmark" : "copy-outline"} size={13} />
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

function WebSearchSummary({ entry, expanded }: { entry: TimelineEntry; expanded: boolean }) {
  const actions = entry.webSearchActions ?? [];
  const title = entry.streaming ? `正在搜索网页 ${actions.length || 1} 次` : entry.title;

  return (
    <View style={styles.webSearchPanel}>
      <View style={styles.webSearchHeader}>
        <View style={styles.webSearchTitleRow}>
          <Ionicons color="#516071" name="globe-outline" size={18} />
          <Text style={styles.webSearchTitle}>{title}</Text>
        </View>
        <Ionicons color="#7b8797" name={expanded ? "chevron-up" : "chevron-down"} size={18} />
      </View>
      {expanded ? (
        <View style={styles.webSearchActions}>
          {actions.map((action) => (
            <View key={action.id} style={styles.webSearchActionRow}>
              <Ionicons color="#6b7788" name={getWebSearchIconName(action.icon)} size={16} />
              <View style={styles.webSearchActionText}>
                <Text style={styles.webSearchActionLabel}>{action.label}</Text>
                <Text numberOfLines={2} style={styles.webSearchActionDetail}>
                  {action.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TurnProcessSummary({
  compact,
  entry,
  expanded,
  workspacePath,
  onOpenAttachment,
  onOpenAllFileChanges,
  onOpenCommandOutput,
  onOpenFileChange,
}: {
  compact: boolean;
  entry: TimelineEntry;
  expanded: boolean;
  workspacePath: string;
  onOpenAttachment: (attachment: TimelineAttachment) => void;
  onOpenAllFileChanges: (fileChanges: TimelineFileChange[]) => void;
  onOpenCommandOutput: (entry: TimelineEntry) => void;
  onOpenFileChange: (fileChange: TimelineFileChange) => void;
}) {
  const processEntries = entry.processEntries ?? [];

  return (
    <View style={styles.turnProcessPanel}>
      <View style={styles.turnProcessHeader}>
        <View style={styles.turnProcessTitleRow}>
          <Text style={styles.turnProcessTitle}>{entry.title}</Text>
          {processEntries.length ? <Text style={styles.turnProcessCount}>{processEntries.length} 项</Text> : null}
        </View>
        {!compact ? <Ionicons color="#7b8797" name={expanded ? "chevron-up" : "chevron-forward"} size={18} /> : null}
      </View>
      {expanded ? (
        <View style={styles.turnProcessEntries}>
          {processEntries.map((processEntry) => (
            <MessageBubble
              key={processEntry.id}
              compact
              defaultCollapseWebSearch={processEntry.variant === "webSearchGroup"}
              entry={processEntry}
              onOpenAttachment={onOpenAttachment}
              onOpenAllFileChanges={onOpenAllFileChanges}
              onOpenCommandOutput={onOpenCommandOutput}
              onOpenFileChange={onOpenFileChange}
              workspacePath={workspacePath}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function getWebSearchIconName(icon: NonNullable<TimelineEntry["webSearchActions"]>[number]["icon"]) {
  switch (icon) {
    case "search":
      return "search-outline";
    case "open":
      return "open-outline";
    case "find":
      return "document-text-outline";
    case "other":
      return "globe-outline";
  }
}

const styles = StyleSheet.create({
  messageRow: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%",
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
  messageRowCompact: {
    justifyContent: "flex-start",
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
  pendingSpinner: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    marginRight: 8,
    width: 26,
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
    backgroundColor: "transparent",
    borderRadius: 0,
    maxWidth: "100%",
    paddingHorizontal: 0,
    paddingVertical: 2,
    width: "100%",
  },
  toolCardBubble: {
    backgroundColor: "transparent",
    borderRadius: 0,
    maxWidth: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: "100%",
  },
  compactBubble: {
    maxWidth: "100%",
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
    gap: 12,
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
    height: 24,
    justifyContent: "center",
    width: 24,
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
  turnProcessPanel: {
    backgroundColor: "transparent",
    borderBottomColor: "#d8dee8",
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  turnProcessHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 30,
    paddingHorizontal: 2,
  },
  turnProcessTitleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
  },
  turnProcessTitle: {
    color: "#6b7788",
    fontSize: 15,
    fontWeight: "900",
  },
  turnProcessCount: {
    color: "#8a94a6",
    fontSize: 12,
    fontWeight: "800",
  },
  turnProcessEntries: {
    gap: 8,
    paddingTop: 8,
  },
  webSearchPanel: {
    backgroundColor: "#f6f8fb",
    borderColor: "#d8dee8",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  webSearchHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 26,
  },
  webSearchTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
  },
  webSearchTitle: {
    color: "#516071",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  webSearchActions: {
    borderTopColor: "#e1e6ee",
    borderTopWidth: 1,
    gap: 9,
    marginTop: 8,
    paddingTop: 8,
  },
  webSearchActionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  webSearchActionText: {
    flex: 1,
    gap: 2,
  },
  webSearchActionLabel: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
  },
  webSearchActionDetail: {
    color: "#6b7788",
    fontSize: 13,
    lineHeight: 18,
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
