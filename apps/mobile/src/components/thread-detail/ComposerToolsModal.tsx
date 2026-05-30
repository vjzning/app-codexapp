import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { AppInfo, Model, SkillMetadata } from "@codex-mobile/protocol/v2";

import type { ComposerMention } from "@/types/composer";

type Props = {
  apps: AppInfo[];
  isLoading?: boolean;
  models: Model[];
  selectedModelId: string | null;
  skills: SkillMetadata[];
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onRunCommand: () => void;
  onSelectMention: (mention: ComposerMention) => void;
  onSelectModel: (modelId: string) => void;
};

export function ComposerToolsModal({
  apps,
  isLoading = false,
  models,
  selectedModelId,
  skills,
  visible,
  onClose,
  onRefresh,
  onRunCommand,
  onSelectMention,
  onSelectModel,
}: Props) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>输入增强</Text>
            <Pressable onPress={() => void onRefresh()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>{isLoading ? "..." : "刷新"}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Pressable onPress={onRunCommand} style={styles.action}>
              <Text style={styles.actionTitle}>运行命令</Text>
              <Text style={styles.actionText}>在当前会话执行 shell command</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>模型</Text>
            <View style={styles.modelWrap}>
              {models.length ? (
                models.map((model) => (
                  <Pressable
                    key={model.model}
                    onPress={() => onSelectModel(model.model)}
                    style={[styles.modelPill, selectedModelId === model.model && styles.modelPillActive]}
                  >
                    <Text style={[styles.modelText, selectedModelId === model.model && styles.modelTextActive]}>{model.displayName || model.model}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptyText}>暂无模型数据</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Skills</Text>
            {skills.length ? (
              skills.map((skill) => (
                <Pressable key={skill.path} onPress={() => onSelectMention({ type: "skill", name: skill.name, path: skill.path })} style={styles.action}>
                  <Text style={styles.actionTitle}>${skill.name}</Text>
                  <Text numberOfLines={2} style={styles.actionText}>
                    {skill.interface?.shortDescription || skill.shortDescription || skill.description}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>暂无可用 Skill</Text>
            )}

            <Text style={styles.sectionTitle}>Apps</Text>
            {apps.length ? (
              apps.map((app) => (
                <Pressable key={app.id} onPress={() => onSelectMention({ type: "app", id: app.id, name: app.name })} style={styles.action}>
                  <Text style={styles.actionTitle}>${app.id}</Text>
                  <Text numberOfLines={2} style={styles.actionText}>
                    {app.description || app.name}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyText}>暂无可用 App</Text>
            )}
          </ScrollView>
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
    maxHeight: "82%",
    padding: 14,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
  },
  refreshButton: {
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 6,
  },
  action: {
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
  sectionTitle: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
    textTransform: "uppercase",
  },
  modelWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modelPill: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modelPillActive: {
    backgroundColor: "#2454d6",
    borderColor: "#2454d6",
  },
  modelText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "800",
  },
  modelTextActive: {
    color: "#ffffff",
  },
  emptyText: {
    color: "#6b7788",
    fontSize: 12,
    paddingVertical: 4,
  },
});
