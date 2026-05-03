# 微博运营台 - 第一阶段代码审查报告

> 审查日期：2026-05-04
> 审查范围：后端 ~70 文件 + 前端 ~90 组件 + 21 个 Markdown 文档

---

## 修订说明

本报告基于 2026-05-04 的全面代码审查。根据用户确认的数据隔离策略，以下结论已做相应调整：

| 资源类型 | 原审查结论 | 修正后结论 |
|----------|-----------|-----------|
| 微博账号 | "缺失 ownerUserId 过滤" | **正确有过滤，非安全漏洞** |
| 每日计划 | "缺失 ownerUserId 过滤" | **正确有过滤，非安全漏洞** |
| 执行日志 | "缺失 ownerUserId 过滤" | **ADMIN 可见全部是设计行为，非漏洞** |
| 互动任务 | "缺失 ownerUserId 过滤" | **隔离型资源，正确** |
| **控评任务 (ActionJob)** | "缺失 ownerUserId 过滤（数据泄露）" | **公共资源，无需过滤，实际正确** |
| **文案库** | 未审查 | **公共资源，无需过滤** |
| **超话** | 未审查 | **公共资源，无需过滤** |
| **评论池 (CommentPool)** | "缺失 ownerUserId 过滤（严重泄露）" | **公共资源，无需过滤，实际正确** |

---

## 数据隔离策略（已确认）

详细规则见：[`docs/superpowers/specs/2026-05-04-data-isolation-policy.md`](./docs/superpowers/specs/2026-05-04-data-isolation-policy.md)

- **隔离型**：微博账号、每日计划、执行日志、互动任务 → 按 `ownerUserId` 隔离，ADMIN 除外
- **公共型**：控评任务、转发轮转、文案库、超话、话题任务、代理节点、代理绑定、首评锁定 → 全员共享

---

## 一、安全问题（必须修复）

### 1.1 🔴 语法错误 — 日志 API 会崩溃

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/app/api/logs/route.ts` | 5 | `requireApiRole("VIEWER")` —— 多了一个尾部 `R`，枚举值是 `"VIEWER"`（无 R）。所有用户访问日志页都返回 403。**直接阻断功能。** |

**修复**：
```diff
- const auth = await requireApiRole("VIEWER");  // 多了一个 R
+ const auth = await requireApiRole("VIEWER");
```

### 1.2 🔴 语法错误 — 登录端点崩溃

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/app/api/auth/login/route.ts` | 30-32 | `|| "")),` —— 多了一个右括号。Form-data 登录请求会 parse error。 |

**修复**：`|| ""),` → `|| "")),` 应改为 `|| "")`

### 1.3 🟡 CSRF 风险

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/app/api/auth/login/route.ts` | 17 | `sameSite: "lax"` + 无 CSRF Token，状态变更操作（POST/PUT/DELETE）存在 CSRF 风险。建议改为 `sameSite: "strict"` 或实现 CSRF Token。 |

### 1.4 🟡 硬编码凭证

| 文件 | 行 | 问题 |
|------|----|------|
| `src/server/executors/weibo-executor.ts` | 162 | `WEIBO_APP_SEND_QUERY` 的 env fallback 值是真实的微博客户端参数（含设备指纹）。虽然通过环境变量可覆盖，但默认值暴露了内部标识。 |
| `prisma/seed.ts` | 全局 | `admin123456` / `demo123456` 硬编码在源码中，生产误执行 seed 会覆盖密码。 |

### 1.5 🟡 错误信息泄露

多个 catch 块直接返回 `error.message` 给客户端，可能暴露内部路径、SQL 错误、堆栈信息。

| 文件 | 风险 |
|------|------|
| `apps/api/src/app/api/auth/register/route.ts:96` | `error.message` 直接返回 |
| `apps/api/src/app/api/proxy-nodes/route.ts:77-80` | 暴露 "同一主机端口已存在" 等 DB 约束信息 |
| 几乎所有路由的 catch 块 | 条件性泄露内部错误细节 |

---

## 二、逻辑 Bug

### 2.1 🔴 人为延迟函数从未执行

| 文件 | 行 | 问题 |
|------|----|------|
| `src/server/action-jobs/runner.ts` | 289-295 | `simulateBrowsePauseMs()` 和 `simulateTypingDelayMs()` 返回的是 **数字而非 Promise**。调用处没有 `await` 也没有 `sleep()`，延迟被完全忽略。执行速度比预期快，更容易被微博检测。 |

**修复**：将这两个函数包装为 `async` 并在调用处 `await`。

### 2.2 🟠 重试计数 Off-by-One

| 文件 | 行 | 问题 |
|------|----|------|
| `src/server/action-jobs/runner.ts` | 605-627 | `retryCount = attempt + 1` 在 `shouldRetryTransient` 返回 false 时不会设置，导致失败记录的 `retryCount` 为 0（实际已执行了一次）。 |

### 2.3 🟡 POST 计划生成但被阻止执行

| 文件 | 问题 |
|------|------|
| `src/server/plan-generator.ts` | 仍在生成 `POST` 类型的 DailyPlan |
| `src/server/executors/precheck.ts` | 但执行器直接 `return buildBlockedResult("发帖功能已下线")` |

导致无用数据库记录产生。

### 2.4 🟡 plan-generator 空内容 ID

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/lib/plan-generator.ts` | 260, 303 | 当文案库为空时，`contentIds` 为空数组，`pickRandomId([])` 返回 `undefined`，但计划仍被创建。执行时会因内容为空而失败。 |

### 2.5 🟢 重复代码路径（Dead Code）

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/lib/weibo-executor.ts` | 942-948 | `commentMode` 判断中 `Boolean(commentId) || ...` 已短路，中间分支永远无法到达。 |

### 2.6 🟢 WebSocket close 事件重复注册

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/lib/websocket.ts` | 100, 124 | `ws.on("close", ...)` 注册了两次，复制粘贴遗留。 |

---

## 三、并发与性能

### 3.1 🟠 竞态条件 — ActionJob 重复分发

| 文件 | 行 | 问题 |
|------|----|------|
| `src/server/action-jobs/dispatcher.ts` | 41-58 | 从 `findMany` 获取待分发任务到 `updateMany` 认领之间无行级锁。多节点部署时同一任务可能被多个节点同时认领执行，导致重复操作。 |

**修复**：使用 Prisma 的 `updateMany` 原子操作或将 `findMany` + `updateMany` 合并为带 `FOR UPDATE` 的事务查询。

### 3.2 🟠 竞态条件 — 注册码超用

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/app/api/auth/register/route.ts` | 45-58 | `findUnique` 后 `updateMany` 之间存在时间窗口，并发注册可用同一邀请码超出 `maxUses`。 |

**修复**：使用 Prisma transaction 将 `findUnique` 和 `updateMany` 原子化，或使用 `UPDATE ... WHERE usedCount < maxUses RETURNING *` 原子查询。

### 3.3 🟡 N+1 查询

| 文件 | 行 | 问题 |
|------|----|------|
| `src/server/action-jobs/runner.ts` | 325-358 | `recomputeCommentLikeRunStatus` 在每个并行 step 中调用，每次 2 次 DB 查询。1000 steps 产生 ~2000 次查询。 |

### 3.4 🟡 Redis KEYS 命令阻塞

| 文件 | 行 | 问题 |
|------|----|------|
| `apps/api/src/lib/cache.ts` | 106-117 | `delPattern` 使用 `redis.keys()` 扫描全 keyspace。生产环境大量 key 时可导致 Redis 冻结。 |

**修复**：改用 `SCAN` 命令迭代删除。

### 3.5 🟡 缺失数据库索引

| 表 | 字段 | 建议 |
|----|------|------|
| `InteractionTarget` | `targetUrl` | 查询频繁但无索引 |
| `WeiboAccount` | `lastActiveAt` | 排序/查询常用字段无索引 |
| `ExecutionLog` | `userId` | 直接按 userId 查询日志无独立索引 |
| `DailyPlan` | `taskId` | 任务下计划查询无独立索引 |

### 3.6 🟡 无优雅关闭

Prisma 连接池和 Redis 连接在 SIGTERM 时未清理，可能丢失进行中的请求。

---

## 四、前端问题

### 4.1 🟡 API Client 两套混用

| 文件 | 说明 |
|------|------|
| `src/lib/api/client.ts` | 返回裸 `data` |
| `src/lib/hooks/use-api.ts` | SWR 封装，返回 `{ success, data, message }` |

两套混用导致数据获取模式不一致，建议统一或明确文档说明各自适用场景。

### 4.2 🟡 多个组件缺少空状态展示

大量列表组件在无数据时仅有空白或 loading spinner，无"暂无数据"提示。

### 4.3 🟡 缺少 Error Boundary

未找到 React Error Boundary 实现，组件渲染错误会导致整页崩溃。

### 4.4 🟢 控制台日志可能泄露敏感信息

部分组件 `console.log` 了完整 API 响应，建议改为只打印必要字段。

### 4.5 🟢 缺少键盘无障碍支持

表单提交和表格操作大量依赖鼠标点击，无键盘快捷键。

---

## 五、代码质量

### 5.1 🟠 双重实现（重复代码）

以下模块在 `src/server/` 和 `apps/api/src/lib/` 各有一份高度相同的代码：

| 模块 |
|------|
| `plan-generator.ts` |
| `proxy-pool.ts` |
| `weibo-executor.ts` |
| `ai-copywriting.ts` |
| `ai-risk.ts` |
| `action-job-nodes.ts` |
| 所有 validators |

维护两份代码极易引入不一致 bug，建议后续重构为共享模块。

### 5.2 🟡 验证器校验不足

| 文件 | 问题 |
|------|------|
| `account-session.ts` | `cookie` 字段 `max(10000)` 可能不够，微博 Cookie 常超过 10KB |
| 各验证器 | `accountId`、`contentId` 等字段仅 `z.string().min(1)`，无 cuid 格式校验 |
| `auth.ts` (register) | `inviteCode` 无字符集限制 |
| `user.ts` | `username` 无字符集限制（空格、emoji 可入） |
| `plan.ts` | 日期格式仅正则，不验证日期有效性（如 2024-13-45 会通过） |

### 5.3 🟡 API 响应格式不统一

各路由混用 `{ success, message }` 和 `{ success, message, errors }` 等不同结构，前端需针对性处理。

### 5.4 🟢 `executionWindowEnd` 空字符串边界问题

| 文件 | 问题 |
|------|------|
| `account.ts` 验证器 | `executionWindowStart >= executionWindowEnd` 在 `executionWindowEnd=""` 时 `"" >= ""` 为 true，会误报。需先判断空字符串情况。 |

---

## 六、文档问题

### 6.1 🔴 必须删除或重写的文档

| 文件 | 问题 |
|------|------|
| `IMPLEMENTATION_SUMMARY.md` | 声称完成了 56%，但所有列出的组件文件都不存在。内容与代码完全不符。 |
| `QUICK_IMPROVEMENT_GUIDE.md` | 全部是未勾选 TODO，引用了 10+ 个不存在的文件。 |
| `IMPROVEMENT_CHECKLIST.md` | 同样引用大量不存在的文件，与上述文档大量重复。 |
| `OPTIMIZATION_SUMMARY.md` | 列出不存在的分拆组件和假性能数据。 |
| `apps/web/API_USAGE.md` | 混淆了两套 API client 的用法，与实际代码不符。 |

**建议**：这些文档建议直接删除或改名为 `*.deprecated.md`，避免误导后续维护者。

### 6.2 🟡 CHANGELOG.md 过时

最后更新 2026-05-03，但 `session-handoff.md` 记录的后续特性（代理池增强、受控并发等）均未记录。

### 6.3 🟡 环境变量缺失

`.env.example` 中缺少 `REDIS_URL`、`REDIS_ENABLED`，但这两个变量在 `REDIS_CACHE_GUIDE.md` 中被引用。

### 6.4 🟢 AGENTS.md 与实际架构描述不一致

AGENTS.md 描述的"两节点模型"与 README 中的三层架构（app→api→web）描述不统一。

---

## 七、修复优先级清单

### 🔴 P0 — 立即修复（阻断性）

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| P0-1 | 日志路由拼写错误 | `apps/api/src/app/api/logs/route.ts:5` | `"VIEWER"` → `"VIEWER"` |
| P0-2 | 登录路由多余括号 | `apps/api/src/app/api/auth/login/route.ts:30-32` | 删除多余 `)` |
| P0-3 | 模拟延迟函数不生效 | `src/server/action-jobs/runner.ts:289-295` | 改为 async 函数 + await |
| P0-4 | 生产环境 seed 风险 | `prisma/seed.ts` | 添加 `NODE_ENV` 检测，生产环境拒绝执行 |

### 🟠 P1 — 高优先级（安全性/稳定性）

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| P1-1 | CSRF 风险 | `auth/login/route.ts:17` | `sameSite: "strict"` 或加 CSRF Token |
| P1-2 | 重试计数 off-by-one | `runner.ts:605-627` | 调整赋值时机 |
| P1-3 | POST 计划生成无用记录 | `plan-generator.ts` + `precheck.ts` | 生成时跳过 POST 类型或标记为废弃 |
| P1-4 | plan-generator 空内容 ID | `plan-generator.ts:260,303` | 空文案时跳过对应类型计划生成 |
| P1-5 | 注册码并发超用 | `register/route.ts:45-58` | 事务原子化 |
| P1-6 | ActionJob 分发竞态 | `dispatcher.ts:41-58` | 原子 claim 或 FOR UPDATE 锁 |
| P1-7 | Redis KEYS 阻塞 | `cache.ts:106-117` | 改用 SCAN 命令 |
| P1-8 | 硬编码微博参数 | `weibo-executor.ts:162` | 移除 fallback default 值 |

### 🟡 P2 — 中优先级（质量提升）

| # | 问题 | 修复方案 |
|---|------|----------|
| P2-1 | 合并重复代码 | 重构 `src/server/` 和 `apps/api/src/lib/` 为共享模块 |
| P2-2 | 验证器增强 | cuid 格式校验、cookie 大小扩大、inviteCode 字符集限制 |
| P2-3 | 添加数据库索引 | InteractionTarget.targetUrl、WeiboAccount.lastActiveAt 等 |
| P2-4 | 优雅关闭 | Prisma/Redis SIGTERM handler |
| P2-5 | 统一 API 响应格式 | 提取公共响应包装函数 |
| P2-6 | 前端空状态组件 | 为列表组件添加"暂无数据"展示 |
| P2-7 | API Client 统一 | 明确两套 client 的职责边界 |

### 🟢 P3 — 文档整理（可选）

| # | 问题 | 修复方案 |
|---|------|----------|
| P3-1 | 删除过时文档 | 删除 `IMPLEMENTATION_SUMMARY.md`、`QUICK_IMPROVEMENT_GUIDE.md`、`IMPROVEMENT_CHECKLIST.md`、`OPTIMIZATION_SUMMARY.md` 或改名为 `.deprecated.md` |
| P3-2 | 更新 CHANGELOG | 补充 2026-05-03 之后的功能 |
| P3-3 | 更新 API_USAGE.md | 明确两套 API client 各自用途 |
| P3-4 | 添加 Redis 环境变量 | `REDIS_URL`、`REDIS_ENABLED` 加入 `.env.example` |
| P3-5 | 统一 AGENTS.md | 与 README 的三层架构描述对齐 |
| P3-6 | 删除冗余文档 | `BATCH_OPERATIONS_GUIDE.md`、`PERFORMANCE_MONITORING_GUIDE.md`、`REALTIME_UPDATE_GUIDE.md`、`REDIS_CACHE_GUIDE.md` 内容均已部分过时 |

---

## 八、架构亮点（无需改动）

- ✅ 三层分离架构（app / api / web）清晰合理
- ✅ Prisma ORM + PostgreSQL，数据模型设计完整
- ✅ 轮转加权随机算法（控评 + 转发）实现完整
- ✅ 代理池自动分配与故障转移机制
- ✅ 熔断器模式（circuit breaker）保护账号安全
- ✅ Zod 统一验证覆盖主要 API
- ✅ WebSocket 实时推送架构设计合理
- ✅ RBAC 权限体系（ADMIN / OPERATOR / VIEWER）实现完整
- ✅ 每日计划自动生成逻辑完善
- ✅ 数据隔离策略清晰（已文档化）

---

## 九、建议第一阶段收尾步骤

1. **修复所有 P0 问题**（4 项）—— 阻断性问题，修复后才能正常测试
2. **修复 P1-1~P1-8 中的 4~5 项** —— 建议优先：CSRF、注册码竞态、ActionJob 竞态、Redis KEYS、硬编码参数
3. **清理过时文档（P3-1）** —— 删除引用不存在文件的文档，避免维护者被误导
4. **验证数据隔离逻辑** —— 确认非 ADMIN 用户访问 `/api/logs`、`/api/plans` 等返回 403，ADMIN 返回全部
5. **补充 .env.example** —— 加入 Redis 相关变量
6. **启动测试** —— 核心流程：登录 → 添加账号 → 保存 Cookie → 执行控评任务 → 查看日志

---

*本报告由 AI 代码审查生成。数据隔离策略以 [`docs/superpowers/specs/2026-05-04-data-isolation-policy.md`](./docs/superpowers/specs/2026-05-04-data-isolation-policy.md) 为准。*