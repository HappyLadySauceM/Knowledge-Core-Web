# Knowledge Core Web 文档

这里记录 Knowledge Core Web 的产品决策、技术边界、交付路线与执行状态。文档先于实现约束方向；如果代码与文档不一致，应在同一变更中更新文档。

## 文档索引

- [产品与范围](./product-scope.md)：目标用户、核心能力、非目标与体验原则
- [技术方案](./technical-plan.md)：前端、BFF、Knowledge-Core 集成与安全边界
- [交付路线](./roadmap.md)：core → media → AI → community 的阶段计划
- [执行记录](./progress.md)：已完成内容、验证结果与当前待办

## 当前状态

2026-09-11，Web 已通过同源 BFF 接入 Gateway 认证与业务 API，不再停留在 Stage 0 骨架。Stage 1 文档工作区（列表、文件夹、编辑/协作入口、回收站、公开发布文章与 locale RSS）以及 Stage 2 媒体库管理界面已在代码中落地；UX 打磨仍不完整（编辑器 slash/浮动工具栏、部分管理流、空状态与文案一致性等）。

已实现的 locale 路由（`src/app/[locale]/`）：

- `/` → `/zh-CN`
- `/{locale}` 首页
- `/{locale}/articles/[slug]` 公开文章
- `/{locale}/rss.xml`
- `/{locale}/studio` 文档与文件夹
- `/{locale}/studio/documents/[documentId]` 协作编辑
- `/{locale}/studio/media` 媒体库
- `/{locale}/studio/trash` 文档回收站
- `/{locale}/admin` 管理配置
- `/{locale}/login`、`/{locale}/register`、`/{locale}/verify-email`、`/{locale}/forgot-password`、`/{locale}/reset-password`
- `/{locale}/settings/security`

尚未实现：slash commands、作者页、归档、社区、AI 对话 UI。
