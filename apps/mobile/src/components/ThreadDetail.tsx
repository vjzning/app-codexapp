import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AppInfo, Model, SkillMetadata, Thread } from "@codex-mobile/protocol/v2";
import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";

import type { TimelineAttachment, TimelineEntry, TimelineFileChange } from "@/lib/threadFormat";
import { threadProjectLabel, threadTitle } from "@/lib/threadFormat";
import { ApprovalCard } from "@/components/approval/ApprovalCard";
import { getApprovalTimelineEntryId, type ApprovalDecision } from "@/components/approval/approvalFormat";
import { ComposerToolsModal } from "@/components/thread-detail/ComposerToolsModal";
import { DiffModal } from "@/components/thread-detail/DiffModal";
import { ImagePreviewModal } from "@/components/thread-detail/ImagePreviewModal";
import { MessageBubble } from "@/components/thread-detail/MessageBubble";
import { CommandOutputModal } from "@/components/thread-detail/CommandOutputModal";
import { ThreadActionsModal } from "@/components/thread-detail/ThreadActionsModal";
import { VoiceInputButton } from "@/components/thread-detail/VoiceInputButton";
import { prepareThreadDetailTimeline } from "@/components/thread-detail/timelineDisplay";
import { UserInputRequestCard } from "@/components/user-input/UserInputRequestCard";
import { getUserInputTimelineEntryId } from "@/components/user-input/userInputFormat";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { PendingApproval, PendingUserInputRequest } from "@/types/codex";
import type { ComposerMention } from "@/types/composer";

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
  apps?: AppInfo[];
  isLoadingPickerData?: boolean;
  models?: Model[];
  selectedModelId?: string | null;
  skills?: SkillMetadata[];
  onBack: () => void;
  onCreateNew?: () => void;
  onArchiveThread?: () => void | Promise<void>;
  onLoadMore: () => void;
  onRefresh: () => void;
  onRefreshPickerData?: () => void | Promise<void>;
  onRenameThread?: (name: string) => void | Promise<void>;
  onReviewThread?: () => void | Promise<void>;
  onSelectModel?: (modelId: string) => void;
  onSend: (text: string, mentions?: ComposerMention[]) => void | Promise<void>;
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
  apps = [],
  isLoadingPickerData = false,
  models = [],
  selectedModelId = null,
  skills = [],
  onBack,
  onCreateNew,
  onArchiveThread,
  onLoadMore,
  onRefresh,
  onRefreshPickerData,
  onRenameThread,
  onReviewThread,
  onSelectModel,
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
  const [actionsVisible, setActionsVisible] = useState(false);
  const [commandSheetVisible, setCommandSheetVisible] = useState(false);
  const [shellCommand, setShellCommand] = useState("");
  const [mentions, setMentions] = useState<ComposerMention[]>([]);
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
  const appendVoiceText = useCallback((text: string) => {
    // 语音识别只负责产出文本，这里统一追加到 composer，避免语音 hook 依赖 UI 状态。
    setMessage((current) => `${current}${current.trim().length ? " " : ""}${text}`);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);
  const voiceInput = useVoiceInput({ onResult: appendVoiceText });

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
    void onSend(message, mentions);
    setMessage("");
    setMentions([]);
  };

  const insertMention = (mention: ComposerMention) => {
    const marker = mention.type === "skill" ? `$${mention.name}` : `$${mention.id}`;
    setMentions((current) =>
      current.some((candidate) => getMentionKey(candidate) === getMentionKey(mention)) ? current : [...current, mention],
    );
    setMessage((current) => `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}${marker} `);
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

  const selectedModelLabel = models.find((model) => model.model === selectedModelId)?.displayName ?? selectedModelId;
  const shouldSteer = isResponding && message.trim().length > 0;

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
          <Pressable disabled={isDraft} onPress={() => setActionsVisible(true)} style={[styles.headerIconButton, isDraft && styles.headerActionButtonDisabled]}>
            <Text style={styles.headerIconText}>⋯</Text>
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
        apps={apps}
        isLoading={isLoadingPickerData}
        models={models}
        onClose={() => setToolsVisible(false)}
        onRefresh={() => void onRefreshPickerData?.()}
        onRunCommand={openCommandSheet}
        onSelectMention={insertMention}
        onSelectModel={(modelId) => {
          onSelectModel?.(modelId);
          setToolsVisible(false);
        }}
        selectedModelId={selectedModelId}
        skills={skills}
        visible={toolsVisible}
      />
      <ThreadActionsModal
        canReview={!isResponding}
        currentName={threadTitle(thread)}
        isBusy={isRefreshing || isResponding}
        onArchive={() => onArchiveThread?.()}
        onClose={() => setActionsVisible(false)}
        onRename={(name) => onRenameThread?.(name)}
        onReview={() => onReviewThread?.()}
        visible={actionsVisible}
      />
      <ShellCommandModal
        command={shellCommand}
        onChangeCommand={setShellCommand}
        onClose={() => setCommandSheetVisible(false)}
        onSubmit={() => void runShellCommand()}
        visible={commandSheetVisible}
      />

      <View style={styles.composerShell}>
        {selectedModelLabel || mentions.length ? (
          <View style={styles.composerMeta}>
            {selectedModelLabel ? <Text style={styles.composerMetaText}>模型 {selectedModelLabel}</Text> : null}
            {mentions.map((mention) => (
              <Text key={getMentionKey(mention)} style={styles.composerMetaText}>
                {mention.type === "skill" ? `$${mention.name}` : `$${mention.id}`}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable onPress={() => setToolsVisible(true)} style={styles.toolButton}>
            <Text style={styles.toolButtonText}>+</Text>
          </Pressable>
          <VoiceInputButton error={voiceInput.error} isListening={voiceInput.isListening} onPress={voiceInput.toggle} partialText={voiceInput.partialText} />
          <TextInput
            ref={inputRef}
            multiline
            onChangeText={setMessage}
            placeholder={isDraft ? "输入第一条消息开始新会话" : isResponding ? "追加指令，或留空点取消" : "给当前会话发消息"}
            style={styles.input}
            value={message}
          />
          <Pressable
            disabled={isInterrupting}
            onPress={isResponding && !shouldSteer ? onInterrupt : submit}
            style={[styles.sendButton, isResponding && !shouldSteer && styles.cancelButton, shouldSteer && styles.steerButton, isInterrupting && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendText}>{isInterrupting ? "..." : shouldSteer ? "追加" : isResponding ? "取消" : "发送"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MessageSeparator() {
  return <View style={styles.messageSeparator} />;
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

function getMentionKey(mention: ComposerMention) {
  return mention.type === "skill" ? `skill:${mention.path}` : `app:${mention.id}`;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#eaf0f7",
    flex: 1,
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
  headerIconButton: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerIconText: {
    color: "#304052",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: -2,
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
  composerShell: {
    backgroundColor: "#ffffff",
    borderTopColor: "#d8dee8",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  composerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  composerMetaText: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 999,
    borderWidth: 1,
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  composer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
  },
  toolButton: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
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
  steerButton: {
    backgroundColor: "#1f7a4d",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalBackdropEnd: {
    backgroundColor: "rgba(24, 34, 48, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
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
