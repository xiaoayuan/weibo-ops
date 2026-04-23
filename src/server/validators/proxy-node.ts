import { z } from "zod";

const protocolSchema = z.enum(["HTTP", "HTTPS", "SOCKS5"]);

export const createProxyNodeSchema = z.object({
  name: z.string().min(1, "代理名称不能为空").max(50, "代理名称过长"),
  protocol: protocolSchema.default("HTTP"),
  host: z.string().min(1, "代理主机不能为空").max(255, "代理主机过长"),
  port: z.number().int("端口必须是整数").min(1, "端口范围错误").max(65535, "端口范围错误"),
  username: z.string().max(100, "代理用户名过长").optional().or(z.literal("")),
  password: z.string().max(200, "代理密码过长").optional().or(z.literal("")),
  enabled: z.boolean().optional().default(true),
  maxAccounts: z.number().int("单IP账号上限必须是整数").min(1, "上限最少为 1").max(100, "上限不能超过 100").optional().default(100),
});

export const updateProxyNodeSchema = createProxyNodeSchema.partial();
