-- 数据库索引优化迁移
-- 添加缺失的复合索引以提升查询性能

-- DailyPlan 表优化
-- 常见查询：按日期和状态筛选计划
CREATE INDEX IF NOT EXISTS "DailyPlan_planDate_status_idx" ON "DailyPlan"("planDate", "status");

-- 常见查询：按账号、日期和状态筛选
CREATE INDEX IF NOT EXISTS "DailyPlan_accountId_planDate_status_idx" ON "DailyPlan"("accountId", "planDate", "status");

-- 常见查询：按计划类型和状态筛选
CREATE INDEX IF NOT EXISTS "DailyPlan_planType_status_idx" ON "DailyPlan"("planType", "status");

-- ExecutionLog 表优化
-- 常见查询：按时间范围查询日志
CREATE INDEX IF NOT EXISTS "ExecutionLog_executedAt_idx" ON "ExecutionLog"("executedAt" DESC);

-- 常见查询：按成功状态和时间筛选
CREATE INDEX IF NOT EXISTS "ExecutionLog_success_executedAt_idx" ON "ExecutionLog"("success", "executedAt" DESC);

-- 常见查询：按操作类型和时间筛选
CREATE INDEX IF NOT EXISTS "ExecutionLog_actionType_executedAt_idx" ON "ExecutionLog"("actionType", "executedAt" DESC);

-- WeiboAccount 表优化
-- 常见查询：按状态筛选账号
CREATE INDEX IF NOT EXISTS "WeiboAccount_status_idx" ON "WeiboAccount"("status");

-- 常见查询：按登录状态筛选
CREATE INDEX IF NOT EXISTS "WeiboAccount_loginStatus_idx" ON "WeiboAccount"("loginStatus");

-- 常见查询：按所有者和状态筛选
CREATE INDEX IF NOT EXISTS "WeiboAccount_ownerUserId_status_idx" ON "WeiboAccount"("ownerUserId", "status");

-- InteractionTask 表优化
-- 常见查询：按状态和计划时间筛选
CREATE INDEX IF NOT EXISTS "InteractionTask_status_scheduledTime_idx" ON "InteractionTask"("status", "scheduledTime");

-- 常见查询：按账号和状态筛选
CREATE INDEX IF NOT EXISTS "InteractionTask_accountId_status_idx" ON "InteractionTask"("accountId", "status");

-- CopywritingTemplate 表优化
-- 常见查询：按状态筛选文案
CREATE INDEX IF NOT EXISTS "CopywritingTemplate_status_idx" ON "CopywritingTemplate"("status");

-- 常见查询：按创建时间排序
CREATE INDEX IF NOT EXISTS "CopywritingTemplate_createdAt_idx" ON "CopywritingTemplate"("createdAt" DESC);

-- ActionJob 表优化
-- 常见查询：按状态和创建时间筛选
CREATE INDEX IF NOT EXISTS "ActionJob_status_createdAt_idx" ON "ActionJob"("status", "createdAt" DESC);

-- ActionJobAccountRun 表优化
-- 常见查询：按任务和状态筛选
CREATE INDEX IF NOT EXISTS "ActionJobAccountRun_jobId_status_idx" ON "ActionJobAccountRun"("jobId", "status");

-- 性能提示：
-- 1. 这些索引会占用额外的存储空间（约 10-20% 的表大小）
-- 2. 写入操作会稍微变慢（需要更新索引）
-- 3. 但查询性能会显著提升（特别是复杂查询）
-- 4. 定期使用 ANALYZE 命令更新统计信息
