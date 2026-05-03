import Papa from "papaparse";

/**
 * 数据导出工具
 * 
 * 提供 CSV 和 JSON 格式的数据导出功能
 */
export class DataExporter {
  /**
   * 导出为 CSV
   */
  static exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    fields?: (keyof T)[],
  ): void {
    if (data.length === 0) {
      alert("没有数据可导出");
      return;
    }

    // 如果指定了字段，只导出这些字段
    const exportData = fields
      ? data.map((item) => {
          const filtered: Partial<T> = {};
          fields.forEach((field) => {
            filtered[field] = item[field];
          });
          return filtered;
        })
      : data;

    // 转换为 CSV
    const csv = Papa.unparse(exportData, {
      header: true,
    });

    // 添加 BOM 以支持中文
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

    // 下载文件
    this.downloadBlob(blob, `${filename}.csv`);
  }

  /**
   * 导出为 JSON
   */
  static exportToJSON<T>(data: T[], filename: string): void {
    if (data.length === 0) {
      alert("没有数据可导出");
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });

    this.downloadBlob(blob, `${filename}.json`);
  }

  /**
   * 导出为 Excel（实际上是 CSV，但 Excel 可以打开）
   */
  static exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    fields?: (keyof T)[],
  ): void {
    this.exportToCSV(data, filename, fields);
  }

  /**
   * 下载 Blob
   */
  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 格式化日期
   */
  static formatDate(date: Date | string | null | undefined): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  /**
   * 格式化布尔值
   */
  static formatBoolean(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return "";
    return value ? "是" : "否";
  }

  /**
   * 格式化状态
   */
  static formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      ACTIVE: "活跃",
      INACTIVE: "停用",
      PENDING: "待执行",
      RUNNING: "执行中",
      COMPLETED: "已完成",
      FAILED: "失败",
      CANCELLED: "已取消",
    };
    return statusMap[status] || status;
  }
}

/**
 * 账号数据导出字段配置
 */
export const ACCOUNT_EXPORT_FIELDS = {
  nickname: "昵称",
  weiboUid: "微博 UID",
  status: "状态",
  groupName: "分组",
  remark: "备注",
  createdAt: "创建时间",
  updatedAt: "更新时间",
} as const;

/**
 * 文案数据导出字段配置
 */
export const COPYWRITING_EXPORT_FIELDS = {
  title: "标题",
  content: "内容",
  status: "状态",
  category: "分类",
  tags: "标签",
  createdAt: "创建时间",
  updatedAt: "更新时间",
} as const;

/**
 * 计划数据导出字段配置
 */
export const PLAN_EXPORT_FIELDS = {
  title: "标题",
  planDate: "计划日期",
  status: "状态",
  urgency: "紧急度",
  targetCount: "目标数量",
  completedCount: "完成数量",
  createdAt: "创建时间",
  updatedAt: "更新时间",
} as const;

/**
 * 日志数据导出字段配置
 */
export const LOG_EXPORT_FIELDS = {
  action: "操作",
  status: "状态",
  message: "消息",
  createdAt: "时间",
} as const;
