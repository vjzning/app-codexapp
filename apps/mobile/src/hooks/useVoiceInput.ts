import { useEffect, useState } from "react";

import Voice, { type SpeechErrorEvent, type SpeechResultsEvent } from "@react-native-voice/voice";

type Options = {
  locale?: string;
  onResult: (text: string) => void;
};

export function useVoiceInput({ locale = "zh-CN", onResult }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");

  useEffect(() => {
    Voice.onSpeechStart = () => {
      setError(null);
      setIsListening(true);
    };
    Voice.onSpeechEnd = () => {
      setIsListening(false);
      setPartialText("");
    };
    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      setIsListening(false);
      setPartialText("");
      setError(event.error?.message || "语音识别失败");
    };
    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      setPartialText(event.value?.[0] ?? "");
    };
    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      const text = event.value?.[0]?.trim();
      if (text) {
        onResult(text);
      }
      setPartialText("");
    };

    return () => {
      void Voice.destroy().finally(() => Voice.removeAllListeners());
    };
  }, [onResult]);

  const start = async () => {
    try {
      setError(null);
      setPartialText("");
      const available = await Voice.isAvailable();
      if (!available) {
        setError("当前设备不可用语音识别");
        return;
      }
      await Voice.start(locale);
    } catch (startError) {
      setIsListening(false);
      setError(startError instanceof Error ? startError.message : String(startError));
    }
  };

  const stop = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : String(stopError));
    }
  };

  const toggle = () => {
    if (isListening) {
      void stop();
      return;
    }

    void start();
  };

  return {
    error,
    isListening,
    partialText,
    start,
    stop,
    toggle,
  };
}
