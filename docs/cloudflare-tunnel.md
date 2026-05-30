# Cloudflare Tunnel 接入

目标：手机通过公网 `wss://` 访问本机 `4501 relay`，relay 再连接本机 `4500 codex app-server`。

## 端口结构

```text
Phone App
  -> wss://codex-mobile.zaime.me?relay_token=<relay-token>
  -> Cloudflare Tunnel
  -> http://127.0.0.1:4501
  -> ws://127.0.0.1:4500
```

不要直接暴露 `4500`。公网只进 `4501 relay`。

## 1. 准备 token

```bash
mkdir -p ~/.codex/app-server
openssl rand -hex 32 > ~/.codex/app-server/mobile.token
openssl rand -hex 32 > ~/.codex/app-server/relay.token
```

## 2. 日常一键启动

```bash
pnpm start:cloudflare
```

这个命令会同时启动：

- `codex app-server` on `127.0.0.1:4500`
- `relay` on `127.0.0.1:4501`
- `cloudflared tunnel`

按 `Ctrl+C` 会一起停止。

## 3. 手机端填写

URL：

```text
wss://codex-mobile.zaime.me?relay_token=<relay-token>
```

Token 输入框留空。`relay_token` 使用 `/Users/ningjiangzhu/.codex/app-server/relay.token` 文件内容。

## 4. 自检

本机验证 relay：

```bash
curl -i http://127.0.0.1:4501/readyz
```

公网验证 Tunnel：

```bash
curl -i https://codex-mobile.zaime.me/readyz
```

WebSocket 验证：

```bash
CODEX_APP_SERVER_URL="wss://codex-mobile.zaime.me?relay_token=$(cat /Users/ningjiangzhu/.codex/app-server/relay.token)" \
node scripts/probe-app-server.mjs
```

返回 `ok: true` 和 `threads.count` 后，手机端再连接。

## 首次配置参考

### 手动启动 relay

```bash
RELAY_TOKEN="$(cat /Users/ningjiangzhu/.codex/app-server/relay.token)" \
UPSTREAM_WS_URL=ws://127.0.0.1:4500 \
UPSTREAM_TOKEN_FILE=/Users/ningjiangzhu/.codex/app-server/mobile.token \
pnpm relay:cloudflare
```

relay 只监听 `127.0.0.1:4501`，不直接暴露到局域网。

### 创建 Cloudflare Tunnel

安装并登录 `cloudflared` 后执行：

```bash
cloudflared tunnel login
cloudflared tunnel create codex-mobile
```

复制模板：

```bash
cp docs/cloudflare-tunnel.yml.example ~/.cloudflared/codex-mobile.yml
```

把 `~/.cloudflared/codex-mobile.yml` 里的：

- `tunnel`
- `credentials-file`
- `hostname`

替换成你自己的值。

然后把域名路由到 Tunnel：

```bash
cloudflared tunnel route dns codex-mobile codex-mobile.zaime.me
```

### 启动 Tunnel

```bash
cloudflared tunnel --config ~/.cloudflared/codex-mobile.yml run
```

## 安全说明

- 不要使用 `dev-bridge` 作为公网 token。
- 不要把 `mobile.token` 放到手机端。
- 不要直接公开 `4500`。
- 推荐在 Cloudflare 侧额外启用 Access，只允许你的账号访问该域名。
