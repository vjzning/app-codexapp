import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TimelineFileChange } from "@/lib/threadFormat";

import { formatWorkspaceRelativePath } from "./utils";

const DIFF_INITIAL_LINE_LIMIT = 400;
const DIFF_LINE_INCREMENT = 400;

type Props = {
  fileChange: TimelineFileChange | null;
  workspacePath: string;
  onClose: () => void;
};

export function DiffModal({ fileChange, workspacePath, onClose }: Props) {
  const [lineLimit, setLineLimit] = useState(DIFF_INITIAL_LINE_LIMIT);
  const diffLines = useMemo(() => (fileChange?.diff ? fileChange.diff.split("\n") : ["暂无 diff"]), [fileChange?.diff]);
  const visibleLines = diffLines.slice(0, lineLimit);

  useEffect(() => {
    setLineLimit(DIFF_INITIAL_LINE_LIMIT);
  }, [fileChange?.path]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(fileChange)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.diffSheet}>
          <View style={styles.diffSheetHandle} />
          <View style={styles.diffHeader}>
            <View style={styles.diffHeaderCopy}>
              <Text numberOfLines={1} style={styles.diffTitle}>
                {fileChange ? formatWorkspaceRelativePath(fileChange.path, workspacePath) : ""}
              </Text>
              <Text style={styles.diffSubtitle}>
                {fileChange?.kind} <Text style={styles.diffAdd}>+{fileChange?.additions ?? 0}</Text>{" "}
                <Text style={styles.diffDelete}>-{fileChange?.deletions ?? 0}</Text>
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.diffCloseButton}>
              <Text style={styles.diffCloseText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView horizontal style={styles.diffHorizontal}>
            <ScrollView contentContainerStyle={styles.diffContent}>
              {visibleLines.map((line, index) => (
                <View key={`${index}:${line.slice(0, 16)}`} style={[styles.diffLine, getDiffLineStyle(line)]}>
                  <Text style={styles.diffLineNumber}>{index + 1}</Text>
                  <Text style={[styles.diffLineText, getDiffTextStyle(line)]}>{line || " "}</Text>
                </View>
              ))}
              {lineLimit < diffLines.length ? (
                <Pressable onPress={() => setLineLimit((current) => current + DIFF_LINE_INCREMENT)} style={styles.diffLoadMore}>
                  <Text style={styles.diffLoadMoreText}>继续加载 {diffLines.length - lineLimit} 行</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getDiffLineStyle(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return styles.diffLineAdd;
  }

  if (line.startsWith("-") && !line.startsWith("---")) {
    return styles.diffLineDelete;
  }

  if (line.startsWith("@@")) {
    return styles.diffLineMeta;
  }

  return null;
}

function getDiffTextStyle(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return styles.diffTextAdd;
  }

  if (line.startsWith("-") && !line.startsWith("---")) {
    return styles.diffTextDelete;
  }

  if (line.startsWith("@@")) {
    return styles.diffTextMeta;
  }

  return null;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  diffSheet: {
    backgroundColor: "#111315",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "82%",
    overflow: "hidden",
    paddingTop: 8,
  },
  diffSheetHandle: {
    alignSelf: "center",
    backgroundColor: "#4b5158",
    borderRadius: 999,
    height: 4,
    marginBottom: 8,
    width: 44,
  },
  diffHeader: {
    alignItems: "center",
    borderBottomColor: "#2e3338",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  diffHeaderCopy: {
    flex: 1,
    gap: 3,
  },
  diffTitle: {
    color: "#f2f4f7",
    fontSize: 14,
    fontWeight: "900",
  },
  diffSubtitle: {
    color: "#9aa4b2",
    fontSize: 12,
    fontWeight: "800",
  },
  diffCloseButton: {
    backgroundColor: "#252a30",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  diffCloseText: {
    color: "#f2f4f7",
    fontSize: 12,
    fontWeight: "900",
  },
  diffHorizontal: {
    maxHeight: "100%",
  },
  diffContent: {
    minWidth: 720,
    paddingBottom: 22,
    paddingVertical: 10,
  },
  diffLine: {
    flexDirection: "row",
    minHeight: 20,
    paddingRight: 18,
  },
  diffLineAdd: {
    backgroundColor: "rgba(36, 130, 73, 0.18)",
  },
  diffLineDelete: {
    backgroundColor: "rgba(218, 54, 51, 0.18)",
  },
  diffLineMeta: {
    backgroundColor: "rgba(56, 139, 253, 0.16)",
  },
  diffLineNumber: {
    color: "#6f7782",
    fontFamily: "Menlo",
    fontSize: 11,
    paddingHorizontal: 8,
    textAlign: "right",
    width: 52,
  },
  diffLineText: {
    color: "#c9d1d9",
    flexShrink: 0,
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 18,
  },
  diffTextAdd: {
    color: "#7ee787",
  },
  diffTextDelete: {
    color: "#ffa198",
  },
  diffTextMeta: {
    color: "#79c0ff",
    fontWeight: "800",
  },
  diffAdd: {
    color: "#33d17a",
  },
  diffDelete: {
    color: "#ff5f57",
  },
  diffLoadMore: {
    alignItems: "center",
    backgroundColor: "#252a30",
    borderRadius: 999,
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  diffLoadMoreText: {
    color: "#f2f4f7",
    fontSize: 12,
    fontWeight: "900",
  },
});
