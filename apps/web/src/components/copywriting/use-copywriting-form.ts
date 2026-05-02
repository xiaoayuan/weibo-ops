"use client";

import { useState } from "react";
import type { CopywritingTemplate } from "@/lib/app-data";
import type { FormState } from "./types";
import { initialForm } from "./types";

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

function getApiMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "success" in value) {
    const envelope = value as ApiEnvelope<unknown>;
    return typeof envelope.message === "string" ? envelope.message : null;
  }
  return null;
}

export function useCopywritingForm(
  items: CopywritingTemplate[],
  onItemsChange: (items: CopywritingTemplate[]) => void,
  onSuccess: (message: string) => void,
  onError: (message: string) => void
) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  function startEdit(item: CopywritingTemplate) {
    setForm({
      title: item.title,
      content: item.content,
      tags: item.tags.join(", "),
      firstComment: item.tags.includes("首评"),
      status: item.status as "ACTIVE" | "DISABLED",
    });
    setEditingId(item.id);
  }

  async function submitForm() {
    try {
      setSubmitting(true);

      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      if (form.firstComment && !tags.includes("首评")) {
        tags.push("首评");
      }

      const payload = {
        title: form.title,
        content: form.content,
        tags,
        status: form.status,
      };

      const response = await fetch(editingId ? `/api/copywriting/${editingId}` : "/api/copywriting", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiEnvelope<CopywritingTemplate>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(getApiMessage(result) || (editingId ? "更新文案失败" : "新增文案失败"));
      }

      if (editingId) {
        onItemsChange(items.map((item) => (item.id === editingId ? result.data! : item)));
        onSuccess("文案已更新");
      } else {
        onItemsChange([result.data!, ...items]);
        onSuccess("文案已新增");
      }

      resetForm();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : editingId ? "更新文案失败" : "新增文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(id: string) {
    if (!window.confirm("确认删除这条文案吗？")) {
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/copywriting/${id}`, { method: "DELETE" });
      const result = (await response.json()) as ApiEnvelope<void>;

      if (!response.ok || !result.success) {
        throw new Error(getApiMessage(result) || "删除文案失败");
      }

      onItemsChange(items.filter((item) => item.id !== id));
      onSuccess("文案已删除");
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "删除文案失败");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    form,
    setForm,
    editingId,
    submitting,
    resetForm,
    startEdit,
    submitForm,
    deleteItem,
  };
}
