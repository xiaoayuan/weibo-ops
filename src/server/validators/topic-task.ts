import { z } from "zod";

export const topicTaskFields = {
  accountId: z.string().min(1, "请选择账号"),
  superTopicId: z.string().min(1, "请选择超话"),
  signEnabled: z.boolean().default(false),
  firstCommentEnabled: z.boolean().default(false),
  firstCommentPerDay: z.number().int().min(1).max(10).default(4),
  firstCommentTemplates: z.array(z.string().trim().min(1).max(500)).max(200).default([]),
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
  firstCommentEnabled: topicTaskFields.firstCommentEnabled,
  firstCommentPerDay: topicTaskFields.firstCommentPerDay,
  postEnabled: topicTaskFields.postEnabled,
  minPostsPerDay: topicTaskFields.minPostsPerDay,
  maxPostsPerDay: topicTaskFields.maxPostsPerDay,
  startTime: topicTaskFields.startTime,
  endTime: topicTaskFields.endTime,
  status: topicTaskFields.status,
};

export const createTopicTaskSchema = z
  .object(createTopicTaskFields)
  .refine((value) => value.signEnabled || value.firstCommentEnabled, {
    message: "请至少启用一种任务：签到或首评",
    path: ["signEnabled"],
  })
  .refine((value) => value.minPostsPerDay <= value.maxPostsPerDay, {
    message: "最小发帖数不能大于最大发帖数",
    path: ["minPostsPerDay"],
  });

export const updateTopicTaskSchema = z.object(topicTaskFields).partial();
