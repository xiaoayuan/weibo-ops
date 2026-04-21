"use client";

import { useState } from "react";

function summarizeText(text: string, maxLength = 42) {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}...`;
}

export function InteractionResultPreview({ result }: { result: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!result || result.trim() === "") {
    return <span className="text-slate-400">-</span>;
  }

  const summary = summarizeText(result);
  const needsExpand = summary !== result.trim();

  return (
    <div className="space-y-1">
      <div className="whitespace-pre-wrap break-all text-slate-600">{expanded ? result : summary}</div>
      {needsExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-xs text-sky-700 transition hover:text-sky-800"
        >
          {expanded ? "收起结果" : "展开结果"}
        </button>
      ) : null}
    </div>
  );
}
