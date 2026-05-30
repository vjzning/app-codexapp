import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  currentName: string;
  isBusy?: boolean;
  canReview?: boolean;
  visible: boolean;
  onArchive: () => void | Promise<void>;
  onClose: () => void;
  onRename: (name: string) => void | Promise<void>;
  onReview: () => void | Promise<void>;
};

export function ThreadActionsModal({ currentName, isBusy = false, canReview = true, visible, onArchive, onClose, onRename, onReview }: Props) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (visible) {
      setName(currentName);
    }
  }, [currentName, visible]);

  const submitRename = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    await onRename(trimmed);
    onClose();
  };

  const submitArchive = async () => {
    await onArchive();
    onClose();
  };

  const submitReview = async () => {
    await onReview();
    onClose();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>会话操作</Text>
          <View style={styles.renameBox}>
            <Text style={styles.label}>名称</Text>
            <TextInput onChangeText={setName} placeholder="输入会话名称" style={styles.input} value={name} />
            <Pressable disabled={!name.trim() || isBusy} onPress={() => void submitRename()} style={[styles.primaryButton, (!name.trim() || isBusy) && styles.disabled]}>
              <Text style={styles.primaryText}>保存名称</Text>
            </Pressable>
          </View>
          <Pressable disabled={!canReview || isBusy} onPress={() => void submitReview()} style={[styles.actionButton, (!canReview || isBusy) && styles.disabled]}>
            <Text style={styles.actionTitle}>Review 当前改动</Text>
            <Text style={styles.actionText}>在当前会话内启动 Codex reviewer</Text>
          </Pressable>
          <Pressable disabled={isBusy} onPress={() => void submitArchive()} style={[styles.archiveButton, isBusy && styles.disabled]}>
            <Text style={styles.archiveText}>归档会话</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(24, 34, 48, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 12,
    padding: 14,
  },
  title: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
  },
  renameBox: {
    gap: 8,
  },
  label: {
    color: "#6b7788",
    fontSize: 12,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 12,
    minHeight: 42,
    justifyContent: "center",
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  actionButton: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  actionTitle: {
    color: "#182230",
    fontSize: 14,
    fontWeight: "900",
  },
  actionText: {
    color: "#6b7788",
    fontSize: 12,
    lineHeight: 17,
  },
  archiveButton: {
    alignItems: "center",
    backgroundColor: "#fff1f0",
    borderColor: "#ffccc7",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  archiveText: {
    color: "#b42318",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.5,
  },
});
