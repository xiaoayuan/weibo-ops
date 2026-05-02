# 实时更新功能使用指南

## 概述

项目已实现实时更新功能，支持自动轮询和智能暂停，提供更好的用户体验。

---

## 功能特性

### 1. 基础轮询
- 自动定时刷新数据
- 可自定义轮询间隔
- 支持手动刷新
- 错误处理

### 2. 智能轮询
- 页面不可见时自动暂停
- 页面可见时自动恢复
- 节省资源和带宽

### 3. 条件轮询
- 满足条件时自动停止
- 适合任务状态监控
- 避免无效请求

---

## 使用方法

### 1. 基础轮询 Hook

```typescript
import { usePolling } from "@/lib/hooks/use-polling";

function MyComponent() {
  const [data, setData] = useState([]);

  const { refresh } = usePolling(
    async () => {
      const response = await fetch("/api/data");
      const result = await response.json();
      setData(result.data);
    },
    {
      interval: 3000, // 3秒轮询一次
      enabled: true, // 是否启用
      onError: (error) => {
        console.error("轮询失败:", error);
      },
    }
  );

  return (
    <div>
      <button onClick={refresh}>手动刷新</button>
      {/* 渲染数据 */}
    </div>
  );
}
```

### 2. 智能轮询 Hook

自动根据页面可见性暂停/恢复轮询：

```typescript
import { useSmartPolling } from "@/lib/hooks/use-polling";

function JobsList() {
  const [jobs, setJobs] = useState([]);

  useSmartPolling(
    async () => {
      const response = await fetch("/api/jobs");
      const result = await response.json();
      setJobs(result.data);
    },
    {
      interval: 5000, // 5秒
    }
  );

  return (
    <div>
      {jobs.map((job) => (
        <div key={job.id}>{job.name}</div>
      ))}
    </div>
  );
}
```

### 3. 条件轮询 Hook

满足条件时自动停止轮询：

```typescript
import { useConditionalPolling } from "@/lib/hooks/use-polling";

function TaskMonitor({ taskId }: { taskId: string }) {
  const [task, setTask] = useState(null);

  useConditionalPolling(
    async () => {
      const response = await fetch(`/api/tasks/${taskId}`);
      const result = await response.json();
      setTask(result.data);
      return result.data;
    },
    // 任务完成或失败时停止轮询
    (data) => data.status === "SUCCESS" || data.status === "FAILED",
    {
      interval: 2000, // 2秒
    }
  );

  return (
    <div>
      <p>状态: {task?.status}</p>
    </div>
  );
}
```

---

## 实际应用示例

### 1. 任务列表实时更新

```typescript
"use client";

import { useState } from "react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

export function JobsRealtimeList() {
  const [jobs, setJobs] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { refresh } = useSmartPolling(
    async () => {
      const response = await fetch("/api/action-jobs");
      const result = await response.json();
      
      if (result.success) {
        setJobs(result.data);
        setLastUpdate(new Date());
      }
    },
    { interval: 3000 }
  );

  const runningCount = jobs.filter((job) => job.status === "RUNNING").length;

  return (
    <div>
      {/* 状态栏 */}
      <div className="status-bar">
        <span>实时监控</span>
        <span>最后更新: {lastUpdate.toLocaleTimeString()}</span>
        {runningCount > 0 && (
          <span>{runningCount} 个任务运行中</span>
        )}
        <button onClick={refresh}>刷新</button>
      </div>

      {/* 任务列表 */}
      <div>
        {jobs.map((job) => (
          <div key={job.id}>
            <span>{job.id}</span>
            <span>{job.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. 计划状态监控

```typescript
"use client";

import { useState } from "react";
import { useConditionalPolling } from "@/lib/hooks/use-polling";

export function PlanMonitor({ planId }: { planId: string }) {
  const [plan, setPlan] = useState(null);
  const [stopped, setStopped] = useState(false);

  useConditionalPolling(
    async () => {
      const response = await fetch(`/api/plans/${planId}`);
      const result = await response.json();
      setPlan(result.data);
      return result.data;
    },
    (data) => {
      const isFinished = ["SUCCESS", "FAILED", "CANCELLED"].includes(data.status);
      if (isFinished) {
        setStopped(true);
      }
      return isFinished;
    },
    { interval: 2000 }
  );

  return (
    <div>
      <h3>计划 #{planId}</h3>
      <p>状态: {plan?.status}</p>
      {stopped && <p className="text-success">监控已停止</p>}
    </div>
  );
}
```

### 3. 账号登录状态监控

```typescript
"use client";

import { useState } from "react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

export function AccountStatusMonitor() {
  const [accounts, setAccounts] = useState([]);
  const [offlineCount, setOfflineCount] = useState(0);

  useSmartPolling(
    async () => {
      const response = await fetch("/api/accounts");
      const result = await response.json();
      
      if (result.success) {
        setAccounts(result.data);
        
        const offline = result.data.filter(
          (acc) => acc.loginStatus === "EXPIRED" || acc.loginStatus === "FAILED"
        ).length;
        
        setOfflineCount(offline);
        
        // 有账号离线时发送通知
        if (offline > 0) {
          new Notification(`${offline} 个账号离线`, {
            body: "请检查账号登录状态",
          });
        }
      }
    },
    { interval: 60000 } // 1分钟检查一次
  );

  return (
    <div>
      <h3>账号状态监控</h3>
      <p>总账号: {accounts.length}</p>
      <p className={offlineCount > 0 ? "text-danger" : "text-success"}>
        离线账号: {offlineCount}
      </p>
    </div>
  );
}
```

---

## 最佳实践

### 1. 选择合适的轮询间隔

```typescript
// 实时性要求高（任务状态）
{ interval: 2000 } // 2秒

// 一般数据更新（列表数据）
{ interval: 5000 } // 5秒

// 低频更新（统计数据）
{ interval: 30000 } // 30秒

// 监控类（账号状态）
{ interval: 60000 } // 1分钟
```

### 2. 使用智能轮询节省资源

```typescript
// ✅ 推荐：使用智能轮询
useSmartPolling(fetcher, { interval: 3000 });

// ❌ 不推荐：页面不可见时仍然轮询
usePolling(fetcher, { interval: 3000 });
```

### 3. 任务监控使用条件轮询

```typescript
// ✅ 推荐：任务完成后自动停止
useConditionalPolling(
  fetcher,
  (data) => data.status === "SUCCESS",
  { interval: 2000 }
);

// ❌ 不推荐：任务完成后仍然轮询
usePolling(fetcher, { interval: 2000 });
```

### 4. 错误处理

```typescript
useSmartPolling(
  async () => {
    try {
      const response = await fetch("/api/data");
      if (!response.ok) {
        throw new Error("请求失败");
      }
      const result = await response.json();
      setData(result.data);
    } catch (error) {
      console.error("获取数据失败:", error);
      // 不要抛出错误，避免轮询停止
    }
  },
  {
    interval: 5000,
    onError: (error) => {
      // 记录错误日志
      console.error("轮询错误:", error);
    },
  }
);
```

### 5. 避免过度轮询

```typescript
// ❌ 不推荐：间隔太短
usePolling(fetcher, { interval: 500 }); // 0.5秒

// ✅ 推荐：合理的间隔
usePolling(fetcher, { interval: 3000 }); // 3秒
```

---

## 性能优化

### 1. 缓存配合轮询

```typescript
// API 端添加缓存
export async function GET() {
  const cacheKey = "jobs:list";
  
  // 短 TTL 缓存（30秒）
  const cached = await CacheManager.get(cacheKey);
  if (cached) {
    return Response.json({ success: true, data: cached, cached: true });
  }
  
  const data = await db.job.findMany();
  await CacheManager.set(cacheKey, data, 30);
  
  return Response.json({ success: true, data, cached: false });
}

// 前端轮询间隔略大于缓存 TTL
useSmartPolling(fetcher, { interval: 35000 }); // 35秒
```

### 2. 批量更新

```typescript
// ✅ 推荐：一次请求获取所有数据
useSmartPolling(
  async () => {
    const response = await fetch("/api/dashboard");
    const { jobs, accounts, plans } = await response.json();
    setJobs(jobs);
    setAccounts(accounts);
    setPlans(plans);
  },
  { interval: 5000 }
);

// ❌ 不推荐：多个轮询
useSmartPolling(() => fetch("/api/jobs"), { interval: 5000 });
useSmartPolling(() => fetch("/api/accounts"), { interval: 5000 });
useSmartPolling(() => fetch("/api/plans"), { interval: 5000 });
```

### 3. 增量更新

```typescript
useSmartPolling(
  async () => {
    // 只获取最近更新的数据
    const response = await fetch(
      `/api/jobs?updatedAfter=${lastUpdate.toISOString()}`
    );
    const result = await response.json();
    
    // 合并新数据
    setJobs((prev) => [...result.data, ...prev]);
    setLastUpdate(new Date());
  },
  { interval: 5000 }
);
```

---

## 注意事项

1. **避免过度轮询** - 选择合理的轮询间隔
2. **使用智能轮询** - 页面不可见时自动暂停
3. **错误处理** - 不要让错误中断轮询
4. **条件停止** - 任务完成后停止轮询
5. **配合缓存** - 减少数据库压力
6. **批量更新** - 减少请求次数
7. **清理资源** - 组件卸载时自动清理

---

## 相关文档

- [REDIS_CACHE_GUIDE.md](REDIS_CACHE_GUIDE.md) - Redis 缓存使用指南
- [API_USAGE.md](apps/web/API_USAGE.md) - API 客户端使用指南

---

## 总结

实时更新功能提供了：
- ✅ 自动刷新数据
- ✅ 智能暂停/恢复
- ✅ 条件停止
- ✅ 手动刷新
- ✅ 错误处理
- ✅ 资源优化

合理使用轮询功能可以显著提升用户体验，同时保持良好的性能。
