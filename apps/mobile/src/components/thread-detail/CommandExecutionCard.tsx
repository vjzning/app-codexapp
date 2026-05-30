import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "@/lib/threadFormat";

import { summarizeCommandOutput } from "./commandOutputSummary";

type Props = {
  entry: TimelineEntry;
  onOpenOutput?: (entry: TimelineEntry) => void;
};

export function CommandExecutionCard({ entry, onOpenOutput }: Props) {
  const isRunning = entry.commandStatus === "inProgress";
  const isFailed = entry.commandStatus === "failed" || entry.commandStatus === "declined" || Boolean(entry.commandExitCode && entry.commandExitCode !== 0);
  const isSuccess = entry.commandStatus === "completed" && (entry.commandExitCode === 0 || entry.commandExitCode === null || entry.commandExitCode === undefined);
  const summary = summarizeCommandOutput(entry.commandOutput || entry.body, entry.commandExitCode);
  const canOpenOutput = Boolean(onOpenOutput && (entry.commandOutput || entry.body || entry.commandText));

  return (
    <View style={[styles.commandCard, isFailed && styles.commandCardFailed, isSuccess && styles.commandCardSuccess]}>
      <View style={styles.commandHeader}>
        <View style={styles.commandIcon}>
          {isRunning ? (
            <ActivityIndicator color="#7aa7ff" size="small" />
          ) : (
            <Ionicons color={getIconColor(isFailed, isSuccess)} name={getIconName(isFailed, isSuccess)} size={17} />
          )}
        </View>
        <View style={styles.commandCopy}>
          <Text numberOfLines={1} style={styles.commandTitle}>
            {entry.title}
          </Text>
          <View style={styles.metaRow}>
            {entry.metaLabel ? <Text style={styles.commandMeta}>{entry.metaLabel}</Text> : null}
            {entry.commandExitCode !== null && entry.commandExitCode !== undefined ? (
              <Text style={[styles.exitPill, entry.commandExitCode !== 0 && styles.exitPillFailed]}>exit {entry.commandExitCode}</Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.summaryBlock}>
        <Text style={[styles.summaryTitle, getSummaryTitleStyle(summary.kind)]}>{summary.title}</Text>
        {summary.lines.length > 0 ? (
          <Text numberOfLines={5} style={styles.commandOutput}>
            {summary.lines.join("\n")}
          </Text>
        ) : null}
        {canOpenOutput ? (
          <Pressable onPress={() => onOpenOutput?.(entry)} style={styles.openOutputButton}>
            <Text style={styles.openOutputText}>查看完整输出</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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

function getSummaryTitleStyle(kind: ReturnType<typeof summarizeCommandOutput>["kind"]) {
  if (kind === "test-failure" || kind === "generic-error") {
    return styles.summaryTitleFailed;
  }

  if (kind === "test-success") {
    return styles.summaryTitleSuccess;
  }

  return null;
}

const styles = StyleSheet.create({
  commandCard: {
    backgroundColor: "#15171a",
    borderColor: "#2e3338",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  commandCardFailed: {
    borderColor: "#6f2b2b",
  },
  commandCardSuccess: {
    borderColor: "#25573b",
  },
  commandHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  commandIcon: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  commandCopy: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
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
  summaryBlock: {
    borderTopColor: "#2e3338",
    borderTopWidth: 1,
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryTitle: {
    color: "#d0d5dd",
    fontSize: 12,
    fontWeight: "900",
  },
  summaryTitleFailed: {
    color: "#ff9b9b",
  },
  summaryTitleSuccess: {
    color: "#87d39d",
  },
  commandOutput: {
    color: "#d0d5dd",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
  },
  openOutputButton: {
    alignSelf: "flex-start",
    backgroundColor: "#252a30",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openOutputText: {
    color: "#f2f4f7",
    fontSize: 11,
    fontWeight: "900",
  },
});
