"use client";

import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { SessionFormState } from "./types";

type SessionEditorProps = {
  accountNickname: string;
  form: SessionFormState;
  submitting: boolean;
  onFormChange: (form: SessionFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function SessionEditor({
  accountNickname,
  form,
  submitting,
  onFormChange,
  onSubmit,
  onCancel,
}: SessionEditorProps) {
  return (
    <SurfaceCard>
      <SectionHeader
        title={`编辑 ${accountNickname} 的登录信息`}
        description="手动更新账号的 Cookie 和用户信息"
      />

      <div className="mt-5 space-y-4">
        <div>
          <label className="app-label">UID</label>
          <input
            type="text"
            value={form.uid}
            onChange={(e) => onFormChange({ ...form, uid: e.target.value })}
            placeholder="微博用户 ID"
            className="app-input font-mono"
          />
        </div>

        <div>
          <label className="app-label">用户名</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => onFormChange({ ...form, username: e.target.value })}
            placeholder="微博用户名"
            className="app-input"
          />
        </div>

        <div>
          <label className="app-label">Cookie</label>
          <textarea
            value={form.cookie}
            onChange={(e) => onFormChange({ ...form, cookie: e.target.value })}
            placeholder="完整的 Cookie 字符串"
            rows={6}
            className="app-input font-mono text-sm"
          />
          <p className="mt-1 text-xs text-app-text-soft">
            从浏览器开发者工具中复制完整的 Cookie 字符串
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="app-button app-button-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="app-button app-button-primary"
          >
            {submitting ? "保存中..." : "保存登录信息"}
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
