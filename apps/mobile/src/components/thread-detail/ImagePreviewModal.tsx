import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TimelineAttachment } from "@/lib/threadFormat";

import { normalizeImageUri } from "./utils";

type Props = {
  attachment: TimelineAttachment | null;
  onClose: () => void;
};

export function ImagePreviewModal({ attachment, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(attachment)}>
      <View style={styles.imagePreviewBackdrop}>
        <Pressable
          accessibilityLabel="关闭图片预览"
          hitSlop={10}
          onPress={onClose}
          style={[styles.imagePreviewClose, { top: Math.max(insets.top + 12, 32) }]}
        >
          <Ionicons color="#ffffff" name="close" size={24} />
        </Pressable>
        {attachment ? <Image resizeMode="contain" source={{ uri: normalizeImageUri(attachment.uri) }} style={styles.imagePreview} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  imagePreviewBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 48,
  },
  imagePreview: {
    height: "100%",
    width: "100%",
  },
  imagePreviewClose: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    elevation: 10,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    width: 44,
    zIndex: 2,
  },
});
