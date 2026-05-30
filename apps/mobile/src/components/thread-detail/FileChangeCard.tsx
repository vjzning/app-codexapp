import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineFileChange } from "@/lib/threadFormat";

import { formatWorkspaceRelativePath } from "./utils";

type Props = {
  changes: TimelineFileChange[];
  workspacePath: string;
  onOpenFileChange: (fileChange: TimelineFileChange) => void;
};

export function FileChangeCard({ changes, workspacePath, onOpenFileChange }: Props) {
  const totals = changes.reduce(
    (next, change) => ({
      additions: next.additions + change.additions,
      deletions: next.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 },
  );

  return (
    <View style={styles.fileCard}>
      <View style={styles.fileCardHeader}>
        <Text numberOfLines={1} style={styles.fileHeaderTitle}>
          已编辑 {changes.length} 个文件
        </Text>
        <Text style={styles.fileHeaderStats}>
          <Text style={styles.diffAdd}>+{totals.additions}</Text>
          <Text> </Text>
          <Text style={styles.diffDelete}>-{totals.deletions}</Text>
        </Text>
      </View>
      <View style={styles.fileRows}>
        {changes.map((change) => (
          <Pressable key={change.path} onPress={() => onOpenFileChange(change)} style={styles.fileRow}>
            <Text numberOfLines={1} style={styles.filePath}>
              {formatWorkspaceRelativePath(change.path, workspacePath)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fileCard: {
    backgroundColor: "#15171a",
    borderColor: "#2e3338",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 78,
    overflow: "hidden",
    width: "100%",
  },
  fileCardHeader: {
    alignItems: "center",
    borderBottomColor: "#2e3338",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileHeaderTitle: {
    color: "#f2f4f7",
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
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filePath: {
    color: "#f2f4f7",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  diffAdd: {
    color: "#33d17a",
  },
  diffDelete: {
    color: "#ff5f57",
  },
});
