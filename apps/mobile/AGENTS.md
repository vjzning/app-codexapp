# Mobile App Instructions

这个目录是 Expo React Native 客户端。进入 `apps/mobile/` 后，除根目录 `AGENTS.md` 外还要遵守本文件。

## Expo / React Native

1. 当前 Expo 版本是 `~56.0.5`。写 Expo 相关代码前，优先查阅对应版本文档：
   `https://docs.expo.dev/versions/v56.0.0/`
2. 不要假设旧版 Expo API 仍然可用；相机、剪贴板、安全存储等 API 要按当前依赖版本确认。
3. UI 要考虑 iOS 刘海屏和 Android status bar；新增顶层页面时使用现有 SafeArea / padding 模式。
4. tab、按钮、状态图标优先使用 `@expo/vector-icons` 中的 Ionicons。
5. 不要把大文本、大 diff、完整命令输出直接渲染进主消息列表；用 modal / bottom sheet。

## 状态和实时流

1. `useCodexAppServer` 是协调层，不要继续无限膨胀；新增协议分支优先拆到 `hooks/codex-app-server/*`。
2. WebSocket notification 要尽量增量更新 timeline，避免刷新整条列表。
3. `item/agentMessage/delta` 必须保持批量 flush，避免 token 级重渲染。
4. `thread/status/changed`、`turn/started`、`turn/completed` 要同步更新会话列表和当前详情。
5. `serverRequest/resolved` 要清理对应的 pending UI，例如 approval 和 user input request。

## 交互卡片

1. 命令执行、文件变更、审批、`tool/requestUserInput` 都应优先嵌在对应 timeline item 下。
2. 如果协议里没有足够信息匹配 timeline item，才使用顶部兜底卡片。
3. 命令输出只在卡片中展示摘要；完整输出放在 `CommandOutputModal`。
4. 文件 diff 只在 `DiffModal` 中查看。
5. 图片只在主列表中展示稳定尺寸预览，点击后进入预览 modal。

## 验证

改动后从仓库根目录运行：

```bash
pnpm typecheck
```

如果修改了真机连接、扫码、SecureStore、Camera 或 WebSocket header 行为，需要在最终说明里标注是否已真机验证。
