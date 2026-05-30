# AGENTS.md

这个仓库是 Codex App Server 的移动端远程客户端。后续 agent 进入仓库时，先按本文确认边界，再动代码。

## 项目结构

- `apps/mobile/`：Expo React Native 客户端。
- `packages/protocol/`：通过 `codex app-server generate-ts` 生成的协议类型。
- `scripts/`：本地 app-server relay、Cloudflare 启动、探测脚本。
- `docs/`：本地启动、Cloudflare Tunnel、App Server API 资料。

## 基本规则

1. 依赖管理默认使用 `pnpm`。
2. 修改代码后至少运行 `pnpm typecheck`。
3. 不要手改 `packages/protocol/src/**` 里的生成文件；协议变化请运行 `pnpm protocol:generate`。
4. 新增生产依赖前需要先解释用途、替代方案和选择原因，并等待用户确认。
5. 关键逻辑可以写中文注释，尤其是协议兼容、移动端限制、鉴权和重连逻辑。
6. 不要提交 `node_modules`、Expo 缓存、构建产物或本地 token。
7. 这个客户端连接的是显式启动的 `codex app-server`，不是直接控制 Codex Desktop App 窗口。

## 常用命令

```bash
pnpm install
pnpm typecheck
pnpm mobile
pnpm start:cloudflare
pnpm protocol:generate
```

说明：

- `pnpm mobile` 是 Expo Metro，默认端口是 `8097`。
- Codex App Server WebSocket 常见端口是 `4500`。
- 本地 relay 常见端口是 `4501`。

## App Server / Relay 约定

- 本机 `codex app-server` 优先监听 `ws://127.0.0.1:4500`。
- 真机公网访问优先走 Cloudflare Tunnel + relay，不直接暴露 `4500`。
- relay token / capability token 属于敏感配置，移动端必须走 `expo-secure-store`。
- iPhone / Expo Go 对 WebSocket 自定义 `Authorization` header 不稳定时，使用 relay query token，由 relay 注入上游 bearer token。

## 移动端功能约定

- 会话列表按工作区分组；自定义工作区排在 Codex 默认日期目录前面。
- `/Documents/Codex/YYYY-MM-DD/...` 目录显示为 `Codex / YYYY-MM-DD`。
- 消息流要避免频繁整体重渲染；delta 合并、自动滚动、长文本折叠都要保留。
- 只有用户接近底部时才自动滚到底部。
- 图片、diff、命令输出等大内容不要直接塞满主列表，使用预览或 bottom sheet。
- 审批和 `tool/requestUserInput` 优先嵌入对应 timeline item；无法匹配时再顶部兜底。

## 验证要求

提交或声明完成前运行：

```bash
pnpm typecheck
```

如果改动涉及脚本，也要手动运行对应脚本的最小验证命令。无法真机验证时，要明确说明只完成了类型检查。

## Git 约定

- 提交信息使用 Conventional Commits，例如 `feat(mobile): ...`、`fix(relay): ...`。
- 提交前检查 `git status --short` 和暂存范围。
- 不要把用户未要求的无关改动混进提交。
