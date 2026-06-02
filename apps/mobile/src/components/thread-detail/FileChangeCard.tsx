import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineFileChange } from "@/lib/threadFormat";

import { formatWorkspaceRelativePath } from "./utils";

type Props = {
  changes: TimelineFileChange[];
  workspacePath: string;
  compact?: boolean;
  initialVisibleCount?: number;
  onOpenAllFileChanges?: (fileChanges: TimelineFileChange[]) => void;
  onOpenFileChange: (fileChange: TimelineFileChange) => void;
};

export function FileChangeCard({
  changes,
  workspacePath,
  compact = false,
  initialVisibleCount = 3,
  onOpenAllFileChanges,
  onOpenFileChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const totals = changes.reduce(
    (next, change) => ({
      additions: next.additions + change.additions,
      deletions: next.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
  const hasLineStats = totals.additions > 0 || totals.deletions > 0;
  const visibleChanges = expanded ? changes : changes.slice(0, initialVisibleCount);
  const hiddenCount = Math.max(0, changes.length - visibleChanges.length);
  const lastChange = changes.at(-1);

  if (compact && lastChange) {
    return (
      <Pressable
        onPress={() => {
          if (onOpenAllFileChanges) {
            onOpenAllFileChanges(changes);
            return;
          }

          onOpenFileChange(lastChange);
        }}
        style={styles.compactFileCard}
      >
        <Text style={[styles.statusPill, getStatusPillStyle(lastChange.status)]}>{lastChange.kind}</Text>
        <Text numberOfLines={1} style={styles.compactFileTitle}>
          最后编辑 {formatWorkspaceRelativePath(lastChange.path, workspacePath)}
        </Text>
        {hasLineStats ? (
          <Text style={styles.fileHeaderStats}>
            <Text style={styles.diffAdd}>+{totals.additions}</Text>
            <Text> </Text>
            <Text style={styles.diffDelete}>-{totals.deletions}</Text>
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.fileCard}>
      <Pressable onPress={() => onOpenAllFileChanges?.(changes)} style={styles.fileCardHeader}>
        <Text numberOfLines={1} style={styles.fileHeaderTitle}>
          已编辑 {changes.length} 个文件
        </Text>
        {hasLineStats ? (
          <Text style={styles.fileHeaderStats}>
            <Text style={styles.diffAdd}>+{totals.additions}</Text>
            <Text> </Text>
            <Text style={styles.diffDelete}>-{totals.deletions}</Text>
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.fileRows}>
        {visibleChanges.map((change, index) => (
          <Pressable key={`${change.path}:${index}`} onPress={() => onOpenFileChange(change)} style={styles.fileRow}>
            <Text style={[styles.statusPill, getStatusPillStyle(change.status)]}>{change.kind}</Text>
            <Text numberOfLines={1} style={styles.filePath}>
              {formatWorkspaceRelativePath(change.path, workspacePath)}
            </Text>
            {change.additions > 0 || change.deletions > 0 ? (
              <Text style={styles.rowStats}>
                <Text style={styles.diffAdd}>+{change.additions}</Text>
                <Text> </Text>
                <Text style={styles.diffDelete}>-{change.deletions}</Text>
              </Text>
            ) : null}
          </Pressable>
        ))}
        {hiddenCount > 0 || (expanded && changes.length > initialVisibleCount) ? (
          <Pressable onPress={() => setExpanded((current) => !current)} style={styles.expandButton}>
            <Text style={styles.expandText}>{expanded ? "收起" : `展开全部 ${changes.length} 个文件`}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function getStatusPillStyle(status: TimelineFileChange["status"]) {
  switch (status) {
    case "added":
      return styles.statusAdded;
    case "deleted":
      return styles.statusDeleted;
    case "moved":
      return styles.statusMoved;
    case "updated":
      return styles.statusUpdated;
  }
}

const styles = StyleSheet.create({
  compactFileCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    width: "100%",
  },
  compactFileTitle: {
    color: "#304052",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  fileCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 78,
    overflow: "hidden",
    width: "100%",
  },
  fileCardHeader: {
    alignItems: "center",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileHeaderTitle: {
    color: "#182230",
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  fileHeaderStats: {
    fontSize: 12,
    fontWeight: "900",
  },
  fileRows: {
    paddingVertical: 4,
  },
  fileRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filePath: {
    color: "#304052",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    minWidth: 38,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
    textAlign: "center",
  },
  statusAdded: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusDeleted: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusMoved: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  statusUpdated: {
    backgroundColor: "#eef2ff",
    color: "#3730a3",
  },
  rowStats: {
    fontSize: 11,
    fontWeight: "900",
  },
  expandButton: {
    alignItems: "center",
    borderTopColor: "#edf1f7",
    borderTopWidth: 1,
    paddingVertical: 9,
  },
  expandText: {
    color: "#2454d6",
    fontSize: 12,
    fontWeight: "900",
  },
  diffAdd: {
    color: "#1d8f54",
  },
  diffDelete: {
    color: "#d92d20",
  },
});
