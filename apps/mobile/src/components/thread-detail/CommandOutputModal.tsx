import { useEffect, useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TimelineEntry } from "@/lib/threadFormat";

const OUTPUT_INITIAL_LINE_LIMIT = 300;
const OUTPUT_LINE_INCREMENT = 300;

type Props = {
  entry: TimelineEntry | null;
  onClose: () => void;
};

export function CommandOutputModal({ entry, onClose }: Props) {
  const [lineLimit, setLineLimit] = useState(OUTPUT_INITIAL_LINE_LIMIT);
  const output = entry?.commandOutput || entry?.body || "";
  const outputLines = useMemo(() => (output ? output.split("\n") : ["暂无输出"]), [output]);
  const visibleLines = outputLines.slice(0, lineLimit);

  useEffect(() => {
    setLineLimit(OUTPUT_INITIAL_LINE_LIMIT);
  }, [entry?.id]);

  const copyCommand = async () => {
    if (entry?.commandText) {
      await Clipboard.setStringAsync(entry.commandText);
    }
  };

  const copyOutput = async () => {
    if (output) {
      await Clipboard.setStringAsync(output);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(entry)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={styles.title}>
                {entry?.commandText || "命令输出"}
              </Text>
              <Text style={styles.subtitle}>
                {formatCommandStatus(entry)} {entry?.metaLabel ? `· ${entry.metaLabel}` : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>关闭</Text>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable disabled={!entry?.commandText} onPress={() => void copyCommand()} style={styles.actionButton}>
              <Text style={styles.actionText}>复制命令</Text>
            </Pressable>
            <Pressable disabled={!output} onPress={() => void copyOutput()} style={styles.actionButton}>
              <Text style={styles.actionText}>复制输出</Text>
            </Pressable>
          </View>
          <ScrollView horizontal style={styles.horizontal}>
            <ScrollView contentContainerStyle={styles.outputContent}>
              {visibleLines.map((line, index) => (
                <View key={`${index}:${line.slice(0, 16)}`} style={styles.outputLine}>
                  <Text style={styles.lineNumber}>{index + 1}</Text>
                  <Text style={styles.lineText}>{line || " "}</Text>
                </View>
              ))}
              {lineLimit < outputLines.length ? (
                <Pressable onPress={() => setLineLimit((current) => current + OUTPUT_LINE_INCREMENT)} style={styles.loadMore}>
                  <Text style={styles.loadMoreText}>继续加载 {outputLines.length - lineLimit} 行</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatCommandStatus(entry: TimelineEntry | null) {
  if (!entry) {
    return "";
  }

  if (entry.commandExitCode !== null && entry.commandExitCode !== undefined) {
    return `exit ${entry.commandExitCode}`;
  }

  switch (entry.commandStatus) {
    case "inProgress":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "declined":
      return "已拒绝";
    default:
      return "";
  }
}

const styles = StyleSheet.create({
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111315",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "82%",
    overflow: "hidden",
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#4b5158",
    borderRadius: 999,
    height: 4,
    marginBottom: 8,
    width: 44,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#2e3338",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: "#f2f4f7",
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    color: "#9aa4b2",
    fontSize: 12,
    fontWeight: "800",
  },
  closeButton: {
    backgroundColor: "#252a30",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  closeText: {
    color: "#f2f4f7",
    fontSize: 12,
    fontWeight: "900",
  },
  actions: {
    borderBottomColor: "#2e3338",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButton: {
    backgroundColor: "#252a30",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: "#f2f4f7",
    fontSize: 12,
    fontWeight: "900",
  },
  horizontal: {
    maxHeight: "100%",
  },
  outputContent: {
    minWidth: 720,
    paddingBottom: 22,
    paddingVertical: 10,
  },
  outputLine: {
    flexDirection: "row",
    minHeight: 20,
    paddingRight: 18,
  },
  lineNumber: {
    color: "#6f7782",
    fontFamily: "Menlo",
    fontSize: 11,
    paddingHorizontal: 8,
    textAlign: "right",
    width: 48,
  },
  lineText: {
    color: "#d0d5dd",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 18,
  },
  loadMore: {
    alignItems: "center",
    margin: 12,
    paddingVertical: 10,
  },
  loadMoreText: {
    color: "#7aa7ff",
    fontSize: 12,
    fontWeight: "900",
  },
});
