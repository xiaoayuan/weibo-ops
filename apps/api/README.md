# apps/api 当前状态

`apps/api` 当前默认运行时是 `src/server.ts`，基于 `Hono` 启动，职责是：

- 对外提供 `3009` API 入口
- 统一加响应头、WebSocket 与少量边界能力
- 以 `proxy-first` 模式把 `/api/*` 请求转发到旧后端 `app`

## 当前不是默认生效链路的内容

仓库中仍保留了 `src/app/api/**` 下的一批 Next Route Handler。

这些文件当前处于“迁移停放区”状态：

- 不参与 `npm run dev:api`
- 不参与 `apps/api` 当前 `build` / `lint` 主链
- 不应被视为生产已接管的独立 API 实现

保留它们的目的，是为后续逐步原生化 API 预留迁移素材，而不是表示这套路由已经在当前运行链路中生效。

## 当前开发约定

- 若要修改当前 `3009` 服务的真实行为，优先改 `src/server.ts`、`src/http/**`、`src/lib/**`
- 若要推进独立 API 原生化，先明确迁移范围，再把对应路由正式纳入运行时、构建与校验链路
