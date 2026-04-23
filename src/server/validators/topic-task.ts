import { z } from "zod";

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

const createTopicTaskFields = {
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
};

export const createTopicTaskSchema = z
  .object(createTopicTaskFields)
  .refine((value) => value.signEnabled || value.firstCommentEnabled || value.likePerDay > 0 || value.repostPerDay > 0 || value.commentPerDay > 0, {
    message: "请至少配置一种任务：签到、首评、点赞、转发或回复",
    path: ["signEnabled"],
  })
  .refine((value) => value.minPostsPerDay <= value.maxPostsPerDay, {
    message: "最小发帖数不能大于最大发帖数",
    path: ["minPostsPerDay"],
  });

export const updateTopicTaskSchema = z.object(topicTaskFields).partial();
