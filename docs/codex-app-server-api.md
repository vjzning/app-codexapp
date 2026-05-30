# Codex App Server 接口文档

来源：用户提供的 OpenAI Codex App Server 文档内容，结合当前项目实现整理。

本文用于本项目的移动端 Codex Remote 开发。它不是 SDK 封装说明，而是移动端直接连接 `codex app-server` 时需要对齐的协议、接口和安全边界。

## 定位

`codex app-server` 是 Codex 富客户端协议层，VS Code 插件等客户端会通过它连接 Codex。适合自定义客户端做深度集成：

- 认证和账号状态。
- 会话历史。
- 新建、恢复、归档、分叉会话。
- turn 发送、追加、取消。
- 审批请求。
- agent 运行事件流。
- 文件系统、模型、技能、App connector 等扩展能力。

如果是 CI 或自动化任务，官方建议优先使用 Codex SDK，而不是 app-server。

## 传输协议

协议是 JSON-RPC 2.0，服务端和客户端双向通信。线上的消息通常省略 `"jsonrpc": "2.0"` 字段，但当前项目保留该字段也能被当前服务端接受。

支持 transport：

- `stdio`：默认，JSONL。
- `websocket`：`--listen ws://IP:PORT`，实验且不受支持。
- `unix`：Unix socket 上的 WebSocket Upgrade。
- `off`：关闭本地 transport。

WebSocket 模式同一个 listener 会提供：

- `GET /readyz`：listener 可以接受连接时返回 `200 OK`。
- `GET /healthz`：没有 `Origin` header 时返回 `200 OK`。
- 带 `Origin` header 的 `/healthz` 请求会返回 `403 Forbidden`。

移动端检测建议用 `/readyz`。

## 安全边界

官方明确说明 WebSocket transport 是 experimental / unsupported。`ws://127.0.0.1:PORT` 适合本机或 SSH port-forwarding。不要把裸 app-server 直接暴露公网。

非 loopback WebSocket listener 在 rollout 期间可能默认允许未认证连接，所以暴露远程前必须配置鉴权。

官方支持的 WebSocket auth flags：

```bash
--ws-auth capability-token --ws-token-file /absolute/path
--ws-auth capability-token --ws-token-sha256 HEX
--ws-auth signed-bearer-token --ws-shared-secret-file /absolute/path
```

客户端在 WebSocket 握手时通过：

```http
Authorization: Bearer <token>
```

提交 credential。

本项目当前策略：

- `4500`：只监听 `127.0.0.1`，给本机 relay 使用。
- `4501`：本地 relay，使用 `relay_token` query 鉴权。
- Cloudflare Tunnel：只暴露 relay，不暴露裸 app-server。
- 移动端填写你的 Cloudflare Tunnel 地址，例如 `wss://your-domain.example.com` + relay token。

## 初始化流程

每个连接必须先发送一次 `initialize`，成功后再发送 `initialized` notification。初始化前发送其他 request 会被拒绝。

当前项目已实现：

```json
{
  "method": "initialize",
  "id": 1,
  "params": {
    "clientInfo": {
      "name": "codex-mobile-remote",
      "title": "Codex Mobile Remote",
      "version": "0.1.0"
    },
    "capabilities": {
      "experimentalApi": true,
      "requestAttestation": false
    }
  }
}
```

随后发送：

```json
{ "method": "initialized", "params": {} }
```

可选能力：

- `capabilities.experimentalApi: true`：启用实验接口和字段。
- `capabilities.optOutNotificationMethods`：按精确 method 名称关闭某些通知。

## 核心模型

### Thread

一次 Codex 会话。包含多个 turn。

### Turn

用户一次请求和 agent 后续工作。包含多个 item。

### Item

输入或输出单元，例如：

- `userMessage`
- `agentMessage`
- `reasoning`
- `commandExecution`
- `fileChange`
- `mcpToolCall`
- `plan`
- `webSearch`
- `enteredReviewMode`
- `exitedReviewMode`

## 当前移动端已用接口

### `thread/list`

列出会话。

当前项目用法：

```json
{
  "method": "thread/list",
  "params": {
    "limit": 30,
    "sortKey": "updated_at",
    "sortDirection": "desc",
    "archived": false
  }
}
```

注意：

- 支持 cursor 分页。
- 支持 `archived`、`cwd`、`searchTerm`、`sourceKinds` 等筛选。

### `thread/start`

新建会话。返回 thread，并自动订阅该 thread 的 turn / item 事件。

当前项目用法：

```json
{
  "method": "thread/start",
  "params": {
    "cwd": "/absolute/project/path",
    "experimentalRawEvents": false,
    "persistExtendedHistory": false
  }
}
```

建议后续补充：

- `serviceName: "codex-mobile-remote"`，方便服务端指标识别来源。
- 可选模型、sandbox、approval policy、personality。

### `thread/resume`

恢复已有会话。用于继续历史 thread 之前把它加载到内存。

当前项目规则：

- 打开详情前先 resume。
- 发送消息前也 defensive resume。

原因：`thread/list` 返回的 thread 可能是 `status.type === "notLoaded"`，直接 `turn/start` 容易出现 `thread not found`。

### `thread/turns/list`

读取会话 turn 历史。当前稳定路径。

当前项目用法：

```json
{
  "method": "thread/turns/list",
  "params": {
    "threadId": "<thread-id>",
    "cursor": null,
    "limit": 4,
    "sortDirection": "desc",
    "itemsView": "full"
  }
}
```

注意：

- 默认 newest-first。
- 当前项目取 desc 后本地 reverse，保证时间线从旧到新显示。
- `thread/turns/items/list` 文档明确是 reserved，目前返回 unsupported，不能使用。

### `turn/start`

给 thread 发送用户输入并开始 agent 工作。

当前项目用法：

```json
{
  "method": "turn/start",
  "params": {
    "threadId": "<thread-id>",
    "input": [
      {
        "type": "text",
        "text": "用户消息",
        "text_elements": []
      }
    ]
  }
}
```

可选能力：

- 每个 turn 可以覆盖 `cwd`、model、approval policy、sandbox、personality 等。
- 支持 text、image、localImage、skill、mention 等输入类型。

### `turn/interrupt`

取消当前 active turn。

当前项目用法：

```json
{
  "method": "turn/interrupt",
  "params": {
    "threadId": "<thread-id>",
    "turnId": "<turn-id>"
  }
}
```

成功返回 `{}`，服务端之后发 `turn/completed`，状态为 `interrupted`。

### 审批请求

app-server 会以 server-initiated request 形式向客户端发审批请求，客户端必须用相同 `id` 回 response。

当前项目支持：

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `execCommandApproval`
- `applyPatchApproval`

决策：

- `accept`
- `acceptForSession`
- `decline`
- `cancel`

## 当前移动端已处理通知

### `thread/started`

新建或分叉 thread 后发出。当前项目把 thread 插到列表前面。

### `thread/name/updated`

thread 标题更新。当前项目同步列表里的 name。

### `thread/status/changed`

thread runtime 状态更新。当前项目用它显示：

- `正在回复...`
- `等待审批...`
- `等待输入...`

状态判断：

- `status.type === "active"`
- `status.activeFlags` 包含：
  - `waitingOnApproval`
  - `waitingOnUserInput`

### `turn/started`

记录当前 active turn id，供 `turn/interrupt` 使用。

### `turn/completed`

清理 active turn id。

### `item/completed`

服务端发送 final item。当前项目把 item flatten 成 timeline entry。

### delta 通知

文档支持：

- `item/agentMessage/delta`
- `item/plan/delta`
- `item/commandExecution/outputDelta`
- `item/fileChange/outputDelta` deprecated

当前项目暂时主要依赖轮询和 `item/completed`，没有做完整 token streaming UI。

## 推荐下一批接口

### `turn/steer`

用途：active turn 中追加用户输入，不创建新 turn。

适合移动端：

- agent 正在回复时，输入框不必完全禁用。
- 可以把按钮改成“追加说明”。

请求：

```json
{
  "method": "turn/steer",
  "params": {
    "threadId": "<thread-id>",
    "expectedTurnId": "<active-turn-id>",
    "input": [
      {
        "type": "text",
        "text": "补充说明"
      }
    ]
  }
}
```

限制：

- 必须有 active turn。
- `expectedTurnId` 必须匹配。
- 不支持覆盖 model、cwd、sandbox 等 turn-level 设置。

### `thread/name/set`

用途：重命名会话。

适合移动端：

- 会话列表长按或详情页菜单里改名。

### `thread/archive` / `thread/unarchive`

用途：归档 / 恢复归档会话。

适合移动端：

- 会话列表清理。
- 增加“归档”按钮。

### `thread/fork`

用途：从历史会话分叉新 thread。

适合移动端：

- 在当前上下文基础上新开方向。

### `thread/compact/start`

用途：触发上下文压缩。

特点：

- request 立即返回 `{}`。
- 进度通过 turn / item 通知流式返回。

### `model/list`

用途：列出可用模型和能力。

适合移动端：

- 新建会话时做模型选择。
- 展示 supported reasoning effort。

### `skills/list`

用途：列出 cwd 范围内可用 skill。

适合移动端：

- 输入框支持 `$skill`。
- 可以做技能选择器。

### `review/start`

用途：触发 Codex reviewer。

适合移动端：

- 对当前会话做 review。
- 对某个 commit / baseBranch / uncommitted changes 做 review。

### `account/read` / `account/rateLimits/read`

用途：读取账号和额度状态。

适合移动端：

- 首页显示登录状态。
- 显示 rate limit 和 reset 时间。

## 不建议移动端优先暴露的接口

### `command/exec`

直接运行命令，虽然在 sandbox 中，但移动端误触风险高。除非做明确的命令面板和审批，否则不要优先做。

### `process/*`

实验接口，而且运行在 Codex sandbox 外。只有明确要做进程控制台时再考虑。

### `fs/writeFile` / `fs/remove`

文件写入和删除风险高。移动端不应直接做泛用文件管理器，最好只通过 Codex 的审批流程间接操作。

## 当前项目的协议对齐清单

已完成：

- 初始化握手。
- WebSocket 连接。
- relay token 模式。
- `/readyz` 检测。
- 会话列表。
- 会话详情分页。
- 新建会话。
- 恢复会话。
- 发送消息。
- 取消 turn。
- pending 消息。
- 审批 UI。
- 状态展示。
- 工具输出摘要。

待补：

- `turn/steer`：active turn 追加说明。
- `thread/name/set`：重命名会话。
- `thread/archive`：归档会话。
- `model/list`：模型选择。
- `skills/list`：技能选择。
- `review/start`：review 入口。
- `account/read`：账号状态。
- token 安全持久化：已使用 `expo-secure-store` 保存 URL 和 relay token。

## 本项目启动命令

后端 / relay / tunnel 一键启动：

```bash
pnpm start:cloudflare
```

Expo 真机调试：

```bash
pnpm mobile
```

默认 Expo 地址：

```text
exp://<your-mac-lan-ip>:8097
```

移动端默认连接：

```text
URL: wss://your-domain.example.com
token: ~/.codex/app-server/relay.token 中的 relay token
```
