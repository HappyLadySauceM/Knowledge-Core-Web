# Knowledge Core Web 文档

这里记录 Knowledge Core Web 的产品决策、技术边界、交付路线与执行状态。文档先于实现约束方向；如果代码与文档不一致，应在同一变更中更新文档。

## 文档索引

- [产品与范围](./product-scope.md)：目标用户、核心能力、非目标与体验原则
- [技术方案](./technical-plan.md)：前端、BFF、Knowledge-Core 集成与安全边界
- [交付路线](./roadmap.md)：core → media → AI → community 的阶段计划
- [执行记录](./progress.md)：已完成内容、验证结果与当前待办

## 当前状态

2026-08-20，第一阶段 Web 基础骨架已完成：Next.js App Router、双语路由、双主题、首页、Studio 壳、登录壳、Storybook、Vitest、Playwright 配置与 Gateway 契约边界已建立。业务 API 尚未接入。
