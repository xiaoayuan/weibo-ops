"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { AiRiskConfig } from "@/lib/app-data";

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

function getApiMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "success" in value) {
    const envelope = value as ApiEnvelope<unknown>;
    return typeof envelope.message === "string" ? envelope.message : null;
  }
  return null;
}

type AiRiskConfigFormProps = {
  initialConfig: AiRiskConfig | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function AiRiskConfigForm({ initialConfig, onSuccess, onError }: AiRiskConfigFormProps) {
  const [keywordsText, setKeywordsText] = useState(initialConfig?.riskyKeywords.join("\n") || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);

      const response = await fetch("/api/ai-risk/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskyKeywords: keywordsText
            .split(/\n+/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = (await response.json()) as ApiEnvelope<AiRiskConfig>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(getApiMessage(result) || "保存风险词配置失败");
      }

      setKeywordsText(result.data.riskyKeywords.join("\n"));
      onSuccess("AI 风险词配置已保存");
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "保存风险词配置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <SectionHeader title="AI 风险词配置" description="维护高风险关键词，用于候选文案预审和风控提示。" />
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-app-text">高风险关键词（每行一个）</label>
          <textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="敏感词1&#10;敏感词2&#10;敏感词3"
            rows={8}
            className="app-input w-full font-mono text-sm"
          />
        </div>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="app-button app-button-primary">
          {saving ? "保存中" : "保存配置"}
        </button>
      </div>
    </SurfaceCard>
  );
}
