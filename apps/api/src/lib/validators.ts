import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长"),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
});

export const updateUserSchema = z.object({
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
});

export const createInviteCodeSchema = z.object({
  role: z.enum(["VIEWER", "OPERATOR"]).default("VIEWER"),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(48),
});

export const updateInviteCodeSchema = z.object({
  disabled: z.boolean(),
});

export const createSuperTopicSchema = z.object({
  name: z.string().min(1, "超话名称不能为空").max(50, "超话名称过长"),
  boardName: z.string().max(50, "板块名称过长").optional().or(z.literal("")),
  topicUrl: z.string().url("请填写有效链接").optional().or(z.literal("")),
  postingUrl: z.string().url("请填写有效链接").optional().or(z.literal("")),
});

export const createCopywritingSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题过长"),
  content: z.string().min(1, "文案内容不能为空").max(500, "文案内容过长"),
  tags: z.array(z.string().min(1).max(20)).default([]),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});

const protocolSchema = z.enum(["HTTP", "HTTPS", "SOCKS5"]);
const rotationModeSchema = z.enum(["STICKY", "M1", "M5", "M10"]);

export const createProxyNodeSchema = z.object({
  name: z.string().min(1, "代理名称不能为空").max(50, "代理名称过长"),
  protocol: protocolSchema.default("HTTP"),
  rotationMode: rotationModeSchema.optional().default("M5"),
  countryCode: z.string().max(8, "国家/地区编码过长").regex(/^[A-Za-z0-9-]*$/, "国家/地区编码格式不正确").optional().or(z.literal("")),
  host: z.string().min(1, "代理主机不能为空").max(255, "代理主机过长"),
  port: z.number().int("端口必须是整数").min(1, "端口范围错误").max(65535, "端口范围错误"),
  username: z.string().max(100, "代理用户名过长").optional().or(z.literal("")),
  password: z.string().max(200, "代理密码过长").optional().or(z.literal("")),
  enabled: z.boolean().optional().default(true),
  maxAccounts: z.number().int("单IP账号上限必须是整数").min(1, "上限最少为 1").max(100, "上限不能超过 100").optional().default(100),
});

export const updateProxyNodeSchema = createProxyNodeSchema.partial();

export const payloadProxyBindingSchema = z.object({
  proxyNodeId: z.string().nullable().optional(),
  backupProxyNodeId: z.string().nullable().optional(),
  fallbackProxyNodeId: z.string().nullable().optional(),
  proxyBindingMode: z.enum(["AUTO", "MANUAL"]).optional(),
  proxyBindingLocked: z.boolean().optional(),
  allowHostFallback: z.boolean().optional(),
});

export const generatePlansSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式不正确"),
});

export const updatePlanSchema = z.object({
  status: z.enum(["PENDING", "READY", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"]).optional(),
  resultMessage: z.string().max(200, "结果说明过长").optional().or(z.literal("")),
  scheduledTime: z.string().datetime().optional(),
  contentId: z.string().optional().nullable(),
});

export const topicTaskFields = {
  accountId: z.string().min(1, "请选择账号"),
  superTopicId: z.string().min(1, "请选择超话"),
  signEnabled: z.boolean().default(false),
  firstCommentEnabled: z.boolean().default(false),
  firstCommentPerDay: z.number().int().min(1).max(10).default(4),
  firstCommentIntervalSec: z.number().int().min(60).max(86_400).default(1800),
  likePerDay: z.number().int().min(0).max(300).default(0),
  likeIntervalSec: z.number().int().min(30).max(86_400).default(1200),
  repostPerDay: z.number().int().min(0).max(200).default(0),
  repostIntervalSec: z.number().int().min(60).max(86_400).default(1800),
  commentPerDay: z.number().int().min(0).max(100).default(0),
  commentIntervalSec: z.number().int().min(60).max(86_400).default(1800),
  firstCommentTemplates: z.array(z.string().trim().min(1).max(500)).max(200).default([]),
  postEnabled: z.boolean().default(false),
  minPostsPerDay: z.number().int().min(0).max(20).default(0),
  maxPostsPerDay: z.number().int().min(0).max(20).default(0),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  status: z.boolean().default(true),
};

export const createTopicTaskSchema = z
  .object({
    accountIds: z.array(z.string().min(1)).min(1, "请至少选择一个账号"),
    superTopicId: topicTaskFields.superTopicId,
    signEnabled: topicTaskFields.signEnabled,
    firstCommentEnabled: topicTaskFields.firstCommentEnabled,
    firstCommentPerDay: topicTaskFields.firstCommentPerDay,
    firstCommentIntervalSec: topicTaskFields.firstCommentIntervalSec,
    likePerDay: topicTaskFields.likePerDay,
    likeIntervalSec: topicTaskFields.likeIntervalSec,
    repostPerDay: topicTaskFields.repostPerDay,
    repostIntervalSec: topicTaskFields.repostIntervalSec,
    commentPerDay: topicTaskFields.commentPerDay,
    commentIntervalSec: topicTaskFields.commentIntervalSec,
    postEnabled: topicTaskFields.postEnabled,
    minPostsPerDay: topicTaskFields.minPostsPerDay,
    maxPostsPerDay: topicTaskFields.maxPostsPerDay,
    startTime: topicTaskFields.startTime,
    endTime: topicTaskFields.endTime,
    status: topicTaskFields.status,
  })
  .refine((value) => value.signEnabled || value.firstCommentEnabled || value.likePerDay > 0 || value.repostPerDay > 0 || value.commentPerDay > 0, {
    message: "请至少配置一种任务：签到、首评、点赞、转发或回复",
    path: ["signEnabled"],
  })
  .refine((value) => value.minPostsPerDay <= value.maxPostsPerDay, {
    message: "最小发帖数不能大于最大发帖数",
    path: ["minPostsPerDay"],
  });

export const updateTopicTaskSchema = z.object(topicTaskFields).partial();

const urgencySchema = z.enum(["S", "A", "B"]);

const forecastSchema = z.object({
  targetMinutes: z.number().int().min(1).max(24 * 60),
  limitMinutes: z.number().int().min(1).max(24 * 60),
  riskLevel: z.enum(["low", "medium", "high"]),
  notes: z.array(z.string().trim().min(1).max(200)).max(10),
});

const aiRiskSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().trim().min(1).max(300),
  reasons: z.array(z.string().trim().min(1).max(300)).max(10),
  suggestions: z.array(z.string().trim().min(1).max(300)).max(10),
  canBlock: z.boolean(),
});

export const startCommentLikeJobSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
  poolItemIds: z.array(z.string().min(1)).min(1, "至少选择一条评论链接"),
  targetNodeId: z.string().trim().min(1).max(100).nullable().optional(),
  urgency: urgencySchema.default("S").optional(),
  forecast: forecastSchema.optional(),
  aiRisk: aiRiskSchema.nullable().optional(),
});

export const startRepostRotationJobSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
  targetNodeId: z.string().trim().min(1).max(100).nullable().optional(),
  targetUrl: z.string().url("请填写有效微博链接"),
  times: z.number().int().min(1).max(20).default(5),
  intervalSec: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(10)]).default(3),
  copywritingTexts: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  urgency: urgencySchema.default("A").optional(),
  forecast: forecastSchema.optional(),
  aiRisk: aiRiskSchema.nullable().optional(),
});

export const registerSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长"),
  inviteCode: z.string().min(1, "注册码不能为空").max(50, "注册码过长"),
});

const proxyProtocolSchema = z.enum(["HTTP", "HTTPS", "SOCKS5"]);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式应为 HH:MM");

export const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(1, "密码不能为空").max(100, "密码过长"),
});

export const proxySettingsSchema = z
  .object({
    proxyEnabled: z.boolean().optional(),
    proxyProtocol: proxyProtocolSchema.optional(),
    proxyHost: z.string().max(255, "代理主机过长").optional().or(z.literal("")),
    proxyPort: z.number().int("端口必须是整数").min(1, "端口范围无效").max(65535, "端口范围无效").optional(),
    proxyUsername: z.string().max(255, "代理用户名过长").optional().or(z.literal("")),
    proxyPassword: z.string().max(255, "代理密码过长").optional().or(z.literal("")),
    taskConcurrency: z.number().int("并发数必须是整数").min(1, "并发数至少为 1").max(5, "并发数最多为 5").optional(),
    autoGenerateEnabled: z.boolean().optional(),
    autoGenerateWindowStart: hhmmSchema.optional(),
    autoGenerateWindowEnd: hhmmSchema.optional(),
    autoExecuteEnabled: z.boolean().optional(),
    autoExecuteStartTime: hhmmSchema.optional(),
    autoExecuteEndTime: hhmmSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.proxyEnabled) {
      return;
    }

    if (!data.proxyProtocol) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["proxyProtocol"], message: "请选择代理协议" });
    }

    if (!data.proxyHost || data.proxyHost.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["proxyHost"], message: "请输入代理主机" });
    }

    if (!data.proxyPort) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["proxyPort"], message: "请输入代理端口" });
    }
  });

export const updateProfileSchema = z
  .object({
    username: z.string().min(3, "用户名至少 3 位").max(50, "用户名过长").optional(),
    password: z.string().min(6, "密码至少 6 位").max(100, "密码过长").optional().or(z.literal("")),
    proxyEnabled: z.boolean().optional(),
    proxyProtocol: proxyProtocolSchema.optional(),
    proxyHost: z.string().max(255, "代理主机过长").optional().or(z.literal("")),
    proxyPort: z.number().int("端口必须是整数").min(1, "端口范围无效").max(65535, "端口范围无效").optional(),
    proxyUsername: z.string().max(255, "代理用户名过长").optional().or(z.literal("")),
    proxyPassword: z.string().max(255, "代理密码过长").optional().or(z.literal("")),
    taskConcurrency: z.number().int("并发数必须是整数").min(1, "并发数至少为 1").max(5, "并发数最多为 5").optional(),
    autoGenerateEnabled: z.boolean().optional(),
    autoGenerateWindowStart: hhmmSchema.optional(),
    autoGenerateWindowEnd: hhmmSchema.optional(),
    autoExecuteEnabled: z.boolean().optional(),
    autoExecuteStartTime: hhmmSchema.optional(),
    autoExecuteEndTime: hhmmSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasProfileChange = (data.username && data.username.trim() !== "") || (data.password && data.password !== "");
    const hasProxyChange =
      data.proxyEnabled !== undefined ||
      data.proxyProtocol !== undefined ||
      data.proxyHost !== undefined ||
      data.proxyPort !== undefined ||
      data.proxyUsername !== undefined ||
      data.proxyPassword !== undefined ||
      data.taskConcurrency !== undefined ||
      data.autoGenerateEnabled !== undefined ||
      data.autoGenerateWindowStart !== undefined ||
      data.autoGenerateWindowEnd !== undefined ||
      data.autoExecuteEnabled !== undefined ||
      data.autoExecuteStartTime !== undefined ||
      data.autoExecuteEndTime !== undefined;

    if (data.autoGenerateWindowStart && data.autoGenerateWindowEnd && data.autoGenerateWindowStart >= data.autoGenerateWindowEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["autoGenerateWindowEnd"], message: "生成窗口结束时间必须晚于开始时间" });
    }

    if (data.autoExecuteStartTime && data.autoExecuteEndTime && data.autoExecuteStartTime >= data.autoExecuteEndTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["autoExecuteEndTime"], message: "自动执行结束时间必须晚于开始时间" });
    }

    if (!hasProfileChange && !hasProxyChange) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "至少填写一个修改项" });
    }

    const proxyValidation = proxySettingsSchema.safeParse(data);
    if (!proxyValidation.success) {
      for (const issue of proxyValidation.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message });
      }
    }
  });

export const parseInteractionTargetSchema = z.object({
  targetUrl: z.string().url("请填写有效链接"),
});

export const createInteractionBatchSchema = z
  .object({
    targetUrl: z.string().url("请填写有效链接").optional(),
    targetUrls: z.array(z.string().url("请填写有效链接")).optional(),
    accountIds: z.array(z.string().min(1)).min(1, "至少选择一个账号"),
    contentIds: z.array(z.string().min(1)).optional(),
    actionType: z.enum(["LIKE", "POST", "COMMENT"]).default("LIKE"),
  })
  .superRefine((value, ctx) => {
    const targetCount = (value.targetUrls?.length || 0) + (value.targetUrl ? 1 : 0);

    if (targetCount === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetUrl"], message: "请至少提供一个目标链接" });
    }

    if (value.actionType === "COMMENT") {
      if (!value.targetUrls || value.targetUrls.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetUrls"], message: "回复任务请按行粘贴至少一个微博链接" });
      }

      if (!value.contentIds || value.contentIds.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contentIds"], message: "回复任务至少选择一条文案" });
      }
    }
  });

export const createCommentPoolItemSchema = z.object({
  sourceUrl: z.string().url("请填写有效链接"),
  note: z.string().trim().max(80, "备注不能超过 80 字").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  forceDuplicate: z.boolean().optional(),
});

export const batchImportCommentPoolSchema = z.object({
  sourceUrls: z.array(z.string().url("包含无效链接")).min(1, "至少导入一条链接"),
  note: z.string().trim().max(80, "备注不能超过 80 字").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  forceDuplicate: z.boolean().default(false),
});

export const fetchHotCommentsSchema = z.object({
  targetUrl: z.string().url("请填写有效微博链接"),
  limit: z.number().int().min(1).max(50).default(20),
  keywords: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

const aiBusinessTypeSchema = z.enum(["DAILY_PLAN", "QUICK_REPLY", "COMMENT_CONTROL", "REPOST_ROTATION"]);
const aiToneSchema = z.enum(["NATURAL", "PASSERBY", "SUPPORTIVE", "DISCUSSIVE", "LIVELY"]);
const aiLengthSchema = z.enum(["SHORT", "STANDARD", "LONG"]);
const aiRiskAssessmentSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().min(1).max(300),
  reasons: z.array(z.string().min(1).max(300)).max(10),
  suggestions: z.array(z.string().min(1).max(300)).max(10),
  canBlock: z.boolean(),
});

export const generateAiCopywritingSchema = z.object({
  businessType: aiBusinessTypeSchema,
  context: z.string().trim().min(5, "请填写更具体的主题或上下文").max(1000, "上下文过长"),
  tone: aiToneSchema,
  count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
});

export const saveAiCopywritingSchema = z.object({
  batchId: z.string().min(1),
  businessType: aiBusinessTypeSchema,
  tone: aiToneSchema,
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  items: z.array(createCopywritingSchema).min(1, "至少选择一条文案").max(100),
  riskAssessments: z.array(aiRiskAssessmentSchema).max(100).optional(),
});

export const rewriteAiCopywritingSchema = z.object({
  sourceContent: z.string().trim().min(1, "原文案不能为空").max(500, "原文案过长"),
  businessType: aiBusinessTypeSchema,
  context: z.string().trim().max(1000, "上下文过长").default(""),
  tone: aiToneSchema,
  count: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  length: aiLengthSchema,
  constraints: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
});

const allowedWeiboHosts = new Set(["weibo.com", "www.weibo.com", "m.weibo.cn", "weibo.cn"]);
const allowedAiHosts = new Set(["api.openai.com"]);

function getValidatedUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isAllowedWeiboUrl(value: string) {
  const url = getValidatedUrl(value);
  return Boolean(url && ["http:", "https:"].includes(url.protocol) && allowedWeiboHosts.has(url.hostname.toLowerCase()));
}

function isAllowedAiUrl(value: string) {
  const url = getValidatedUrl(value);
  return Boolean(url && url.protocol === "https:" && allowedAiHosts.has(url.hostname.toLowerCase()));
}

export const saveAiConfigSchema = z.object({
  baseUrl: z.string().url("请填写有效的 AI 接口地址").refine(isAllowedAiUrl, "AI 接口地址仅允许使用 OpenAI 官方 HTTPS 接口"),
  model: z.string().trim().min(1, "模型不能为空").max(100, "模型名称过长"),
  apiKey: z.string().trim().max(500, "API Key 过长").optional().or(z.literal("")),
});

export const fetchCopywritingLinkPreviewSchema = z.object({
  targetUrl: z.string().url("请填写有效微博链接").refine(isAllowedWeiboUrl, "仅支持预览微博域名链接"),
});

export const assessCopywritingRiskSchema = z.object({
  businessType: z.string().min(1),
  context: z.string().max(2000).default(""),
  candidates: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
});

export const assessTaskRiskSchema = z.object({
  taskType: z.string().min(1),
  urgency: z.enum(["S", "A", "B"]),
  accountCount: z.number().int().min(1).max(500),
  context: z.string().max(2000).optional(),
});

export const summarizeFailureRiskSchema = z.object({
  actionText: z.string().min(1).max(200),
  detailText: z.string().min(1).max(2000),
  topReason: z.string().max(1000).optional().nullable(),
});

const timeTextSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式应为 HH:MM");

const accountFieldsSchema = z.object({
  nickname: z.string().min(1, "账号昵称不能为空").max(50, "账号昵称过长"),
  remark: z.string().max(100, "备注过长").optional().or(z.literal("")),
  groupName: z.string().max(50, "分组名称过长").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED", "RISKY", "EXPIRED"]).default("ACTIVE"),
  scheduleWindowEnabled: z.boolean().optional().default(false),
  executionWindowStart: timeTextSchema.optional().or(z.literal("")),
  executionWindowEnd: timeTextSchema.optional().or(z.literal("")),
  baseJitterSec: z.number().int("随机间隔必须是整数").min(0, "随机间隔不能小于 0").max(3600, "随机间隔不能超过 3600 秒").optional().default(0),
});

function refineAccountSchedule(
  data: { scheduleWindowEnabled?: boolean; executionWindowStart?: string; executionWindowEnd?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.scheduleWindowEnabled) {
    return;
  }

  if (!data.executionWindowStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowStart"], message: "请输入执行窗口开始时间" });
  }

  if (!data.executionWindowEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowEnd"], message: "请输入执行窗口结束时间" });
  }

  if (data.executionWindowStart && data.executionWindowEnd && data.executionWindowStart >= data.executionWindowEnd) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executionWindowEnd"], message: "第一版仅支持当天窗口，结束时间必须晚于开始时间" });
  }
}

export const createAccountSchema = accountFieldsSchema.superRefine(refineAccountSchedule);
export const updateAccountSchema = accountFieldsSchema.partial().superRefine(refineAccountSchedule);

export const saveAccountSessionSchema = z.object({
  uid: z.string().max(100, "UID 过长").optional().or(z.literal("")),
  username: z.string().max(100, "用户名过长").optional().or(z.literal("")),
  cookie: z.string().min(1, "Cookie 不能为空").max(10000, "Cookie 过长"),
});
