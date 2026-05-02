"use client";

import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { FormState } from "./types";

type CopywritingFormProps = {
  form: FormState;
  editingId: string | null;
  submitting: boolean;
  onFormChange: (form: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function CopywritingForm({ form, editingId, submitting, onFormChange, onSubmit, onCancel }: CopywritingFormProps) {
  return (
    <SurfaceCard>
      <SectionHeader title={editingId ? "编辑文案" : "新增文案"} />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <input
          value={form.title}
          onChange={(e) => onFormChange({ ...form, title: e.target.value })}
          className="app-input"
          placeholder="标题"
        />
        <input
          value={form.tags}
          onChange={(e) => onFormChange({ ...form, tags: e.target.value })}
          className="app-input"
          placeholder="标签，多个用英文逗号分隔"
        />
        <textarea
          value={form.content}
          onChange={(e) => onFormChange({ ...form, content: e.target.value })}
          className="app-input min-h-[168px] resize-y py-3 md:col-span-2"
          placeholder="文案内容"
        />
        <label className="flex items-center gap-3 rounded-[16px] border border-app-line bg-app-panel-muted px-4 py-3 text-sm text-app-text-soft">
          <input
            type="checkbox"
            checked={form.firstComment}
            onChange={(e) => onFormChange({ ...form, firstComment: e.target.checked })}
          />
          标记为首评文案
        </label>
        <select
          value={form.status}
          onChange={(e) => onFormChange({ ...form, status: e.target.value as FormState["status"] })}
          className="app-input"
        >
          <option value="ACTIVE">启用</option>
          <option value="DISABLED">停用</option>
        </select>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {editingId && (
          <button type="button" onClick={onCancel} className="app-button app-button-secondary">
            取消编辑
          </button>
        )}
        <button type="button" onClick={onSubmit} disabled={submitting} className="app-button app-button-primary">
          {editingId ? "保存修改" : "新增文案"}
        </button>
      </div>
    </SurfaceCard>
  );
}
