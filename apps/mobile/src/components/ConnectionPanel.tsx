import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as SecureStore from "expo-secure-store";

import type { ConnectionState, ReadinessStatus } from "@/types/codex";

type Props = {
  state: ConnectionState;
  readiness: ReadinessStatus | null;
  recentError?: string | null;
  onConnect: (url: string, token: string) => void;
  onDisconnect: () => void;
  onProbe: (url: string, token: string) => void;
};

const STORAGE_URL_KEY = "codexRemote.appServerUrl";
const STORAGE_TOKEN_KEY = "codexRemote.appServerToken";

export function ConnectionPanel({ state, readiness, recentError = null, onConnect, onDisconnect, onProbe }: Props) {
  const [url, setUrl] = useState("wss://codex-mobile.zaime.me");
  const [token, setToken] = useState("");
  const [storageStatus, setStorageStatus] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scannerLockedRef = useRef(false);
  const isConnecting = state === "connecting" || state === "reconnecting";

  useEffect(() => {
    let mounted = true;

    const restoreConfig = async () => {
      try {
        const available = await SecureStore.isAvailableAsync();
        if (!available) {
          if (mounted) {
            setStorageStatus("当前平台不支持安全保存");
          }
          return;
        }

        const [savedUrl, savedToken] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_URL_KEY),
          SecureStore.getItemAsync(STORAGE_TOKEN_KEY),
        ]);

        if (!mounted) {
          return;
        }

        if (savedUrl) {
          setUrl(savedUrl);
        }
        if (savedToken) {
          setToken(savedToken);
        }
        if (savedUrl || savedToken) {
          setStorageStatus("已恢复保存的连接配置");
        }
      } catch (error) {
        if (mounted) {
          setStorageStatus(`读取保存配置失败：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    void restoreConfig();

    return () => {
      mounted = false;
    };
  }, []);

  const saveConfig = async () => {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (!available) {
        setStorageStatus("当前平台不支持安全保存");
        return;
      }

      // token 属于敏感配置，必须写入 SecureStore，避免落到普通本地存储。
      await SecureStore.setItemAsync(STORAGE_URL_KEY, url.trim());
      if (token.trim()) {
        await SecureStore.setItemAsync(STORAGE_TOKEN_KEY, token.trim());
      } else {
        await SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY);
      }
      setStorageStatus("已安全保存连接配置");
    } catch (error) {
      setStorageStatus(`保存配置失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleConnect = async () => {
    await saveConfig();
    onConnect(url, token);
  };

  const openScanner = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();

    if (!permission.granted) {
      setStorageStatus("没有相机权限，无法扫码导入");
      return;
    }

    scannerLockedRef.current = false;
    setScannerLocked(false);
    setScannerVisible(true);
  };

  const handleScanned = (result: BarcodeScanningResult) => {
    if (scannerLockedRef.current) {
      return;
    }

    scannerLockedRef.current = true;
    setScannerLocked(true);
    const parsed = parseConnectionQr(result.data);

    if (!parsed) {
      setStorageStatus("二维码不是 Codex Mobile 连接配置");
      scannerLockedRef.current = false;
      setScannerLocked(false);
      return;
    }

    setUrl(parsed.url);
    setToken(parsed.token);
    setStorageStatus("已从二维码导入连接配置");
    setScannerVisible(false);
  };

  const clearConfig = async () => {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        await Promise.all([SecureStore.deleteItemAsync(STORAGE_URL_KEY), SecureStore.deleteItemAsync(STORAGE_TOKEN_KEY)]);
      }
      setUrl("wss://codex-mobile.zaime.me");
      setToken("");
      setStorageStatus("已清除保存的连接配置");
    } catch (error) {
      setStorageStatus(`清除配置失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.title}>连接设置</Text>
        <Text
          style={[
            styles.badge,
            state === "connected" && styles.badgeConnected,
            state === "reconnecting" && styles.badgeReconnecting,
          ]}
        >
          {getStateLabel(state)}
        </Text>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setUrl}
        placeholder="wss://codex-mobile.zaime.me"
        style={styles.input}
        value={url}
      />
      <Text style={styles.hint}>
        真机公网访问优先填 Cloudflare Tunnel 的 `wss://域名`。局域网 relay 可填 `ws://MacIP:4501`。
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setToken}
        placeholder="relay token / capability token"
        secureTextEntry
        style={styles.input}
        value={token}
      />
      <Text style={styles.hint}>relay 模式会自动把 token 拼到 `relay_token` query；直连 `ws://MacIP:4500` 时会改用 Authorization header。</Text>
      {readiness ? (
        <Text style={[styles.readiness, readiness.ok ? styles.readinessOk : styles.readinessError]}>
          {readiness.ok ? `readyz ${readiness.status}` : readiness.error}
        </Text>
      ) : null}
      {storageStatus ? <Text style={styles.storageText}>{storageStatus}</Text> : null}
      {recentError ? <Text style={styles.errorText}>{recentError}</Text> : null}
      <Pressable onPress={() => void openScanner()} style={styles.scanButton}>
        <Text style={styles.scanText}>扫码导入连接配置</Text>
      </Pressable>
      <View style={styles.actions}>
        <Pressable disabled={isConnecting} onPress={() => void handleConnect()} style={[styles.primaryButton, isConnecting && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{isConnecting ? "连接中..." : "连接"}</Text>
        </Pressable>
        <Pressable onPress={onDisconnect} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>断开</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => onProbe(url, token)} style={styles.probeButton}>
        <Text style={styles.probeText}>检测 readyz</Text>
      </Pressable>
      <Pressable onPress={() => void clearConfig()} style={styles.clearButton}>
        <Text style={styles.clearText}>清除保存配置</Text>
      </Pressable>
      <ConnectionQrScannerModal
        onClose={() => setScannerVisible(false)}
        onScanned={handleScanned}
        visible={scannerVisible}
      />
    </View>
  );
}

type ParsedConnectionQr = {
  url: string;
  token: string;
};

function parseConnectionQr(raw: string): ParsedConnectionQr | null {
  const trimmed = raw.trim();

  try {
    const parsedJson = JSON.parse(trimmed) as { kind?: string; url?: string; token?: string };
    if (parsedJson.kind === "codex-mobile-connection" && parsedJson.url && parsedJson.token) {
      return {
        url: parsedJson.url,
        token: parsedJson.token,
      };
    }
  } catch {
    // 兼容直接扫描完整 wss://...?relay_token=... URL。
  }

  try {
    const parsedUrl = new URL(trimmed);
    const relayToken = parsedUrl.searchParams.get("relay_token") || "";
    parsedUrl.searchParams.delete("relay_token");

    if ((parsedUrl.protocol === "ws:" || parsedUrl.protocol === "wss:") && relayToken) {
      return {
        url: parsedUrl.toString(),
        token: relayToken,
      };
    }
  } catch {
    return null;
  }

  return null;
}

type ConnectionQrScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanned: (result: BarcodeScanningResult) => void;
};

function ConnectionQrScannerModal({ visible, onClose, onScanned }: ConnectionQrScannerModalProps) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.scannerBackdrop}>
        <View style={styles.scannerSheet}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>扫描连接二维码</Text>
            <Pressable onPress={onClose} style={styles.scannerCloseButton}>
              <Text style={styles.scannerCloseText}>关闭</Text>
            </Pressable>
          </View>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScanned}
            style={styles.camera}
          >
            <View style={styles.scanFrame} />
          </CameraView>
          <Text style={styles.scannerHint}>扫描 `npm run start:cloudflare` 输出的二维码。</Text>
        </View>
      </View>
    </Modal>
  );
}

function getStateLabel(state: ConnectionState) {
  if (state === "connected") {
    return "已连接";
  }

  if (state === "connecting") {
    return "连接中";
  }

  if (state === "reconnecting") {
    return "重连中";
  }

  if (state === "closed") {
    return "已断开";
  }

  if (state === "error") {
    return "连接错误";
  }

  return "未连接";
}

const styles = StyleSheet.create({
  panel: {
    gap: 10,
    padding: 14,
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#edf1f7",
    borderRadius: 6,
    color: "#516071",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeConnected: {
    backgroundColor: "#dff7e8",
    color: "#19663b",
  },
  badgeReconnecting: {
    backgroundColor: "#fff4d8",
    color: "#8a5a00",
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
  hint: {
    color: "#6b7788",
    fontSize: 12,
    lineHeight: 17,
  },
  readiness: {
    borderRadius: 8,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  readinessOk: {
    backgroundColor: "#dff7e8",
    color: "#19663b",
  },
  readinessError: {
    backgroundColor: "#fff1f1",
    color: "#9b2222",
  },
  scanButton: {
    alignItems: "center",
    backgroundColor: "#182230",
    borderRadius: 999,
    paddingVertical: 11,
  },
  scanText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  errorText: {
    backgroundColor: "#fff1f1",
    borderRadius: 8,
    color: "#9b2222",
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  storageText: {
    backgroundColor: "#edf7ff",
    borderRadius: 8,
    color: "#2454d6",
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2454d6",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 11,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#cfd7e3",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: "#304052",
    fontWeight: "700",
  },
  probeButton: {
    alignItems: "center",
    borderColor: "#cfd7e3",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
  },
  probeText: {
    color: "#304052",
    fontWeight: "700",
  },
  clearButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  clearText: {
    color: "#7b8797",
    fontSize: 12,
    fontWeight: "700",
  },
  scannerBackdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  scannerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    paddingBottom: 14,
  },
  scannerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  scannerTitle: {
    color: "#182230",
    fontSize: 16,
    fontWeight: "900",
  },
  scannerCloseButton: {
    backgroundColor: "#edf1f7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scannerCloseText: {
    color: "#304052",
    fontSize: 12,
    fontWeight: "900",
  },
  camera: {
    height: 360,
    marginHorizontal: 14,
    overflow: "hidden",
  },
  scanFrame: {
    alignSelf: "center",
    borderColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 3,
    height: 220,
    marginTop: 70,
    width: 220,
  },
  scannerHint: {
    color: "#6b7788",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    textAlign: "center",
  },
});
