# API 客户端和状态管理使用指南

> 注意：本项目存在**两套 API 客户端**，职责不同，请根据场景选择使用。

## 两套 client 的职责边界

| 客户端 | 所在文件 | 适用场景 | 返回值 |
|--------|----------|----------|--------|
| **裸数据 client** | `apps/web/src/lib/api/client.ts` | 页面级数据获取、单次请求、工具函数 | 直接返回 `data`（抛出 ApiError） |
| **SWR Hooks client** | `apps/web/src/lib/hooks/use-api.ts` | 需要缓存、自动刷新、轮询的场景 | `{ data, error, isLoading, mutate }` |
| **状态管理 hooks** | `apps/web/src/lib/api/hooks.ts` | 表单提交、批量操作、手动控制状态 | `{ mutate, loading, error }` |

> **规则**：优先使用 `apps/web/src/lib/api/client.ts` + `apps/web/src/lib/api/hooks.ts`，这两套是推荐组合。`apps/web/src/lib/hooks/use-api.ts`（SWR 风格）用于需要缓存和自动刷新的场景。

---

## 1. 裸数据 API Client（推荐）

文件：`apps/web/src/lib/api/client.ts`

### 基本用法

```typescript
import { apiGet, apiPost, apiPatch, apiDelete, handleApiError } from "@/lib/api/client";

// GET 请求
const accounts = await apiGet<WeiboAccount[]>("/api/accounts");

// GET 请求带参数
const plans = await apiGet<DailyPlan[]>("/api/plans", { date: "2026-05-03" });

// POST 请求
const newAccount = await apiPost<WeiboAccount>("/api/accounts", {
  nickname: "测试账号",
  cookie: "...",
});

// PATCH 请求
const updated = await apiPatch<WeiboAccount>(`/api/accounts/${id}`, {
  status: "ACTIVE",
});

// DELETE 请求
await apiDelete(`/api/accounts/${id}`);
```

### 错误处理

```typescript
import { handleApiError } from "@/lib/api/client";

try {
  const data = await apiGet("/api/accounts");
} catch (error) {
  const message = handleApiError(error);
  console.error(message); // 用户友好的错误消息
}
```

---

## 2. 状态管理 Hooks（推荐用于表单）

文件：`apps/web/src/lib/api/hooks.ts`

### useApiData - 数据获取

```typescript
import { useApiData } from "@/lib/api/hooks";

function AccountsList() {
  const { data, loading, error, fetch, refetch } = useApiData<WeiboAccount[]>("/api/accounts");

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {data?.map(account => (
        <div key={account.id}>{account.nickname}</div>
      ))}
    </div>
  );
}
```

### useApiMutation - 数据提交

```typescript
import { useApiMutation } from "@/lib/api/hooks";

function CreateAccountForm() {
  const { mutate, loading, error } = useApiMutation<AccountFormData, WeiboAccount>();

  async function handleSubmit(formData: AccountFormData) {
    const result = await mutate("/api/accounts", formData, "POST");
    if (result) {
      console.log("创建成功:", result);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 表单字段 */}
      <button type="submit" disabled={loading}>
        {loading ? "创建中..." : "创建账号"}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

---

## 3. SWR Hooks（用于需要缓存和自动刷新的场景）

文件：`apps/web/src/lib/hooks/use-api.ts`

### useApi - 带缓存的数据获取

```typescript
import { useApi } from "@/lib/hooks/use-api";

function SuperTopicsList() {
  const { data, error, isLoading, refresh } = useApi<unknown[]>("/api/super-topics");

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {data?.map(topic => (
        <div key={topic.id}>{topic.name}</div>
      ))}
    </div>
  );
}
```

### useAccounts / usePlans 等快捷 Hook

```typescript
import { useAccounts, usePlans, useLogs, useSuperTopics } from "@/lib/hooks/use-api";

// 账号列表（自动缓存 + 轮询）
const { data: accounts } = useAccounts();

// 计划列表（带日期筛选）
const { data: plans } = usePlans("2026-05-03");

// 执行日志
const { data: logs } = useLogs(1, 50);

// 超话列表
const { data: topics } = useSuperTopics();
```

### POST/PUT/DELETE 请求

```typescript
import { apiPost, apiPut, apiDelete } from "@/lib/hooks/use-api";

// POST（返回完整 ApiResponse）
const result = await apiPost<FormData, Result>("/api/accounts", formData);
if (result.success) {
  console.log("创建成功:", result.data);
}

// 批量操作
import { apiBatch } from "@/lib/hooks/use-api";
const batchResult = await apiBatch("/api/accounts/batch-delete", ["id1", "id2"]);
```

---

## 4. 全局状态管理

文件：`apps/web/src/stores/app-store.ts`

### 基本用法

```typescript
import { useAppStore } from "@/stores/app-store";

function AccountsPage() {
  const accounts = useAppStore((state) => state.accounts);
  const loading = useAppStore((state) => state.accountsLoading);
  const fetchAccounts = useAppStore((state) => state.fetchAccounts);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <div>
      {loading ? "加载中..." : accounts.map(account => (
        <div key={account.id}>{account.nickname}</div>
      ))}
    </div>
  );
}
```

### 更新数据（乐观更新）

```typescript
function AccountItem({ account }: { account: WeiboAccount }) {
  const updateAccount = useAppStore((state) => state.updateAccount);

  async function handleStatusChange(status: string) {
    // 乐观更新
    updateAccount(account.id, { status });

    // 发送 API 请求
    try {
      await apiPatch(`/api/accounts/${account.id}`, { status });
    } catch (error) {
      // 失败时回滚
      updateAccount(account.id, { status: account.status });
    }
  }

  return <div>{/* UI */}</div>;
}
```

### 全局通知

```typescript
function SomeComponent() {
  const setNotice = useAppStore((state) => state.setNotice);
  const setError = useAppStore((state) => state.setError);

  async function handleAction() {
    try {
      await apiPost("/api/some-action");
      setNotice("操作成功");
    } catch (error) {
      setError(handleApiError(error));
    }
  }

  return <button onClick={handleAction}>执行操作</button>;
}
```

---

## 5. 选择指南

| 场景 | 推荐方式 |
|------|----------|
| 页面加载时获取数据 | `useApiData`（手动控制） |
| 需要缓存和轮询 | `useApi`（SWR 风格） |
| 表单提交 | `useApiMutation` + `apiPost` 等 |
| 一次性工具请求 | `apiGet` / `apiPost` 等 |
| 全局共享数据（账号、计划） | `useAppStore` |
| 批量操作 | `apiBatch` 或 `useApiMutation` |

---

## 6. 已废弃的 API Client

以下文件**已被取代**，请勿在新代码中使用：

- ~~`src/lib/api/client.ts`~~ → 使用 `apps/web/src/lib/api/client.ts`
- ~~`src/lib/hooks/use-api.ts`~~ → 已迁移到 `apps/web/src/lib/hooks/use-api.ts`

所有 API 客户端已统一在 `apps/web/src/lib/` 目录下。
