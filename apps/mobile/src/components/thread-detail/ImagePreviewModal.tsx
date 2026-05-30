import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { TimelineAttachment } from "@/lib/threadFormat";

import { normalizeImageUri } from "./utils";

type Props = {
  attachment: TimelineAttachment | null;
  onClose: () => void;
};

export function ImagePreviewModal({ attachment, onClose }: Props) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(attachment)}>
      <View style={styles.imagePreviewBackdrop}>
        <Pressable onPress={onClose} style={styles.imagePreviewClose}>
          <Text style={styles.imagePreviewCloseText}>关闭</Text>
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
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    right: 16,
    top: 48,
    zIndex: 2,
  },
  imagePreviewCloseText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});
