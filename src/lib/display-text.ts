const actionTypeTextMap: Record<string, string> = {
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
  PLAN_STATUS_UPDATED: "计划状态更新",
  PLAN_DELETED: "计划删除",
  INTERACTION_TASK_CREATED: "互动任务创建",
  INTERACTION_TASK_UPDATED: "互动任务更新",
  INTERACTION_TASK_DELETED: "互动任务删除",
  INTERACTION_TASK_BATCH_DELETED: "互动任务批量删除",
  INTERACTION_SCHEDULED: "互动执行入队",
  INTERACTION_APPROVED: "互动审核通过",
  INTERACTION_REJECTED: "互动审核驳回",
  INTERACTION_STOPPED: "互动已停止",
  ACTION_JOB_SCHEDULED: "编排任务入队",
  ACTION_JOB_STOPPED: "编排任务停止",
  ACTION_JOB_STEP_SUCCESS: "编排步骤成功",
  ACTION_JOB_STEP_FAILED: "编排步骤失败",
  AUTO_CHECKIN_DAILY_RUN: "自动签到调度",
  AUTO_FIRST_COMMENT_DAILY_RUN: "自动首评调度",
  ACCOUNT_SESSION_SAVED: "登录态保存",
  ACCOUNT_SESSION_CHECKED: "登录态检测",
  INVITE_CODE_CREATED: "邀请码创建",
  INVITE_CODE_UPDATED: "邀请码更新",
  USER_REGISTERED_WITH_INVITE: "邀请码注册",
  FIRST_COMMENT_EXECUTE_FAILED: "首评执行失败",
};

const taskStatusTextMap: Record<string, string> = {
  PENDING: "待审核",
  READY: "已确认",
  RUNNING: "执行中",
  SUCCESS: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
  PARTIAL_FAILED: "部分失败",
};

function readStepType(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const stepType = record.stepType;

  if (typeof stepType === "string") {
    return stepType;
  }

  return undefined;
}

function readStepActionType(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const stepActionType = record.stepActionType;

  if (typeof stepActionType === "string") {
    return stepActionType;
  }

  return undefined;
}

function getStepActionText(stepType: string | undefined) {
  if (stepType === "LIKE") {
    return "点赞";
  }

  if (stepType === "POST") {
    return "转发";
  }

  if (stepType === "COMMENT") {
    return "评论";
  }

  if (stepType === "COMMENT_LIKE") {
    return "评论点赞";
  }

  if (stepType === "REPOST") {
    return "转发";
  }

  return "任务步骤";
}

export function getActionTypeText(actionType: string, requestPayload?: unknown) {
  if (actionType.startsWith("ACTION_JOB_STEP_")) {
    const actionText = getStepActionText(readStepActionType(requestPayload) || readStepType(requestPayload));

    if (actionType.endsWith("SUCCESS")) {
      return `${actionText}成功`;
    }

    if (actionType.endsWith("FAILED")) {
      return `${actionText}失败`;
    }

    return `${actionText}日志`;
  }

  return actionTypeTextMap[actionType] || actionType;
}

export function getTaskStatusText(status: string) {
  return taskStatusTextMap[status] || status;
}
