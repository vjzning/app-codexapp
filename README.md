# Codex Mobile Remote

Codex App Server 移动端客户端。它把手机 App 当作一个 Codex UI surface，连接你显式启动的 `codex app-server`，用于查看会话、继续发送消息、接收事件和处理审批。

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

## 一键启动

### 本地局域网

```bash
pnpm start:lan
```

这个命令会同时启动：

- `codex app-server`：监听 `127.0.0.1:4500`
- 本地 relay：监听 `0.0.0.0:4501`
- 终端二维码：手机 App 扫码后自动填入 URL 和 relay token

首次运行会自动生成：

```text
~/.codex/app-server/mobile.token
~/.codex/app-server/relay.token
```

手机和电脑必须在同一个 Wi-Fi / 局域网。如果自动识别的 IP 不对，可以手动指定：

```bash
CODEX_MOBILE_LAN_HOST=192.168.1.23 pnpm start:lan
```

### 外网 Cloudflare

先创建 Cloudflare Tunnel 配置：

```bash
mkdir -p ~/.cloudflared
cp docs/cloudflare-tunnel.yml.example ~/.cloudflared/codex-mobile.yml
```

把 `~/.cloudflared/codex-mobile.yml` 里的 `tunnel`、`credentials-file`、`hostname` 改成你自己的值，然后启动：

```bash
PUBLIC_CODEX_MOBILE_URL=wss://your-domain.example.com pnpm start:cloudflare
```

这个命令会同时启动：

- `codex app-server`：监听 `127.0.0.1:4500`
- 本地 relay：监听 `127.0.0.1:4501`
- `cloudflared tunnel`
- 终端二维码：手机 App 扫码后自动填入公网 URL 和 relay token

公网只暴露 relay，不要直接暴露裸 `4500`。详细配置见 [docs/cloudflare-tunnel.md](docs/cloudflare-tunnel.md)。

## 手动调试

只在本机调试协议时，可以单独启动 app-server：

```bash
codex app-server --listen ws://127.0.0.1:4500
```

再用探测脚本验证：

```bash
CODEX_APP_SERVER_URL=ws://127.0.0.1:4500 pnpm probe:app-server
```

真机连接建议优先使用 `pnpm start:lan` 或 `pnpm start:cloudflare`，它们会通过 relay 处理 WebSocket token。

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

## License

MIT
