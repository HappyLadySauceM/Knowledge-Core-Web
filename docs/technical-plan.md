# 技术方案

## 前端基础

- Next.js App Router + React + TypeScript。
- Node.js 运行时最低版本跟随 Next.js 当前要求；仓库使用 pnpm。
- Tailwind CSS 负责原子样式，Radix UI 负责无障碍交互原语，组件通过自定义 token 形成 Knowledge Core 视觉系统。
- next-themes 管理主题；当前语言路由为 `/zh-CN` 与 `/en`。
- TanStack Query、Zod、React Hook Form、Tiptap、Yjs 按业务阶段接入。
- Storybook 作为组件设计与验收表面；Vitest 做单元/组件测试，Playwright 做关键用户路径。

## BFF 与认证边界

浏览器不直接持有服务端 token。后续认证接入采用：

```text
Browser → Next.js BFF（HttpOnly cookie）→ Knowledge-Core Gateway → Identity / Knowledge / Collaboration
```

- access/refresh token 只存在服务端会话或 HttpOnly、Secure、SameSite cookie。
- BFF 统一转发 Problem Details、request id、trace context 和超时语义。浏览器接口统一位于 `/api/bff/auth/*` 与 `/api/bff/gateway/*`；会话层集中处理 HttpOnly Cookie、Origin 校验、refresh 轮换和一次重试。
- 浏览器端只能依赖稳定的前后端 DTO；当前类型入口为 `src/lib/api/types.ts`。
- Server Component 的 Gateway 请求入口为 `src/lib/api/gateway.ts`，不在页面组件中散落 `fetch`。服务端 BFF 实现位于 `src/lib/bff/`，只允许转发 `/api/v1/*`，不承载领域权限规则；认证控制类 Gateway 路径只通过 `/api/bff/auth/*` 暴露。

## Knowledge-Core 对接原则

- Go Gateway、Identity、Knowledge 与 Rust Collaboration 的领域边界保持不变。
- 前端不绕过 Gateway 直接访问服务数据库、Redis、NATS 或协作实例。
- IDL 与服务端生成代码仍归 Knowledge-Core 所有；Web 只消费稳定 HTTP/RPC 映射。
- 协作 WebSocket ticket 必须为短时、一次性、绑定用户/文档的 opaque 值；实例选择由 Higress 对 `/v1/documents/{id}` 做通常 locality hash，不进入浏览器契约。
- 任何跨服务写入、事件发布、索引任务都遵循幂等、重试、死信和补偿约束。

## 路由壳

当前已实现：

- `/{locale}`：产品首页与视觉入口，使用公开站点 Header
- `/{locale}/studio`：文档、文件夹、筛选与分页工作区，使用独立后台 Shell
- `/{locale}/studio/documents/{id}`：Yjs 协作编辑、元数据、成员和双状态发布，使用后台 Shell
- `/{locale}/studio/media`：通用媒体库，使用后台 Shell
- `/{locale}/studio/trash`：文档回收站，使用后台 Shell
- `/{locale}/admin`：管理员业务配置与投递状态，使用后台 Shell
- `/{locale}/settings/security`：会话与账号安全，使用后台 Shell
- `/{locale}/login`：认证入口壳，使用公开站点 Header
- `/`：重定向到 `/zh-CN`

## 文档双状态、提交历史与发布边界

- Collaboration 持久化唯一的实时编辑稿；Yjs/IndexedDB 与 WebSocket 重连后从服务端合并恢复，编辑内容不会直接改写公开页。
- Knowledge 持有最近一次公开快照。首次打开“公开发布”或已发布文档点击“更新”时，Gateway 先通过 state vector 捕获已提交的 Collaboration 状态，再原子推进公开发布候选；公开列表和文章详情只读取有效快照。
- 取消发布只撤下公开快照，完整编辑稿继续保留。回收站中的文档、取消发布中的候选、失败候选以及已标记永久删除的文档均不可通过公开 URL 访问。
- 编辑稿之外保留显式提交历史：离开和发布可通过 `/studio/documents/:id/commits` 形成可查看提交，编辑器不再提供重复的手动保存按钮。历史页面只读展示时间线和快照；选择恢复后由编辑器将快照应用到 Collaboration/Yjs 草稿并等待同步确认，不再只更新 Knowledge 投影副本。
- 回收站恢复仍是独立的软删除恢复；“永久删除”使用强 `If-Match`、`Idempotency-Key` 和不可逆确认，返回 `202` 后由后台幂等清理。
- 标题、正文、摘要、标签、图标和封面焦点参与规范化 authoring hash。已发布文档只有 hash 不同才启用“更新”；草稿同步状态和历史提交状态分别显示，避免普通输入推动顶部按钮抖动。
- Studio 侧栏按可扩展库树组织“我的文档库”和“知识库”：个人库包含拥有、共享和嵌套文件夹，知识库当前映射有效公开快照。后续组织工作空间可增加同级库根并携带 workspace/subject 权限上下文，无需重做导航层级。

上述页面均通过同源 BFF 或服务端 Gateway client 连接真实业务 API；浏览器不持有 Gateway token。

## 质量门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm build-storybook
```

## 运行与发布

- Next.js 使用 standalone 输出，由 Node 24 生产镜像运行在 3000 端口。
- `/api/health` 是只检查 Web 进程的健康入口；Gateway 依赖通过部署 Smoke 单独验证。
- `KNOWLEDGE_CORE_GATEWAY_URL` 仅作为服务端运行时配置注入，不进入浏览器 bundle。
- `KNOWLEDGE_CORE_WEB_ORIGIN` 用于 BFF 的精确 Origin/CSRF 校验；`KNOWLEDGE_CORE_GATEWAY_TIMEOUT_MS` 控制出站 Gateway 超时。两者都由运行时配置注入。
- `dev` 发布构建 immutable Harbor candidate digest，GitOps 更新后等待 `knowledge-core-web-dev` Argo Application 健康，再执行 Web、Gateway 直连和 BFF Smoke。
- Smoke 和 DeepSeek 发布摘要通过后，流水线仅 fast-forward 推送 `main`，并创建同一 SHA 的版本 Tag 与 GitHub Release；冲突或分叉时禁止强推。

关键流程补齐后增加 Playwright：注册/验证、登录/刷新、创建文档、发布、协作连接、AI 问答和举报审核。
