import { z } from "zod";

export const topicTaskFields = {
  accountId: z.string().min(1, "请选择账号"),
  superTopicId: z.string().min(1, "请选择超话"),
  signEnabled: z.boolean().default(false),
  postEnabled: z.boolean().default(false),
  minPostsPerDay: z.number().int().min(0).max(20).default(0),
  maxPostsPerDay: z.number().int().min(0).max(20).default(0),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  status: z.boolean().default(true),
};

const createTopicTaskFields = {
  accountIds: z.array(z.string().min(1)).min(1, "请至少选择一个账号"),
  superTopicId: topicTaskFields.superTopicId,
  signEnabled: topicTaskFields.signEnabled,
  postEnabled: topicTaskFields.postEnabled,
  minPostsPerDay: topicTaskFields.minPostsPerDay,
  maxPostsPerDay: topicTaskFields.maxPostsPerDay,
  startTime: topicTaskFields.startTime,
  endTime: topicTaskFields.endTime,
  status: topicTaskFields.status,
};

export const createTopicTaskSchema = z
  .object(createTopicTaskFields)
  .refine((value) => value.signEnabled, {
    message: "当前仅支持签到任务，请开启签到",
    path: ["signEnabled"],
  })
  .refine((value) => value.minPostsPerDay <= value.maxPostsPerDay, {
    message: "最小发帖数不能大于最大发帖数",
    path: ["minPostsPerDay"],
  });

export const updateTopicTaskSchema = z.object(topicTaskFields).partial();
