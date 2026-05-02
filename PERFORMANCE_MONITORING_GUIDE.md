# 性能监控使用指南

## 概述

项目已集成性能监控工具，可以追踪 API 响应时间、慢查询、错误率和缓存命中率。

---

## 功能特性

### 1. 自动监控
- API 请求自动记录
- 响应时间追踪
- 错误自动捕获
- 缓存命中率统计

### 2. 慢查询检测
- 自动识别慢查询（>1000ms）
- 控制台警告提示
- 慢查询列表查看

### 3. 统计报告
- 总请求数
- 成功/失败率
- 平均响应时间
- 最快/最慢请求
- 缓存命中率
- 错误率

---

## 使用方法

### 1. 查看实时统计

在浏览器控制台中：

```javascript
// 查看最近 5 分钟的统计
performanceMonitor.printReport(5 * 60 * 1000);

// 查看所有统计
performanceMonitor.printReport();
```

输出示例：
```
📊 性能监控报告
总请求数: 150
成功请求: 145
失败请求: 5
平均响应时间: 245ms
缓存命中率: 75%
错误率: 3%
最慢请求: API:GET /api/plans (1250ms)
最快请求: API:GET /api/accounts (35ms)
慢查询数量: 3
```

### 2. 查看慢查询

```javascript
// 查看所有慢查询（>1000ms）
const slowQueries = performanceMonitor.getSlowQueries();
console.table(slowQueries);

// 查看超过 500ms 的查询
const queries = performanceMonitor.getSlowQueries(500);
console.table(queries);
```

### 3. 查看错误列表

```javascript
const errors = performanceMonitor.getErrors();
console.table(errors);
```

### 4. 获取统计数据

```javascript
// 获取最近 1 分钟的统计
const stats = performanceMonitor.getStats(60 * 1000);

console.log(`平均响应时间: ${stats.averageResponseTime}ms`);
console.log(`缓存命中率: ${stats.cacheHitRate}%`);
console.log(`错误率: ${stats.errorRate}%`);
```

### 5. 导出数据

```javascript
// 导出所有性能数据
const data = performanceMonitor.export();

// 保存为 JSON
const json = JSON.stringify(data, null, 2);
console.log(json);

// 或下载为文件
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'performance-data.json';
a.click();
```

---

## 自动监控

### API 请求自动监控

所有通过 `apiRequest` 发送的请求都会自动记录：

```typescript
import { apiGet } from '@/lib/api/client';

// 自动记录性能
const accounts = await apiGet<Account[]>('/api/accounts');
```

监控记录包括：
- 请求 URL
- 请求方法
- 响应时间
- 成功/失败状态
- 是否来自缓存

### 缓存命中自动追踪

当 API 返回缓存数据时，自动记录缓存命中：

```json
{
  "name": "Cache:HIT /api/accounts",
  "duration": 0,
  "timestamp": 1234567890,
  "success": true,
  "cached": true
}
```

---

## 手动监控

### 监控自定义函数

```typescript
import { performanceMonitor } from '@/lib/performance-monitor';

async function processData() {
  return performanceMonitor.measure(
    'processData',
    async () => {
      // 你的代码
      await heavyComputation();
      return result;
    }
  );
}
```

### 监控组件渲染

```typescript
import { useEffect } from 'react';
import { usePerformanceMonitor } from '@/lib/performance-monitor';

function MyComponent() {
  const cleanup = usePerformanceMonitor('MyComponent');

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return <div>...</div>;
}
```

---

## 性能优化建议

### 1. 识别慢查询

```javascript
// 查看慢查询
const slowQueries = performanceMonitor.getSlowQueries();

// 分析最慢的 10 个请求
slowQueries.slice(0, 10).forEach(query => {
  console.log(`${query.name}: ${query.duration}ms`);
});
```

**优化方案**：
- 添加数据库索引
- 实施缓存策略
- 优化查询逻辑
- 减少数据量

### 2. 提升缓存命中率

```javascript
const stats = performanceMonitor.getStats();
console.log(`当前缓存命中率: ${stats.cacheHitRate}%`);
```

**目标**：
- 热点数据缓存命中率 > 80%
- 一般数据缓存命中率 > 60%

**优化方案**：
- 增加缓存 TTL
- 预热热点数据
- 优化缓存键设计

### 3. 降低错误率

```javascript
const errors = performanceMonitor.getErrors();
console.log(`错误率: ${performanceMonitor.getStats().errorRate}%`);
```

**目标**：
- 错误率 < 1%

**优化方案**：
- 添加重试机制
- 改进错误处理
- 修复 API 问题

---

## 实时监控面板

### 创建监控组件

```typescript
"use client";

import { useState, useEffect } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";

export function PerformanceMonitorPanel() {
  const [stats, setStats] = useState(performanceMonitor.getStats());

  useEffect(() => {
    const timer = setInterval(() => {
      setStats(performanceMonitor.getStats(60 * 1000)); // 最近 1 分钟
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="performance-panel">
      <h3>性能监控</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总请求</div>
          <div className="stat-value">{stats.totalRequests}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">平均响应时间</div>
          <div className="stat-value">{stats.averageResponseTime}ms</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">缓存命中率</div>
          <div className="stat-value">{stats.cacheHitRate}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">错误率</div>
          <div className={`stat-value ${stats.errorRate > 5 ? 'text-danger' : ''}`}>
            {stats.errorRate}%
          </div>
        </div>
      </div>

      {stats.slowestRequest && (
        <div className="slow-query-alert">
          <strong>最慢请求:</strong> {stats.slowestRequest.name} 
          ({stats.slowestRequest.duration}ms)
        </div>
      )}
    </div>
  );
}
```

---

## 性能基准

### 响应时间基准

| 类型 | 目标 | 警告 | 严重 |
|------|------|------|------|
| 缓存命中 | < 50ms | > 100ms | > 200ms |
| 简单查询 | < 200ms | > 500ms | > 1000ms |
| 复杂查询 | < 500ms | > 1000ms | > 2000ms |
| 列表查询 | < 300ms | > 800ms | > 1500ms |

### 缓存命中率基准

| 数据类型 | 目标 | 警告 |
|----------|------|------|
| 热点数据 | > 80% | < 60% |
| 一般数据 | > 60% | < 40% |
| 动态数据 | > 40% | < 20% |

### 错误率基准

| 场景 | 目标 | 警告 |
|------|------|------|
| 正常运行 | < 0.5% | > 1% |
| 高峰期 | < 2% | > 5% |

---

## 定期检查

### 每日检查

```javascript
// 查看昨天的统计
const oneDayAgo = 24 * 60 * 60 * 1000;
performanceMonitor.printReport(oneDayAgo);
```

### 每周检查

```javascript
// 导出一周的数据进行分析
const weekData = performanceMonitor.export();
const lastWeek = weekData.filter(
  m => Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000
);

// 分析趋势
console.log(`一周总请求: ${lastWeek.length}`);
console.log(`平均响应时间: ${
  lastWeek.reduce((sum, m) => sum + m.duration, 0) / lastWeek.length
}ms`);
```

---

## 故障排查

### 1. 响应时间突然变慢

```javascript
// 查看最近的慢查询
const recent = performanceMonitor.getSlowQueries().filter(
  m => Date.now() - m.timestamp < 5 * 60 * 1000 // 最近 5 分钟
);

console.table(recent);
```

### 2. 错误率突然升高

```javascript
// 查看最近的错误
const recentErrors = performanceMonitor.getErrors().filter(
  m => Date.now() - m.timestamp < 5 * 60 * 1000
);

console.table(recentErrors);
```

### 3. 缓存命中率下降

```javascript
const stats = performanceMonitor.getStats(60 * 1000);
console.log(`缓存命中率: ${stats.cacheHitRate}%`);

// 检查是否 Redis 连接问题
// 检查缓存 TTL 是否过短
// 检查缓存键是否正确
```

---

## 最佳实践

1. **定期查看报告** - 每天查看一次性能报告
2. **设置告警** - 慢查询和错误自动记录到控制台
3. **导出数据分析** - 定期导出数据进行深度分析
4. **优化慢查询** - 及时优化响应时间 > 1000ms 的请求
5. **监控缓存** - 保持缓存命中率 > 60%
6. **追踪错误** - 错误率 > 1% 时立即排查

---

## 总结

性能监控工具帮助你：
- ✅ 实时了解系统性能
- ✅ 快速定位性能瓶颈
- ✅ 追踪优化效果
- ✅ 预防性能问题

建议在开发和生产环境都启用性能监控，持续优化系统性能。
