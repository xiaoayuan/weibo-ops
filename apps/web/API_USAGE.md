# API 客户端和状态管理使用指南

## 1. 使用统一的 API 客户端

### 基本用法

```typescript
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";

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

## 2. 使用 API Hooks

### useApiData - 数据获取

```typescript
import { useApiData } from "@/lib/api/hooks";

function AccountsList() {
  const { data, loading, error, fetch } = useApiData<WeiboAccount[]>("/api/accounts");

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

## 3. 使用全局状态管理

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

### 更新数据

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

## 4. 迁移现有代码

### 旧代码

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function fetchData() {
  setLoading(true);
  try {
    const response = await fetch("/api/accounts");
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "请求失败");
    }
    setData(result.data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "请求失败");
  } finally {
    setLoading(false);
  }
}
```

### 新代码

```typescript
const { data, loading, error, fetch } = useApiData<Account[]>("/api/accounts");

useEffect(() => {
  fetch();
}, [fetch]);
```

## 5. 优势

1. **代码更简洁**：减少 80% 的样板代码
2. **类型安全**：完整的 TypeScript 支持
3. **统一错误处理**：一致的错误消息格式
4. **全局状态**：避免重复请求，数据共享
5. **乐观更新**：更好的用户体验
6. **易于测试**：集中的 API 逻辑

## 6. 最佳实践

1. **使用 useAppStore 管理全局数据**（账号、文案、计划等）
2. **使用 useApiData 获取页面级数据**
3. **使用 useApiMutation 提交表单数据**
4. **使用 apiGet/apiPost 等方法进行一次性请求**
5. **始终处理错误**，使用 handleApiError 获取友好消息
6. **使用乐观更新**提升用户体验
