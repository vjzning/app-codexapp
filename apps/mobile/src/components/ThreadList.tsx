import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Thread } from "@codex-mobile/protocol/v2";

import { formatTime, threadProjectLabel, threadTitle } from "@/lib/threadFormat";

type Props = {
  threads: Thread[];
  selectedThreadId?: string;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onOpen: (thread: Thread) => void;
};

export function ThreadList({ threads, selectedThreadId, isRefreshing = false, onRefresh, onOpen }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const filteredThreads = useMemo(() => filterThreads(threads, searchTerm), [threads, searchTerm]);
  const groups = useMemo(() => groupThreads(filteredThreads), [filteredThreads]);
  const hasSearch = searchTerm.trim().length > 0;

  const toggleGroup = (name: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [name]: !current[name],
    }));
  };

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>会话</Text>
        <Pressable disabled={isRefreshing} onPress={onRefresh} style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}>
          <Text style={styles.refreshText}>{isRefreshing ? "刷新中" : "刷新"}</Text>
        </Pressable>
      </View>
      <View style={styles.searchBox}>
        <Ionicons color="#8a94a6" name="search" size={17} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchTerm}
          placeholder="搜索标题、路径、日期"
          placeholderTextColor="#8a94a6"
          style={styles.searchInput}
          value={searchTerm}
        />
        {hasSearch ? (
          <Pressable onPress={() => setSearchTerm("")} style={styles.clearSearchButton}>
            <Ionicons color="#8a94a6" name="close-circle" size={17} />
          </Pressable>
        ) : null}
      </View>
      {threads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>{isRefreshing ? "正在加载会话..." : "连接后刷新会话列表"}</Text>
        </View>
      ) : null}
      {threads.length > 0 && filteredThreads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>没有匹配的会话</Text>
        </View>
      ) : null}
      {groups.map((group) => {
        const collapsed = Boolean(collapsedGroups[group.name]);
        return (
          <View key={group.name} style={styles.group}>
            <Pressable onPress={() => toggleGroup(group.name)} style={styles.groupHeader}>
              <Ionicons color="#516071" name={collapsed ? "chevron-forward" : "chevron-down"} size={16} />
              <Ionicons color="#7b8797" name={collapsed ? "folder-outline" : "folder-open-outline"} size={17} />
              <Text numberOfLines={1} style={styles.groupTitle}>
                {group.name}
              </Text>
              <Text style={styles.groupCount}>{group.threads.length}</Text>
            </Pressable>
            {collapsed
                ? null
                : group.threads.map((thread) => {
                  const selected = thread.id === selectedThreadId;
                  return (
                    <Pressable key={thread.id} onPress={() => onOpen(thread)} style={[styles.thread, selected && styles.threadSelected]}>
                      <View style={styles.threadBody}>
                        <View style={styles.threadTopLine}>
                          <Text numberOfLines={1} style={styles.threadTitle}>
                            {threadTitle(thread)}
                          </Text>
                          <Text numberOfLines={1} style={styles.timeText}>
                            {formatTime(thread.updatedAt)}
                          </Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Text numberOfLines={1} style={styles.cwd}>
                            {formatThreadCwd(thread.cwd)}
                          </Text>
                          <ThreadStatusIcon thread={thread} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
          </View>
        );
      })}
    </View>
  );
}

function filterThreads(threads: Thread[], searchTerm: string) {
  const normalizedTerm = normalizeSearchText(searchTerm);

  if (!normalizedTerm) {
    return threads;
  }

  return threads.filter((thread) => normalizeSearchText(buildSearchText(thread)).includes(normalizedTerm));
}

function buildSearchText(thread: Thread) {
  const group = getThreadGroup(thread);
  return [
    threadTitle(thread),
    threadProjectLabel(thread),
    thread.cwd,
    formatThreadCwd(thread.cwd),
    group.name,
    group.dateKey,
    formatTime(thread.createdAt),
    formatTime(thread.updatedAt),
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeSearchText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function ThreadStatusIcon({ thread }: { thread: Thread }) {
  if (thread.status.type === "active") {
    return (
      <View style={styles.statusIconWrap}>
        <ActivityIndicator color="#2454d6" size="small" />
      </View>
    );
  }

  if (thread.status.type === "systemError") {
    return (
      <View style={styles.statusIconWrap}>
        <Ionicons color="#d92d20" name="alert-circle" size={18} />
      </View>
    );
  }

  return <View style={styles.statusIconPlaceholder} />;
}

function groupThreads(threads: Thread[]) {
  const buckets = new Map<string, { name: string; kind: "custom" | "codex"; dateKey: string | null; threads: Thread[] }>();

  for (const thread of threads) {
    const group = getThreadGroup(thread);
    const bucket = buckets.get(group.name);
    if (bucket) {
      bucket.threads.push(thread);
    } else {
      buckets.set(group.name, { ...group, threads: [thread] });
    }
  }

  return [...buckets.values()]
    .map((group) => ({
      name: group.name,
      kind: group.kind,
      dateKey: group.dateKey,
      latestUpdatedAt: Math.max(...group.threads.map((thread) => thread.updatedAt || thread.createdAt || 0)),
      threads: [...group.threads].sort(compareThreadsStable),
    }))
    .sort((first, second) => {
      if (first.kind !== second.kind) {
        return first.kind === "custom" ? -1 : 1;
      }

      if (first.kind === "codex" && second.kind === "codex") {
        return (second.dateKey || "").localeCompare(first.dateKey || "");
      }

      const updatedDiff = second.latestUpdatedAt - first.latestUpdatedAt;
      if (updatedDiff !== 0) {
        return updatedDiff;
      }

      return first.name.localeCompare(second.name, "zh-Hans-CN");
    });
}

function getThreadGroup(thread: Thread) {
  const cwd = (thread.cwd || "").replace(/\\/g, "/");
  const codexDateDir = cwd.match(/\/Documents\/Codex\/(\d{4}-\d{2}-\d{2})(?=\/|$)/);

  if (codexDateDir?.[1]) {
    return { name: `Codex / ${codexDateDir[1]}`, kind: "codex" as const, dateKey: codexDateDir[1] };
  }

  return { name: threadProjectLabel(thread), kind: "custom" as const, dateKey: null };
}

function formatThreadCwd(cwd: string) {
  const normalized = (cwd || "").replace(/\\/g, "/");
  const codexWorkspace = normalized.match(/\/Documents\/Codex\/\d{4}-\d{2}-\d{2}\/(.+)$/);

  if (codexWorkspace?.[1]) {
    return codexWorkspace[1];
  }

  const workspacePath = normalized.match(/\/Workspace\/(.+)$/);
  if (workspacePath?.[1]) {
    return workspacePath[1];
  }

  const parts = normalized.split("/").filter(Boolean);
  return parts.slice(-3).join("/") || cwd;
}

function compareThreadsStable(first: Thread, second: Thread) {
  const createdDiff = second.createdAt - first.createdAt;
  if (createdDiff !== 0) {
    return createdDiff;
  }

  const titleDiff = threadTitle(first).localeCompare(threadTitle(second), "zh-Hans-CN");
  if (titleDiff !== 0) {
    return titleDiff;
  }

  return first.id.localeCompare(second.id);
}

const styles = StyleSheet.create({
  panel: {
    gap: 6,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#182230",
    fontSize: 18,
    fontWeight: "800",
  },
  refreshButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  refreshText: {
    color: "#304052",
    fontWeight: "700",
  },
  refreshButtonDisabled: {
    opacity: 0.55,
  },
  empty: {
    color: "#6b7788",
    fontSize: 13,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 280,
    paddingHorizontal: 20,
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: "#182230",
    flex: 1,
    fontSize: 14,
    paddingVertical: 9,
  },
  clearSearchButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  group: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  groupHeader: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupTitle: {
    color: "#182230",
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  groupCount: {
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    color: "#516071",
    fontSize: 11,
    fontWeight: "900",
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    textAlign: "center",
  },
  thread: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  threadSelected: {
    backgroundColor: "#eef4ff",
  },
  threadBody: {
    flex: 1,
    gap: 4,
  },
  threadTopLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  threadTitle: {
    color: "#182230",
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  project: {
    color: "#516071",
    fontSize: 12,
    fontWeight: "700",
  },
  cwd: {
    flex: 1,
    color: "#7b8797",
    fontSize: 12,
  },
  timeText: {
    color: "#8a94a6",
    fontSize: 10,
    maxWidth: 96,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusIconWrap: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  statusIconPlaceholder: {
    width: 22,
  },
});
