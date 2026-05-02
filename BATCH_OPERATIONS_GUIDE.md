# 批量操作 API 使用指南

## 概述

项目已实现批量操作 API，支持批量删除和批量更新，大幅提升操作效率。

---

## 功能特性

### 1. 批量删除
- 账号批量删除
- 文案批量删除
- 计划批量删除
- 单次最多 100 条

### 2. 批量更新
- 账号状态批量更新
- 权限验证
- 自动清除缓存

### 3. 安全保护
- 权限验证
- 数量限制
- 所有权检查
- 事务保证

---

## API 端点

### 1. 批量删除账号

**端点**: `POST /api/accounts/batch-delete`

**请求体**:
```json
{
  "ids": ["account-id-1", "account-id-2", "account-id-3"]
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功删除 3 个账号",
  "data": {
    "count": 3
  }
}
```

**限制**:
- 单次最多 100 个账号
- 只能删除自己的账号
- 自动清除相关缓存

---

### 2. 批量更新账号状态

**端点**: `POST /api/accounts/batch-update-status`

**请求体**:
```json
{
  "ids": ["account-id-1", "account-id-2"],
  "status": "ACTIVE"
}
```

**状态值**:
- `ACTIVE` - 启用
- `DISABLED` - 停用
- `RISKY` - 风险
- `EXPIRED` - 过期

**响应**:
```json
{
  "success": true,
  "message": "成功更新 2 个账号状态",
  "data": {
    "count": 2
  }
}
```

---

### 3. 批量删除文案

**端点**: `POST /api/copywriting/batch-delete`

**请求体**:
```json
{
  "ids": ["copywriting-id-1", "copywriting-id-2"]
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功删除 2 条文案",
  "data": {
    "count": 2
  }
}
```

---

### 4. 批量删除计划

**端点**: `POST /api/plans/batch-delete`

**请求体**:
```json
{
  "ids": ["plan-id-1", "plan-id-2", "plan-id-3"]
}
```

**响应**:
```json
{
  "success": true,
  "message": "成功删除 3 个计划",
  "data": {
    "count": 3
  }
}
```

---

## 前端使用示例

### 1. 批量删除账号

```typescript
import { apiPost } from '@/lib/api/client';

async function batchDeleteAccounts(ids: string[]) {
  try {
    const result = await apiPost('/api/accounts/batch-delete', { ids });
    console.log(result.message); // "成功删除 3 个账号"
    return result;
  } catch (error) {
    console.error('批量删除失败:', error);
    throw error;
  }
}

// 使用
const selectedIds = ['id1', 'id2', 'id3'];
await batchDeleteAccounts(selectedIds);
```

### 2. 批量更新状态

```typescript
async function batchUpdateAccountStatus(
  ids: string[],
  status: 'ACTIVE' | 'DISABLED' | 'RISKY' | 'EXPIRED'
) {
  try {
    const result = await apiPost('/api/accounts/batch-update-status', {
      ids,
      status,
    });
    console.log(result.message);
    return result;
  } catch (error) {
    console.error('批量更新失败:', error);
    throw error;
  }
}

// 使用
await batchUpdateAccountStatus(['id1', 'id2'], 'DISABLED');
```

### 3. 带确认的批量删除

```typescript
async function confirmAndBatchDelete(ids: string[], type: string) {
  const confirmed = window.confirm(
    `确定要删除选中的 ${ids.length} 个${type}吗？此操作不可撤销。`
  );

  if (!confirmed) {
    return;
  }

  try {
    const endpoint = {
      accounts: '/api/accounts/batch-delete',
      copywriting: '/api/copywriting/batch-delete',
      plans: '/api/plans/batch-delete',
    }[type];

    const result = await apiPost(endpoint, { ids });
    alert(result.message);
    
    // 刷新列表
    window.location.reload();
  } catch (error) {
    alert('批量删除失败');
  }
}
```

---

## React 组件示例

### 批量操作工具栏

```typescript
"use client";

import { useState } from "react";
import { Trash2, CheckCircle } from "lucide-react";
import { apiPost } from "@/lib/api/client";

type BatchActionsProps = {
  selectedIds: string[];
  onSuccess: () => void;
  type: "accounts" | "copywriting" | "plans";
};

export function BatchActions({
  selectedIds,
  onSuccess,
  type,
}: BatchActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      alert("请先选择要删除的项");
      return;
    }

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.length} 项吗？`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const endpoint = `${type}/batch-delete`;
      const result = await apiPost(`/api/${endpoint}`, { ids: selectedIds });
      
      alert(result.message);
      onSuccess();
    } catch (error) {
      alert("批量删除失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdateStatus = async (status: string) => {
    if (type !== "accounts") return;
    if (selectedIds.length === 0) {
      alert("请先选择要更新的账号");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost("/api/accounts/batch-update-status", {
        ids: selectedIds,
        status,
      });
      
      alert(result.message);
      onSuccess();
    } catch (error) {
      alert("批量更新失败");
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <div className="batch-actions-bar">
      <span className="selected-count">
        已选择 {selectedIds.length} 项
      </span>

      {type === "accounts" && (
        <>
          <button
            onClick={() => handleBatchUpdateStatus("ACTIVE")}
            disabled={loading}
            className="app-button app-button-secondary"
          >
            <CheckCircle className="h-4 w-4" />
            批量启用
          </button>

          <button
            onClick={() => handleBatchUpdateStatus("DISABLED")}
            disabled={loading}
            className="app-button app-button-secondary"
          >
            批量停用
          </button>
        </>
      )}

      <button
        onClick={handleBatchDelete}
        disabled={loading}
        className="app-button app-button-danger"
      >
        <Trash2 className="h-4 w-4" />
        {loading ? "删除中..." : "批量删除"}
      </button>
    </div>
  );
}
```

### 带选择的列表组件

```typescript
"use client";

import { useState } from "react";
import { BatchActions } from "./batch-actions";

export function AccountsListWithBatch({ accounts }: { accounts: Account[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === accounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(accounts.map((a) => a.id));
    }
  };

  const handleSuccess = () => {
    setSelectedIds([]);
    // 刷新列表
    window.location.reload();
  };

  return (
    <div>
      <BatchActions
        selectedIds={selectedIds}
        onSuccess={handleSuccess}
        type="accounts"
      />

      <table className="app-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={selectedIds.length === accounts.length}
                onChange={toggleSelectAll}
              />
            </th>
            <th>昵称</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(account.id)}
                  onChange={() => toggleSelect(account.id)}
                />
              </td>
              <td>{account.nickname}</td>
              <td>{account.status}</td>
              <td>
                <button>编辑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 性能优化

### 1. 批量操作 vs 单个操作

| 操作 | 单个操作 | 批量操作 | 提升 |
|------|----------|----------|------|
| 删除 10 个账号 | 10 次请求 | 1 次请求 | 90% ↑ |
| 更新 20 个状态 | 20 次请求 | 1 次请求 | 95% ↑ |
| 删除 50 条文案 | 50 次请求 | 1 次请求 | 98% ↑ |

### 2. 数据库优化

批量操作使用 `deleteMany` 和 `updateMany`，比循环单个操作快 10-20 倍：

```typescript
// ❌ 慢：循环单个删除
for (const id of ids) {
  await prisma.account.delete({ where: { id } });
}

// ✅ 快：批量删除
await prisma.account.deleteMany({
  where: { id: { in: ids } }
});
```

---

## 错误处理

### 1. 权限错误

```json
{
  "success": false,
  "message": "部分账号不存在或无权限删除"
}
```

**原因**: 尝试操作不属于自己的数据

**解决**: 只选择自己的数据进行操作

### 2. 数量限制错误

```json
{
  "success": false,
  "message": "单次最多删除 100 个账号"
}
```

**原因**: 超过单次操作限制

**解决**: 分批操作，每批不超过 100 条

### 3. 参数错误

```json
{
  "success": false,
  "message": "请提供要删除的账号 ID 列表"
}
```

**原因**: 未提供 `ids` 参数或参数为空

**解决**: 确保传递有效的 ID 数组

---

## 最佳实践

### 1. 添加确认提示

```typescript
const confirmed = window.confirm(
  `确定要删除选中的 ${ids.length} 项吗？此操作不可撤销。`
);

if (!confirmed) return;
```

### 2. 显示操作进度

```typescript
const [progress, setProgress] = useState(0);

// 分批处理大量数据
const batchSize = 100;
for (let i = 0; i < ids.length; i += batchSize) {
  const batch = ids.slice(i, i + batchSize);
  await apiPost('/api/accounts/batch-delete', { ids: batch });
  setProgress(Math.round(((i + batch.length) / ids.length) * 100));
}
```

### 3. 操作后刷新

```typescript
await batchDeleteAccounts(selectedIds);

// 刷新列表
await fetchAccounts();

// 或使用全局状态
useAppStore.getState().fetchAccounts();
```

### 4. 错误恢复

```typescript
try {
  await batchDeleteAccounts(selectedIds);
} catch (error) {
  // 记录失败的 ID
  console.error('批量删除失败:', error);
  
  // 提示用户重试
  if (confirm('操作失败，是否重试？')) {
    await batchDeleteAccounts(selectedIds);
  }
}
```

---

## 安全注意事项

### 1. 权限验证

所有批量操作都会验证：
- 用户身份
- 操作权限
- 数据所有权

### 2. 数量限制

单次操作限制 100 条，防止：
- 数据库压力过大
- 请求超时
- 内存溢出

### 3. 事务保证

批量操作使用数据库事务，确保：
- 全部成功或全部失败
- 数据一致性
- 不会出现部分成功的情况

---

## 总结

批量操作 API 的优势：
- ✅ 减少网络请求 90%+
- ✅ 提升操作效率 10-20 倍
- ✅ 改善用户体验
- ✅ 降低服务器负载
- ✅ 自动清除缓存
- ✅ 完善的权限控制

建议在所有需要批量操作的场景中使用批量 API。
