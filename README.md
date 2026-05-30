# Codex Mobile Remote

个人自用的 Codex App Server 移动端客户端雏形。它把手机 App 当作一个 Codex UI surface，连接本机 `codex app-server`，用于查看会话、继续发送消息、接收事件和处理审批。

## 目录

```text
apps/mobile/        Expo React Native 客户端
packages/protocol/  codex app-server generate-ts 生成的协议类型
docs/               本地启动说明
```

## 开发命令

```bash
pnpm install
pnpm typecheck
pnpm mobile
```

说明：

- `pnpm mobile` 默认固定使用 Expo Metro 端口 `8097`
- 这是前端打包端口，不是 Codex WebSocket 的 `4500 / 4501`

重新生成协议类型：

```bash
pnpm protocol:generate
```

## 启动 Codex App Server

本机调试：

```bash
codex app-server --listen ws://127.0.0.1:4500
```

手机通过公网访问时，优先使用 Cloudflare Tunnel 暴露 `4501 relay`，不要直接暴露 `4500`。

本机 `codex app-server` 建议只监听 loopback：

```bash
codex app-server --listen ws://127.0.0.1:4500
```

非 loopback 监听时建议开启 token 鉴权：

```bash
mkdir -p ~/.codex/app-server
openssl rand -hex 32 > ~/.codex/app-server/mobile.token
codex app-server \
  --listen ws://100.x.x.x:4500 \
  --ws-auth capability-token \
  --ws-token-file ~/.codex/app-server/mobile.token
```

移动端里填写：

```text
ws://127.0.0.1:4500
```

以及 token 文件里的内容。

公网访问请看：

```text
docs/cloudflare-tunnel.md
```

如果 iPhone / Expo Go 真机出现 `readyz` 正常但 WebSocket `403 Forbidden`，改用 relay：

```bash
RELAY_TOKEN=dev-bridge \
UPSTREAM_WS_URL=ws://100.x.x.x:4500 \
UPSTREAM_TOKEN_FILE=/Users/ningjiangzhu/.codex/app-server/mobile.token \
pnpm relay:app-server
```

移动端填写：

```text
ws://100.x.x.x:4501?relay_token=<relay-token>
```

此时 token 输入框留空。relay 会负责给真正的 `codex app-server` 注入 bearer token。

## 当前能力

- 连接 WebSocket App Server
- 初始化 JSON-RPC 会话
- 列出最近 thread
- 读取 thread turns/items
- 给已选 thread 发送 `turn/start`
- 展示实时 notification
- 展示命令/文件变更 approval，并支持允许一次、本会话允许、拒绝

## 注意

这是协议验证版，不直接控制 Codex Desktop App 窗口。它应连接你显式启动的 `codex app-server`。
