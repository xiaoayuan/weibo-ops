# 超话互动计划技术设计文档

## 1. 背景与目标

当前系统已经具备微博账号、超话任务、日计划生成、定时执行、执行日志、代理节点、风险识别等基础能力。现有互动能力主要覆盖：

- 超话签到
- 首评
- 发帖
- 点赞
- 评论

本次设计目标是在现有体系上扩展两类能力：

1. **增加“评论转发”互动能力**  
   支持系统在超话内选择目标微博，按计划执行转发，并可携带转发文案。

2. **按超话类型生成差异化互动计划**  
   根据超话所属类型，例如明星粉丝、影视剧综、生活兴趣、品牌活动等，自动生成更符合场景的互动组合、频率、时间分布和文案策略。

目标不是新建一套独立系统，而是复用现有 `DailyPlan` 日计划体系、执行器、日志、风控和调度能力，最小化改造成本。

---

## 2. 当前系统现状

### 2.1 核心数据模型

当前日计划模型为 `DailyPlan`，主要字段包括：

| 字段 | 含义 |
| --- | --- |
| `id` | 日计划 ID |
| `taskId` | 关联账号超话任务 |
| `accountId` | 微博账号 ID |
| `contentId` | 关联文案模板 |
| `planDate` | 计划日期 |
| `planType` | 计划类型 |
| `scheduledTime` | 计划执行时间 |
| `status` | 执行状态 |
| `targetUrl` | 目标微博或超话链接 |
| `resultMessage` | 执行结果说明 |

当前 `PlanType` 包括：

- `CHECK_IN`：签到
- `FIRST_COMMENT`：首评
- `POST`：发帖
- `LIKE`：点赞
- `COMMENT`：评论

当前 `TaskStatus` 包括：

- `PENDING`
- `READY`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `CANCELLED`

账号与超话任务由 `AccountTopicTask` 表维护，核心配置包括：

| 字段 | 含义 |
| --- | --- |
| `signEnabled` | 是否启用签到 |
| `firstCommentEnabled` | 是否启用首评 |
| `firstCommentPerDay` | 每日首评次数 |
| `likePerDay` | 每日点赞次数 |
| `repostPerDay` | 每日转发次数，当前模型已有字段 |
| `commentPerDay` | 每日评论次数 |
| `postEnabled` | 是否启用发帖 |
| `minPostsPerDay` / `maxPostsPerDay` | 每日发帖数量区间 |
| `startTime` / `endTime` | 执行时间窗口 |
| `firstCommentTemplates` | 首评文案模板 |

当前 `SuperTopic` 模型包括：

| 字段 | 含义 |
| --- | --- |
| `name` | 超话名称 |
| `boardName` | 板块/分类名称，当前为自由文本 |
| `topicUrl` | 超话链接 |

### 2.2 当前计划生成链路

当前日计划生成入口在：

```text
weibo-ops/src/server/plan-generator.ts
```

典型流程：

1. 查询启用状态的账号超话任务。
2. 根据任务配置生成当日计划。
3. 按 `startTime` / `endTime` 生成计划执行时间。
4. 为发帖、评论等计划绑定文案模板。
5. 写入 `DailyPlan`。
6. 定时任务按 `scheduledTime` 拉取待执行计划。

### 2.3 当前计划执行链路

计划执行入口在：

```text
weibo-ops/src/server/plans/execute-plan.ts
```

核心流程：

1. 校验计划是否存在、状态是否可执行。
2. 将计划置为 `RUNNING`。
3. 根据 `planType` 调用执行器。
4. 执行结束后更新计划状态。
5. 写入执行日志。
6. 调用风险分类逻辑。
7. 对网络类、平台繁忙类失败进行有限自动重试。

### 2.4 当前执行器能力

微博执行器在：

```text
weibo-ops/src/server/executors/weibo-executor.ts
```

当前已经存在的能力包括：

- 签到请求
- 发帖请求
- 点赞请求
- 评论请求
- 转发请求函数 `sendRepostRequest(...)`

需要注意：

当前底层已经存在转发请求实现，但日计划枚举、计划生成、执行分发、前端配置等链路尚未完整接入“转发计划”。

---

## 3. 评论转发功能设计

### 3.1 功能定义

“评论转发”指系统针对某个目标微博执行转发动作，并可携带转发文案。

业务上可分为两种模式：

1. **普通转发**  
   从超话最新微博中选取目标微博，执行转发。

2. **带评论语义的转发**  
   转发时携带一段自然语言文案，例如：
   - “这个观点很有意思”
   - “支持一下”
   - “刚好也想说这个”

在微博接口层面，该能力本质上仍然是转发请求，只是转发内容来自评论/互动文案模板。

### 3.2 建议新增计划类型

建议在 `PlanType` 中新增：

```prisma
REPOST
```

更新后计划类型为：

```prisma
enum PlanType {
  CHECK_IN
  FIRST_COMMENT
  POST
  LIKE
  COMMENT
  REPOST
}
```

原因：

- `AccountTopicTask` 当前已有 `repostPerDay` 和 `repostIntervalSec` 字段。
- 执行器中已有 `sendRepostRequest(...)` 基础能力。
- 单独增加 `REPOST` 比复用 `COMMENT` 更清晰，便于统计、风控、日志和失败重试。

### 3.3 数据模型调整

#### 3.3.1 Prisma 枚举调整

文件：

```text
weibo-ops/prisma/schema.prisma
```

修改 `PlanType`：

```prisma
enum PlanType {
  CHECK_IN
  FIRST_COMMENT
  POST
  LIKE
  COMMENT
  REPOST
}
```

#### 3.3.2 文案模板标签建议

现有 `CopywritingTemplate` 已支持 `tags: String[]`。

建议新增标签约定：

| 标签 | 用途 |
| --- | --- |
| `REPOST` | 转发文案 |
| `转发文案` | 中文运营标签 |
| `COMMENT_REPOST` | 带评论语义的转发文案 |
| `明星粉丝` / `影视剧综` / `生活兴趣` | 超话分类标签 |

这样可以通过标签组合筛选文案：

- 当前超话类型 = `明星粉丝`
- 当前动作 = `REPOST`
- 则优先选择同时包含 `REPOST` 和 `明星粉丝` 的模板
- 若无匹配，则降级选择通用 `REPOST` 模板

### 3.4 日计划生成改造

在 `plan-generator.ts` 中增加转发计划生成逻辑。

伪代码：

```ts
if (task.repostPerDay > 0) {
  const times = generateScheduleTimes({
    count: task.repostPerDay,
    intervalSec: task.repostIntervalSec,
    startTime: task.startTime,
    endTime: task.endTime,
  });

  for (const scheduledTime of times) {
    await prisma.dailyPlan.create({
      data: {
        taskId: task.id,
        accountId: task.accountId,
        planDate,
        planType: "REPOST",
        scheduledTime,
        status: "PENDING",
        contentId: selectedRepostTemplateId,
        targetUrl: null,
      },
    });
  }
}
```

目标微博选择建议分两种策略：

| 策略 | 说明 |
| --- | --- |
| 生成计划时确定 `targetUrl` | 便于提前锁定目标，但目标可能到执行时已经过时 |
| 执行计划时动态获取目标 | 更适合超话最新互动，推荐采用 |

推荐方案：

- 计划生成阶段只生成 `REPOST` 计划，不强制写入 `targetUrl`。
- 执行阶段如果 `targetUrl` 为空，则调用超话最新微博抓取逻辑动态选择目标。

当前 `execute-plan.ts` 对 `LIKE` / `COMMENT` 已有类似处理：当目标链接中无法识别微博 ID 时，会从超话最新帖子中取第一条作为目标。

建议扩展为：

```ts
if (
  (plan.planType === "LIKE" ||
   plan.planType === "COMMENT" ||
   plan.planType === "REPOST") &&
  !extractStatusIdFromUrl(resolvedTargetUrl || "")
) {
  // 从超话最新微博中选择目标
}
```

### 3.5 执行器改造

当前 `weibo-executor.ts` 已有 `sendRepostRequest(...)`。

需要补齐的部分：

1. 在执行器对外方法中增加 `REPOST` 分支。
2. 调用 `sendRepostRequest(targetUrl, cookie, repostContent, proxyConfig)`。
3. 将响应标准化为统一执行结果。
4. 写入请求端点、请求体、响应摘要、转发前后计数等信息。

建议统一结果字段：

```ts
{
  success: boolean;
  status: "SUCCESS" | "FAILED";
  message: string;
  responsePayload: {
    endpoint: string;
    mode: string;
    targetUrl: string;
    statusId: string;
    beforeRepostsCount?: number;
    afterRepostsCount?: number;
    attempts: unknown[];
  };
}
```

### 3.6 执行分发改造

在 `execute-plan.ts` 中，将 `REPOST` 纳入执行分发。

当前逻辑中 `COMMENT` 使用 `executeInteraction(...)`，其他类型使用 `executePlan(...)`。

建议方案：

- 如果 `executeInteraction(...)` 代表对目标微博的互动行为，则 `LIKE` / `COMMENT` / `REPOST` 都可以统一走 interaction 分支。
- 如果当前结构中 `LIKE` 已走 `executePlan(...)`，则也可以先在 `executePlan(...)` 中新增 `REPOST` 分支，减少重构。

推荐短期实现：

```ts
await executor.executePlan({
  planId: plan.id,
  accountId: plan.accountId,
  accountNickname: plan.account.nickname,
  accountLoginStatus: plan.account.loginStatus,
  planType: plan.planType,
  targetUrl: resolvedTargetUrl,
  content: plan.content?.content || null,
  topicName: plan.task?.superTopic.name || null,
  topicUrl: plan.task?.superTopic.topicUrl || null,
});
```

并在 `executePlan(...)` 内部增加：

```ts
case "REPOST":
  return sendRepostRequest(targetUrl, cookie, content, proxyConfig);
```

### 3.7 执行日志

新增或复用现有日志类型时，建议保持可观测性。

建议新增 actionType：

- `REPOST_EXECUTE_PRECHECKED`
- `REPOST_EXECUTE_SUCCESS`
- `REPOST_EXECUTE_FAILED`

如果不扩展日志枚举，也可继续使用统一的：

- `PLAN_EXECUTE_PRECHECKED`
- `PLAN_EXECUTE_BLOCKED`

但 `requestPayload.planType` 必须保留 `REPOST`，以便后续统计。

### 3.8 风控与失败重试

转发失败常见原因：

| 类型 | 示例 | 建议处理 |
| --- | --- | --- |
| 登录失效 | cookie 无效、账号未登录 | 标记账号风险，暂停执行 |
| 权限限制 | 账号被限制转发 | 标记平台限制 |
| 目标不可用 | 微博删除、不可见 | 换目标或失败 |
| 平台繁忙 | 5xx、接口返回 busy | 可自动重试一次 |
| 网络异常 | 代理超时、连接失败 | 可自动重试一次 |

当前系统已有错误分类和自动重试逻辑，建议将 `REPOST` 纳入同一套风控分类。

---

## 4. 按超话类型生成差异化互动计划

### 4.1 当前问题

当前 `SuperTopic.boardName` 是自由文本字段，只能作为人工分类或筛选字段使用。

现状不足：

- 没有标准化超话类型。
- 没有类型与互动策略的映射。
- 没有按类型选择文案模板的规则。
- 不同超话使用相同频率和时间策略，容易显得机械。

### 4.2 设计目标

引入“超话类型策略”，让不同类型超话生成不同的互动计划。

例如：

| 超话类型 | 典型行为 |
| --- | --- |
| 明星粉丝 | 签到、首评、点赞、转发、少量评论 |
| 影视剧综 | 发帖、评论、转发、点赞 |
| 生活兴趣 | 评论、发帖、点赞，弱首评 |
| 品牌活动 | 转发、评论、发帖，强调活动话术 |
| 游戏动漫 | 评论、转发、签到、热点跟帖 |

### 4.3 分类模型方案

#### 方案 A：复用 `SuperTopic.boardName`

优点：

- 改造最小。
- 当前已有字段。
- 前端和 API 改动少。

缺点：

- 字段不标准，容易出现多个同义值，例如“明星”“明星粉丝”“粉圈”。
- 不便于做策略匹配。

#### 方案 B：新增标准化字段 `category`

在 `SuperTopic` 增加：

```prisma
category String?
```

示例值：

- `STAR_FANDOM`
- `FILM_TV_VARIETY`
- `LIFESTYLE`
- `BRAND_CAMPAIGN`
- `GAME_ANIME`
- `GENERAL`

优点：

- 标准化，适合策略匹配。
- 可保留 `boardName` 作为展示字段。
- 后续可迁移为枚举或独立表。

缺点：

- 需要 Prisma migration。
- 前端管理页需要增加字段。

推荐方案：

短期复用 `boardName`，中期新增 `category` 标准字段。

### 4.4 策略配置设计

建议在代码中先维护默认策略配置，后续再产品化为数据库配置。

示例：

```ts
const topicInteractionProfiles = {
  STAR_FANDOM: {
    checkIn: true,
    firstCommentWeight: "high",
    likeWeight: "high",
    commentWeight: "medium",
    repostWeight: "medium",
    postWeight: "low",
    preferredWindows: ["08:00-10:00", "12:00-14:00", "19:00-23:00"],
    templateTags: ["明星粉丝"],
  },
  FILM_TV_VARIETY: {
    checkIn: true,
    firstCommentWeight: "medium",
    likeWeight: "medium",
    commentWeight: "high",
    repostWeight: "high",
    postWeight: "medium",
    preferredWindows: ["12:00-14:00", "20:00-23:30"],
    templateTags: ["影视剧综"],
  },
  LIFESTYLE: {
    checkIn: false,
    firstCommentWeight: "low",
    likeWeight: "medium",
    commentWeight: "high",
    repostWeight: "low",
    postWeight: "medium",
    preferredWindows: ["07:30-09:30", "18:00-22:00"],
    templateTags: ["生活兴趣"],
  },
};
```

### 4.5 计划数量生成规则

可使用两层规则：

1. **任务配置为上限或基础值**  
   例如 `likePerDay = 10`、`commentPerDay = 5`。

2. **超话类型策略做调整**  
   例如明星粉丝类提升点赞和首评，生活类降低首评。

示例：

```ts
const finalLikeCount = applyProfileWeight(task.likePerDay, profile.likeWeight);
const finalCommentCount = applyProfileWeight(task.commentPerDay, profile.commentWeight);
const finalRepostCount = applyProfileWeight(task.repostPerDay, profile.repostWeight);
```

权重示例：

| 权重 | 系数 |
| --- | --- |
| high | 1.2 |
| medium | 1.0 |
| low | 0.5 |
| off | 0 |

为避免行为过于机械，建议加入随机扰动：

```ts
finalCount = clamp(round(baseCount * weight * random(0.8, 1.2)), min, max)
```

### 4.6 时间分布规则

不同超话类型适合不同时间段：

| 类型 | 推荐时间 |
| --- | --- |
| 明星粉丝 | 早签到、午间、晚高峰 |
| 影视剧综 | 午间、剧集播出后、晚间 |
| 生活兴趣 | 早间、下班后 |
| 品牌活动 | 白天工作时间、活动节点 |
| 游戏动漫 | 午后、晚间、周末 |

执行时间生成建议：

- 保留任务级 `startTime` / `endTime`。
- 类型策略提供偏好时间窗。
- 取两者交集。
- 在交集内随机分布。
- 保证同账号同超话计划间隔不小于配置 interval。

### 4.7 文案选择规则

建议按以下优先级选择模板：

1. 同时匹配动作标签和超话类型标签。
2. 匹配动作标签。
3. 匹配通用标签。
4. 无模板则使用系统默认安全短文案。

例如转发文案选择：

```text
优先级 1：tags contains ["REPOST", "明星粉丝"]
优先级 2：tags contains ["REPOST"]
优先级 3：tags contains ["转发文案"]
优先级 4：默认文案
```

### 4.8 目标微博选择规则

当前 `fetchLatestPosts(...)` 可从超话中抓取最新帖子，返回：

- `id`
- `commentsCount`
- `targetUrl`

建议目标选择不要永远取第一条，而是按策略筛选：

| 动作 | 推荐目标选择 |
| --- | --- |
| 点赞 | 最新 10-30 条中随机 |
| 评论 | 评论数适中、非重复目标 |
| 转发 | 最新且互动量较高的目标 |
| 首评 | 评论数为 0 或低评论数目标 |

转发目标推荐规则：

1. 拉取最新 30 条。
2. 排除最近已互动过的微博。
3. 排除无法识别 statusId 的链接。
4. 优先选择评论数、转发数或发布时间符合条件的微博。
5. 在候选集中随机选择，避免总是第一条。

---

## 5. 推荐开发改造清单

### 5.1 后端改造

| 模块 | 改造内容 |
| --- | --- |
| Prisma schema | `PlanType` 新增 `REPOST` |
| migration | 生成并执行数据库迁移 |
| plan-generator | 根据 `repostPerDay` 生成 `REPOST` 计划 |
| execute-plan | `REPOST` 纳入目标解析和执行分发 |
| weibo-executor | 对外执行逻辑接入 `sendRepostRequest(...)` |
| CopywritingTemplate | 增加转发文案标签约定 |
| risk classifier | 确认转发失败响应能正确分类 |
| execution log | 确认日志记录 `planType=REPOST` |

### 5.2 前端改造

| 页面 | 改造内容 |
| --- | --- |
| 超话任务配置页 | 展示并编辑 `repostPerDay`、`repostIntervalSec` |
| 超话管理页 | 增加超话类型/分类配置 |
| 文案模板页 | 支持转发文案标签 |
| 日计划列表 | 支持展示 `REPOST` 类型 |
| 执行日志页 | 支持筛选和展示转发执行结果 |

### 5.3 配置与运营改造

| 项目 | 说明 |
| --- | --- |
| 超话类型字典 | 定义标准类型和中文显示名 |
| 互动策略配置 | 定义不同类型的动作权重和时间窗 |
| 文案模板库 | 为不同类型准备转发/评论/发帖文案 |
| 风控阈值 | 控制单账号每日转发、评论、点赞上限 |

---

## 6. 分阶段实施建议

### 阶段一：接入基础转发计划

目标：最小可用。

范围：

- `PlanType` 新增 `REPOST`
- 根据 `repostPerDay` 生成转发计划
- 执行器接入 `sendRepostRequest(...)`
- 执行日志可查看结果
- 失败可进入现有风险分类

验收标准：

- 后台可生成 `REPOST` 日计划。
- 定时任务可执行转发。
- 成功后计划状态为 `SUCCESS`。
- 失败后计划状态为 `FAILED`，并有明确失败原因。
- 执行日志中能看到目标链接、接口、响应摘要。

### 阶段二：接入转发文案模板

目标：让转发内容可运营配置。

范围：

- 文案模板增加 `REPOST` 标签。
- 计划生成时绑定转发文案。
- 执行时将 `content` 传给转发请求。
- 支持无文案时空转发或默认文案。

验收标准：

- 不同转发计划可使用不同文案。
- 可通过标签区分评论文案、发帖文案、转发文案。

### 阶段三：按超话类型生成差异化计划

目标：计划生成更贴近超话场景。

范围：

- 标准化超话类型。
- 建立类型与互动策略映射。
- 生成计划时根据类型调整数量、时间窗和文案标签。
- 支持默认策略兜底。

验收标准：

- 明星粉丝类超话生成更多签到、首评、点赞。
- 影视剧综类超话生成更多评论、转发和晚间计划。
- 生活兴趣类超话减少首评，增加自然评论和发帖。
- 未分类超话使用 `GENERAL` 默认策略。

### 阶段四：优化目标选择和风控

目标：提升成功率并降低行为异常风险。

范围：

- 目标微博从“取第一条”改为候选池随机。
- 记录近期互动目标，避免重复互动。
- 针对不同动作设置频率上限。
- 对失败类型做更细分类。

验收标准：

- 同账号不会短时间重复操作同一微博。
- 转发目标分布更自然。
- 网络失败可自动重试，账号限制不会反复重试。

---

## 7. 风险点与规避建议

### 7.1 平台接口变化

微博接口可能变更参数、校验方式或返回结构。

建议：

- 保留 `attempts` 详细日志。
- 请求失败时记录 endpoint、status、summary。
- 对关键接口做灰度账号验证。

### 7.2 账号风控

转发、评论、点赞属于高风险互动行为。

建议：

- 单账号每日转发量设置上限。
- 同账号操作间隔增加随机扰动。
- 不同动作错峰执行。
- 登录异常时立即暂停账号。

### 7.3 文案重复

大量重复文案容易触发平台限制。

建议：

- 文案模板按类型扩充。
- 支持同义改写或变量替换。
- 同账号短期内避免重复使用同一文案。

### 7.4 目标选择过于集中

如果总是操作最新第一条微博，行为模式明显。

建议：

- 从候选池随机选择。
- 结合发布时间、互动量、是否已操作做筛选。
- 记录账号维度的近期目标去重。

---

## 8. 推荐验收用例

### 8.1 转发计划生成

输入：

- `repostPerDay = 3`
- `repostIntervalSec = 1800`
- 时间窗口 `09:00-22:00`

期望：

- 当日生成 3 条 `REPOST` 计划。
- 计划时间均在窗口内。
- 计划间隔不小于配置值或符合现有调度规则。

### 8.2 转发执行成功

输入：

- 有效 cookie
- 可访问目标微博链接
- 有转发文案

期望：

- 调用微博转发接口成功。
- `DailyPlan.status = SUCCESS`
- `resultMessage` 显示转发成功。
- 执行日志包含接口响应摘要。

### 8.3 转发目标动态选择

输入：

- `REPOST` 计划无 `targetUrl`
- 任务关联超话有 `topicUrl`

期望：

- 执行时自动抓取超话最新微博。
- 选择一个可识别 statusId 的目标。
- 执行转发。

### 8.4 超话类型策略

输入：

- 超话类型：`STAR_FANDOM`
- 基础配置：点赞 10、评论 4、转发 3、发帖 1

期望：

- 点赞和首评权重提高。
- 转发保持中等频率。
- 发帖频率较低。
- 文案优先选择明星粉丝类模板。

---

## 9. 结论

当前系统已经具备接入“评论转发”和“按超话类型生成计划”的大部分基础设施：

- `AccountTopicTask` 已有转发次数和转发间隔字段。
- 执行器中已有 `sendRepostRequest(...)` 基础函数。
- `DailyPlan` 已能承载不同类型日计划。
- 执行链路已有状态流转、日志、风险分类和自动重试。
- `SuperTopic.boardName` 可作为短期分类入口。
- `CopywritingTemplate.tags` 可作为动作和类型文案筛选依据。

推荐优先级：

1. 先将 `REPOST` 接入日计划体系，形成基础闭环。
2. 再接入转发文案模板，提高运营可控性。
3. 然后引入超话类型策略，优化计划生成质量。
4. 最后优化目标选择、去重和风控，提升稳定性和自然度。
