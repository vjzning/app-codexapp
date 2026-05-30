import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ThreadDetail } from "@/components/ThreadDetail";
import { HomeTabs } from "@/components/app-shell/HomeTabs";
import type { RootTab } from "@/components/app-shell/RootTabBar";
import { useCodexAppServer } from "@/hooks/useCodexAppServer";
import type { Thread } from "@codex-mobile/protocol/v2";
import type { ComposerImageAttachment } from "@/types/composer";

export default function App() {
  const codex = useCodexAppServer();
  const [activeTab, setActiveTab] = useState<RootTab>("threads");
  const [isDraftThread, setIsDraftThread] = useState(false);
  const isDetailView = Boolean(codex.selectedThread) || isDraftThread;

  const openThread = (thread: Thread) => {
    setIsDraftThread(false);
    void codex.openThread(thread);
  };

  const closeThread = () => {
    setIsDraftThread(false);
    codex.closeThread();
  };

  const startDraftThread = () => {
    codex.closeThread();
    setIsDraftThread(true);
  };

  const sendDraftMessage = async (
    text: string,
    mentions: Parameters<typeof codex.sendMessage>[1] = [],
    images: ComposerImageAttachment[] = [],
  ) => {
    await codex.createThread(null, text, mentions, images);
    setIsDraftThread(false);
  };

  if (isDetailView) {
    return (
      <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          <StatusBar style="dark" />
          <View style={styles.detailScreen}>
            <ThreadDetail
              approval={codex.approval}
              userInputRequest={codex.userInputRequest}
              hasMoreMessages={isDraftThread ? false : codex.hasMoreMessages}
              isLoadingPickerData={codex.isLoadingPickerData}
              isDraft={isDraftThread}
              isLoading={isDraftThread ? false : codex.isOpeningThread}
              isLoadingMore={codex.isLoadingMore}
              isRefreshing={codex.isRefreshingThread}
              isInterrupting={codex.isInterruptingTurn}
              isResponding={isDraftThread ? codex.isCreatingThread : codex.isResponding}
              models={codex.pickerData.models}
              plugins={codex.pickerData.plugins}
              selectedModelId={codex.selectedModelId}
              statusLabel={isDraftThread ? "新会话" : codex.statusLabel}
              skills={codex.pickerData.skills}
              onBack={closeThread}
              onArchiveThread={codex.archiveSelectedThread}
              onCreateNew={startDraftThread}
              onInterrupt={codex.interruptTurn}
              onLoadMore={codex.loadOlderMessages}
              onRefresh={codex.refreshSelectedThread}
              onRefreshPickerData={codex.refreshPickerData}
              onRenameThread={codex.renameThread}
              onReviewThread={codex.startCurrentReview}
              onResolveApproval={codex.resolveApproval}
              onResolveUserInputRequest={codex.resolveUserInputRequest}
              onRunShellCommand={codex.runShellCommand}
              onSelectModel={codex.setSelectedModelId}
              onSend={isDraftThread ? sendDraftMessage : codex.sendMessage}
              thread={codex.selectedThread}
              timeline={isDraftThread ? [] : codex.timeline}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <StatusBar style="dark" />
        <HomeTabs activeTab={activeTab} codex={codex} onCreateThread={startDraftThread} onOpenThread={openThread} onTabChange={setActiveTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f4f7fb",
    flex: 1,
  },
  detailScreen: {
    flex: 1,
  },
});
