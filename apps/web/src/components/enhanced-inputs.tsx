"use client";

import { Info, AlertCircle } from "lucide-react";
import { useState } from "react";

/**
 * 输入框属性
 */
interface EnhancedInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

/**
 * 增强输入框组件
 */
export function EnhancedInput({
  label,
  name,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  hint,
  example,
  error,
  required = false,
  disabled = false,
  maxLength,
  className = "",
}: EnhancedInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const showCharCount = maxLength && isFocused;
  const charCount = value.length;
  const isNearLimit = maxLength && charCount > maxLength * 0.8;

  return (
    <div className={className}>
      {/* 标签 */}
      <label className="block text-sm font-medium text-app-text-strong mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 输入框 */}
      <div className="relative">
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={`w-full px-4 py-2 rounded-[12px] border transition ${
            error
              ? "border-red-500 focus:border-red-500"
              : "border-app-line focus:border-app-accent"
          } bg-app-panel-muted text-app-text focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {/* 字符计数 */}
        {showCharCount && (
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
              isNearLimit ? "text-yellow-500" : "text-app-text-muted"
            }`}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>

      {/* 提示信息 */}
      {!error && hint && (
        <div className="flex items-start gap-2 mt-2 text-xs text-app-text-muted">
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{hint}</span>
        </div>
      )}

      {/* 示例 */}
      {!error && example && (
        <div className="mt-2 text-xs text-app-text-muted">
          示例：<span className="font-mono">{example}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-start gap-2 mt-2 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 增强文本域属性
 */
interface EnhancedTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  example?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}

/**
 * 增强文本域组件
 */
export function EnhancedTextarea({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  example,
  error,
  required = false,
  disabled = false,
  rows = 4,
  maxLength,
  className = "",
}: EnhancedTextareaProps) {
  const [isFocused, setIsFocused] = useState(false);

  const showCharCount = maxLength && isFocused;
  const charCount = value.length;
  const isNearLimit = maxLength && charCount > maxLength * 0.8;

  return (
    <div className={className}>
      {/* 标签 */}
      <label className="block text-sm font-medium text-app-text-strong mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 文本域 */}
      <div className="relative">
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={`w-full px-4 py-2 rounded-[12px] border transition resize-none ${
            error
              ? "border-red-500 focus:border-red-500"
              : "border-app-line focus:border-app-accent"
          } bg-app-panel-muted text-app-text focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {/* 字符计数 */}
        {showCharCount && (
          <div
            className={`absolute right-3 bottom-3 text-xs ${
              isNearLimit ? "text-yellow-500" : "text-app-text-muted"
            }`}
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>

      {/* 提示信息 */}
      {!error && hint && (
        <div className="flex items-start gap-2 mt-2 text-xs text-app-text-muted">
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{hint}</span>
        </div>
      )}

      {/* 示例 */}
      {!error && example && (
        <div className="mt-2 text-xs text-app-text-muted">
          示例：<span className="font-mono">{example}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-start gap-2 mt-2 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 增强选择框属性
 */
interface EnhancedSelectProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 增强选择框组件
 */
export function EnhancedSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = "请选择",
  hint,
  error,
  required = false,
  disabled = false,
  className = "",
}: EnhancedSelectProps) {
  return (
    <div className={className}>
      {/* 标签 */}
      <label className="block text-sm font-medium text-app-text-strong mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 选择框 */}
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-[12px] border transition ${
          error
            ? "border-red-500 focus:border-red-500"
            : "border-app-line focus:border-app-accent"
        } bg-app-panel-muted text-app-text focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* 提示信息 */}
      {!error && hint && (
        <div className="flex items-start gap-2 mt-2 text-xs text-app-text-muted">
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{hint}</span>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="flex items-start gap-2 mt-2 text-xs text-red-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
