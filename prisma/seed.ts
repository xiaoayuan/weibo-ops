import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("缺少 DATABASE_URL 环境变量");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const [adminPasswordHash, demoPasswordHash] = await Promise.all([
    hashPassword("admin123456"),
    hashPassword("demo123456"),
  ]);

  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  for (const userSeed of [
    { username: "operator", role: "OPERATOR" as const },
    { username: "viewer", role: "VIEWER" as const },
  ]) {
    await prisma.user.upsert({
      where: { username: userSeed.username },
      update: {
        passwordHash: demoPasswordHash,
        role: userSeed.role,
      },
      create: {
        username: userSeed.username,
        passwordHash: demoPasswordHash,
        role: userSeed.role,
      },
    });
  }

  const accountSeeds = [
    { nickname: "账号A", remark: "娱乐组主号", groupName: "娱乐组", status: "ACTIVE" as const, ownerUserId: adminUser.id },
    { nickname: "账号B", remark: "娱乐组备用", groupName: "娱乐组", status: "ACTIVE" as const, ownerUserId: adminUser.id },
    { nickname: "账号C", remark: "控评组", groupName: "互动组", status: "ACTIVE" as const, ownerUserId: adminUser.id },
  ];

  const topicSeeds = [
    { name: "示例明星超话", boardName: "签到区", topicUrl: "https://weibo.com/example-super-topic-1" },
    { name: "活动应援超话", boardName: "日常发帖区", topicUrl: "https://weibo.com/example-super-topic-2" },
  ];

  const copySeeds = [
    { title: "日常打卡1", content: "今日来超话打卡，继续加油，期待更多好消息。", tags: ["日常", "打卡"] },
    { title: "日常打卡2", content: "新的一天继续支持，愿所有安排都顺顺利利。", tags: ["支持", "日常"] },
    { title: "活动宣传", content: "活动进行中，欢迎一起参与互动，保持热度。", tags: ["活动", "宣传"] },
    { title: "晚间互动", content: "晚安前来签到，记录一下今天的超话日常。", tags: ["晚间", "签到"] },
    { title: "早间互动", content: "早上好，今天也在认真营业，继续保持活跃。", tags: ["早间", "营业"] },
  ];

  const createdAccounts = [] as Array<{ id: string; nickname: string }>;
  for (const seed of accountSeeds) {
    const account = await prisma.weiboAccount.upsert({
      where: { id: `seed-account-${seed.nickname}` },
      update: {
        nickname: seed.nickname,
        remark: seed.remark,
        groupName: seed.groupName,
        status: seed.status,
        ownerUserId: seed.ownerUserId,
      },
      create: {
        id: `seed-account-${seed.nickname}`,
        nickname: seed.nickname,
        remark: seed.remark,
        groupName: seed.groupName,
        status: seed.status,
        ownerUserId: seed.ownerUserId,
      },
    });

    createdAccounts.push({ id: account.id, nickname: account.nickname });
  }

  const createdTopics = [] as Array<{ id: string; name: string }>;
  for (const seed of topicSeeds) {
    const topic = await prisma.superTopic.upsert({
      where: { id: `seed-topic-${seed.name}` },
      update: seed,
      create: {
        id: `seed-topic-${seed.name}`,
        ...seed,
      },
    });

    createdTopics.push({ id: topic.id, name: topic.name });
  }

  const createdContents = [] as Array<{ id: string; title: string }>;
  for (const seed of copySeeds) {
    const content = await prisma.copywritingTemplate.upsert({
      where: { id: `seed-copy-${seed.title}` },
      update: {
        ...seed,
        status: "ACTIVE",
      },
      create: {
        id: `seed-copy-${seed.title}`,
        ...seed,
        status: "ACTIVE",
      },
    });

    createdContents.push({ id: content.id, title: content.title });
  }

  const taskSeeds = [
    {
      id: "seed-task-1",
      accountId: createdAccounts[0]?.id,
      superTopicId: createdTopics[0]?.id,
      signEnabled: true,
      postEnabled: true,
      minPostsPerDay: 4,
      maxPostsPerDay: 6,
      startTime: "09:00",
      endTime: "21:00",
      status: true,
    },
    {
      id: "seed-task-2",
      accountId: createdAccounts[1]?.id,
      superTopicId: createdTopics[1]?.id,
      signEnabled: true,
      postEnabled: true,
      minPostsPerDay: 3,
      maxPostsPerDay: 5,
      startTime: "10:00",
      endTime: "22:00",
      status: true,
    },
  ].filter((item) => item.accountId && item.superTopicId);

  for (const seed of taskSeeds) {
    await prisma.accountTopicTask.upsert({
      where: { id: seed.id },
      update: seed,
      create: seed,
    });
  }

  // 使用本地时区创建日期，避免 UTC 时区偏差
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  function createLocalDateTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0);
  }

  const planSeeds = [
    {
      id: "seed-plan-1",
      taskId: "seed-task-1",
      accountId: createdAccounts[0]?.id,
      contentId: createdContents[0]?.id,
      planDate: today,
      planType: "POST" as const,
      scheduledTime: createLocalDateTime(today, "10:30"),
      status: "READY" as const,
    },
    {
      id: "seed-plan-2",
      taskId: "seed-task-1",
      accountId: createdAccounts[0]?.id,
      contentId: createdContents[1]?.id,
      planDate: today,
      planType: "CHECK_IN" as const,
      scheduledTime: createLocalDateTime(today, "09:20"),
      status: "SUCCESS" as const,
    },
    {
      id: "seed-plan-3",
      taskId: "seed-task-2",
      accountId: createdAccounts[1]?.id,
      contentId: createdContents[2]?.id,
      planDate: today,
      planType: "POST" as const,
      scheduledTime: createLocalDateTime(today, "14:00"),
      status: "FAILED" as const,
      resultMessage: "模拟失败日志",
    },
    {
      id: "seed-plan-4",
      taskId: "seed-task-2",
      accountId: createdAccounts[1]?.id,
      contentId: createdContents[3]?.id,
      planDate: tomorrow,
      planType: "POST" as const,
      scheduledTime: createLocalDateTime(tomorrow, "11:30"),
      status: "PENDING" as const,
    },
  ].filter((item) => item.accountId);

  for (const seed of planSeeds) {
    await prisma.dailyPlan.upsert({
      where: { id: seed.id },
      update: seed,
      create: seed,
    });
  }

  await prisma.interactionTarget.upsert({
    where: { id: "seed-target-1" },
    update: {
      targetUrl: "https://weibo.com/comment/example-1",
      targetType: "COMMENT_LINK",
      parsedTargetId: "example-1",
      status: "PENDING",
    },
    create: {
      id: "seed-target-1",
      targetUrl: "https://weibo.com/comment/example-1",
      targetType: "COMMENT_LINK",
      parsedTargetId: "example-1",
      status: "PENDING",
    },
  });

  const interactionSeeds = [
    { id: "seed-interaction-1", targetId: "seed-target-1", accountId: createdAccounts[0]?.id, actionType: "LIKE" as const, status: "READY" as const },
    { id: "seed-interaction-2", targetId: "seed-target-1", accountId: createdAccounts[2]?.id, actionType: "LIKE" as const, status: "FAILED" as const, resultMessage: "模拟点赞失败" },
  ].filter((item) => item.accountId);

  for (const seed of interactionSeeds) {
    await prisma.interactionTask.upsert({
      where: { id: seed.id },
      update: seed,
      create: seed,
    });
  }

  const logSeeds = [
    { id: "seed-log-1", accountId: createdAccounts[1]?.id, planId: "seed-plan-3", actionType: "PLAN_STATUS_UPDATED", success: false, errorMessage: "模拟发帖失败" },
    { id: "seed-log-2", accountId: createdAccounts[0]?.id, planId: "seed-plan-2", actionType: "PLAN_STATUS_UPDATED", success: true },
    { id: "seed-log-3", accountId: createdAccounts[2]?.id, actionType: "INTERACTION_TASK_UPDATED", success: false, errorMessage: "模拟互动失败" },
  ].filter((item) => item.accountId);

  for (const seed of logSeeds) {
    await prisma.executionLog.upsert({
      where: { id: seed.id },
      update: seed,
      create: seed,
    });
  }

  console.log("已初始化管理员账号：admin / admin123456");
  console.log("已初始化演示账号：operator / demo123456，viewer / demo123456");
  console.log("已写入演示数据：账号、超话、文案、任务、计划、互动任务、日志");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
