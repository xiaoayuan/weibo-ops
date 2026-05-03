"use client";

import { useState } from "react";
import { Filter, X, Save, RotateCcw } from "lucide-react";

/**
 * 过滤器配置
 */
export interface FilterConfig {
  name: string;
  label: string;
  type: "text" | "select" | "multiSelect" | "dateRange" | "number";
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

/**
 * 过滤值类型
 */
export type FilterValues = Record<string, unknown>;

/**
 * 高级过滤组件属性
 */
interface AdvancedFilterProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset?: () => void;
  onSave?: (name: string, values: FilterValues) => void;
  savedFilters?: Array<{ name: string; values: FilterValues }>;
  className?: string;
}

/**
 * 高级过滤组件
 */
export function AdvancedFilter({
  filters,
  values,
  onChange,
  onReset,
  onSave,
  savedFilters = [],
  className = "",
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const handleChange = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({});
    }
  };

  const handleSave = () => {
    if (filterName.trim() && onSave) {
      onSave(filterName.trim(), values);
      setFilterName("");
      setSaveDialogOpen(false);
    }
  };

  const handleLoadSaved = (savedValues: FilterValues) => {
    onChange(savedValues);
    setIsOpen(false);
  };

  const activeFilterCount = Object.values(values).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;

  return (
    <div className={`relative ${className}`}>
      {/* 过滤按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted hover:bg-app-panel-strong transition text-sm"
      >
        <Filter className="h-4 w-4" />
        <span>高级过滤</span>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-app-accent text-white text-xs">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* 过滤面板 */}
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 面板 */}
          <div className="absolute right-0 mt-2 w-96 app-surface shadow-2xl z-50 max-h-[600px] overflow-y-auto">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-app-line sticky top-0 app-surface">
              <h3 className="font-semibold text-app-text-strong">高级过滤</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-app-text-soft hover:text-app-text-strong transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 过滤器列表 */}
            <div className="p-4 space-y-4">
              {filters.map((filter) => (
                <div key={filter.name}>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">
                    {filter.label}
                  </label>

                  {/* 文本输入 */}
                  {filter.type === "text" && (
                    <input
                      type="text"
                      value={values[filter.name] || ""}
                      onChange={(e) => handleChange(filter.name, e.target.value)}
                      placeholder={filter.placeholder}
                      className="w-full px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                    />
                  )}

                  {/* 单选下拉 */}
                  {filter.type === "select" && (
                    <select
                      value={values[filter.name] || ""}
                      onChange={(e) => handleChange(filter.name, e.target.value)}
                      className="w-full px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                    >
                      <option value="">全部</option>
                      {filter.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* 多选 */}
                  {filter.type === "multiSelect" && (
                    <div className="space-y-2">
                      {filter.options?.map((option) => {
                        const selected = (values[filter.name] || []).includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const current = values[filter.name] || [];
                                const newValue = e.target.checked
                                  ? [...current, option.value]
                                  : current.filter((v: string) => v !== option.value);
                                handleChange(filter.name, newValue);
                              }}
                              className="rounded border-app-line"
                            />
                            <span className="text-sm text-app-text">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* 数字输入 */}
                  {filter.type === "number" && (
                    <input
                      type="number"
                      value={values[filter.name] || ""}
                      onChange={(e) => handleChange(filter.name, e.target.value)}
                      placeholder={filter.placeholder}
                      className="w-full px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                    />
                  )}

                  {/* 日期范围 */}
                  {filter.type === "dateRange" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={values[`${filter.name}_start`] || ""}
                        onChange={(e) => handleChange(`${filter.name}_start`, e.target.value)}
                        className="px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                      />
                      <input
                        type="date"
                        value={values[`${filter.name}_end`] || ""}
                        onChange={(e) => handleChange(`${filter.name}_end`, e.target.value)}
                        className="px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 保存的过滤器 */}
            {savedFilters.length > 0 && (
              <div className="p-4 border-t border-app-line">
                <h4 className="text-sm font-medium text-app-text-strong mb-2">
                  保存的过滤器
                </h4>
                <div className="space-y-2">
                  {savedFilters.map((saved, index) => (
                    <button
                      key={index}
                      onClick={() => handleLoadSaved(saved.values)}
                      className="w-full text-left px-3 py-2 rounded-[12px] bg-app-panel-muted hover:bg-app-panel-strong transition text-sm text-app-text"
                    >
                      {saved.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 底部操作 */}
            <div className="flex items-center justify-between gap-3 p-4 border-t border-app-line sticky bottom-0 app-surface">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted hover:bg-app-panel-strong transition text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                <span>重置</span>
              </button>

              {onSave && (
                <button
                  onClick={() => setSaveDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-[12px] bg-app-accent hover:bg-app-accent/90 text-white transition text-sm"
                >
                  <Save className="h-4 w-4" />
                  <span>保存</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* 保存对话框 */}
      {saveDialogOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setSaveDialogOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md app-surface shadow-2xl">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-app-text-strong mb-4">
                  保存过滤器
                </h3>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="输入过滤器名称"
                  className="w-full px-3 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text focus:outline-none focus:border-app-accent"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-app-line">
                <button
                  onClick={() => setSaveDialogOpen(false)}
                  className="px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text hover:bg-app-panel-strong transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!filterName.trim()}
                  className="px-4 py-2 rounded-[12px] bg-app-accent hover:bg-app-accent/90 text-white transition disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * 过滤 Hook
 */
export function useAdvancedFilter(initialValues: FilterValues = {}) {
  const [values, setValues] = useState<FilterValues>(initialValues);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; values: FilterValues }>>([]);

  const handleSave = (name: string, filterValues: FilterValues) => {
    setSavedFilters((prev) => [...prev, { name, values: filterValues }]);
  };

  const handleReset = () => {
    setValues(initialValues);
  };

  return {
    values,
    setValues,
    savedFilters,
    handleSave,
    handleReset,
  };
}
