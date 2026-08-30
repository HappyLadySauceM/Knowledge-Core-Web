# Knowledge Core Web

Knowledge Core 的桌面优先、响应式 Web 前端。当前实现包含 Next.js App Router UI、设计系统，以及通过 HttpOnly cookie 管理会话的同源 BFF；文档、文件夹、协作等业务能力将按 core → media → AI → community 逐步接入 Knowledge-Core Gateway。

产品决策、技术边界和执行状态见 [docs/README.md](./docs/README.md)。

## 本地开发

```bash
pnpm install
pnpm dev
```

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

生产镜像使用 Next.js standalone server 构建；运行时通过 `KNOWLEDGE_CORE_GATEWAY_URL` 访问集群内 Gateway。`dev` 分支发布会在质量门禁、Argo CD 健康检查和部署 Smoke 通过后，fast-forward 推送到 `main` 并创建版本 Release。

## 边界约定

- 浏览器不直接持有 access/refresh token；认证与 Gateway 请求通过同源 BFF 转换为 HttpOnly cookie 会话。
- `src/lib/api/types.ts` 只描述稳定的前后端契约；`gateway.ts` 是唯一的 Gateway 请求入口。
- Studio 当前是可预览的工作区壳，文档、文件夹与协作能力将在后续阶段接入。
