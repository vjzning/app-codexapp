import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  error?: string | null;
  isListening: boolean;
  partialText?: string;
  onPress: () => void;
};

export function VoiceInputButton({ error = null, isListening, partialText = "", onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel={isListening ? "停止语音输入" : "开始语音输入"} onPress={onPress} style={[styles.button, isListening && styles.buttonActive]}>
        <Ionicons color={isListening ? "#ffffff" : "#2454d6"} name={isListening ? "mic" : "mic-outline"} size={20} />
      </Pressable>
      {isListening || partialText || error ? (
        <View style={[styles.statusBubble, error && styles.errorBubble]}>
          <Text numberOfLines={1} style={[styles.statusText, error && styles.errorText]}>
            {error || partialText || "正在听..."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  buttonActive: {
    backgroundColor: "#d92d20",
  },
  statusBubble: {
    backgroundColor: "#182230",
    borderRadius: 999,
    bottom: 50,
    maxWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: "absolute",
  },
  errorBubble: {
    backgroundColor: "#fff1f0",
    borderColor: "#ffccc7",
    borderWidth: 1,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  errorText: {
    color: "#b42318",
  },
});
