# 权限体系设计

## 目标

在不改动现有数据库角色模型的前提下，为项目补齐一套全链路 RBAC：统一控制导航显示、页面访问、前端操作入口和 API 权限，避免出现“页面可见但接口拒绝”或“接口已加权限但前端仍可误操作”的不一致问题。

本次只基于现有 `ADMIN`、`OPERATOR`、`VIEWER` 三种角色实现，不新增权限表，不引入更细粒度策略系统。

## 角色定义

- `ADMIN`：拥有全部权限，包括用户管理和系统设置
- `OPERATOR`：拥有业务模块的查看、编辑、审批和执行权限，但不管理用户和系统级配置
- `VIEWER`：拥有业务模块和日志的只读查看权限，不允许任何写操作、审批或执行

## 页面访问规则

- `控制台`：`VIEWER`
- `账号管理`：`VIEWER`
- `超话管理`：`VIEWER`
- `任务配置`：`VIEWER`
- `文案库`：`VIEWER`
- `每日计划`：`VIEWER`
- `互动任务`：`VIEWER`
- `执行日志`：`VIEWER`
- `用户管理`：`ADMIN`
- `系统设置`：`ADMIN`

未满足页面最小角色时：

- 导航中不显示该入口
- 用户直接访问页面时重定向到首页或登录页

## 操作权限规则

- `ADMIN`
  - 可执行全部读写、审批、执行、用户管理、系统设置操作
- `OPERATOR`
  - 可查看全部业务页
  - 可新增、编辑、删除账号、超话、任务配置、文案、计划、互动任务
  - 可审批和执行计划、互动任务
  - 不可访问用户管理和系统设置
- `VIEWER`
  - 可查看业务数据和日志
  - 不可新增、编辑、删除、审批、执行
  - 不可访问用户管理和系统设置

前端对无权限操作的处理：

- 隐藏新增、编辑、删除、审批、执行等按钮
- 保留列表和详情查看能力
- 表单区域保持只读，不允许提交

## API 权限规则

### 认证接口

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`

保持现状，不纳入业务 RBAC 变更范围。

### 用户管理

- `/api/users`
- `/api/users/[id]`

全部要求 `ADMIN`。

### 业务读写接口

- `/api/accounts*`
- `/api/super-topics*`
- `/api/topic-tasks*`
- `/api/copywriting*`
- `/api/plans`
- `/api/interaction-tasks`
- `/api/logs`

规则：

- `GET` 等只读操作要求 `VIEWER`
- `POST`、`PATCH`、`DELETE` 等写操作要求 `OPERATOR`
- `/api/logs` 为只读接口，要求 `VIEWER`

### 业务动作接口

- `/api/plans/generate`：`OPERATOR`
- `/api/plans/[id]/approve`：`OPERATOR`
- `/api/plans/[id]/reject`：`OPERATOR`
- `/api/plans/[id]/execute`：`OPERATOR`
- `/api/interaction-targets/parse`：`OPERATOR`
- `/api/interaction-tasks/batch-create`：`OPERATOR`
- `/api/interaction-tasks/[id]/approve`：`OPERATOR`
- `/api/interaction-tasks/[id]/reject`：`OPERATOR`
- `/api/interaction-tasks/[id]/execute`：`OPERATOR`

## 实现方案

### 服务端

继续复用 `src/lib/permissions.ts` 中已有的：

- `hasRequiredRole`
- `requireApiRole`
- `requirePageRole`

在此基础上补充更清晰的操作级判断函数，统一表达以下语义：

- 是否可以管理业务数据
- 是否可以审批和执行任务
- 是否可以管理用户
- 是否可以管理系统设置

这样页面和组件都复用同一套规则，避免在多个文件中手写角色字符串比较。

### 前端

页面继续使用 `requirePageRole` 做页面级拦截。

所有 manager 组件接收当前登录用户角色，基于共享权限函数控制：

- 是否显示新增按钮
- 是否显示编辑和删除操作
- 是否显示审批和执行按钮
- 是否允许提交表单

本次只做最小必要改动，不重构现有组件结构。

### 页面改造范围

- `src/app/(dashboard)/accounts/page.tsx`
- `src/app/(dashboard)/super-topics/page.tsx`
- `src/app/(dashboard)/topic-tasks/page.tsx`
- `src/app/(dashboard)/copywriting/page.tsx`
- `src/app/(dashboard)/plans/page.tsx`
- `src/app/(dashboard)/interactions/page.tsx`
- `src/app/(dashboard)/logs/page.tsx`
- `src/app/(dashboard)/users/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- 对应 `src/components/**/` 下各 manager 组件
- 对应 `src/app/api/**` 下相关路由

## 错误处理

- 前端遗漏权限控制时，API 仍返回 `401` 或 `403` 作为最终兜底
- 前端继续保留现有错误提示逻辑，确保用户能明确知道是权限不足而非普通失败
- 无登录态统一重定向到 `/login`

## 测试与验收

验收以三类账号行为一致性为标准：

- `ADMIN` 登录后可访问全部页面并执行全部操作
- `OPERATOR` 登录后可管理业务模块，但无法访问用户管理和系统设置
- `VIEWER` 登录后仅可查看，不出现任何业务写操作入口

静态验证要求：

- `npm run lint`
- `npm run build`

本次不引入新的测试框架；先以权限行为验证加静态构建验证为主。

## 范围边界

本次不包含：

- 数据库权限模型改造
- 更细粒度的资源级权限控制
- 审计日志模型新增字段
- 真正可编辑的系统设置中心
- 真实执行器能力扩展
