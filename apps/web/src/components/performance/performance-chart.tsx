"use client";

import { useEffect, useState } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import { BarChart3 } from "lucide-react";
import { useSmartPolling } from "@/lib/hooks/use-polling";

type ChartData = {
  time: string;
  avgResponseTime: number;
  requestCount: number;
};

export function PerformanceChart() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [maxValue, setMaxValue] = useState<number>(0);

  const fetchChartData = async () => {
    const metrics = performanceMonitor.export();
    
    const groupedByMinute = new Map<string, { total: number; count: number }>();
    
    metrics.forEach((metric) => {
      const time = new Date(metric.timestamp);
      const key = `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`;
      
      if (!groupedByMinute.has(key)) {
        groupedByMinute.set(key, { total: 0, count: 0 });
      }
      
      const group = groupedByMinute.get(key)!;
      group.total += metric.duration;
      group.count += 1;
    });

    const data: ChartData[] = Array.from(groupedByMinute.entries())
      .map(([time, { total, count }]) => ({
        time,
        avgResponseTime: Math.round(total / count),
        requestCount: count,
      }))
      .slice(-20);

    setChartData(data);
    
    const max = Math.max(...data.map((d) => d.avgResponseTime), 100);
    setMaxValue(max);
  };

  useSmartPolling(fetchChartData, { interval: 5000 });

  useEffect(() => {
    void fetchChartData();
  }, []);

  return (
    <div className="app-surface">
      <div className="pb-4 border-b border-app-line mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-app-info" />
          <h2 className="text-lg font-semibold text-app-text-strong">响应时间趋势</h2>
        </div>
        <p className="text-sm text-app-text-soft mt-1">按分钟统计的平均响应时间</p>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-8 text-app-text-soft">
          暂无数据
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-end gap-2 h-64">
            {chartData.map((data, index) => {
              const height = (data.avgResponseTime / maxValue) * 100;
              const color = data.avgResponseTime > 1000 ? "bg-app-danger" : 
                           data.avgResponseTime > 500 ? "bg-app-warning" : "bg-app-success";
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-app-text-muted">
                    {data.avgResponseTime}ms
                  </div>
                  <div 
                    className={`w-full ${color} rounded-t transition-all`}
                    style={{ height: `${height}%` }}
                    title={`${data.time}: ${data.avgResponseTime}ms (${data.requestCount} 请求)`}
                  />
                  <div className="text-xs text-app-text-muted rotate-45 origin-top-left mt-2">
                    {data.time}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-app-success rounded" />
              <span className="text-app-text">&lt; 500ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-app-warning rounded" />
              <span className="text-app-text">500-1000ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-app-danger rounded" />
              <span className="text-app-text">&gt; 1000ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
