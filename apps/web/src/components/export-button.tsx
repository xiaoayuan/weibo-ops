"use client";

import { useState } from "react";
import { Download, FileText, FileJson } from "lucide-react";
import { DataExporter } from "@/lib/data-exporter";

/**
 * 导出按钮组件
 */
interface ExportButtonProps<T> {
  data: T[];
  filename: string;
  fields?: (keyof T)[];
  label?: string;
  className?: string;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  fields,
  label = "导出",
  className = "",
}: ExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExportCSV = () => {
    DataExporter.exportToCSV(data, filename, fields);
    setIsOpen(false);
  };

  const handleExportJSON = () => {
    DataExporter.exportToJSON(data, filename);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`app-button app-button-secondary flex items-center gap-2 ${className}`}
      >
        <Download className="h-4 w-4" />
        {label}
      </button>

      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute right-0 mt-2 w-48 app-surface z-50 shadow-lg">
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-app-text hover:bg-app-panel-muted transition"
            >
              <FileText className="h-4 w-4 text-app-success" />
              <span>导出为 CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-app-text hover:bg-app-panel-muted transition border-t border-app-line"
            >
              <FileJson className="h-4 w-4 text-app-info" />
              <span>导出为 JSON</span>
            </button>

            <div className="px-4 py-2 text-xs text-app-text-muted border-t border-app-line">
              共 {data.length} 条数据
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 带字段选择的导出按钮
 */
interface ExportButtonWithFieldsProps<T> {
  data: T[];
  filename: string;
  availableFields: Record<keyof T, string>;
  label?: string;
  className?: string;
}

export function ExportButtonWithFields<T extends Record<string, unknown>>({
  data,
  filename,
  availableFields,
  label = "导出",
  className = "",
}: ExportButtonWithFieldsProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<keyof T>>(
    new Set(Object.keys(availableFields) as (keyof T)[]),
  );

  const toggleField = (field: keyof T) => {
    const newFields = new Set(selectedFields);
    if (newFields.has(field)) {
      newFields.delete(field);
    } else {
      newFields.add(field);
    }
    setSelectedFields(newFields);
  };

  const handleExport = (format: "csv" | "json") => {
    const fields = Array.from(selectedFields);
    
    if (format === "csv") {
      DataExporter.exportToCSV(data, filename, fields);
    } else {
      DataExporter.exportToJSON(data, filename);
    }
    
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`app-button app-button-secondary flex items-center gap-2 ${className}`}
      >
        <Download className="h-4 w-4" />
        {label}
      </button>

      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute right-0 mt-2 w-80 app-surface z-50 shadow-lg max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-app-line">
              <h3 className="text-sm font-medium text-app-text-strong">
                选择导出字段
              </h3>
            </div>

            <div className="p-2">
              {Object.entries(availableFields).map(([field, label]) => (
                <label
                  key={field}
                  className="flex items-center gap-2 px-2 py-2 hover:bg-app-panel-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field as keyof T)}
                    onChange={() => toggleField(field as keyof T)}
                    className="rounded border-app-line"
                  />
                  <span className="text-sm text-app-text">{label}</span>
                </label>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-app-line space-y-2">
              <button
                onClick={() => handleExport("csv")}
                disabled={selectedFields.size === 0}
                className="w-full app-button app-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                导出为 CSV
              </button>
              <button
                onClick={() => handleExport("json")}
                className="w-full app-button app-button-secondary"
              >
                导出为 JSON（全部字段）
              </button>
              <div className="text-xs text-app-text-muted text-center">
                已选择 {selectedFields.size} 个字段，共 {data.length} 条数据
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
