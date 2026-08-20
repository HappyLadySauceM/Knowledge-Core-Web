# 执行记录

## 2026-08-20：Stage 0 前端骨架

### 已完成

- 在 `Knowledge-Core-Web` 建立 `dev` 分支。
- 初始化 Next.js 16 App Router、React 19、TypeScript、pnpm、Tailwind 4。
- 建立双语路由：`/zh-CN`、`/en`。
- 建立主题系统：浅色、深色、跟随系统和手动切换。
- 建立 Knowledge Core 品牌壳：首页、导航、Studio 空间壳、登录入口壳。
- 建立组件基础：Button、Badge、主题切换、语言切换、站点 Header。
- 建立 API 边界：Problem Details、SessionUser、DocumentSummary、Folder 与 Gateway fetch 入口。
- 建立 Storybook、Vitest、Playwright 配置，并添加 Button 示例和单测。
- 更新 README，记录本地运行、质量门禁和 BFF 约定。

### 验证结果

```text
pnpm lint             通过
pnpm typecheck        通过
pnpm test             通过（1 test file / 1 test）
pnpm build            通过
pnpm build-storybook  通过
```

实际路由检查：`/` 返回 307 并跳转 `/zh-CN`；`/zh-CN`、`/en/studio`、`/zh-CN/login` 返回 200。

### 尚未接入

- 真实登录、refresh session 和 BFF Route Handler
- 文档、文件夹、版本与发布 API
- Tiptap 编辑器和 Yjs 协作连接
- 媒体上传
- AI、向量索引和公共 AI 限流
- 评论、通知、举报和审核

### 已知基线问题

Knowledge-Core 的既有 `make ci` 中，Go 检查、Go 测试、漏洞扫描、Rust fmt/clippy/test 均通过；`cargo deny` 因锁定的 `h2 0.4.15` 命中 `RUSTSEC-2026-0258` 失败。该问题不由本次 Web 骨架引入，后续应升级至 `h2 >= 0.4.16` 并重新验证。

## 2026-08-20：认证里程碑启动

### 已完成

- Knowledge-Core Collaboration 的 `h2` 已升级到 `0.4.16`，`cargo deny` advisories 已通过。
- Web 增加 GitHub Actions 工作流，固定 Node `24.18.1`、pnpm `10.31.0`，执行 lint、类型检查、单测、生产构建和 Storybook 构建。
- Core `make ci` 的 Go/Rust 检查、测试、漏洞扫描、生成检查和 release build 已通过；仅保留既有供应链配置的 unmatched warning。

### 认证范围（当前优先）

- Identity 已加入待验证账号、邮箱验证、密码找回、refresh token 轮换、设备会话撤销、全端登出和账号停用。
- 邮件操作令牌使用摘要保存，并通过加密 transactional outbox 交给可选 SMTP worker；数据库不保存明文令牌。
- Gateway 已暴露认证相关 HTTP 契约；Next.js BFF 使用 HttpOnly access/refresh cookies，并提供登录、注册、验证、找回密码和安全设置页面。

### 暂缓范围

文档编辑、文件夹、版本、发布、AI、向量索引、社区、评论、通知和审核暂不实现，待认证鉴权验收后再排期。

### 认证验证结果

```text
Knowledge-Core: GOFLAGS=-mod=mod go test ./... 通过
Knowledge-Core-Web: pnpm lint 通过
Knowledge-Core-Web: pnpm typecheck 通过
Knowledge-Core-Web: pnpm test 通过（1 test file / 1 test）
Knowledge-Core-Web: pnpm build 通过
Knowledge-Core-Web: pnpm build-storybook 通过
```
