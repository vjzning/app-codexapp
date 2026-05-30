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

  const sendDraftMessage = async (text: string) => {
    const cwd = codex.selectedThread?.cwd ?? codex.recentCwds[0];

    if (!cwd) {
      return;
    }

    await codex.createThread(cwd, text);
    setIsDraftThread(false);
  };

  if (isDetailView) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.detailScreen}>
          <ThreadDetail
            approval={codex.approval}
            hasMoreMessages={isDraftThread ? false : codex.hasMoreMessages}
            isDraft={isDraftThread}
            isLoading={isDraftThread ? false : codex.isOpeningThread}
            isLoadingMore={codex.isLoadingMore}
            isRefreshing={codex.isRefreshingThread}
            isInterrupting={codex.isInterruptingTurn}
            isResponding={isDraftThread ? codex.isCreatingThread : codex.isResponding}
            statusLabel={isDraftThread ? "新会话" : codex.statusLabel}
            onBack={closeThread}
            onCreateNew={startDraftThread}
            onInterrupt={codex.interruptTurn}
            onLoadMore={codex.loadOlderMessages}
            onRefresh={codex.refreshSelectedThread}
            onResolveApproval={codex.resolveApproval}
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
