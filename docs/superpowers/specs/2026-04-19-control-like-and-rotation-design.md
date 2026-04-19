# 控评点赞与轮转转发设计

## 目标

围绕现有微博执行链路，新增两类高频能力，并保持最小侵入：

- 控评点赞：运营手动导入评论举报链接/评论直达链接后，按账号批量立即点赞
- 轮转转发：多账号对同一微博链接执行 5 次连续转发，每次携带不同数字文案

本设计优先保证第一版可执行、可追踪、可复盘，不在第一版引入复杂汇总看板与高级策略编排。

## 已确认需求

- 控评点赞支持两种入口：
  - 一次性批量粘贴链接直接下发
  - 评论链接池长期维护后按需下发
- 评论链接池独立页面承载，不与互动任务页耦合
- 评论链接池默认按评论 ID 去重，但允许强制重复导入
- 评论链接池条目支持备注与分组/tag
- 下发时支持先按 tag 过滤，再手动勾选微调
- 账号选择支持手动勾选；账号分组后续补
- 轮转转发支持多账号，每个账号各自执行 5 次
- 轮转转发立即开始执行，不走排期
- 轮转间隔第一版采用固定档位：`0/3/5/10` 秒，默认 `3` 秒
- 轮转文案第一版固定为纯数字：`1/2/3/4/5`
- 失败策略：某账号轮转失败则该账号停止，其他账号继续
- 结果查看第一版以日志可追踪为主，后续再补页面汇总面板
- 页面入口策略：独立页做主入口，互动任务页保留快捷入口

## 方案选择

采用分层方案（推荐方案 A）：

- 新增独立页面 `控评与轮转` 作为主入口
- 复用现有执行器请求能力（特别是评论点赞网页接口）
- 在执行器之上新增“编排层”，用于组织多账号、多步骤任务
- 保留现有互动任务页作为快捷入口，不改动其核心职责

该方案在开发复杂度、扩展性和稳定性之间平衡最好，适合当前运营工作流。

## 架构设计

### 分层

- 页面层：控评池与轮转创建/查看
- API 层：参数校验、任务创建、任务触发、任务查询
- 编排层：将高层任务展开为账号级与步骤级执行单元
- 执行层：复用 `weibo-executor` 发送点赞/转发请求
- 日志层：沿用 `writeExecutionLog`，补充编排上下文

### 任务模型

- 控评批量任务：`COMMENT_LIKE_BATCH`
  - 语义：`账号集合 x 评论链接集合` 的立即执行批次
- 轮转任务：`REPOST_ROTATION`
  - 语义：`账号集合 x 5步轮转` 的立即执行批次

## 数据模型（新增）

### `CommentLinkPoolItem`

- `id: String @id`
- `sourceUrl: String`（原始导入链接）
- `commentId: String?`（解析出的评论 ID）
- `note: String?`
- `tags: String`（第一版使用逗号分隔；后续可迁移为独立表）
- `isForcedDuplicate: Boolean @default(false)`
- `createdAt/updatedAt`

索引建议：

- `@@index([commentId])`
- `@@index([createdAt])`

### `ActionJob`

- `id: String @id`
- `jobType: String`（`COMMENT_LIKE_BATCH` / `REPOST_ROTATION`）
- `status: String`（`PENDING/RUNNING/SUCCESS/PARTIAL_FAILED/FAILED/CANCELLED`）
- `config: Json`（间隔档位、是否强制重复导入等）
- `summary: Json?`（成功账号数、失败账号数、步骤统计）
- `createdBy: String?`（关联用户）
- `createdAt/updatedAt`

索引建议：

- `@@index([jobType, createdAt])`
- `@@index([status, createdAt])`

### `ActionJobAccountRun`

- `id: String @id`
- `jobId: String`
- `accountId: String`
- `status: String`
- `currentStep: Int @default(0)`
- `totalSteps: Int`
- `errorMessage: String?`
- `createdAt/updatedAt`

索引建议：

- `@@index([jobId])`
- `@@index([accountId, createdAt])`

### `ActionJobStep`

- `id: String @id`
- `jobId: String`
- `accountId: String`
- `stepType: String`（`COMMENT_LIKE` / `REPOST`）
- `targetUrl: String`
- `payload: Json?`（轮转时存 `content: "1"..."5"`）
- `sequenceNo: Int`
- `status: String`
- `resultPayload: Json?`
- `errorMessage: String?`
- `startedAt: DateTime?`
- `finishedAt: DateTime?`
- `createdAt/updatedAt`

索引建议：

- `@@index([jobId, sequenceNo])`
- `@@index([accountId, status])`

## API 设计

### 控评池管理

- `GET /api/comment-pool`
  - 支持分页、关键词、tag 过滤
- `POST /api/comment-pool`
  - 新增单条链接，解析评论 ID，按默认去重规则入库
- `POST /api/comment-pool/batch-import`
  - 批量导入，支持 `forceDuplicate` 参数
- `DELETE /api/comment-pool/[id]`
  - 删除控评池条目

### 控评批量下发

- `POST /api/action-jobs/comment-like`
  - 入参：`accountIds[]`、`poolItemIds[]`
  - 行为：创建 `COMMENT_LIKE_BATCH`，立即展开并执行

### 轮转转发

- `POST /api/action-jobs/repost-rotation`
  - 入参：`accountIds[]`、`targetUrl`、`times=5`、`intervalSec`
  - `intervalSec` 只允许 `0/3/5/10`，默认 `3`
  - 行为：创建 `REPOST_ROTATION`，立即展开并执行

### 编排任务查询

- `GET /api/action-jobs`
- `GET /api/action-jobs/[id]`
- `POST /api/action-jobs/[id]/cancel`（第一版可选）

## 页面设计

### 新增页面：`/ops`（控评与轮转）

- Tab 1：`控评池`
  - 批量导入输入区（每行一个链接）
  - 强制重复导入开关
  - 列表（链接/commentId/备注/tags/创建时间/删除）
  - 过滤（tag + 关键词）
  - 勾选与全选
  - 账号勾选 + 一键“立即控评点赞”
- Tab 2：`轮转转发`
  - 目标链接输入
  - 多账号选择
  - 间隔档位选择（默认 3 秒）
  - 一键“立即开始轮转”

### 互动任务页改动

- 新增快捷入口跳转到 `/ops`
- 保持现有执行/删除流程，不承载复杂编排流程

## 执行流程

### 控评点赞执行

1. 读取选中的账号和评论池条目
2. 按账号生成 `ActionJobAccountRun`，按评论顺序生成 `ActionJobStep`
3. 每个账号内部串行执行评论点赞，多个账号可并行
4. 每步记录请求摘要、响应摘要、成功失败
5. 汇总 `ActionJob` 状态并输出统计

失败处理（第一版）：

- 单条评论点赞失败仅记录该步失败，不中断同账号后续评论点赞

### 轮转转发执行

1. 针对每个账号生成 5 个步骤，文案依次为 `1..5`
2. 账号内部串行执行，步骤间 sleep `intervalSec`
3. 某账号任一步失败则该账号后续步骤置为停止
4. 其他账号不受影响继续执行
5. 汇总 `ActionJob` 和账号级结果

## 权限与安全

- 页面访问：`VIEWER` 可看，`OPERATOR/ADMIN` 可操作
- API：
  - 查询接口最小 `VIEWER`
  - 创建/执行/删除接口最小 `OPERATOR`
- 复用当前 Cookie 与 XSRF 机制，不引入新的敏感凭据
- 不在日志中输出完整 Cookie，仅记录脱敏摘要

## 日志与可观测性

每个步骤写执行日志，至少包括：

- `jobId`
- `jobType`
- `accountId`
- `stepType`
- `sequenceNo`
- `targetUrl`
- `success`
- `errorMessage`
- `responsePayload` 摘要

第一版以日志页可追踪为主，后续再补任务页图形化汇总。

## 兼容与迁移

- 不移除现有 `interaction-tasks` 与执行接口
- 新能力以新增模型和新增 API 实现，不破坏旧链路
- 评论点赞继续沿用网页接口实现，避免回退到不稳定 App token 链路

## 验收标准

- 控评池支持批量导入、默认去重、强制重复导入、tag 过滤、勾选下发
- 控评下发支持多账号 x 多评论立即执行
- 轮转转发支持多账号各 5 次、数字文案、间隔档位
- 轮转失败策略满足“单账号失败即停，其他账号继续”
- 日志可追踪到任务、账号、步骤粒度
- `npm run lint` 与 `npm run build` 通过

## 范围边界（第一版不做）

- 账号分组管理 UI
- 自定义轮转文案模板
- 任务页高级汇总图表
- 智能风控策略（随机抖动、动态并发策略）

以上内容后续在验证第一版稳定后分期补充。
