/**
 * 性能监控工具
 * 
 * 功能：
 * - API 响应时间监控
 * - 慢查询追踪
 * - 错误率统计
 * - 缓存命中率统计
 */

type PerformanceMetric = {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
  cached?: boolean;
  error?: string;
};

type PerformanceStats = {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  slowestRequest: PerformanceMetric | null;
  fastestRequest: PerformanceMetric | null;
  cacheHitRate: number;
  errorRate: number;
};

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // 最多保存 1000 条记录
  private slowQueryThreshold = 1000; // 慢查询阈值（毫秒）

  /**
   * 记录性能指标
   */
  record(metric: PerformanceMetric) {
    this.metrics.push(metric);

    // 限制记录数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // 慢查询警告
    if (metric.duration > this.slowQueryThreshold) {
      console.warn(
        `[性能警告] 慢查询: ${metric.name} 耗时 ${metric.duration}ms`,
        metric
      );
    }
  }

  /**
   * 测量函数执行时间
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    options?: { cached?: boolean }
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await fn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : "Unknown error";
      throw err;
    } finally {
      const duration = performance.now() - startTime;

      this.record({
        name,
        duration,
        timestamp: Date.now(),
        success,
        cached: options?.cached,
        error,
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats(timeRange?: number): PerformanceStats {
    const now = Date.now();
    const metrics = timeRange
      ? this.metrics.filter((m) => now - m.timestamp < timeRange)
      : this.metrics;

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        slowestRequest: null,
        fastestRequest: null,
        cacheHitRate: 0,
        errorRate: 0,
      };
    }

    const successMetrics = metrics.filter((m) => m.success);
    const cachedMetrics = metrics.filter((m) => m.cached);

    const durations = metrics.map((m) => m.duration);
    const averageResponseTime =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    const sortedByDuration = [...metrics].sort((a, b) => a.duration - b.duration);

    return {
      totalRequests: metrics.length,
      successRequests: successMetrics.length,
      failedRequests: metrics.length - successMetrics.length,
      averageResponseTime: Math.round(averageResponseTime),
      slowestRequest: sortedByDuration[sortedByDuration.length - 1] || null,
      fastestRequest: sortedByDuration[0] || null,
      cacheHitRate:
        metrics.length > 0
          ? Math.round((cachedMetrics.length / metrics.length) * 100)
          : 0,
      errorRate:
        metrics.length > 0
          ? Math.round(
              ((metrics.length - successMetrics.length) / metrics.length) * 100
            )
          : 0,
    };
  }

  /**
   * 获取慢查询列表
   */
  getSlowQueries(threshold?: number): PerformanceMetric[] {
    const limit = threshold || this.slowQueryThreshold;
    return this.metrics
      .filter((m) => m.duration > limit)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * 获取错误列表
   */
  getErrors(): PerformanceMetric[] {
    return this.metrics.filter((m) => !m.success);
  }

  /**
   * 清除所有记录
   */
  clear() {
    this.metrics = [];
  }

  /**
   * 导出数据
   */
  export(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 打印统计报告
   */
  printReport(timeRange?: number) {
    const stats = this.getStats(timeRange);

    console.group("📊 性能监控报告");
    console.log(`总请求数: ${stats.totalRequests}`);
    console.log(`成功请求: ${stats.successRequests}`);
    console.log(`失败请求: ${stats.failedRequests}`);
    console.log(`平均响应时间: ${stats.averageResponseTime}ms`);
    console.log(`缓存命中率: ${stats.cacheHitRate}%`);
    console.log(`错误率: ${stats.errorRate}%`);

    if (stats.slowestRequest) {
      console.log(
        `最慢请求: ${stats.slowestRequest.name} (${stats.slowestRequest.duration}ms)`
      );
    }

    if (stats.fastestRequest) {
      console.log(
        `最快请求: ${stats.fastestRequest.name} (${stats.fastestRequest.duration}ms)`
      );
    }

    const slowQueries = this.getSlowQueries();
    if (slowQueries.length > 0) {
      console.warn(`慢查询数量: ${slowQueries.length}`);
      console.table(
        slowQueries.slice(0, 10).map((m) => ({
          名称: m.name,
          耗时: `${m.duration}ms`,
          时间: new Date(m.timestamp).toLocaleTimeString(),
        }))
      );
    }

    const errors = this.getErrors();
    if (errors.length > 0) {
      console.error(`错误数量: ${errors.length}`);
      console.table(
        errors.slice(0, 10).map((m) => ({
          名称: m.name,
          错误: m.error,
          时间: new Date(m.timestamp).toLocaleTimeString(),
        }))
      );
    }

    console.groupEnd();
  }
}

// 全局实例
export const performanceMonitor = new PerformanceMonitor();

// 在浏览器环境中暴露到 window 对象
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).performanceMonitor = performanceMonitor;
}

/**
 * API 性能监控装饰器
 */
export function monitorApi(name: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return performanceMonitor.measure(
        `${name}.${propertyKey}`,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * React Hook - 监控组件渲染性能
 */
export function usePerformanceMonitor(componentName: string) {
  if (typeof window === "undefined") return;

  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    performanceMonitor.record({
      name: `Component:${componentName}`,
      duration,
      timestamp: Date.now(),
      success: true,
    });
  };
}
