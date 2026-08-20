# Knowledge Core Web

Knowledge Core 的桌面优先、响应式 Web 前端。当前阶段建立 Next.js App Router 基线与设计系统，后续按 core → media → AI → community 逐步接入 Knowledge-Core Gateway。

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
```

## 边界约定

- 浏览器不直接持有 access/refresh token；认证接入阶段通过 BFF HttpOnly cookie 与 Gateway 通信。
- `src/lib/api/types.ts` 只描述稳定的前后端契约；`gateway.ts` 是唯一的 Gateway 请求入口。
- Studio 当前是可预览的工作区壳，文档、文件夹与协作能力将在后续阶段接入。
