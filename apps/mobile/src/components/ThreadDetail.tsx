import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

import type { Thread } from "@codex-mobile/protocol/v2";
import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";

import type { TimelineAttachment, TimelineEntry, TimelineFileChange } from "@/lib/threadFormat";
import { threadProjectLabel, threadTitle } from "@/lib/threadFormat";
import { ApprovalCard } from "@/components/approval/ApprovalCard";
import { getApprovalTimelineEntryId, type ApprovalDecision } from "@/components/approval/approvalFormat";
import { DiffModal } from "@/components/thread-detail/DiffModal";
import { ImagePreviewModal } from "@/components/thread-detail/ImagePreviewModal";
import { MessageBubble } from "@/components/thread-detail/MessageBubble";
import { CommandOutputModal } from "@/components/thread-detail/CommandOutputModal";
import { prepareThreadDetailTimeline } from "@/components/thread-detail/timelineDisplay";
import { UserInputRequestCard } from "@/components/user-input/UserInputRequestCard";
import { getUserInputTimelineEntryId } from "@/components/user-input/userInputFormat";
import type { PendingApproval, PendingUserInputRequest } from "@/types/codex";

type Props = {
  thread: Thread | null;
  timeline: TimelineEntry[];
  isDraft?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  isRefreshing?: boolean;
  isInterrupting?: boolean;
  isResponding?: boolean;
  statusLabel?: string | null;
  hasMoreMessages?: boolean;
  approval?: PendingApproval | null;
  userInputRequest?: PendingUserInputRequest | null;
  onBack: () => void;
  onCreateNew?: () => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onSend: (text: string) => void | Promise<void>;
  onRunShellCommand?: (command: string) => void | Promise<void>;
  onInterrupt: () => void;
  onResolveApproval?: (decision: ApprovalDecision) => void;
  onResolveUserInputRequest?: (response: ToolRequestUserInputResponse) => void;
};

export function ThreadDetail({
  thread,
  timeline,
  isDraft = false,
  isLoading = false,
  isLoadingMore = false,
  isRefreshing = false,
  isInterrupting = false,
  isResponding = false,
  statusLabel = null,
  hasMoreMessages = false,
  approval = null,
  userInputRequest = null,
  onBack,
  onCreateNew,
  onLoadMore,
  onRefresh,
  onSend,
  onRunShellCommand,
  onInterrupt,
  onResolveApproval,
  onResolveUserInputRequest,
}: Props) {
  const [message, setMessage] = useState("");
  const [selectedFileChange, setSelectedFileChange] = useState<TimelineFileChange | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<TimelineAttachment | null>(null);
  const [selectedCommandEntry, setSelectedCommandEntry] = useState<TimelineEntry | null>(null);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [commandSheetVisible, setCommandSheetVisible] = useState(false);
  const [shellCommand, setShellCommand] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const listRef = useRef<FlashListRef<TimelineEntry>>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const approvalEntryId = useMemo(() => getApprovalTimelineEntryId(approval), [approval]);
  const userInputEntryId = useMemo(() => getUserInputTimelineEntryId(userInputRequest), [userInputRequest]);
  const listData = useMemo(
    () => prepareThreadDetailTimeline(timeline, { preserveEntryIds: [approvalEntryId, userInputEntryId] }),
    [approvalEntryId, timeline, userInputEntryId],
  );
  const approvalIsInTimeline = useMemo(() => Boolean(approvalEntryId && listData.some((entry) => entry.id === approvalEntryId)), [approvalEntryId, listData]);
  const userInputIsInTimeline = useMemo(
    () => Boolean(userInputEntryId && listData.some((entry) => entry.id === userInputEntryId)),
    [userInputEntryId, listData],
  );
  const emptyStateMinHeight = Math.max(260, windowHeight - 280);

  useEffect(() => {
    if (!isDraft) {
      return;
    }

    setMessage("");
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => clearTimeout(timer);
  }, [isDraft]);

  useEffect(() => {
    if (isLoading || isLoadingMore || listData.length === 0 || !isNearBottomRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [isLoading, isLoadingMore, listData.length]);

  const submit = () => {
    if (!message.trim()) {
      return;
    }
    void onSend(message);
    setMessage("");
  };

  const insertMentionShortcut = (shortcut: "$skill" | "$app") => {
    setMessage((current) => `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}${shortcut} `);
    setToolsVisible(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const openCommandSheet = () => {
    setToolsVisible(false);
    setCommandSheetVisible(true);
  };

  const runShellCommand = async () => {
    const trimmed = shellCommand.trim();

    if (!trimmed || !onRunShellCommand) {
      return;
    }

    await onRunShellCommand(trimmed);
    setShellCommand("");
    setCommandSheetVisible(false);
  };

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < 160;
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: TimelineEntry }) => (
      <MessageBubble
        approval={approval}
        approvalEntryId={approvalEntryId}
        entry={item}
        onOpenAttachment={setSelectedAttachment}
        onOpenCommandOutput={setSelectedCommandEntry}
        workspacePath={thread?.cwd ?? ""}
        onOpenFileChange={setSelectedFileChange}
        onResolveApproval={onResolveApproval}
        userInputEntryId={userInputEntryId}
        userInputRequest={userInputRequest}
        onResolveUserInputRequest={onResolveUserInputRequest}
      />
    ),
    [approval, approvalEntryId, onResolveApproval, onResolveUserInputRequest, thread?.cwd, userInputEntryId, userInputRequest],
  );

  if (!thread) {
    return (
      <SafeAreaView style={styles.panel}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        </View>
        <Text style={styles.empty}>未选择会话</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.panel}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.topMeta}>
          <Text numberOfLines={1} style={styles.project}>
            {threadProjectLabel(thread)}
          </Text>
          <Text numberOfLines={2} style={styles.title}>
            {isDraft ? "新会话" : threadTitle(thread)}
          </Text>
          {statusLabel ? <Text style={styles.statusText}>{statusLabel}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          {onCreateNew ? (
            <Pressable disabled={isDraft} onPress={onCreateNew} style={[styles.headerActionButton, isDraft && styles.headerActionButtonDisabled]}>
              <Text style={styles.headerActionText}>新建</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={isRefreshing || isDraft} onPress={onRefresh} style={[styles.headerActionButton, (isRefreshing || isDraft) && styles.headerActionButtonDisabled]}>
            <Text style={styles.headerActionText}>{isRefreshing ? "..." : "刷新"}</Text>
          </Pressable>
        </View>
      </View>

      {approval && onResolveApproval && !approvalIsInTimeline ? (
        <View style={styles.inlineApproval}>
          <ApprovalCard approval={approval} onResolve={onResolveApproval} />
        </View>
      ) : null}
      {userInputRequest && onResolveUserInputRequest && !userInputIsInTimeline ? (
        <View style={styles.inlineApproval}>
          <UserInputRequestCard request={userInputRequest} onSubmit={onResolveUserInputRequest} />
        </View>
      ) : null}

      <FlashList
        ref={listRef}
        contentContainerStyle={styles.timeline}
        data={listData}
        drawDistance={900}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={MessageSeparator}
        ListEmptyComponent={
          isDraft ? (
            <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
              <Text style={styles.draftTitle}>新会话</Text>
              <Text style={styles.draftText}>直接输入第一条消息开始。</Text>
            </View>
          ) : isLoading ? (
            <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
              <Text style={styles.empty}>正在加载会话消息...</Text>
            </View>
          ) : (
            <View style={[styles.emptyState, { minHeight: emptyStateMinHeight }]}>
              <Text style={styles.empty}>暂无消息明细</Text>
            </View>
          )
        }
        ListHeaderComponent={
          hasMoreMessages ? (
            <Pressable onPress={onLoadMore} style={styles.loadMoreButton}>
              <Text style={styles.loadMoreText}>{isLoadingMore ? "正在加载更早消息..." : "加载更早消息"}</Text>
            </Pressable>
          ) : null
        }
        renderItem={renderMessage}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{
          autoscrollToBottomThreshold: 0.18,
          animateAutoScrollToBottom: true,
          startRenderingFromBottom: true,
        }}
      />
      <DiffModal fileChange={selectedFileChange} onClose={() => setSelectedFileChange(null)} workspacePath={thread.cwd} />
      <CommandOutputModal entry={selectedCommandEntry} onClose={() => setSelectedCommandEntry(null)} />
      <ImagePreviewModal attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} />
      <ComposerToolsModal
        onClose={() => setToolsVisible(false)}
        onInsertApp={() => insertMentionShortcut("$app")}
        onInsertSkill={() => insertMentionShortcut("$skill")}
        onRunCommand={openCommandSheet}
        visible={toolsVisible}
      />
      <ShellCommandModal
        command={shellCommand}
        onChangeCommand={setShellCommand}
        onClose={() => setCommandSheetVisible(false)}
        onSubmit={() => void runShellCommand()}
        visible={commandSheetVisible}
      />

      <View style={styles.composer}>
        <Pressable disabled={isResponding} onPress={() => setToolsVisible(true)} style={[styles.toolButton, isResponding && styles.toolButtonDisabled]}>
          <Text style={styles.toolButtonText}>+</Text>
        </Pressable>
        <TextInput
          ref={inputRef}
          editable={!isResponding}
          multiline
          onChangeText={setMessage}
          placeholder={isDraft ? "输入第一条消息开始新会话" : isResponding ? "等待当前回复结束，或点击取消" : "给当前会话发消息"}
          style={[styles.input, isResponding && styles.inputDisabled]}
          value={message}
        />
        <Pressable
          disabled={isInterrupting}
          onPress={isResponding ? onInterrupt : submit}
          style={[styles.sendButton, isResponding && styles.cancelButton, isInterrupting && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendText}>{isInterrupting ? "..." : isResponding ? "取消" : "发送"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MessageSeparator() {
  return <View style={styles.messageSeparator} />;
}

function ComposerToolsModal({
  visible,
  onClose,
  onRunCommand,
  onInsertSkill,
  onInsertApp,
}: {
  visible: boolean;
  onClose: () => void;
  onRunCommand: () => void;
  onInsertSkill: () => void;
  onInsertApp: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <View style={styles.toolSheet}>
          <Text style={styles.toolSheetTitle}>输入增强</Text>
          <Pressable onPress={onRunCommand} style={styles.toolAction}>
            <Text style={styles.toolActionTitle}>运行命令</Text>
            <Text style={styles.toolActionText}>在当前会话执行 shell command</Text>
          </Pressable>
          <Pressable onPress={onInsertSkill} style={styles.toolAction}>
            <Text style={styles.toolActionTitle}>插入 Skill</Text>
            <Text style={styles.toolActionText}>快速插入 `$skill` 提及</Text>
          </Pressable>
          <Pressable onPress={onInsertApp} style={styles.toolAction}>
            <Text style={styles.toolActionTitle}>插入 App / 插件</Text>
            <Text style={styles.toolActionText}>快速插入 `$app` 提及</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function ShellCommandModal({
  visible,
  command,
  onChangeCommand,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  command: string;
  onChangeCommand: (command: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdropEnd}>
        <View style={styles.commandSheet}>
          <View style={styles.commandSheetHandle} />
          <Text style={styles.commandSheetTitle}>运行命令</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            onChangeText={onChangeCommand}
            placeholder="例如 pnpm typecheck"
            style={styles.commandInput}
            value={command}
          />
          <View style={styles.commandActions}>
            <Pressable onPress={onClose} style={styles.commandCancelButton}>
              <Text style={styles.commandCancelText}>取消</Text>
            </Pressable>
            <Pressable disabled={!command.trim()} onPress={onSubmit} style={[styles.commandRunButton, !command.trim() && styles.commandRunButtonDisabled]}>
              <Text style={styles.commandRunText}>运行</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#eaf0f7",
    flex: 1,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight ?? 0 : 0,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#d8dee8",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topMeta: {
    flex: 1,
    gap: 2,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  backText: {
    color: "#304052",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 28,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    alignItems: "center",
    borderColor: "#cfd7e3",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    minWidth: 52,
    paddingHorizontal: 10,
  },
  headerActionButtonDisabled: {
    opacity: 0.55,
  },
  headerActionText: {
    color: "#304052",
    fontWeight: "700",
  },
  project: {
    color: "#2454d6",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "800",
  },
  statusText: {
    color: "#9b5b00",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    color: "#6b7788",
    fontSize: 13,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  draftTitle: {
    color: "#182230",
    fontSize: 22,
    fontWeight: "900",
  },
  draftText: {
    color: "#6b7788",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  inlineApproval: {
    backgroundColor: "#eaf0f7",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  timeline: {
    paddingBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  messageSeparator: {
    height: 10,
  },
  loadMoreButton: {
    alignItems: "center",
    alignSelf: "center",
    borderColor: "#cfd7e3",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadMoreText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "700",
  },
  composer: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopColor: "#d8dee8",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  toolButton: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  toolButtonText: {
    color: "#2454d6",
    fontSize: 28,
    fontWeight: "500",
    lineHeight: 32,
  },
  input: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlignVertical: "top",
  },
  inputDisabled: {
    backgroundColor: "#eef2f7",
    color: "#6b7788",
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 14,
  },
  cancelButton: {
    backgroundColor: "#b54708",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalBackdrop: {
    backgroundColor: "rgba(24, 34, 48, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  modalBackdropEnd: {
    backgroundColor: "rgba(24, 34, 48, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
  },
  toolSheet: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 8,
    padding: 14,
  },
  toolSheetTitle: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
    paddingBottom: 4,
  },
  toolAction: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  toolActionTitle: {
    color: "#182230",
    fontSize: 14,
    fontWeight: "900",
  },
  toolActionText: {
    color: "#6b7788",
    fontSize: 12,
    lineHeight: 17,
  },
  commandSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 12,
    padding: 14,
    paddingTop: 8,
  },
  commandSheetHandle: {
    alignSelf: "center",
    backgroundColor: "#cfd7e3",
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  commandSheetTitle: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
  },
  commandInput: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  commandActions: {
    flexDirection: "row",
    gap: 10,
  },
  commandCancelButton: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  commandCancelText: {
    color: "#304052",
    fontWeight: "900",
  },
  commandRunButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  commandRunButtonDisabled: {
    opacity: 0.45,
  },
  commandRunText: {
    color: "#ffffff",
    fontWeight: "900",
  },
});
