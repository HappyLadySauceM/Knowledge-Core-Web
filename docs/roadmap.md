# 交付路线

## Stage 0：Web 基础与设计系统（已完成）

- Next.js App Router 与 pnpm 工程基线
- 专业科技特效风视觉 token、浅色/深色主题
- 中文/英文路由
- 首页、Studio 空间壳、登录壳
- Storybook、Vitest、Playwright 配置
- Gateway DTO 与 BFF 请求边界

## Stage 1：Core 文档与发布（代码已接入，UX 未完成）

代码中已通过 BFF/Gateway 落地的部分：

- Identity：注册、邮箱验证、密码重置、刷新会话、全端登出、账号停用
- Knowledge：文档 CRUD、个人文件夹、标签、公开/私有、软删除和版本
- Tiptap 文档画布与 Collaboration：Yjs 文档会话、在线状态入口
- 公开文章页、slug、SEO metadata、canonical URL、locale RSS
- Studio 文档列表、文件夹、回收站、成员与版本入口

仍未完成：

- slash commands 与浮动工具栏
- 作者主页
- 归档
- 编辑器与 Studio 的其余 UX 打磨

## Stage 2：Media（代码已接入，UX 未完成）

代码中已落地：

- 统一媒体库：图片、音频、视频、普通文件
- 预签名上传/下载、类型与大小校验、引用关系、软删除
- Studio `/{locale}/studio/media` 管理界面

仍未完成：媒体库交互与空状态等 UX 打磨。本阶段不做转码服务；播放能力由浏览器和对象存储负责。

## Stage 3：AI

仍未完成（含 AI 对话 UI）：

- OpenAI-compatible chat 与 embedding 双路配置
- 私有文档自动索引、版本感知、失败重试和可观测性
- 写作助手、知识问答、引用来源和权限过滤
- 登录用户对话持久化
- 匿名公共 AI 的 Turnstile 校验、IP 配额和匿名会话限流
- 产品内 AI chat UI

## Stage 4：Community

仍未完成：

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
