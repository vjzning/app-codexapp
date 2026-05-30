import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PendingApproval } from "@/types/codex";

import { formatApprovalDisplay, type ApprovalDecision } from "./approvalFormat";

type Props = {
  approval: PendingApproval | null;
  compact?: boolean;
  onResolve: (decision: ApprovalDecision) => void;
};

export function ApprovalCard({ approval, compact = false, onResolve }: Props) {
  const display = useMemo(() => (approval ? formatApprovalDisplay(approval) : null), [approval]);

  if (!approval || !display) {
    return null;
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, display.tone === "file" && styles.fileIconWrap]}>
          <Ionicons color={display.tone === "file" ? "#2454d6" : "#b54708"} name={display.tone === "file" ? "document-text" : "terminal"} size={18} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{display.title}</Text>
          <Text numberOfLines={compact ? 1 : 2} style={styles.subtitle}>
            {display.subtitle}
          </Text>
        </View>
      </View>
      {display.detail && !compact ? <Text style={styles.detail}>{display.detail}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => onResolve("accept")} style={[styles.actionButton, styles.acceptButton]}>
          <Text style={styles.acceptText}>允许一次</Text>
        </Pressable>
        <Pressable onPress={() => onResolve("acceptForSession")} style={[styles.actionButton, styles.sessionButton]}>
          <Text style={styles.sessionText}>本会话允许</Text>
        </Pressable>
        <Pressable onPress={() => onResolve("decline")} style={[styles.actionButton, styles.declineButton]}>
          <Text style={styles.declineText}>拒绝</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff8eb",
    borderColor: "#f0c77a",
    borderRadius: 14,
    borderWidth: 1,
    gap: 11,
    padding: 12,
  },
  cardCompact: {
    marginBottom: 4,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#ffefd2",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  fileIconWrap: {
    backgroundColor: "#e8f0ff",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#182230",
    fontSize: 15,
    fontWeight: "900",
  },
  subtitle: {
    color: "#516071",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  detail: {
    color: "#4a3a17",
    fontFamily: "Menlo",
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 8,
  },
  acceptButton: {
    backgroundColor: "#1e7b45",
  },
  sessionButton: {
    backgroundColor: "#2454d6",
  },
  declineButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d92d20",
    borderWidth: 1,
  },
  acceptText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  sessionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  declineText: {
    color: "#b42318",
    fontSize: 12,
    fontWeight: "900",
  },
});
