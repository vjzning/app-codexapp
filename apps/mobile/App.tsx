import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, View } from "react-native";

import { ThreadDetail } from "@/components/ThreadDetail";
import { HomeTabs } from "@/components/app-shell/HomeTabs";
import type { RootTab } from "@/components/app-shell/RootTabBar";
import { useCodexAppServer } from "@/hooks/useCodexAppServer";
import type { Thread } from "@codex-mobile/protocol/v2";

export default function App() {
  const codex = useCodexAppServer();
  const [activeTab, setActiveTab] = useState<RootTab>("threads");
  const [isDraftThread, setIsDraftThread] = useState(false);
  const isDetailView = Boolean(codex.selectedThread);

  const openThread = (thread: Thread) => {
    setIsDraftThread(false);
    void codex.openThread(thread);
  };

  const closeThread = () => {
    setIsDraftThread(false);
    codex.closeThread();
  };

  const startDraftThread = () => {
    setIsDraftThread(true);
  };

  const sendDraftMessage = async (text: string, mentions: Parameters<typeof codex.sendMessage>[1] = []) => {
    const cwd = codex.selectedThread?.cwd ?? codex.recentCwds[0];

    if (!cwd) {
      return;
    }

    await codex.createThread(cwd, text, mentions);
    setIsDraftThread(false);
  };

  if (isDetailView) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.detailScreen}>
          <ThreadDetail
            apps={codex.pickerData.apps}
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
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <HomeTabs activeTab={activeTab} codex={codex} onOpenThread={openThread} onTabChange={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#f4f7fb",
    flex: 1,
    paddingTop: Platform.OS === "android" ? NativeStatusBar.currentHeight ?? 0 : 0,
  },
  detailScreen: {
    flex: 1,
  },
});
