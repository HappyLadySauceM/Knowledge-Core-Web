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
