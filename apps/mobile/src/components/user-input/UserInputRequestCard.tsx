import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { ToolRequestUserInputResponse } from "@codex-mobile/protocol/v2";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { PendingUserInputRequest } from "@/types/codex";

type Props = {
  compact?: boolean;
  request: PendingUserInputRequest | null;
  onSubmit: (response: ToolRequestUserInputResponse) => void;
};

export function UserInputRequestCard({ compact = false, request, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = request?.params.questions ?? [];
  const canSubmit = useMemo(
    () => questions.length > 0 && questions.every((question) => Boolean(answers[question.id]?.trim())),
    [answers, questions],
  );

  useEffect(() => {
    setAnswers({});
  }, [request?.id]);

  if (!request || questions.length === 0) {
    return null;
  }

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    const response: ToolRequestUserInputResponse = {
      answers: Object.fromEntries(
        questions.map((question) => [
          question.id,
          {
            answers: [answers[question.id].trim()],
          },
        ]),
      ),
    };

    onSubmit(response);
  };

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons color="#2454d6" name="help-buoy" size={18} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Codex 需要你确认</Text>
          <Text numberOfLines={compact ? 1 : 2} style={styles.subtitle}>
            {questions.length === 1 ? questions[0]?.header || "请回答问题" : `${questions.length} 个问题待回答`}
          </Text>
        </View>
      </View>

      {questions.map((question) => {
        const selectedAnswer = answers[question.id] ?? "";
        return (
          <View key={question.id} style={styles.questionBlock}>
            <Text style={styles.questionHeader}>{question.header || "问题"}</Text>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.options?.length ? (
              <View style={styles.optionList}>
                {question.options.map((option) => {
                  const selected = selectedAnswer === option.label;
                  return (
                    <Pressable
                      key={option.label}
                      onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.label }))}
                      style={[styles.optionButton, selected && styles.optionButtonSelected]}
                    >
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                      {option.description ? (
                        <Text numberOfLines={compact ? 1 : 2} style={[styles.optionDescription, selected && styles.optionDescriptionSelected]}>
                          {option.description}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {question.isOther || !question.options?.length ? (
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(text) => setAnswers((current) => ({ ...current, [question.id]: text }))}
                placeholder={question.isOther ? "输入其他回答" : "输入回答"}
                secureTextEntry={question.isSecret}
                style={styles.textInput}
                value={question.options?.length ? (question.options.some((option) => option.label === selectedAnswer) ? "" : selectedAnswer) : selectedAnswer}
              />
            ) : null}
          </View>
        );
      })}

      <Pressable disabled={!canSubmit} onPress={submit} style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
        <Text style={styles.submitText}>提交回答</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#eef5ff",
    borderColor: "#b9d2ff",
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  compactCard: {
    marginBottom: 4,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#dce9ff",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  headerCopy: {
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
  questionBlock: {
    gap: 8,
  },
  questionHeader: {
    color: "#2454d6",
    fontSize: 12,
    fontWeight: "900",
  },
  questionText: {
    color: "#182230",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: "#ffffff",
    borderColor: "#c8d7ef",
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  optionButtonSelected: {
    backgroundColor: "#2454d6",
    borderColor: "#2454d6",
  },
  optionLabel: {
    color: "#182230",
    fontSize: 13,
    fontWeight: "900",
  },
  optionLabelSelected: {
    color: "#ffffff",
  },
  optionDescription: {
    color: "#6b7788",
    fontSize: 12,
    lineHeight: 17,
  },
  optionDescriptionSelected: {
    color: "#e6edff",
  },
  textInput: {
    backgroundColor: "#ffffff",
    borderColor: "#c8d7ef",
    borderRadius: 10,
    borderWidth: 1,
    color: "#182230",
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
});
