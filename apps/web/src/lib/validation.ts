import { useState } from "react";

/**
 * 表单验证工具
 * 提供实时验证和友好的错误提示
 */

/**
 * 验证规则类型
 */
export type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: string) => string | undefined;
  message?: string;
};

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 表单字段配置
 */
export interface FieldConfig {
  name: string;
  label: string;
  rules?: ValidationRule;
}

/**
 * 验证单个字段
 */
export function validateField(value: string, rules?: ValidationRule): ValidationResult {
  if (!rules) {
    return { isValid: true };
  }

  // 必填验证
  if (rules.required && !value.trim()) {
    return {
      isValid: false,
      error: rules.message || "此字段为必填项",
    };
  }

  // 如果不是必填且值为空，跳过其他验证
  if (!rules.required && !value.trim()) {
    return { isValid: true };
  }

  // 最小长度验证
  if (rules.minLength && value.length < rules.minLength) {
    return {
      isValid: false,
      error: rules.message || `至少需要 ${rules.minLength} 个字符`,
    };
  }

  // 最大长度验证
  if (rules.maxLength && value.length > rules.maxLength) {
    return {
      isValid: false,
      error: rules.message || `最多 ${rules.maxLength} 个字符`,
    };
  }

  // 最小值验证
  if (rules.min !== undefined) {
    const num = Number(value);
    if (isNaN(num) || num < rules.min) {
      return {
        isValid: false,
        error: rules.message || `最小值为 ${rules.min}`,
      };
    }
  }

  // 最大值验证
  if (rules.max !== undefined) {
    const num = Number(value);
    if (isNaN(num) || num > rules.max) {
      return {
        isValid: false,
        error: rules.message || `最大值为 ${rules.max}`,
      };
    }
  }

  // 邮箱验证
  if (rules.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      return {
        isValid: false,
        error: rules.message || "请输入有效的邮箱地址",
      };
    }
  }

  // URL 验证
  if (rules.url) {
    try {
      new URL(value);
    } catch {
      return {
        isValid: false,
        error: rules.message || "请输入有效的 URL",
      };
    }
  }

  // 正则验证
  if (rules.pattern && !rules.pattern.test(value)) {
    return {
      isValid: false,
      error: rules.message || "格式不正确",
    };
  }

  // 自定义验证
  if (rules.custom) {
    const error = rules.custom(value);
    if (error) {
      return {
        isValid: false,
        error,
      };
    }
  }

  return { isValid: true };
}

/**
 * 验证整个表单
 */
export function validateForm(
  values: Record<string, string>,
  fields: FieldConfig[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.name] || "";
    const result = validateField(value, field.rules);
    if (!result.isValid && result.error) {
      errors[field.name] = result.error;
    }
  }

  return errors;
}

/**
 * 常用验证规则
 */
export const commonRules = {
  required: (message?: string): ValidationRule => ({
    required: true,
    message: message || "此字段为必填项",
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    minLength: length,
    message: message || `至少需要 ${length} 个字符`,
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    maxLength: length,
    message: message || `最多 ${length} 个字符`,
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    min,
    max,
    message: message || `请输入 ${min} 到 ${max} 之间的数字`,
  }),

  email: (message?: string): ValidationRule => ({
    email: true,
    message: message || "请输入有效的邮箱地址",
  }),

  url: (message?: string): ValidationRule => ({
    url: true,
    message: message || "请输入有效的 URL",
  }),

  pattern: (pattern: RegExp, message: string): ValidationRule => ({
    pattern,
    message,
  }),

  nickname: (): ValidationRule => ({
    required: true,
    minLength: 2,
    maxLength: 20,
    message: "昵称长度为 2-20 个字符",
  }),

  username: (): ValidationRule => ({
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: "用户名只能包含字母、数字和下划线，长度为 3-20 个字符",
  }),

  password: (): ValidationRule => ({
    required: true,
    minLength: 8,
    maxLength: 32,
    message: "密码长度为 8-32 个字符",
  }),

  phone: (): ValidationRule => ({
    pattern: /^1[3-9]\d{9}$/,
    message: "请输入有效的手机号码",
  }),

  number: (min?: number, max?: number): ValidationRule => ({
    pattern: /^\d+$/,
    min,
    max,
    message: "请输入有效的数字",
  }),
};

/**
 * 表单验证 Hook
 */
export function useFormValidation(fields: FieldConfig[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));

    // 如果字段已被触摸，实时验证
    if (touched[name]) {
      const field = fields.find((f) => f.name === name);
      if (field) {
        const result = validateField(value, field.rules);
        setErrors((prev) => ({
          ...prev,
          [name]: result.error || "",
        }));
      }
    }
  };

  const handleBlur = (name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));

    // 失焦时验证
    const field = fields.find((f) => f.name === name);
    if (field) {
      const value = values[name] || "";
      const result = validateField(value, field.rules);
      setErrors((prev) => ({
        ...prev,
        [name]: result.error || "",
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors = validateForm(values, fields);
    setErrors(newErrors);
    setTouched(
      fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {})
    );
    return Object.keys(newErrors).length === 0;
  };

  const reset = () => {
    setValues({});
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
  };
}
