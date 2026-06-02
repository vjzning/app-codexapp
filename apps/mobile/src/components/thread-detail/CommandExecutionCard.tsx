import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "@/lib/threadFormat";

type Props = {
  entry: TimelineEntry;
  onOpenOutput?: (entry: TimelineEntry) => void;
};

export function CommandExecutionCard({ entry, onOpenOutput }: Props) {
  const isRunning = entry.commandStatus === "inProgress";
  const isFailed = entry.commandStatus === "failed" || entry.commandStatus === "declined" || Boolean(entry.commandExitCode && entry.commandExitCode !== 0);
  const isSuccess = entry.commandStatus === "completed" && (entry.commandExitCode === 0 || entry.commandExitCode === null || entry.commandExitCode === undefined);
  const canOpenOutput = Boolean(onOpenOutput && (entry.commandOutput || entry.body || entry.commandText));
  const commandText = entry.commandText || entry.title;

  return (
    <Pressable
      disabled={!canOpenOutput}
      onPress={() => onOpenOutput?.(entry)}
      style={({ pressed }) => [styles.commandCard, isFailed && styles.commandCardFailed, isSuccess && styles.commandCardSuccess, pressed && styles.commandCardPressed]}
    >
      <View style={styles.commandIcon}>
        {isRunning ? (
          <ActivityIndicator color="#7aa7ff" size="small" />
        ) : (
          <Ionicons color={getIconColor(isFailed, isSuccess)} name={getIconName(isFailed, isSuccess)} size={17} />
        )}
      </View>
      <View style={styles.commandCopy}>
        <Text numberOfLines={1} style={styles.commandTitle}>
          {commandText}
        </Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={[styles.commandStatus, isFailed && styles.commandStatusFailed, isSuccess && styles.commandStatusSuccess]}>
            {formatCommandStatus(entry)}
          </Text>
          {entry.metaLabel ? (
            <Text numberOfLines={1} style={styles.commandMeta}>
              {entry.metaLabel}
            </Text>
          ) : null}
          {entry.commandExitCode !== null && entry.commandExitCode !== undefined ? (
            <Text style={[styles.exitPill, entry.commandExitCode !== 0 && styles.exitPillFailed]}>exit {entry.commandExitCode}</Text>
          ) : null}
        </View>
      </View>
      {canOpenOutput ? (
        <View style={styles.commandIcon}>
          <Ionicons color="#8a94a6" name="chevron-forward" size={16} />
        </View>
      ) : null}
    </Pressable>
  );
}

function getIconName(isFailed: boolean, isSuccess: boolean) {
  if (isFailed) {
    return "alert-circle";
  }

  if (isSuccess) {
    return "checkmark-circle";
  }

  return "terminal-outline";
}

function getIconColor(isFailed: boolean, isSuccess: boolean) {
  if (isFailed) {
    return "#ff6b6b";
  }

  if (isSuccess) {
    return "#44c47d";
  }

  return "#7aa7ff";
}

function formatCommandStatus(entry: TimelineEntry) {
  switch (entry.commandStatus) {
    case "inProgress":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "运行失败";
    case "declined":
      return "已拒绝";
    default:
      return "命令";
  }
}

const styles = StyleSheet.create({
  commandCard: {
    alignItems: "center",
    backgroundColor: "#15171a",
    borderColor: "#2e3338",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    height: 64,
    overflow: "hidden",
    paddingHorizontal: 12,
    width: "100%",
  },
  commandCardPressed: {
    opacity: 0.76,
  },
  commandCardFailed: {
    borderColor: "#6f2b2b",
  },
  commandCardSuccess: {
    borderColor: "#25573b",
  },
  commandIcon: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  commandCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    overflow: "hidden",
  },
  commandTitle: {
    color: "#f2f4f7",
    fontSize: 14,
    fontWeight: "900",
  },
  commandMeta: {
    color: "#9aa4b2",
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  commandStatus: {
    color: "#9aa4b2",
    fontSize: 11,
    fontWeight: "900",
  },
  commandStatusFailed: {
    color: "#ff9b9b",
  },
  commandStatusSuccess: {
    color: "#87d39d",
  },
  exitPill: {
    backgroundColor: "#243128",
    borderRadius: 999,
    color: "#87d39d",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  exitPillFailed: {
    backgroundColor: "#3a2424",
    color: "#ff9b9b",
  },
});
