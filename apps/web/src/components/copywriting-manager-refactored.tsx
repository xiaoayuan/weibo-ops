"use client";

import { useMemo, useState } from "react";
import { AppNotice } from "@/components/app-notice";
import { PageHeader } from "@/components/page-header";
import type { AiCopywritingConfig, AiRiskConfig, CopywritingTemplate } from "@/lib/app-data";
import { AiConfigForm } from "./copywriting/ai-config-form";
import { AiRiskConfigForm } from "./copywriting/ai-risk-config-form";
import { CopywritingForm } from "./copywriting/copywriting-form";
import { CopywritingList } from "./copywriting/copywriting-list";
import { useCopywritingForm } from "./copywriting/use-copywriting-form";
import { getBusinessTypeFromTags, isAiCopywriting } from "./copywriting/utils";
import type { AiBusinessType } from "./copywriting/types";

export function CopywritingManagerRefactored({
  initialItems,
  initialAiConfig,
  initialAiRiskConfig,
}: {
  initialItems: CopywritingTemplate[];
  initialAiConfig: AiCopywritingConfig | null;
  initialAiRiskConfig: AiRiskConfig | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "MANUAL" | "AI">("ALL");
  const [businessFilter, setBusinessFilter] = useState<"ALL" | AiBusinessType>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSource = sourceFilter === "ALL" || (sourceFilter === "AI" ? isAiCopywriting(item) : !isAiCopywriting(item));
      const matchesBusiness = businessFilter === "ALL" || getBusinessTypeFromTags(item) === businessFilter;

      return matchesSource && matchesBusiness;
    });
  }, [items, sourceFilter, businessFilter]);

  const {
    form,
    setForm,
    editingId,
    submitting,
    resetForm,
    startEdit,
    submitForm,
    deleteItem,
  } = useCopywritingForm(
    items,
    setItems,
    (message) => {
      setNotice(message);
      setError(null);
    },
    (message) => {
      setError(message);
      setNotice(null);
    }
  );

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader title="文案管理" description="维护文案模板，支持手动新增和 AI 生成。" />

      {error && <AppNotice tone="error">{error}</AppNotice>}
      {notice && <AppNotice tone="success">{notice}</AppNotice>}

      <AiConfigForm
        initialConfig={initialAiConfig}
        onSuccess={(message) => {
          setNotice(message);
          setError(null);
        }}
        onError={(message) => {
          setError(message);
          setNotice(null);
        }}
      />

      <AiRiskConfigForm
        initialConfig={initialAiRiskConfig}
        onSuccess={(message) => {
          setNotice(message);
          setError(null);
        }}
        onError={(message) => {
          setError(message);
          setNotice(null);
        }}
      />

      {/* TODO: AI 生成与改写功能 - 保留在原组件中 */}

      <CopywritingForm
        form={form}
        editingId={editingId}
        submitting={submitting}
        onFormChange={setForm}
        onSubmit={() => void submitForm()}
        onCancel={resetForm}
      />

      <CopywritingList
        items={filteredItems}
        sourceFilter={sourceFilter}
        businessFilter={businessFilter}
        submitting={submitting}
        onSourceFilterChange={setSourceFilter}
        onBusinessFilterChange={setBusinessFilter}
        onEdit={startEdit}
        onDelete={(id) => void deleteItem(id)}
      />
    </div>
  );
}
