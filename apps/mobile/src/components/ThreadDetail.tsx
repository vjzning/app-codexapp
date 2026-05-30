import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, View } from "react-native";
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
import { groupCompletedTurnFileChanges } from "@/components/thread-detail/timelineDisplay";
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
  onInterrupt,
  onResolveApproval,
  onResolveUserInputRequest,
}: Props) {
  const [message, setMessage] = useState("");
  const [selectedFileChange, setSelectedFileChange] = useState<TimelineFileChange | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<TimelineAttachment | null>(null);
  const [selectedCommandEntry, setSelectedCommandEntry] = useState<TimelineEntry | null>(null);
  const listRef = useRef<FlashListRef<TimelineEntry>>(null);
  const inputRef = useRef<TextInput>(null);
  const isNearBottomRef = useRef(true);
  const approvalEntryId = useMemo(() => getApprovalTimelineEntryId(approval), [approval]);
  const listData = useMemo(() => groupCompletedTurnFileChanges(timeline, { preserveEntryId: approvalEntryId }), [approvalEntryId, timeline]);
  const approvalIsInTimeline = useMemo(() => Boolean(approvalEntryId && listData.some((entry) => entry.id === approvalEntryId)), [approvalEntryId, listData]);
  const userInputEntryId = useMemo(() => getUserInputTimelineEntryId(userInputRequest), [userInputRequest]);
  const userInputIsInTimeline = useMemo(
    () => Boolean(userInputEntryId && listData.some((entry) => entry.id === userInputEntryId)),
    [userInputEntryId, listData],
  );

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
            <View style={styles.draftEmpty}>
              <Text style={styles.draftTitle}>新会话</Text>
              <Text style={styles.draftText}>直接输入第一条消息开始。</Text>
            </View>
          ) : isLoading ? (
            <Text style={styles.empty}>正在加载会话消息...</Text>
          ) : (
            <Text style={styles.empty}>暂无消息明细</Text>
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

      <View style={styles.composer}>
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
  },
  draftEmpty: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 120,
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
});
