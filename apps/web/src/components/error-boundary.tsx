"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * 错误边界属性
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * 错误边界状态
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // 调用错误回调
    this.props.onError?.(error, errorInfo);

    // 可以在这里上报错误到监控系统
    // reportError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-app-bg">
          <div className="w-full max-w-2xl app-surface p-8 text-center">
            {/* 图标 */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
            </div>

            {/* 标题 */}
            <h1 className="text-2xl font-bold text-app-text-strong mb-2">
              页面出错了
            </h1>
            <p className="text-app-text-muted mb-6">
              抱歉，页面遇到了一些问题。您可以尝试刷新页面或返回首页。
            </p>

            {/* 错误信息（开发环境） */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 text-left">
                <details className="bg-app-panel-muted rounded-[12px] p-4">
                  <summary className="cursor-pointer text-sm font-medium text-app-text-strong mb-2">
                    错误详情（仅开发环境可见）
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-xs text-app-text-muted mb-1">错误消息：</p>
                      <pre className="text-xs text-red-500 bg-app-surface p-2 rounded overflow-x-auto">
                        {this.state.error.message}
                      </pre>
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <p className="text-xs text-app-text-muted mb-1">堆栈跟踪：</p>
                        <pre className="text-xs text-app-text bg-app-surface p-2 rounded overflow-x-auto max-h-40">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo && (
                      <div>
                        <p className="text-xs text-app-text-muted mb-1">组件堆栈：</p>
                        <pre className="text-xs text-app-text bg-app-surface p-2 rounded overflow-x-auto max-h-40">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text hover:bg-app-panel-strong transition"
              >
                <RefreshCw className="h-4 w-4" />
                <span>重试</span>
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 rounded-[12px] border border-app-line bg-app-panel-muted text-app-text hover:bg-app-panel-strong transition"
              >
                <RefreshCw className="h-4 w-4" />
                <span>刷新页面</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-app-accent hover:bg-app-accent/90 text-white transition"
              >
                <Home className="h-4 w-4" />
                <span>返回首页</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 简单错误回退组件
 */
interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-app-text-strong mb-2">
          出错了
        </h3>
        <p className="text-sm text-app-text-muted mb-4">
          {error?.message || "发生了未知错误"}
        </p>
        {resetError && (
          <button
            onClick={resetError}
            className="px-4 py-2 rounded-[12px] bg-app-accent hover:bg-app-accent/90 text-white transition"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
