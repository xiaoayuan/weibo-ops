import { z } from "zod";

export const saveAccountSessionSchema = z.object({
  uid: z.string().min(1, "UID 不能为空").max(100, "UID 过长"),
  username: z.string().min(1, "用户名不能为空").max(100, "用户名过长"),
  cookie: z.string().min(1, "Cookie 不能为空").max(10000, "Cookie 过长"),
});
