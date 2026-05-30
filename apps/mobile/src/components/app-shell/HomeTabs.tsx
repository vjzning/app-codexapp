import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ApprovalBanner } from "@/components/ApprovalBanner";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { EventLog } from "@/components/EventLog";
import { ThreadList } from "@/components/ThreadList";
import { UserInputRequestCard } from "@/components/user-input/UserInputRequestCard";
import type { CodexAppServerState } from "@/hooks/useCodexAppServer";
import type { Thread } from "@codex-mobile/protocol/v2";

import { RootTabBar, type RootTab } from "./RootTabBar";

type Props = {
  activeTab: RootTab;
  codex: CodexAppServerState;
  onCreateThread: () => void;
  onOpenThread: (thread: Thread) => void;
  onTabChange: (tab: RootTab) => void;
};

export function HomeTabs({ activeTab, codex, onCreateThread, onOpenThread, onTabChange }: Props) {
  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Codex</Text>
          <Text style={styles.subtitle}>{activeTab === "connection" ? "连接管理" : "会话"}</Text>
        </View>
        <Text style={[styles.headerBadge, codex.state === "connected" && styles.headerBadgeConnected]}>{codex.state}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "connection" ? (
          <>
            <ConnectionPanel
              state={codex.state}
              readiness={codex.readiness}
              recentError={codex.recentError}
              onConnect={codex.connect}
              onDisconnect={codex.disconnect}
              onProbe={codex.probeReadiness}
            />
            <ApprovalBanner approval={codex.approval} compact onResolve={codex.resolveApproval} />
            <UserInputRequestCard compact request={codex.userInputRequest} onSubmit={codex.resolveUserInputRequest} />
            <EventLog events={codex.events} logs={codex.logs} />
          </>
        ) : (
          <>
            <ApprovalBanner approval={codex.approval} compact onResolve={codex.resolveApproval} />
            <UserInputRequestCard compact request={codex.userInputRequest} onSubmit={codex.resolveUserInputRequest} />
            <ThreadList
              onCreateThread={onCreateThread}
              onOpen={onOpenThread}
              onRefresh={codex.refreshThreads}
              isRefreshing={codex.isRefreshingThreads}
              onRestore={codex.restoreThread}
              onToggleArchived={codex.toggleArchivedThreads}
              showArchived={codex.showArchivedThreads}
              selectedThreadId={codex.selectedThread?.id}
              threads={codex.displayedThreads}
            />
          </>
        )}
      </ScrollView>

      <RootTabBar activeTab={activeTab} onChange={onTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: {
    color: "#121a26",
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    color: "#516071",
    fontSize: 14,
    lineHeight: 20,
  },
  headerBadge: {
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    color: "#516071",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerBadgeConnected: {
    backgroundColor: "#dff7e8",
    color: "#19663b",
  },
});
