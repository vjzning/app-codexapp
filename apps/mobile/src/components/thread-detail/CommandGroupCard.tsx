import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "@/lib/threadFormat";

const DEFAULT_VISIBLE_COMMANDS = 3;

type Props = {
  entry: TimelineEntry;
  onOpenOutput?: (entry: TimelineEntry) => void;
};

export function CommandGroupCard({ entry, onOpenOutput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const commandEntries = entry.commandEntries ?? [];
  const visibleEntries = expanded ? commandEntries : commandEntries.slice(0, DEFAULT_VISIBLE_COMMANDS);
  const failedCount = useMemo(() => commandEntries.filter(isFailedCommandEntry).length, [commandEntries]);
  const hiddenCount = commandEntries.length - visibleEntries.length;

  return (
    <View style={[styles.card, failedCount > 0 && styles.cardFailed]}>
      <View style={styles.header}>
        <View style={[styles.iconBox, failedCount > 0 && styles.iconBoxFailed]}>
          <Ionicons color={failedCount > 0 ? "#b42318" : "#2e6f40"} name={failedCount > 0 ? "alert-circle" : "terminal-outline"} size={18} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.subtitle}>点击命令查看完整输出</Text>
        </View>
      </View>

      <View style={styles.commandList}>
        {visibleEntries.map((commandEntry) => (
          <Pressable
            key={commandEntry.id}
            disabled={!onOpenOutput}
            onPress={() => onOpenOutput?.(commandEntry)}
            style={styles.commandRow}
          >
            <Ionicons color={getCommandColor(commandEntry)} name={getCommandIcon(commandEntry)} size={15} />
            <View style={styles.commandCopy}>
              <Text numberOfLines={1} style={styles.commandText}>
                {commandEntry.commandText || commandEntry.title}
              </Text>
              <View style={styles.commandMetaRow}>
                <Text style={[styles.commandStatus, isFailedCommandEntry(commandEntry) && styles.commandStatusFailed]}>{formatCommandStatus(commandEntry)}</Text>
                {commandEntry.metaLabel ? <Text style={styles.commandMeta}>{commandEntry.metaLabel}</Text> : null}
                {commandEntry.commandExitCode !== null && commandEntry.commandExitCode !== undefined ? (
                  <Text style={[styles.exitPill, commandEntry.commandExitCode !== 0 && styles.exitPillFailed]}>exit {commandEntry.commandExitCode}</Text>
                ) : null}
              </View>
            </View>
            <Ionicons color="#8a94a6" name="chevron-forward" size={15} />
          </Pressable>
        ))}
      </View>

      {hiddenCount > 0 || expanded ? (
        <Pressable onPress={() => setExpanded((current) => !current)} style={styles.expandButton}>
          <Text style={styles.expandText}>{expanded ? "收起命令" : `展开剩余 ${hiddenCount} 条`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function isFailedCommandEntry(entry: TimelineEntry) {
  return entry.commandStatus === "failed" || entry.commandStatus === "declined" || Boolean(entry.commandExitCode && entry.commandExitCode !== 0);
}

function getCommandIcon(entry: TimelineEntry) {
  if (isFailedCommandEntry(entry)) {
    return "alert-circle";
  }

  return "checkmark-circle";
}

function getCommandColor(entry: TimelineEntry) {
  if (isFailedCommandEntry(entry)) {
    return "#b42318";
  }

  return "#2e6f40";
}

function formatCommandStatus(entry: TimelineEntry) {
  switch (entry.commandStatus) {
    case "completed":
      return "已运行";
    case "failed":
      return "运行失败";
    case "declined":
      return "已拒绝";
    case "inProgress":
      return "运行中";
    default:
      return "命令";
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#cfd7e3",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  cardFailed: {
    borderColor: "#f0b8b8",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: "#eaf7ed",
    borderRadius: 9,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  iconBoxFailed: {
    backgroundColor: "#fff1f1",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#182230",
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    color: "#6b7788",
    fontSize: 11,
    fontWeight: "700",
  },
  commandList: {
    borderTopColor: "#e3e8f0",
    borderTopWidth: 1,
  },
  commandRow: {
    alignItems: "center",
    borderBottomColor: "#edf1f7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commandCopy: {
    flex: 1,
    gap: 3,
  },
  commandText: {
    color: "#182230",
    fontFamily: "Menlo",
    fontSize: 12,
    fontWeight: "800",
  },
  commandMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  commandStatus: {
    color: "#2e6f40",
    fontSize: 10,
    fontWeight: "900",
  },
  commandStatusFailed: {
    color: "#b42318",
  },
  commandMeta: {
    color: "#7b8797",
    fontSize: 10,
    fontWeight: "700",
  },
  exitPill: {
    backgroundColor: "#eaf7ed",
    borderRadius: 999,
    color: "#2e6f40",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  exitPillFailed: {
    backgroundColor: "#fff1f1",
    color: "#b42318",
  },
  expandButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  expandText: {
    color: "#2454d6",
    fontSize: 12,
    fontWeight: "900",
  },
});
