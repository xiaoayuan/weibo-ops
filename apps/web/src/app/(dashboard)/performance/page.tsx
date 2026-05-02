"use client";

import { useState } from "react";
import { PerformanceOverview } from "@/components/performance/performance-overview";
import { SlowQueriesList } from "@/components/performance/slow-queries-list";
import { ErrorsList } from "@/components/performance/errors-list";
import { PerformanceChart } from "@/components/performance/performance-chart";

export const dynamic = "force-dynamic";

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "slow-queries" | "errors" | "charts">("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">性能监控</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          实时监控系统性能，追踪 API 响应时间和慢查询
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            概览
          </button>
          <button
            onClick={() => setActiveTab("slow-queries")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "slow-queries"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            慢查询
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "errors"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            错误日志
          </button>
          <button
            onClick={() => setActiveTab("charts")}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === "charts"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            性能图表
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === "overview" && <PerformanceOverview />}
        {activeTab === "slow-queries" && <SlowQueriesList />}
        {activeTab === "errors" && <ErrorsList />}
        {activeTab === "charts" && <PerformanceChart />}
      </div>
    </div>
  );
}
