import { z } from "zod";

export const createSuperTopicSchema = z.object({
  name: z.string().min(1, "超话名称不能为空").max(50, "超话名称过长"),
  boardName: z.string().max(50, "板块名称过长").optional().or(z.literal("")),
  topicUrl: z.string().url("请填写有效链接").optional().or(z.literal("")),
});
