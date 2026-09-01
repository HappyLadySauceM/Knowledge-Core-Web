# Knowledge Core Web

Knowledge Core 的桌面优先、响应式 Web 前端。当前实现包含 Next.js App Router UI、设计系统，以及通过 HttpOnly cookie 管理会话的同源 BFF；文档、文件夹、协作等业务能力将按 core → media → AI → community 逐步接入 Knowledge-Core Gateway。

产品决策、技术边界和执行状态见 [docs/README.md](./docs/README.md)。

## 本地开发

```bash
pnpm install
pnpm dev
```

依赖与 Node 发行包走 npmmirror（淘宝镜像）：仓库 `.npmrc` 指向 `https://registry.npmmirror.com`，CI 的 `actions/setup-node` 使用 `https://cdn.npmmirror.com/binaries/node`。ARC runner 是按 job 隔离的临时 Pod，不依赖宿主机目录或 Docker socket；为避免跨宿主机缓存不一致，CI 不恢复 GitHub Actions 的 pnpm 缓存。

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

生产镜像使用 Next.js standalone server 构建；运行时通过 `KNOWLEDGE_CORE_GATEWAY_URL` 访问集群内 Gateway。`.github/workflows/pipeline.yml` 从 `.ci/pipeline.yaml` 读取服务、Harbor、Argo 和 Smoke 配置：质量/部署任务使用 `hls-standard`，特权镜像构建使用 `hls-builder` 并按 matrix 并行（最多 4 个，standard 池最多 8 个）。校验结果、候选 digest 和 release 摘要通过 GitHub Artifacts 传递；`dev` 分支只有在 Argo CD 健康检查、部署 Smoke 和 Harbor API promotion 成功后才 fast-forward 到 `main` 并创建版本 Release。runner 不挂载宿主机 Docker socket。

## 边界约定

- 浏览器不直接持有 access/refresh token；认证与 Gateway 请求通过同源 BFF 转换为 HttpOnly cookie 会话。
- `src/lib/api/types.ts` 只描述稳定的前后端契约；`gateway.ts` 是唯一的 Gateway 请求入口。
- Studio 当前是可预览的工作区壳，文档、文件夹与协作能力将在后续阶段接入。
