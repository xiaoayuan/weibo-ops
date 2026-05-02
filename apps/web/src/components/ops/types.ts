import type { ActionJob, CommentPoolItem, WeiboAccount } from "@/lib/app-data";

export type HotCommentPreviewItem = {
  commentId: string;
  sourceUrl: string;
  text: string;
  author: string;
  likeCount?: number;
};

export type OpsTab = "POOL" | "HOT" | "TARGET" | "ROTATION";

export type OpsManagerProps = {
  accounts: WeiboAccount[];
  initialPoolItems: CommentPoolItem[];
  initialJobs: ActionJob[];
};

export type PoolFormData = {
  singleUrl: string;
  singleNote: string;
  singleTags: string;
  batchText: string;
  batchNote: string;
  batchTags: string;
};

export type HotCommentFormData = {
  targetUrl: string;
  limit: number;
  keywords: string;
};

export type RotationFormData = {
  targetUrl: string;
  times: number;
  intervalSec: 0 | 3 | 5 | 10;
  copyTexts: string;
};

export function getJobTypeText(jobType: ActionJob["jobType"]) {
  return jobType === "COMMENT_LIKE_BATCH" ? "控评点赞" : "轮转转发";
}

export function getJobStatusText(status: ActionJob["status"]) {
  const map: Record<ActionJob["status"], string> = {
    PENDING: "待执行",
    RUNNING: "执行中",
    SUCCESS: "成功",
    PARTIAL_FAILED: "部分失败",
    FAILED: "失败",
    CANCELLED: "已取消",
  };

  return map[status] || status;
}
