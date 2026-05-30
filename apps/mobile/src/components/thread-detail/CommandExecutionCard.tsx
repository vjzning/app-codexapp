import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "@/lib/threadFormat";

type Props = {
  entry: TimelineEntry;
};

export function CommandExecutionCard({ entry }: Props) {
  const isRunning = entry.commandStatus === "inProgress";
  const isFailed = entry.commandStatus === "failed" || entry.commandStatus === "declined";

  return (
    <View style={styles.commandCard}>
      <View style={styles.commandHeader}>
        <View style={styles.commandIcon}>
          {isRunning ? (
            <ActivityIndicator color="#7aa7ff" size="small" />
          ) : (
            <Ionicons color={isFailed ? "#ff6b6b" : "#7aa7ff"} name={isFailed ? "alert-circle" : "terminal-outline"} size={17} />
          )}
        </View>
        <View style={styles.commandCopy}>
          <Text numberOfLines={1} style={styles.commandTitle}>
            {entry.title}
          </Text>
          {entry.metaLabel ? <Text style={styles.commandMeta}>{entry.metaLabel}</Text> : null}
        </View>
      </View>
      {entry.body ? (
        <Text numberOfLines={6} style={styles.commandOutput}>
          {entry.body}
        </Text>
      ) : null}
    </View>
  );
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
  commandOutput: {
    borderTopColor: "#2e3338",
    borderTopWidth: 1,
    color: "#d0d5dd",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
