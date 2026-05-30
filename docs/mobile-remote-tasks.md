# Codex Mobile Remote 任务拆分

## 当前优先级

先做 `P0 连接配置页` 和 `P1 会话详情体验`。这两块直接影响日常能不能稳定使用。

## P0 连接配置页

### 任务 0.1 保存连接配置

目标：

- 保存 App Server URL。
- 保存 relay token / capability token。
- 下次打开 App 自动填回。

实现建议：

- 使用 `expo-secure-store` 保存 token 和 URL。
- 不使用普通 AsyncStorage 存 token。

依赖确认：

- 需要新增生产依赖：`expo-secure-store`。
- 选择原因：公网 relay token 属于敏感配置，SecureStore 比 AsyncStorage 更合适。

当前状态：

- 已完成，使用 `expo-secure-store` 保存 URL 和 token。

验收：

- 首次输入并连接后，重启 App 仍能看到上次 URL。
- token 不显示明文。
- 点连接时能用保存的配置连上。

### 任务 0.2 连接状态面板

目标：

- 明确显示连接状态。
- 显示 `readyz` 结果。
- 显示最近一次连接/发送/刷新错误。

当前状态：

- 已完成连接状态 badge。
- 已完成 readyz 检测。
- 已完成最近错误聚合展示。

验收：

- 断网、token 错误、readyz 失败时，连接面板能看到原因。
- 成功连接后显示 `connected`。
- `readyz` 成功显示状态码。

### 任务 0.3 公网连接模式

目标：

- 连接配置页默认支持 Cloudflare Tunnel。
- 不再要求用户手动把 token 拼到 URL。

实现建议：

- URL 填你的 Cloudflare Tunnel 地址，例如 `wss://your-domain.example.com`。
- Token 输入框填 relay token。
- 客户端连接时内部组装 `?relay_token=...`，直到 relay 支持更安全的 header/cookie 认证。

验收：

- 用户不用手动拼 query。
- token 输入框留在 App 内部状态/安全存储。
- 旧的完整 URL 仍兼容。

## P1 会话详情体验

### 任务 1.1 发送后本地 pending 消息

目标：

- 用户点发送后，立即在消息列表里出现自己的消息。
- 服务端刷新回来后，用真实 timeline 替换。

当前状态：

- 已完成发送后的本地 pending 气泡。
- 已完成发送失败标记。
- 已完成服务端回显后的去重替换。

验收：

- 点发送后 300ms 内出现 pending 气泡。
- 发送失败时 pending 气泡标记失败，保留文本。
- 服务端返回后不会出现重复消息。

### 任务 1.2 回复中状态

目标：

- 正在回复时显示明确状态。
- 禁用发送按钮。
- 按钮改成取消。

当前状态：

- 已有 `正在回复... / 等待审批... / 等待输入...`。
- 已有取消按钮和 `turn/interrupt`。

后续完善：

- 已完成取消中显示 `取消中...`。
- 已完成取消失败显示错误。

验收：

- 回复中不能再次发送。
- 点击取消会调用 `turn/interrupt`。
- turn 完成后输入框恢复。

### 任务 1.3 手动刷新按钮

目标：

- 聊天详情顶部增加刷新按钮。
- 触发当前 thread 最新一页重新加载。

当前状态：

- Hook 中已有 `refreshSelectedThread`。
- UI 已有刷新入口和刷新中状态。

验收：

- 点击刷新后显示加载态。
- 新消息能显示出来。
- 错误时显示最近错误。

### 任务 1.4 自动滚到底部

目标：

- 首次进入会话后滚到底部。
- 发送消息后滚到底部。
- 收到新回复后，如果用户当前接近底部，则自动滚到底部。

实现建议：

- 使用 `FlatList` ref。
- 对“用户正在看历史消息”的情况不强制滚动。

当前状态：

- 已完成进入详情和新消息出现后的自动滚动到底部。
- 已避免加载更早消息时强制跳到底部。

验收：

- 打开会话默认看到最新消息。
- 发送后能看到 pending 消息。
- 加载更早消息时不会跳到底部。

### 任务 1.5 消息渲染性能

目标：

- 降低 `VirtualizedList` 慢更新警告。
- 工具输出默认摘要化。

当前状态：

- 已改为 `FlatList`。
- 已有超长消息截断和展开。

后续完善：

- 已抽 `MessageBubble` 并 `React.memo`。
- `commandExecution` 默认显示命令和头尾摘要。
- `fileChange` 默认显示路径/变更类型/ diff 行数，不直接渲染 JSON。

验收：

- 大会话滚动不卡死。
- 发送/轮询更新时不整列重渲染。

## P2 新建会话

### 任务 2.1 项目 / cwd 选择

目标：

- 提供项目列表或手动输入 cwd。
- 默认使用最近会话中的 cwd。

验收：

- 能选择已有项目 cwd。
- 能手动输入本机路径。
- 路径为空时禁止创建。

当前状态：

- 已完成从最近会话提取 cwd。
- 已完成常用 cwd 快捷选择和手动输入。

### 任务 2.2 输入第一条消息

目标：

- 新建会话页输入第一条用户消息。
- 提交后调用 `thread/start`。

验收：

- 创建成功后进入新会话详情页。
- 第一条消息出现在 timeline。
- 创建失败显示错误。

当前状态：

- 已完成 `thread/start` 创建会话。
- 已完成创建后调用 `turn/start` 发送第一条消息。
- 已完成创建失败时显示最近错误。

## P3 审批能力完善

### 任务 3.1 命令审批详情

目标：

- 命令审批显示 command、cwd、reason。
- 长命令可折叠。

当前状态：

- 已基本显示 command/cwd/reason。
- 已支持取消。
- 已支持长详情折叠/展开。

验收：

- 用户能明确看到要执行什么命令。
- 支持允许一次 / 本会话允许 / 拒绝。

### 任务 3.2 文件变更审批详情

目标：

- 文件审批显示路径。
- 显示 diff 摘要。
- 大 diff 不直接全文渲染。

当前状态：

- `item/fileChange/requestApproval` 显示 grantRoot/reason。
- `applyPatchApproval` 显示 grantRoot/reason 和文件变更摘要。

验收：

- 用户能看到涉及哪些文件。
- 能看到新增/修改/删除摘要。
- 支持允许一次 / 本会话允许 / 拒绝。

## P4 公网安全

### 任务 4.1 移除 URL 裸 token

目标：

- 不要求用户手动把 `relay_token` 拼在 URL 里。
- App 内单独保存 token。

短期方案：

- UI 上拆成 URL + token。
- 连接时内部拼 query，兼容当前 relay。

长期方案：

- relay 支持更安全的认证方式。
- 后续接 Cloudflare Access。

验收：

- UI 不展示完整 token URL。
- token 能安全保存。
- 旧 URL 仍兼容。

### 任务 4.2 Cloudflare Access

目标：

- 给你的 Cloudflare Tunnel hostname 加 Access。
- 只允许用户自己的账号访问。

验收：

- 未登录 Cloudflare Access 无法访问 `/readyz`。
- App 连接策略需要与 Access 登录方式重新评估。

当前状态：

- 未完成。启用 Cloudflare Access 会改变移动端连接认证方式，需要先确认访问策略和 App 端登录方案。

## 推荐执行顺序

1. `P0.1` 保存连接配置。
2. `P0.3` URL/token 拆分。
3. `P1.1` pending 消息。
4. `P1.3` 手动刷新。
5. `P1.4` 自动滚到底部。
6. `P1.5` 消息渲染性能。
7. `P2` 新建会话。
8. `P3` 审批完善。
9. `P4` 公网安全增强。
