# `apps/web -> apps/api` 联调排查地图

## 使用方式

当你在独立前端联调时，如果某个动作失败，不要先凭感觉改代码。

先按下面顺序定位：

1. 问题发生在哪一层
2. 对应看哪个页面提示
3. 对应看哪个接口响应
4. 对应看哪个日志动作类型
5. 再决定是环境问题、账号问题、代理问题、AI 问题，还是执行器问题

## 四层定位法

### 第一层：前端表现

先看用户肉眼能看到什么：

1. 页面直接报错
2. 操作成功但列表没刷新
3. 操作成功但状态不对
4. 一直 loading
5. 扫码二维码不出

这一步决定你下一步优先看接口还是看日志。

### 第二层：接口响应

前端主要通过 `/api/*` 调 `apps/api`。

优先看：

1. 浏览器 Network 面板
2. `apps/api` 控制台输出
3. HTTP 状态码
4. 响应里的 `success`、`message`、`data`

判断规则：

1. `401/403`
   - 多半是登录态或权限问题

2. `400`
   - 多半是参数校验失败

3. `404`
   - 多半是资源不存在，或 ownerUserId 不匹配

4. `500`
   - 多半是服务端执行异常、第三方接口异常、数据库问题

### 第三层：业务日志

如果接口成功了但行为不符合预期，去 `/logs` 看业务日志。

重点动作类型：

#### 账号侧
- `ACCOUNT_SESSION_SAVED`
- `ACCOUNT_SESSION_CHECKED`

#### 计划侧
- `PLAN_GENERATED`
- `PLAN_APPROVED`
- `PLAN_REJECTED`
- `PLAN_STOPPED`
- `PLAN_SCHEDULED`
- `PLAN_EXECUTE_BLOCKED`
- `PLAN_EXECUTE_PRECHECKED`
- `FIRST_COMMENT_EXECUTE_SUCCESS`
- `FIRST_COMMENT_EXECUTE_FAILED`
- `FIRST_COMMENT_REQUEUED`

#### 互动侧
- `INTERACTION_TASK_CREATED`
- `INTERACTION_APPROVED`
- `INTERACTION_STOPPED`
- `INTERACTION_SCHEDULED`
- `INTERACTION_EXECUTE_BLOCKED`
- `INTERACTION_EXECUTE_PRECHECKED`

#### 控评/轮转侧
- `ACTION_JOB_SCHEDULED`
- `ACTION_JOB_STOPPED`

### 第四层：底层依赖

如果业务日志已经说明是执行问题，再看：

1. 数据库状态
2. 代理配置
3. 账号 Cookie
4. `EXECUTOR_MODE`
5. AI 环境变量

## 按功能排查

### 1. 登录失败

先看：
- `/api/auth/login`

常见原因：
1. 用户名或密码错误
2. `JWT_SECRET` 不一致
3. Cookie 没成功写入

看哪里：
1. 浏览器 Network 里 `/api/auth/login`
2. 登录后访问 `/api/auth/me`

### 2. 页面能进，但刷新后掉登录

先看：
- `/api/auth/me`

常见原因：
1. Cookie 没写上
2. Cookie 域/secure 配置不对
3. `JWT_SECRET` 不一致

### 3. 扫码登录失败

先看接口：
- `/api/accounts/[id]/session/qr/start`
- `/api/accounts/[id]/session/qr/status`

常见原因：
1. 代理不可用
2. 微博扫码接口超时
3. 二维码过期
4. 确认后未拿到有效 Cookie
5. `ACCOUNT_SECRET_KEY` 不一致导致保存后解密失败

看哪里：
1. 页面提示
2. `qr/status` 返回的 `message`
3. `/logs` 里是否有 `ACCOUNT_SESSION_SAVED`

### 4. 手动录入 Cookie 后登录态检测失败

先看接口：
- `/api/accounts/[id]/session`
- `/api/accounts/[id]/check-session`

常见原因：
1. Cookie 本身失效
2. Cookie 不完整
3. 微博返回 401/403
4. 代理链路导致访问失败

看哪里：
1. 页面提示
2. `ACCOUNT_SESSION_CHECKED`
3. 日志里的 `matchedRule`、`httpStatus`、`responseSummary`

### 5. 评论池导入失败

先看接口：
- `/api/comment-pool`
- `/api/comment-pool/batch-import`

常见原因：
1. 链接里无法识别评论 ID
2. 评论 ID 已存在
3. 链接格式不规范

### 6. 热评提取失败

先看接口：
- `/api/comment-pool/hot-comments`

常见原因：
1. 微博链接里无法识别状态 ID
2. 微博公开接口返回非 JSON
3. 该微博暂无热评
4. 微博接口限流或临时异常

### 7. 计划生成失败

先看接口：
- `/api/plans/generate`

常见原因：
1. 任务配置数据异常
2. 文案库缺少有效文案
3. 数据库写入失败

看日志：
- `PLAN_GENERATED`

### 8. 计划执行失败

先分两类：

1. `PLAN_EXECUTE_BLOCKED`
   - 说明是预检没过
   - 多半是登录态、目标链接、文案、超话信息问题

2. `PLAN_EXECUTE_PRECHECKED`
   - 说明请求已经真正发起
   - 多半是平台返回、代理、风控、回查确认问题

#### `FIRST_COMMENT` 重点排查

看日志：
- `FIRST_COMMENT_EXECUTE_FAILED`
- `FIRST_COMMENT_REQUEUED`
- `FIRST_COMMENT_EXECUTE_SUCCESS`

常见原因：
1. 没找到 0 回复帖子
2. 没首评文案
3. Cookie 解密失败
4. 发评论请求未通过

### 9. 互动任务执行失败

看日志：
- `INTERACTION_EXECUTE_BLOCKED`
- `INTERACTION_EXECUTE_PRECHECKED`

判断方式：

1. `BLOCKED`
   - 参数/登录态/链接格式预检失败

2. `PRECHECKED`
   - 已进入真实请求阶段
   - 再看 `responsePayload` 和 `riskMeta`

### 10. 控评/轮转创建成功但停止没效果

看接口：
- `/api/action-jobs/[id]/stop`

看日志：
- `ACTION_JOB_STOPPED`

再看数据库状态：
1. `actionJob.status`
2. `actionJobAccountRun.status`
3. `actionJobStep.status`

如果日志写了停止成功，但 UI 仍显示执行中，多半是前端刷新或缓存问题。

### 11. AI 相关失败

涉及接口：
- `/api/copywriting/ai-*`
- `/api/ai-risk/*`

常见原因：
1. `AI_API_KEY` 没配
2. `AI_BASE_URL` 不合法
3. `AI_MODEL` 不可用
4. 外部 AI 接口返回 401/429/500

判断方式：
1. 页面提示是否明确
2. Network 是否 400/500
3. 后端 message 是否为 `AI_* 未配置` 或 `AI 服务请求失败`

## 高风险环境项

最容易造成“看起来像代码问题，实际是环境问题”的是：

1. `JWT_SECRET`
2. `ACCOUNT_SECRET_KEY`
3. `EXECUTOR_MODE`
4. `AI_API_KEY`
5. `AI_BASE_URL`
6. `DATABASE_URL`
7. 代理节点配置

## 最值得优先看的页面

如果你只想快速判断当前链路是否稳定，优先看：

1. `/accounts`
2. `/plans`
3. `/interactions`
4. `/ops`
5. `/logs`

这 5 个页面能覆盖：
- 鉴权
- 账号 Cookie
- 调度
- 真实执行
- 日志回写

## 当前阶段建议

当前不要再先去大面积改代码。

更好的顺序是：

1. 按 `web-api-integration-checklist.md` 跑联调
2. 把失败样本按动作分类
3. 再针对失败样本定点增强 `WeiboExecutor`

也就是说，接下来最有价值的输入不是“再多迁一点代码”，而是“真实联调时哪类动作还失败”。
