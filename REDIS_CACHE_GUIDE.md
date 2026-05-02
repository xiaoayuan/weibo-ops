# Redis 缓存使用指南

## 概述

项目已集成 Redis 缓存层，用于缓存热点数据，减少数据库查询，提升性能。

## 配置

### 环境变量

```bash
# .env
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true  # 设置为 false 可禁用缓存
```

### 启动 Redis

```bash
# 使用 Docker
docker run -d -p 6379:6379 redis:alpine

# 或使用 Homebrew (macOS)
brew install redis
brew services start redis
```

---

## 基础用法

### 1. 导入缓存管理器

```typescript
import { CacheManager } from "@/lib/cache";
```

### 2. 设置缓存

```typescript
// 缓存数据，默认 5 分钟过期
await CacheManager.set("accounts:list", accounts);

// 自定义过期时间（秒）
await CacheManager.set("accounts:list", accounts, 600); // 10 分钟
```

### 3. 获取缓存

```typescript
const accounts = await CacheManager.get<Account[]>("accounts:list");

if (accounts) {
  // 使用缓存数据
  return accounts;
}

// 缓存未命中，查询数据库
const freshAccounts = await db.account.findMany();
await CacheManager.set("accounts:list", freshAccounts);
return freshAccounts;
```

### 4. 删除缓存

```typescript
// 删除单个缓存
await CacheManager.del("accounts:list");

// 批量删除（支持通配符）
await CacheManager.delPattern("accounts:*");
```

---

## 高级用法

### 1. 检查缓存是否存在

```typescript
const exists = await CacheManager.exists("accounts:list");
if (!exists) {
  // 缓存不存在，重新加载
}
```

### 2. 设置过期时间

```typescript
// 延长缓存时间
await CacheManager.expire("accounts:list", 1800); // 30 分钟
```

### 3. 获取剩余时间

```typescript
const ttl = await CacheManager.ttl("accounts:list");
console.log(`缓存还有 ${ttl} 秒过期`);
```

### 4. 清空所有缓存

```typescript
await CacheManager.flush();
```

---

## 缓存策略

### 1. Cache-Aside（旁路缓存）

最常用的缓存策略，适合读多写少的场景。

```typescript
export async function getAccounts() {
  // 1. 尝试从缓存获取
  const cached = await CacheManager.get<Account[]>("accounts:list");
  if (cached) {
    return cached;
  }

  // 2. 缓存未命中，查询数据库
  const accounts = await db.account.findMany();

  // 3. 写入缓存
  await CacheManager.set("accounts:list", accounts, 300);

  return accounts;
}
```

### 2. Write-Through（写穿）

写入数据时同时更新缓存。

```typescript
export async function updateAccount(id: string, data: UpdateData) {
  // 1. 更新数据库
  const account = await db.account.update({
    where: { id },
    data,
  });

  // 2. 更新缓存
  await CacheManager.set(`account:${id}`, account, 300);

  // 3. 删除列表缓存（触发重新加载）
  await CacheManager.del("accounts:list");

  return account;
}
```

### 3. Write-Behind（写回）

先写缓存，异步写数据库（高性能，但有数据丢失风险）。

```typescript
export async function createAccount(data: CreateData) {
  // 1. 生成临时 ID
  const tempId = `temp:${Date.now()}`;

  // 2. 立即写入缓存
  await CacheManager.set(`account:${tempId}`, data, 60);

  // 3. 异步写入数据库
  setTimeout(async () => {
    const account = await db.account.create({ data });
    await CacheManager.set(`account:${account.id}`, account, 300);
    await CacheManager.del(`account:${tempId}`);
  }, 0);

  return { id: tempId, ...data };
}
```

---

## 缓存键命名规范

### 格式

```
weibo:{resource}:{operation}:{params}
```

### 示例

```typescript
// 账号列表
"weibo:accounts:list"

// 单个账号
"weibo:account:123"

// 账号的计划列表
"weibo:account:123:plans"

// 分页数据
"weibo:logs:page:1:size:50"

// 统计数据
"weibo:stats:accounts:count"
```

---

## 实际应用示例

### 1. 缓存账号列表

```typescript
// apps/api/src/app/api/accounts/route.ts
import { CacheManager } from "@/lib/cache";

export async function GET() {
  try {
    // 尝试从缓存获取
    const cached = await CacheManager.get<Account[]>("accounts:list");
    if (cached) {
      return Response.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 查询数据库
    const accounts = await db.account.findMany({
      include: { proxyNode: true },
      orderBy: { createdAt: "desc" },
    });

    // 写入缓存（5 分钟）
    await CacheManager.set("accounts:list", accounts, 300);

    return Response.json({
      success: true,
      data: accounts,
      cached: false,
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: "获取账号列表失败",
    }, { status: 500 });
  }
}
```

### 2. 更新时清除缓存

```typescript
// apps/api/src/app/api/accounts/[id]/route.ts
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    // 更新数据库
    const account = await db.account.update({
      where: { id: params.id },
      data,
    });

    // 删除相关缓存
    await CacheManager.del(`account:${params.id}`);
    await CacheManager.del("accounts:list");
    await CacheManager.delPattern("accounts:page:*");

    return Response.json({
      success: true,
      data: account,
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: "更新账号失败",
    }, { status: 500 });
  }
}
```

### 3. 缓存分页数据

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");

  // 生成缓存键
  const cacheKey = `logs:page:${page}:size:${pageSize}`;

  // 尝试从缓存获取
  const cached = await CacheManager.get(cacheKey);
  if (cached) {
    return Response.json({ success: true, ...cached, cached: true });
  }

  // 查询数据库
  const [data, total] = await Promise.all([
    db.executionLog.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { executedAt: "desc" },
    }),
    db.executionLog.count(),
  ]);

  const result = {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };

  // 写入缓存（2 分钟）
  await CacheManager.set(cacheKey, result, 120);

  return Response.json({ success: true, ...result, cached: false });
}
```

---

## 性能优化建议

### 1. 合理设置 TTL

```typescript
// 热点数据 - 短 TTL
await CacheManager.set("stats:realtime", data, 30); // 30 秒

// 常规数据 - 中等 TTL
await CacheManager.set("accounts:list", data, 300); // 5 分钟

// 静态数据 - 长 TTL
await CacheManager.set("config:system", data, 3600); // 1 小时
```

### 2. 缓存预热

```typescript
// 应用启动时预加载热点数据
export async function warmupCache() {
  const accounts = await db.account.findMany();
  await CacheManager.set("accounts:list", accounts, 600);

  const plans = await db.interactionPlan.findMany();
  await CacheManager.set("plans:list", plans, 600);

  console.log("✓ 缓存预热完成");
}
```

### 3. 缓存失效策略

```typescript
// 数据变更时清除相关缓存
export async function invalidateAccountCache(accountId: string) {
  await Promise.all([
    CacheManager.del(`account:${accountId}`),
    CacheManager.del("accounts:list"),
    CacheManager.delPattern("accounts:page:*"),
    CacheManager.delPattern(`account:${accountId}:*`),
  ]);
}
```

---

## 监控和调试

### 1. 查看缓存命中率

```typescript
let hits = 0;
let misses = 0;

export async function getCacheStats() {
  return {
    hits,
    misses,
    hitRate: hits / (hits + misses),
  };
}
```

### 2. 日志记录

```typescript
export async function get<T>(key: string): Promise<T | null> {
  const value = await CacheManager.get<T>(key);
  
  if (value) {
    console.log(`[Cache HIT] ${key}`);
    hits++;
  } else {
    console.log(`[Cache MISS] ${key}`);
    misses++;
  }
  
  return value;
}
```

---

## 注意事项

1. **缓存一致性** - 更新数据时务必清除相关缓存
2. **缓存穿透** - 对不存在的数据也要缓存（设置短 TTL）
3. **缓存雪崩** - 避免大量缓存同时过期（添加随机 TTL）
4. **缓存击穿** - 热点数据使用互斥锁防止并发查询
5. **内存管理** - 定期清理过期缓存，避免内存溢出

---

## 禁用缓存

如果不需要 Redis 缓存，可以在 `.env` 中设置：

```bash
REDIS_ENABLED=false
```

所有缓存操作将自动跳过，不影响应用正常运行。
