import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import type { Model, PluginSummary, SkillMetadata, Thread } from "@codex-mobile/protocol/v2";
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
import { prepareThreadDetailTimeline } from "@/components/thread-detail/timelineDisplay";
import { UserInputRequestCard } from "@/components/user-input/UserInputRequestCard";
import { getUserInputTimelineEntryId } from "@/components/user-input/userInputFormat";
import type { PendingApproval, PendingUserInputRequest } from "@/types/codex";
import type { ComposerImageAttachment, ComposerMention } from "@/types/composer";

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
  isLoadingPickerData?: boolean;
  models?: Model[];
  plugins?: PluginSummary[];
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
  onSend: (text: string, mentions?: ComposerMention[], images?: ComposerImageAttachment[]) => void | Promise<void>;
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
  isLoadingPickerData = false,
  models = [],
  plugins = [],
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
  const [imageAttachments, setImageAttachments] = useState<ComposerImageAttachment[]>([]);
  const [imagePickerError, setImagePickerError] = useState<string | null>(null);
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
  const workspacePath = thread?.cwd ?? "";
  const headerProject = thread ? threadProjectLabel(thread) : "普通会话";
  const headerTitle = isDraft ? "新会话" : thread ? threadTitle(thread) : "未选择会话";
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

  useEffect(() => {
    setMentions((current) => current.filter((mention) => messageHasMention(message, mention)));
  }, [message]);

  const submit = () => {
    if (!message.trim() && !imageAttachments.length) {
      return;
    }
    void onSend(message, mentions, imageAttachments);
    setMessage("");
    setMentions([]);
    setImageAttachments([]);
    setImagePickerError(null);
  };

  const pickImages = async () => {
    setImagePickerError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setImagePickerError("没有相册权限，无法选择图片");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 0.9,
    });

    if (result.canceled) {
      return;
    }

    setImageAttachments((current) => [
      ...current,
      ...result.assets.map((asset, index) => ({
        id: `${asset.assetId ?? asset.uri}:${Date.now()}:${index}`,
        uri: asset.uri,
        name: getImageName(asset.uri, asset.fileName),
        mimeType: asset.mimeType ?? guessMimeType(asset.uri),
        width: asset.width,
        height: asset.height,
      })),
    ]);
    setToolsVisible(false);
  };

  const insertMention = (mention: ComposerMention) => {
    const marker = `$${mention.name}`;
    setMentions((current) =>
      current.some((candidate) => getMentionKey(candidate) === getMentionKey(mention)) ? current : [...current, mention],
    );
    setMessage((current) => `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}${marker} `);
    setToolsVisible(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const removeMention = (mention: ComposerMention) => {
    setMentions((current) => current.filter((candidate) => getMentionKey(candidate) !== getMentionKey(mention)));
    setMessage((current) => removeMentionMarker(current, mention));
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
  const shouldSteer = isResponding && (message.trim().length > 0 || imageAttachments.length > 0);

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
        workspacePath={workspacePath}
        onOpenFileChange={setSelectedFileChange}
        onResolveApproval={onResolveApproval}
        userInputEntryId={userInputEntryId}
        userInputRequest={userInputRequest}
        onResolveUserInputRequest={onResolveUserInputRequest}
      />
    ),
    [approval, approvalEntryId, onResolveApproval, onResolveUserInputRequest, userInputEntryId, userInputRequest, workspacePath],
  );

  if (!thread && !isDraft) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.panel}>
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
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.panel}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.topMeta}>
          <Text numberOfLines={1} style={styles.project}>
            {headerProject}
          </Text>
          <Text numberOfLines={2} style={styles.title}>
            {headerTitle}
          </Text>
          {statusLabel ? <Text style={styles.statusText}>{statusLabel}</Text> : null}
        </View>
        <View style={styles.headerActions}>
          {onCreateNew ? (
            <Pressable
              accessibilityLabel="新建会话"
              disabled={isDraft}
              onPress={onCreateNew}
              style={[styles.headerIconButton, isDraft && styles.headerActionButtonDisabled]}
            >
              <Ionicons color="#304052" name="add" size={22} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="刷新会话"
            disabled={isRefreshing || isDraft || !thread}
            onPress={onRefresh}
            style={[styles.headerIconButton, (isRefreshing || isDraft || !thread) && styles.headerActionButtonDisabled]}
          >
            <Ionicons color="#304052" name="refresh" size={19} />
          </Pressable>
          <Pressable disabled={isDraft || !thread} onPress={() => setActionsVisible(true)} style={[styles.headerIconButton, (isDraft || !thread) && styles.headerActionButtonDisabled]}>
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
      <DiffModal fileChange={selectedFileChange} onClose={() => setSelectedFileChange(null)} workspacePath={workspacePath} />
      <CommandOutputModal entry={selectedCommandEntry} onClose={() => setSelectedCommandEntry(null)} />
      <ImagePreviewModal attachment={selectedAttachment} onClose={() => setSelectedAttachment(null)} />
      <ComposerToolsModal
        isLoading={isLoadingPickerData}
        models={models}
        onClose={() => setToolsVisible(false)}
        onPickImages={pickImages}
        onRefresh={() => void onRefreshPickerData?.()}
        onRunCommand={openCommandSheet}
        onSelectMention={insertMention}
        onSelectModel={(modelId) => {
          onSelectModel?.(modelId);
          setToolsVisible(false);
        }}
        selectedModelId={selectedModelId}
        plugins={plugins}
        skills={skills}
        visible={toolsVisible}
      />
      <ThreadActionsModal
        canReview={!isResponding}
        currentName={thread ? threadTitle(thread) : "新会话"}
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
            {selectedModelLabel ? (
              <View style={styles.composerMetaChip}>
                <Text style={styles.composerMetaText}>模型 {selectedModelLabel}</Text>
              </View>
            ) : null}
            {mentions.map((mention) => (
              <Pressable
                accessibilityLabel={`移除 ${mention.name}`}
                key={getMentionKey(mention)}
                onPress={() => removeMention(mention)}
                style={styles.composerMetaChip}
              >
                <Text style={styles.composerMetaText}>${mention.name} ×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {imageAttachments.length ? (
          <View style={styles.imageComposerStrip}>
            {imageAttachments.map((image) => (
              <View key={image.id} style={styles.imageComposerItem}>
                <Image resizeMode="cover" source={{ uri: image.uri }} style={styles.imageComposerThumb} />
                <Pressable
                  accessibilityLabel={`移除图片 ${image.name}`}
                  onPress={() => setImageAttachments((current) => current.filter((candidate) => candidate.id !== image.id))}
                  style={styles.imageRemoveButton}
                >
                  <Ionicons color="#ffffff" name="close" size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {imagePickerError ? <Text style={styles.composerErrorText}>{imagePickerError}</Text> : null}
        <View style={styles.composer}>
          <Pressable onPress={() => setToolsVisible(true)} style={styles.toolButton}>
            <Text style={styles.toolButtonText}>+</Text>
          </Pressable>
          <TextInput
            ref={inputRef}
            multiline
            onChangeText={setMessage}
            placeholder={isDraft ? "输入第一条消息开始新会话" : isResponding ? "追加指令，或留空点取消" : "给当前会话发消息"}
            style={styles.input}
            value={message}
          />
          <Pressable
            accessibilityLabel={isResponding && !shouldSteer ? "取消回复" : shouldSteer ? "追加消息" : "发送消息"}
            disabled={isInterrupting}
            onPress={isResponding && !shouldSteer ? onInterrupt : submit}
            style={[styles.sendButton, isResponding && !shouldSteer && styles.cancelButton, shouldSteer && styles.steerButton, isInterrupting && styles.sendButtonDisabled]}
          >
            <Ionicons
              color="#ffffff"
              name={isInterrupting ? "hourglass-outline" : shouldSteer ? "arrow-up" : isResponding ? "stop" : "send"}
              size={19}
            />
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
  return `skill:${mention.path}`;
}

function messageHasMention(message: string, mention: ComposerMention) {
  return new RegExp(`(^|\\s)\\$${escapeRegExp(mention.name)}(?=\\s|$)`).test(message);
}

function removeMentionMarker(message: string, mention: ComposerMention) {
  return message.replace(new RegExp(`(^|\\s)\\$${escapeRegExp(mention.name)}(?=\\s|$)`, "g"), " ").replace(/\s+/g, " ").trimStart();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getImageName(uri: string, fileName?: string | null) {
  if (fileName) {
    return fileName;
  }

  return decodeURIComponent(uri.split("/").filter(Boolean).at(-1) || "image.jpg").split("?")[0] || "image.jpg";
}

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();

  if (lower.includes(".png")) {
    return "image/png";
  }

  if (lower.includes(".webp")) {
    return "image/webp";
  }

  if (lower.includes(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
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
  composerMetaChip: {
    alignItems: "center",
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  composerMetaText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
  },
  imageComposerStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  imageComposerItem: {
    backgroundColor: "#edf1f7",
    borderRadius: 10,
    height: 58,
    overflow: "hidden",
    width: 58,
  },
  imageComposerThumb: {
    height: 58,
    width: 58,
  },
  imageRemoveButton: {
    alignItems: "center",
    backgroundColor: "rgba(24, 34, 48, 0.72)",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 22,
  },
  composerErrorText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
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
    width: 44,
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
