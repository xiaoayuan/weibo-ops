<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Collaboration Rules

## Default Delivery Rules

- After each code change is completed and verified, push the change to GitHub unless the user explicitly says not to.
- After each pushed change, provide VPS update commands.
- Prefer fixing real production issues and core execution flows before adding secondary features.
- Explanations, summaries, and user-facing guidance should be written in Chinese by default unless the user explicitly asks for another language.

## Project Priorities

Current core priorities, in order:

1. Comment control
2. Repost rotation
3. Daily plan generation and execution
4. Account availability and execution stability
5. Logs, observability, and recovery

Copywriting and AI features are auxiliary. Do not let them override the core execution roadmap unless the user explicitly redirects work there.

## Infrastructure Model

当前项目使用**三层架构 + 双节点执行**模型：

### 三层架构

```
浏览器 → web(3008) → api(3009) → app(3007)
```

- `app`（根目录）：旧后端主体，承载数据库、调度、执行器
- `api`（`apps/api`）：独立 API 骨架，逐步原生化新后端入口
- `web`（`apps/web`）：独立前端，通过 `api` 访问后端

### 双节点执行

- 主服务器 `controller`：承担主数据库、主后台、每日计划生成与调度
- 第二台服务器 `worker`：共享主服务器数据库，执行分布式 `action-job`（控评/轮转）

> 注意：上述"三层架构"是**部署架构**，双节点是**执行架构**，两者描述的是不同维度，不要混淆。

## Secrets Safety

以下密钥在所有节点（controller / worker）之间必须保持一致，不要随意修改：

- `JWT_SECRET`
- `ACCOUNT_SECRET_KEY`
- 若两边都启用 AI，则 AI 接口密钥也要一致

修改任何一个都可能导致登录失效或 Cookie 解密失败。

## Session Handoff

Before continuing work in a new session, read:

- `docs/session-handoff.md`
- `docs/ops-runbook.md`

These files contain the current system state, deployment expectations, and recovery notes.
