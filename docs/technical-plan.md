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
- BFF 统一转发 Problem Details、request id、trace context 和超时语义。
- 浏览器端只能依赖稳定的前后端 DTO；当前类型入口为 `src/lib/api/types.ts`。
- Gateway 请求入口为 `src/lib/api/gateway.ts`，不在页面组件中散落 `fetch`。

## Knowledge-Core 对接原则

- Go Gateway、Identity、Knowledge 与 Rust Collaboration 的领域边界保持不变。
- 前端不绕过 Gateway 直接访问服务数据库、Redis、NATS 或协作实例。
- IDL 与服务端生成代码仍归 Knowledge-Core 所有；Web 只消费稳定 HTTP/RPC 映射。
- 协作 WebSocket ticket 必须为短时、一次性、绑定用户/文档/实例的 opaque 值。
- 任何跨服务写入、事件发布、索引任务都遵循幂等、重试、死信和补偿约束。

## 路由壳

当前已实现：

- `/{locale}`：产品首页与视觉入口
- `/{locale}/studio`：桌面优先工作区壳
- `/{locale}/login`：认证入口壳
- `/`：重定向到 `/zh-CN`

当前页面为静态可预览骨架，未连接真实业务 API。

## 质量门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build-storybook
```

关键流程补齐后增加 Playwright：注册/验证、登录/刷新、创建文档、发布、协作连接、AI 问答和举报审核。
