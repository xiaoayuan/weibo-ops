import type { AppRole } from "@/lib/auth-shared";

export type NavIconName =
  | "layout-dashboard"
  | "users"
  | "tags"
  | "clipboard-list"
  | "file-text"
  | "calendar-range"
  | "message-circle-heart"
  | "refresh-cw"
  | "bell"
  | "bar-chart-3"
  | "settings"
  | "shield";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: NavIconName;
  minRole?: AppRole;
};

export const navItems: NavItem[] = [
  { href: "/", label: "控制台", description: "查看任务、账号和异常总览。", icon: "layout-dashboard" },
  { href: "/accounts", label: "账号管理", description: "查看账号状态、分组和登录健康。", icon: "users" },
  { href: "/super-topics", label: "超话管理", description: "统一管理超话资源和基础配置。", icon: "tags" },
  { href: "/topic-tasks", label: "任务配置", description: "为账号与超话绑定执行策略。", icon: "clipboard-list" },
  { href: "/copywriting", label: "文案库", description: "集中维护可用文案与 AI 生成内容。", icon: "file-text" },
  { href: "/plans", label: "每日计划", description: "查看业务时区下的执行计划与状态。", icon: "calendar-range" },
  { href: "/interactions", label: "互动任务", description: "维护互动任务和执行结果。", icon: "message-circle-heart" },
  { href: "/ops", label: "控评与轮转", description: "关注批次执行、节点分配和结果质量。", icon: "refresh-cw" },
  { href: "/logs", label: "执行日志", description: "按时间线查看执行结果和失败原因。", icon: "bell" },
  { href: "/traffic", label: "流量监控", description: "观察整体任务量和趋势变化。", icon: "bar-chart-3" },
  { href: "/scheduler", label: "调度监控", description: "查看调度器、worker 和排队状态。", icon: "refresh-cw" },
  { href: "/proxy-center", label: "代理中心", description: "维护代理节点与自动分配状态。", icon: "settings", minRole: "ADMIN" },
  { href: "/users", label: "用户管理", description: "管理角色、邀请码和团队账号。", icon: "shield", minRole: "ADMIN" },
  { href: "/settings", label: "系统设置", description: "维护风险规则、个人资料和系统策略。", icon: "settings", minRole: "ADMIN" },
];
