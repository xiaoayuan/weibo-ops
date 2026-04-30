export function getPlanStatusText(status: string) {
  const map: Record<string, string> = {
    PENDING: "待执行",
    READY: "待确认",
    RUNNING: "执行中",
    SUCCESS: "成功",
    FAILED: "失败",
    CANCELLED: "已取消",
    PARTIAL_FAILED: "部分失败",
  };

  return map[status] || status;
}

export function getActionTypeText(actionType: string) {
  const map: Record<string, string> = {
    CHECK_IN: "签到",
    FIRST_COMMENT: "首评",
    LIKE: "点赞",
    POST: "转发",
    COMMENT: "评论",
    COMMENT_LIKE: "评论点赞",
    COMMENT_LIKE_BATCH: "控评点赞",
    REPOST_ROTATION: "轮转转发",
    PLAN_GENERATED: "计划生成",
    PLAN_SCHEDULED: "计划执行入队",
    PLAN_APPROVED: "计划审核通过",
    PLAN_REJECTED: "计划审核驳回",
    PLAN_STOPPED: "计划已停止",
    INTERACTION_TASK_CREATED: "互动任务创建",
    INTERACTION_TASK_UPDATED: "互动任务更新",
    INTERACTION_TASK_DELETED: "互动任务删除",
    ACTION_JOB_SCHEDULED: "编排任务入队",
    ACTION_JOB_STOPPED: "编排任务停止",
    ACCOUNT_SESSION_SAVED: "登录态保存",
    ACCOUNT_SESSION_CHECKED: "登录态检测",
    USER_REGISTERED_WITH_INVITE: "邀请码注册",
    FIRST_COMMENT_EXECUTE_FAILED: "首评执行失败",
  };

  return map[actionType] || actionType;
}

export function getAccountStatusText(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "正常",
    DISABLED: "停用",
    RISKY: "风险",
    EXPIRED: "失效",
  };

  return map[status] || status;
}

export function getLoginStatusText(status: string) {
  const map: Record<string, string> = {
    UNKNOWN: "未检测",
    ONLINE: "在线",
    EXPIRED: "已过期",
    FAILED: "检测失败",
  };

  return map[status] || status;
}

export function getRoleText(role: string) {
  const map: Record<string, string> = {
    ADMIN: "管理员",
    OPERATOR: "运营",
    VIEWER: "只读",
  };

  return map[role] || role;
}

export function getProxyProtocolText(protocol: string) {
  const map: Record<string, string> = {
    HTTP: "HTTP",
    HTTPS: "HTTPS",
    SOCKS5: "SOCKS5",
  };

  return map[protocol] || protocol;
}

export function getProxyRotationModeText(mode: string) {
  const map: Record<string, string> = {
    STICKY: "粘性",
    M1: "1 分钟",
    M5: "5 分钟",
    M10: "10 分钟",
  };

  return map[mode] || mode;
}
