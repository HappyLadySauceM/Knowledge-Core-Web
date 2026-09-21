# Knowledge Core Web

Knowledge Core 的桌面优先、响应式 Web 前端。当前实现包含 Next.js App Router UI、设计系统、通过 HttpOnly cookie 管理会话的同源 BFF，以及文档、文件夹、成员、实时协作、媒体库和管理配置界面。文档保留实时编辑稿、最近一次公开快照和显式历史提交：编辑稿持续协作同步，公开页只在发布/更新时替换快照，手动保存、离开、发布和恢复会形成可查看的提交。

产品决策、技术边界和执行状态见 [docs/README.md](./docs/README.md)。

## 本地开发

```bash
pnpm install
pnpm dev
```

依赖与 Node 发行包走 npmmirror（淘宝镜像）：仓库 `.npmrc` 指向 `https://registry.npmmirror.com`，CI 的 `actions/setup-node` 使用 `https://cdn.npmmirror.com/binaries/node`。ARC runner 是按 job 隔离的临时 Pod，不挂载宿主机 Docker socket；pnpm / Playwright / Actions 工具缓存在节点 `/var/lib/hls-ci-cache`，不使用 GitHub Actions cache。

访问 `/zh-CN` 或 `/en`。主题默认跟随系统，也可以在右上角手动切换。

## 质量门禁

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm build-storybook
```

生产镜像使用 Next.js standalone server 构建；运行时通过 `KNOWLEDGE_CORE_GATEWAY_URL` 访问集群内 Gateway。`.github/workflows/pipeline.yml` 从 `.ci/pipeline.yaml` 读取服务、Harbor、Argo 和 Smoke 配置：质量/部署任务使用 `hls-standard`，特权镜像构建使用 `hls-builder`；当前最多 8 个 standard（request 2 CPU / 1Gi，limit 4 CPU / 4Gi）和 8 个 builder（DinD 4 CPU / 4Gi + runner 4 CPU / 1Gi）。`web-verify-build` 含 lint/typecheck/test/build、Playwright e2e 和 Storybook；没有独立的 `web-pull-request`。pipeline 末尾 `notify` job 发 CI 飞书卡；`.github/workflows/feishu-notify.yml` 只覆盖 PR、Issue、Review 和 Release，使用组织 `ci-templates` 复合 Action 与组织 secrets `FEISHU_WEBHOOK_URL` / `FEISHU_WEBHOOK_SECRET`，不使用 `release` environment。语言/工具缓存在节点 `/var/lib/hls-ci-cache`，不使用 GitHub Actions cache。Playwright CI 的 `webServer.timeout` 为 180s。Runner 的外部 HTTP(S) 流量由集群环境注入的 sing-box 代理控制，集群 API 使用 `https://kubernetes.default.svc:443`。校验结果、候选 digest 和 release 摘要通过 GitHub Artifacts 传递；`dev` 分支只有在 Argo CD 健康检查、部署 Smoke 和 Harbor API promotion 成功后才 fast-forward 到 `main` 并创建版本 Release。失败部署保留 Harbor 候选 tag，供同一 SHA 重跑复用；只有候选成功提升为 active tag 后才清理。runner 不挂载宿主机 Docker socket。

## 边界约定

- 浏览器不直接持有 access/refresh token；认证与 Gateway 请求通过同源 BFF 转换为 HttpOnly cookie 会话。
- `src/lib/api/types.ts` 只描述稳定的前后端契约；`gateway.ts` 是唯一的 Gateway 请求入口。
- Studio 通过领域客户端接入 Gateway，支持文档与文件夹管理、回收站、永久删除、发布/更新、成员权限、显式提交历史和 Yjs 实时协作；编辑稿由 IndexedDB 即时落盘，WebSocket 增量在 300ms 空闲或 1200ms 最大等待后合并提交，公开页只读取最近一次发布快照并保留快照中的空段落。已发布文档根据规范化作者内容 hash 计算“已是最新/更新”，不会因为连接握手或普通重渲染误启用更新。标题附近可隐式添加 Emoji 图标、摘要、标签和封面，封面同时用于编辑器、公开文章和首页卡片。文档、媒体、管理配置和账号安全使用独立的后台 Shell，公开站点导航不会复用到后台。
- 通用媒体库支持 multipart 直传、断点记录、扫描状态、下载、回收与恢复；旧文档附件接口只保留公开内容的只读兼容渲染。
- 管理员可在 `/{locale}/admin` 维护 site、email、ai 配置并查看当前修订的可靠投递状态。
