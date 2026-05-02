/**
 * 错误消息工具
 * 提供友好的错误提示和解决建议
 */

/**
 * 错误类型
 */
export enum ErrorType {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  FORBIDDEN = 'FORBIDDEN',
  
  // 资源相关
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // 验证相关
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // 业务逻辑
  ACCOUNT_OFFLINE = 'ACCOUNT_OFFLINE',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  TASK_RUNNING = 'TASK_RUNNING',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // 系统错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // 未知错误
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误消息配置
 */
interface ErrorConfig {
  title: string;
  message: string;
  suggestion?: string;
  action?: string;
}

/**
 * 错误消息映射
 */
const errorMessages: Record<ErrorType, ErrorConfig> = {
  // 认证相关
  [ErrorType.UNAUTHORIZED]: {
    title: '未登录',
    message: '您还未登录或登录已过期',
    suggestion: '请重新登录后继续操作',
    action: '前往登录',
  },
  [ErrorType.SESSION_EXPIRED]: {
    title: '登录已过期',
    message: '您的登录状态已过期',
    suggestion: '请重新登录以继续使用',
    action: '重新登录',
  },
  [ErrorType.FORBIDDEN]: {
    title: '权限不足',
    message: '您没有权限执行此操作',
    suggestion: '请联系管理员获取相应权限',
  },
  
  // 资源相关
  [ErrorType.NOT_FOUND]: {
    title: '资源不存在',
    message: '您访问的资源不存在或已被删除',
    suggestion: '请检查链接是否正确，或返回首页重新操作',
    action: '返回首页',
  },
  [ErrorType.ALREADY_EXISTS]: {
    title: '资源已存在',
    message: '该资源已经存在，无法重复创建',
    suggestion: '请使用其他名称或编辑现有资源',
  },
  
  // 验证相关
  [ErrorType.VALIDATION_ERROR]: {
    title: '输入验证失败',
    message: '您输入的信息不符合要求',
    suggestion: '请检查输入内容是否正确',
  },
  [ErrorType.INVALID_INPUT]: {
    title: '输入格式错误',
    message: '您输入的格式不正确',
    suggestion: '请按照提示格式输入',
  },
  
  // 业务逻辑
  [ErrorType.ACCOUNT_OFFLINE]: {
    title: '账号未登录',
    message: '该微博账号登录已过期',
    suggestion: '请重新扫码登录该账号',
    action: '扫码登录',
  },
  [ErrorType.ACCOUNT_DISABLED]: {
    title: '账号已停用',
    message: '该账号已被停用，无法执行操作',
    suggestion: '请先启用该账号',
    action: '启用账号',
  },
  [ErrorType.TASK_RUNNING]: {
    title: '任务正在执行',
    message: '该任务正在执行中，无法重复操作',
    suggestion: '请等待当前任务完成后再试',
  },
  [ErrorType.QUOTA_EXCEEDED]: {
    title: '超出限额',
    message: '您的操作已超出系统限额',
    suggestion: '请稍后再试或联系管理员提升限额',
  },
  
  // 系统错误
  [ErrorType.NETWORK_ERROR]: {
    title: '网络错误',
    message: '网络连接失败，请检查您的网络',
    suggestion: '请检查网络连接后重试',
    action: '重试',
  },
  [ErrorType.SERVER_ERROR]: {
    title: '服务器错误',
    message: '服务器处理请求时发生错误',
    suggestion: '请稍后重试，如果问题持续请联系技术支持',
    action: '重试',
  },
  [ErrorType.DATABASE_ERROR]: {
    title: '数据库错误',
    message: '数据库操作失败',
    suggestion: '请稍后重试，如果问题持续请联系技术支持',
  },
  [ErrorType.TIMEOUT]: {
    title: '请求超时',
    message: '请求处理时间过长',
    suggestion: '请检查网络连接或稍后重试',
    action: '重试',
  },
  
  // 未知错误
  [ErrorType.UNKNOWN]: {
    title: '未知错误',
    message: '发生了未知错误',
    suggestion: '请刷新页面重试，如果问题持续请联系技术支持',
    action: '刷新页面',
  },
};

/**
 * 获取友好的错误消息
 */
export function getErrorMessage(error: unknown): ErrorConfig {
  // 如果是 Error 对象
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // 根据错误消息判断类型
    if (message.includes('unauthorized') || message.includes('未登录')) {
      return errorMessages[ErrorType.UNAUTHORIZED];
    }
    if (message.includes('forbidden') || message.includes('权限')) {
      return errorMessages[ErrorType.FORBIDDEN];
    }
    if (message.includes('not found') || message.includes('不存在')) {
      return errorMessages[ErrorType.NOT_FOUND];
    }
    if (message.includes('already exists') || message.includes('已存在')) {
      return errorMessages[ErrorType.ALREADY_EXISTS];
    }
    if (message.includes('offline') || message.includes('过期') || message.includes('登录态')) {
      return errorMessages[ErrorType.ACCOUNT_OFFLINE];
    }
    if (message.includes('disabled') || message.includes('停用')) {
      return errorMessages[ErrorType.ACCOUNT_DISABLED];
    }
    if (message.includes('running') || message.includes('执行中')) {
      return errorMessages[ErrorType.TASK_RUNNING];
    }
    if (message.includes('network') || message.includes('网络')) {
      return errorMessages[ErrorType.NETWORK_ERROR];
    }
    if (message.includes('timeout') || message.includes('超时')) {
      return errorMessages[ErrorType.TIMEOUT];
    }
    
    // 返回原始错误消息
    return {
      title: '操作失败',
      message: error.message,
      suggestion: '请重试或联系技术支持',
    };
  }
  
  // 如果是字符串
  if (typeof error === 'string') {
    return {
      title: '操作失败',
      message: error,
      suggestion: '请重试或联系技术支持',
    };
  }
  
  // 未知错误
  return errorMessages[ErrorType.UNKNOWN];
}

/**
 * 格式化错误消息为字符串
 */
export function formatErrorMessage(error: unknown): string {
  const config = getErrorMessage(error);
  let message = `${config.title}：${config.message}`;
  
  if (config.suggestion) {
    message += `\n建议：${config.suggestion}`;
  }
  
  return message;
}

/**
 * 获取简短错误消息（用于 Toast）
 */
export function getShortErrorMessage(error: unknown): string {
  const config = getErrorMessage(error);
  return `${config.title}：${config.message}`;
}

/**
 * 获取错误建议
 */
export function getErrorSuggestion(error: unknown): string | undefined {
  const config = getErrorMessage(error);
  return config.suggestion;
}

/**
 * 获取错误操作按钮文本
 */
export function getErrorAction(error: unknown): string | undefined {
  const config = getErrorMessage(error);
  return config.action;
}
