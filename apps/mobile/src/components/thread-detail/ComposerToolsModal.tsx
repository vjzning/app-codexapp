import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";

import type { Model, PluginSummary, SkillMetadata } from "@codex-mobile/protocol/v2";

import type { ComposerMention } from "@/types/composer";
import { PERMISSION_MODES, type PermissionModeId } from "@/types/permissionMode";

type Props = {
  isLoading?: boolean;
  models: Model[];
  plugins: PluginSummary[];
  selectedModelId: string | null;
  selectedPermissionModeId: PermissionModeId;
  skills: SkillMetadata[];
  visible: boolean;
  onClose: () => void;
  onPickImages: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onRunCommand: () => void;
  onSelectMention: (mention: ComposerMention) => void;
  onSelectModel: (modelId: string) => void;
  onSelectPermissionMode: (modeId: PermissionModeId) => void;
};

type ToolListItem =
  | { type: "quick" }
  | { type: "models" }
  | { type: "permissionModes" }
  | { type: "section"; id: string; title: string }
  | { type: "skill"; skill: SkillMetadata }
  | { type: "plugin"; plugin: PluginSummary }
  | { type: "empty"; id: string; text: string };

export function ComposerToolsModal({
  isLoading = false,
  models,
  plugins,
  selectedModelId,
  selectedPermissionModeId,
  skills,
  visible,
  onClose,
  onPickImages,
  onRefresh,
  onRunCommand,
  onSelectMention,
  onSelectModel,
  onSelectPermissionMode,
}: Props) {
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(640, Math.max(360, windowHeight * 0.78));
  const listHeight = sheetHeight - 58;

  const data = useMemo<ToolListItem[]>(() => {
    const items: ToolListItem[] = [
      { type: "quick" },
      { type: "section", id: "models-title", title: "模型" },
      { type: "models" },
      { type: "section", id: "permissions-title", title: "权限模式" },
      { type: "permissionModes" },
    ];

    items.push({ type: "section", id: "skills-title", title: "Skills" });
    if (skills.length) {
      items.push(...skills.map((skill) => ({ type: "skill" as const, skill })));
    } else {
      items.push({ type: "empty", id: "skills-empty", text: "暂无可用 Skill" });
    }

    items.push({ type: "section", id: "plugins-title", title: "Plugins" });
    if (plugins.length) {
      items.push(...plugins.map((plugin) => ({ type: "plugin" as const, plugin })));
    } else {
      items.push({ type: "empty", id: "plugins-empty", text: "暂无已启用插件" });
    }

    return items;
  }, [plugins, skills]);

  const renderItem = useCallback(
    ({ item }: { item: ToolListItem }) => {
      switch (item.type) {
        case "quick":
          return (
            <View style={styles.quickGrid}>
              <Pressable onPress={() => void onPickImages()} style={styles.quickAction}>
                <Ionicons color="#2454d6" name="image-outline" size={20} />
                <View style={styles.quickTextWrap}>
                  <Text style={styles.actionTitle}>图片</Text>
                  <Text style={styles.actionText}>从手机相册选择</Text>
                </View>
              </Pressable>
              <Pressable onPress={onRunCommand} style={styles.quickAction}>
                <Ionicons color="#2454d6" name="terminal-outline" size={20} />
                <View style={styles.quickTextWrap}>
                  <Text style={styles.actionTitle}>命令</Text>
                  <Text style={styles.actionText}>执行 shell command</Text>
                </View>
              </Pressable>
            </View>
          );
        case "models":
          return (
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
          );
        case "permissionModes":
          return (
            <View style={styles.permissionWrap}>
              {PERMISSION_MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  onPress={() => onSelectPermissionMode(mode.id)}
                  style={[styles.permissionAction, selectedPermissionModeId === mode.id && styles.permissionActionActive, mode.id === "full" && styles.permissionActionDanger]}
                >
                  <View style={styles.permissionTitleRow}>
                    <Text style={[styles.actionTitle, selectedPermissionModeId === mode.id && styles.permissionTitleActive]}>{mode.label}</Text>
                    {selectedPermissionModeId === mode.id ? <Ionicons color={mode.id === "full" ? "#b42318" : "#2454d6"} name="checkmark-circle" size={17} /> : null}
                  </View>
                  <Text style={styles.actionText}>{mode.description}</Text>
                </Pressable>
              ))}
            </View>
          );
        case "section":
          return <Text style={styles.sectionTitle}>{item.title}</Text>;
        case "skill":
          return (
            <Pressable
              onPress={() => onSelectMention({ type: "skill", name: item.skill.name, path: item.skill.path })}
              style={styles.action}
            >
              <Text style={styles.actionTitle}>${item.skill.name}</Text>
              <Text numberOfLines={2} style={styles.actionText}>
                {item.skill.interface?.shortDescription || item.skill.shortDescription || item.skill.description}
              </Text>
            </Pressable>
          );
        case "plugin":
          return (
            <Pressable onPress={() => setActivePluginId(item.plugin.id)} style={[styles.action, activePluginId === item.plugin.id && styles.pluginActionActive]}>
              <View style={styles.pluginTitleRow}>
                <Text numberOfLines={1} style={styles.actionTitle}>
                  {item.plugin.interface?.displayName || item.plugin.name}
                </Text>
                <Text style={styles.pluginBadge}>{activePluginId === item.plugin.id ? "已启用" : item.plugin.source.type}</Text>
              </View>
              <Text numberOfLines={2} style={styles.actionText}>
                {activePluginId === item.plugin.id
                  ? "插件能力已在电脑端启用；可通过上方 Skills 选择具体能力。"
                  : item.plugin.interface?.shortDescription || item.plugin.interface?.longDescription || item.plugin.name}
              </Text>
            </Pressable>
          );
        case "empty":
          return <Text style={styles.emptyText}>{item.text}</Text>;
      }
    },
    [
      activePluginId,
      models,
      onPickImages,
      onRunCommand,
      onSelectMention,
      onSelectModel,
      onSelectPermissionMode,
      selectedModelId,
      selectedPermissionModeId,
    ],
  );

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { height: sheetHeight }]}>
          <View style={styles.header}>
            <Text style={styles.title}>输入增强</Text>
            <Pressable onPress={() => void onRefresh()} style={styles.refreshButton}>
              <Text style={styles.refreshText}>{isLoading ? "..." : "刷新"}</Text>
            </Pressable>
          </View>

          <View style={[styles.listFrame, { height: listHeight }]}>
            <FlashList
              data={data}
              drawDistance={500}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              ItemSeparatorComponent={ToolItemSeparator}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function keyExtractor(item: ToolListItem) {
  switch (item.type) {
    case "quick":
      return "quick";
    case "models":
      return "models";
    case "permissionModes":
      return "permissionModes";
    case "section":
      return item.id;
    case "skill":
      return `skill:${item.skill.path}`;
    case "plugin":
      return `plugin:${item.plugin.id}`;
    case "empty":
      return item.id;
  }
}

function ToolItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  backdrop: {
    backgroundColor: "rgba(24, 34, 48, 0.28)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
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
  list: {
    flex: 1,
  },
  listFrame: {
    overflow: "hidden",
  },
  listContent: {
    paddingBottom: 6,
  },
  separator: {
    height: 8,
  },
  quickGrid: {
    gap: 8,
  },
  quickAction: {
    alignItems: "center",
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickTextWrap: {
    flex: 1,
    gap: 2,
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
  pluginBadge: {
    backgroundColor: "#e8eef8",
    borderRadius: 999,
    color: "#526073",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pluginActionActive: {
    backgroundColor: "#eef4ff",
    borderColor: "#9db7f4",
  },
  pluginTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
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
  permissionWrap: {
    gap: 8,
  },
  permissionAction: {
    backgroundColor: "#f4f7fb",
    borderColor: "#d8dee8",
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  permissionActionActive: {
    backgroundColor: "#eef4ff",
    borderColor: "#9db7f4",
  },
  permissionActionDanger: {
    borderColor: "#f0b8b8",
  },
  permissionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  permissionTitleActive: {
    color: "#2454d6",
  },
  emptyText: {
    color: "#6b7788",
    fontSize: 12,
    paddingVertical: 4,
  },
});
