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

export const parseInteractionTargetSchema = z.object({
  targetUrl: z.string().url("请填写有效链接"),
});
