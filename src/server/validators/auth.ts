import { z } from "zod";

const proxyProtocolSchema = z.enum(["HTTP", "HTTPS", "SOCKS5"]);
const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式应为 HH:MM");

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
    autoGenerateTime: hhmmSchema.optional(),
    autoExecuteEnabled: z.boolean().optional(),
    autoExecuteStartTime: hhmmSchema.optional(),
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

export const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空").max(50, "用户名过长"),
  password: z.string().min(1, "密码不能为空").max(100, "密码过长"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "用户名至少 3 位").max(50, "用户名过长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码过长"),
  inviteCode: z.string().min(6, "注册码无效").max(64, "注册码无效"),
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
    autoGenerateTime: hhmmSchema.optional(),
    autoExecuteEnabled: z.boolean().optional(),
    autoExecuteStartTime: hhmmSchema.optional(),
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
      data.autoGenerateTime !== undefined ||
      data.autoExecuteEnabled !== undefined ||
      data.autoExecuteStartTime !== undefined;

    if (!hasProfileChange && !hasProxyChange) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "至少填写一个修改项" });
    }

    const proxyValidation = proxySettingsSchema.safeParse(data);

    if (!proxyValidation.success) {
      for (const issue of proxyValidation.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: issue.path,
          message: issue.message,
        });
      }
    }
  });
