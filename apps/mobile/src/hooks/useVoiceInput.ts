import { useEffect, useRef, useState } from "react";

import type VoiceModule from "@react-native-voice/voice";
import type { SpeechErrorEvent, SpeechResultsEvent } from "@react-native-voice/voice";

type Options = {
  locale?: string;
  onResult: (text: string) => void;
};

export function useVoiceInput({ locale = "zh-CN", onResult }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const voiceRef = useRef<typeof VoiceModule | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(
    () => () => {
      const voice = voiceRef.current;
      if (!voice) {
        return;
      }

      void voice.destroy().finally(() => voice.removeAllListeners());
    },
    [],
  );

  const setupVoiceHandlers = (voice: typeof VoiceModule) => {
    voice.onSpeechStart = () => {
      setError(null);
      setIsListening(true);
    };
    voice.onSpeechEnd = () => {
      setIsListening(false);
      setPartialText("");
    };
    voice.onSpeechError = (event: SpeechErrorEvent) => {
      setIsListening(false);
      setPartialText("");
      setError(event.error?.message || "语音识别失败");
    };
    voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      setPartialText(event.value?.[0] ?? "");
    };
    voice.onSpeechResults = (event: SpeechResultsEvent) => {
      const text = event.value?.[0]?.trim();
      if (text) {
        onResultRef.current(text);
      }
      setPartialText("");
    };
  };

  const loadVoice = async () => {
    if (voiceRef.current) {
      return voiceRef.current;
    }

    try {
      const voice = (await import("@react-native-voice/voice")).default;
      setupVoiceHandlers(voice);
      voiceRef.current = voice;
      return voice;
    } catch {
      setError("语音输入需要 dev build，Expo Go 不支持");
      return null;
    }
  };


  const start = async () => {
    try {
      setError(null);
      setPartialText("");
      const voice = await loadVoice();
      if (!voice) {
        return;
      }

      const available = await voice.isAvailable();
      if (!available) {
        setError("当前设备不可用语音识别");
        return;
      }
      await voice.start(locale);
    } catch (startError) {
      setIsListening(false);
      setError(startError instanceof Error ? startError.message : String(startError));
    }
  };

  const stop = async () => {
    try {
      const voice = await loadVoice();
      if (!voice) {
        return;
      }

      await voice.stop();
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
