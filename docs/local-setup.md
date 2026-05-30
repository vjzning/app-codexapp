# 本地调试说明

## 1. 启动服务端

先用本机地址验证协议链路：

```bash
codex app-server --listen ws://127.0.0.1:4500
```

如果要用手机真机公网访问，建议通过 Cloudflare Tunnel 暴露 `4501 relay`，不要直接暴露 `4500`。

```bash
codex app-server --listen ws://127.0.0.1:4500
```

关键点：

- `127.0.0.1` 只能给 Mac 本机访问。
- 局域网手机访问需要监听局域网 IP。
- 公网手机访问建议走 `docs/cloudflare-tunnel.md`。
- 非本机监听必须加鉴权，避免局域网里其他设备直接控制 Codex。

## 2. token 鉴权

生成 token：

```bash
mkdir -p ~/.codex/app-server
openssl rand -hex 32 > ~/.codex/app-server/mobile.token
```

启动：

```bash
codex app-server \
  --listen ws://127.0.0.1:4500 \
  --ws-auth capability-token \
  --ws-token-file ~/.codex/app-server/mobile.token
```

移动端连接时填：

- URL: `ws://127.0.0.1:4500`
- Token: `~/.codex/app-server/mobile.token` 里的文本

## 3. 启动移动端

```bash
pnpm mobile
```

Expo 启动后用 iOS 模拟器、Android 模拟器或 Expo Go 打开。

## 4. 典型流程

1. 手机端填 App Server URL 和 token。
2. 点“连接”。
3. 点“刷新”加载会话列表。
4. 选择一个 thread。
5. 在输入框发送消息。
6. 如果 Codex 请求执行命令或写文件，手机端会显示确认条。

## 5. 已知限制

- 当前未做本地持久化，刷新 App 后需要重新填连接信息。
- 当前只实现 thread 继续发送，不包含新建 thread 的 workspace 选择器。
- `codex app-server --ws-auth capability-token` 当前要求 WebSocket 握手里带 `Authorization: Bearer <token>`。
- iPhone / Expo Go 真机环境下，React Native WebSocket 可能不会把这个 header 可靠带出去，所以会出现 `readyz 200` 但握手 `403`。

## 6. iPhone / Expo Go 403 兜底方案

如果真机里 `readyz` 正常但 WebSocket 报 `403`，通常是 Expo Go / React Native 当前环境没有把 `Authorization` header 带进 WebSocket 握手。

可以改连本机 relay：

```bash
RELAY_TOKEN=dev-bridge \
UPSTREAM_WS_URL=ws://192.168.0.164:4500 \
UPSTREAM_TOKEN_FILE=/Users/ningjiangzhu/.codex/app-server/mobile.token \
pnpm relay:app-server
```

手机端连接：

```text
ws://192.168.0.164:4501?relay_token=dev-bridge
```

此时 App 里的 token 输入框留空即可。relay 会把 bearer token 注入真正的 `codex app-server`。

如果要先自检，可在项目根目录执行：

```bash
CODEX_APP_SERVER_URL='ws://192.168.0.164:4501?relay_token=dev-bridge' \
node scripts/probe-app-server.mjs
```

只要能返回 `ok: true` 和 `threads.count`，说明手机端也应该走得通。
