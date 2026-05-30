import { StyleSheet, Text, View } from "react-native";

type Event = {
  id: string;
  method: string;
  text: string;
};

type Props = {
  events: Event[];
  logs: string[];
};

export function EventLog({ events, logs }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>事件</Text>
      {[...logs.map((line, index) => ({ id: `log:${index}`, method: "client", text: line })), ...events].slice(0, 20).map((event) => (
        <View key={event.id} style={styles.event}>
          <Text style={styles.method}>{event.method}</Text>
          <Text style={styles.text}>{event.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
  },
  title: {
    color: "#182230",
    fontSize: 18,
    fontWeight: "800",
  },
  event: {
    backgroundColor: "#ffffff",
    borderColor: "#d8dee8",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  method: {
    color: "#516071",
    fontSize: 11,
    fontWeight: "800",
  },
  text: {
    color: "#182230",
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 16,
  },
});
