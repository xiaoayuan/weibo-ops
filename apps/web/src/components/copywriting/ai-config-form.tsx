"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/section-header";
import { SurfaceCard } from "@/components/surface-card";
import type { AiCopywritingConfig } from "@/lib/app-data";

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

function getApiMessage(value: unknown) {
  if (typeof value === "object" && value !== null && "success" in value) {
    const envelope = value as ApiEnvelope<unknown>;
    return typeof envelope.message === "string" ? envelope.message : null;
  }
  return null;
}

type AiConfigFormProps = {
  initialConfig: AiCopywritingConfig | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function AiConfigForm({ initialConfig, onSuccess, onError }: AiConfigFormProps) {
  const [config, setConfig] = useState({
    baseUrl: initialConfig?.baseUrl || "",
    model: initialConfig?.model || "",
    apiKey: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);

      const response = await fetch("/api/copywriting/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = (await response.json()) as ApiEnvelope<AiCopywritingConfig>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(getApiMessage(result) || "保存 AI 接口配置失败");
      }

      setConfig((current) => ({ ...current, ...result.data!, apiKey: "" }));
      onSuccess("AI 接口配置已保存");
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "保存 AI 接口配置失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SurfaceCard>
      <SectionHeader title="AI 接口配置" description="维护 Base URL、模型和 API Key。API Key 保存后不会回显。" />
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-app-text">Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="app-input w-full"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-app-text">模型</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="app-input w-full"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-app-text">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="留空表示不修改"
            className="app-input w-full"
          />
        </div>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className="app-button app-button-primary">
          {saving ? "保存中" : "保存配置"}
        </button>
      </div>
    </SurfaceCard>
  );
}
