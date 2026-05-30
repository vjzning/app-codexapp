import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = {
  defaultCwd?: string | null;
  recentCwds: string[];
  isCreating?: boolean;
  onCreate: (cwd: string, message: string) => void | Promise<void>;
};

export function NewThreadPanel({ defaultCwd = null, recentCwds, isCreating = false, onCreate }: Props) {
  const [cwd, setCwd] = useState(defaultCwd ?? "");
  const [message, setMessage] = useState("");
  const canCreate = Boolean(cwd.trim() && message.trim() && !isCreating);
  const cwdOptions = useMemo(() => recentCwds.slice(0, 4), [recentCwds]);

  useEffect(() => {
    if (!cwd && defaultCwd) {
      setCwd(defaultCwd);
    }
  }, [cwd, defaultCwd]);

  const submit = () => {
    if (!canCreate) {
      return;
    }

    void onCreate(cwd.trim(), message.trim());
    setMessage("");
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>新对话</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setCwd}
        placeholder="/path/to/workspace"
        style={styles.input}
        value={cwd}
      />
      {cwdOptions.length > 0 ? (
        <View style={styles.cwdOptions}>
          {cwdOptions.map((item) => (
            <Pressable key={item} onPress={() => setCwd(item)} style={styles.cwdOption}>
              <Text numberOfLines={1} style={styles.cwdOptionText}>
                {item.split("/").filter(Boolean).at(-1) || item}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        multiline
        onChangeText={setMessage}
        placeholder="第一条消息"
        style={[styles.input, styles.messageInput]}
        textAlignVertical="top"
        value={message}
      />
      <Pressable disabled={!canCreate} onPress={submit} style={[styles.createButton, !canCreate && styles.createButtonDisabled]}>
        <Text style={styles.createText}>{isCreating ? "创建中..." : "开始"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  title: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    color: "#182230",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageInput: {
    minHeight: 72,
  },
  cwdOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cwdOption: {
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    maxWidth: "48%",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cwdOptionText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "700",
  },
  createButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 999,
    paddingVertical: 11,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
