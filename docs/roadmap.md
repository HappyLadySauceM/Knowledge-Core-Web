# 交付路线

## Stage 0：Web 基础与设计系统（已完成）

- Next.js App Router 与 pnpm 工程基线
- 专业科技特效风视觉 token、浅色/深色主题
- 中文/英文路由
- 首页、Studio 空间壳、登录壳
- Storybook、Vitest、Playwright 配置
- Gateway DTO 与 BFF 请求边界

## Stage 1：Core 文档与发布（下一阶段）

- Identity：注册、邮箱验证、密码重置、刷新会话、全端登出、账号停用
- Knowledge：文档 CRUD、个人文件夹、标签、公开/私有、软删除和版本
- 作者主页、文章页、归档、RSS
- Tiptap 文档画布、slash command、浮动工具栏
- Collaboration：Yjs 文档会话、在线状态、权限变更和断线恢复
- 发布前预览、slug、SEO metadata、canonical URL

## Stage 2：Media

- 统一媒体库：图片、音频、视频、普通文件
- 预签名上传/下载、类型与大小校验、引用关系、软删除
- 本阶段不做转码服务；播放能力由浏览器和对象存储负责

## Stage 3：AI

- OpenAI-compatible chat 与 embedding 双路配置
- 私有文档自动索引、版本感知、失败重试和可观测性
- 写作助手、知识问答、引用来源和权限过滤
- 登录用户对话持久化
- 匿名公共 AI 的 Turnstile 校验、IP 配额和匿名会话限流

## Stage 4：Community

- 评论/回复、点赞、收藏、关注
- 站内通知
- 举报、审核队列、封禁/恢复和审计日志
- 公共作者 AI 查询与公开文章权限边界

## 每阶段退出条件

每阶段必须同时具备：

1. 可启动的用户路径。
2. API 契约和错误映射。
3. 权限、限流、幂等和审计边界。
4. 单测、集成测试及关键 Playwright 路径。
5. Storybook 组件状态与响应式验收。
6. 文档和运行命令同步更新。
