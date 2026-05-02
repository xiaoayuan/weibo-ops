"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { PoolFormData } from "./types";

type CommentPoolFormProps = {
  onSubmit: (data: PoolFormData) => Promise<void>;
};

export function CommentPoolForm({ onSubmit }: CommentPoolFormProps) {
  const [formData, setFormData] = useState<PoolFormData>({
    singleUrl: "",
    singleNote: "",
    singleTags: "",
    batchText: "",
    batchNote: "",
    batchTags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitSingle = async () => {
    if (!formData.singleUrl.trim()) {
      alert("请输入评论链接");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({ ...formData, singleUrl: "", singleNote: "", singleTags: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBatch = async () => {
    if (!formData.batchText.trim()) {
      alert("请输入评论链接列表");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({ ...formData, batchText: "", batchNote: "", batchTags: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 单条添加 */}
      <SurfaceCard>
        <SectionHeader title="添加单条评论" description="添加一条评论到池中" />

        <div className="mt-5 space-y-4">
          <div>
            <label className="app-label">评论链接</label>
            <input
              type="text"
              value={formData.singleUrl}
              onChange={(e) => setFormData({ ...formData, singleUrl: e.target.value })}
              placeholder="https://weibo.com/..."
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">备注（可选）</label>
            <input
              type="text"
              value={formData.singleNote}
              onChange={(e) => setFormData({ ...formData, singleNote: e.target.value })}
              placeholder="备注信息"
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">标签（可选，逗号分隔）</label>
            <input
              type="text"
              value={formData.singleTags}
              onChange={(e) => setFormData({ ...formData, singleTags: e.target.value })}
              placeholder="标签1, 标签2"
              className="app-input"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitSingle}
            disabled={submitting}
            className="app-button app-button-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加到池中
          </button>
        </div>
      </SurfaceCard>

      {/* 批量添加 */}
      <SurfaceCard>
        <SectionHeader title="批量添加评论" description="一次添加多条评论（每行一个链接）" />

        <div className="mt-5 space-y-4">
          <div>
            <label className="app-label">评论链接列表</label>
            <textarea
              value={formData.batchText}
              onChange={(e) => setFormData({ ...formData, batchText: e.target.value })}
              placeholder="https://weibo.com/...&#10;https://weibo.com/...&#10;https://weibo.com/..."
              rows={6}
              className="app-input font-mono text-sm"
            />
          </div>

          <div>
            <label className="app-label">统一备注（可选）</label>
            <input
              type="text"
              value={formData.batchNote}
              onChange={(e) => setFormData({ ...formData, batchNote: e.target.value })}
              placeholder="备注信息"
              className="app-input"
            />
          </div>

          <div>
            <label className="app-label">统一标签（可选，逗号分隔）</label>
            <input
              type="text"
              value={formData.batchTags}
              onChange={(e) => setFormData({ ...formData, batchTags: e.target.value })}
              placeholder="标签1, 标签2"
              className="app-input"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitBatch}
            disabled={submitting}
            className="app-button app-button-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            批量添加到池中
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}
