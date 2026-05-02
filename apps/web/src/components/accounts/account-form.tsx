"use client";

import { UserPlus } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { FormState } from "./types";

type AccountFormProps = {
  form: FormState;
  editingId: string | null;
  submitting: boolean;
  onFormChange: (form: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function AccountForm({
  form,
  editingId,
  submitting,
  onFormChange,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  return (
    <SurfaceCard>
      <SectionHeader
        title={editingId ? "编辑账号" : "添加账号"}
        description={editingId ? "修改账号信息" : "创建新的微博账号"}
      />

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="app-label">昵称</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => onFormChange({ ...form, nickname: e.target.value })}
              placeholder="账号昵称"
              className="app-input"
              required
            />
          </div>

          <div>
            <label className="app-label">备注（可选）</label>
            <input
              type="text"
              value={form.remark}
              onChange={(e) => onFormChange({ ...form, remark: e.target.value })}
              placeholder="备注信息"
              className="app-input"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="app-label">分组（可选）</label>
            <input
              type="text"
              value={form.groupName}
              onChange={(e) => onFormChange({ ...form, groupName: e.target.value })}
              placeholder="分组名称"
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">状态</label>
            <select
              value={form.status}
              onChange={(e) =>
                onFormChange({ ...form, status: e.target.value as FormState["status"] })
              }
              className="app-input"
            >
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">停用</option>
              <option value="RISKY">风险</option>
              <option value="EXPIRED">过期</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.scheduleWindowEnabled}
              onChange={(e) =>
                onFormChange({ ...form, scheduleWindowEnabled: e.target.checked })
              }
              className="app-checkbox"
            />
            <span className="text-sm font-medium text-app-text">启用执行时间窗口</span>
          </label>
          <p className="mt-1 text-xs text-app-text-soft">
            限制任务只在指定时间段内执行
          </p>
        </div>

        {form.scheduleWindowEnabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="app-label">开始时间</label>
              <input
                type="time"
                value={form.executionWindowStart}
                onChange={(e) =>
                  onFormChange({ ...form, executionWindowStart: e.target.value })
                }
                className="app-input"
              />
            </div>

            <div>
              <label className="app-label">结束时间</label>
              <input
                type="time"
                value={form.executionWindowEnd}
                onChange={(e) =>
                  onFormChange({ ...form, executionWindowEnd: e.target.value })
                }
                className="app-input"
              />
            </div>
          </div>
        )}

        <div>
          <label className="app-label">基础抖动时间（秒）</label>
          <input
            type="number"
            value={form.baseJitterSec}
            onChange={(e) =>
              onFormChange({ ...form, baseJitterSec: parseInt(e.target.value) || 0 })
            }
            min="0"
            max="3600"
            className="app-input"
          />
          <p className="mt-1 text-xs text-app-text-soft">
            任务执行时的随机延迟时间，用于模拟真实用户行为
          </p>
        </div>

        <div className="flex justify-end gap-3">
          {editingId && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="app-button app-button-secondary"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="app-button app-button-primary"
          >
            {editingId ? (
              submitting ? (
                "保存中..."
              ) : (
                "保存修改"
              )
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {submitting ? "创建中..." : "创建账号"}
              </>
            )}
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
