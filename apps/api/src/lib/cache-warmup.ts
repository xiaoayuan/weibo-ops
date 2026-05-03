import { CacheManager } from "./cache";
import { prisma } from "./prisma";

/**
 * 缓存预热管理器
 * 
 * 在应用启动时预加载热点数据到 Redis，提升首次访问速度
 */
export class CacheWarmup {
  private static isWarming = false;
  private static lastWarmupTime = 0;
  private static warmupInterval = 5 * 60 * 1000; // 5 分钟
  private static intervalId: ReturnType<typeof setInterval> | null = null;
  private static hasStarted = false;

  /**
   * 执行缓存预热
   */
  static async warmup(): Promise<void> {
    if (this.isWarming) {
      console.log("⏳ 缓存预热正在进行中，跳过");
      return;
    }

    const now = Date.now();
    if (now - this.lastWarmupTime < this.warmupInterval) {
      console.log("⏳ 距离上次预热时间过短，跳过");
      return;
    }

    this.isWarming = true;
    this.lastWarmupTime = now;

    console.log("🔥 开始缓存预热...");
    const startTime = Date.now();

    try {
      await Promise.all([
        this.warmupAccounts(),
        this.warmupCopywriting(),
        this.warmupPlans(),
        this.warmupStats(),
      ]);

      const duration = Date.now() - startTime;
      console.log(`✅ 缓存预热完成，耗时 ${duration}ms`);
    } catch (error) {
      console.error("❌ 缓存预热失败:", error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * 预热账号数据
   */
  private static async warmupAccounts(): Promise<void> {
    try {
      const accounts = await prisma.weiboAccount.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      await CacheManager.set("accounts:active", accounts, 300);
      console.log(`  ✓ 预热账号数据: ${accounts.length} 条`);
    } catch (error) {
      console.error("  ✗ 预热账号数据失败:", error);
    }
  }

  /**
   * 预热文案数据
   */
  private static async warmupCopywriting(): Promise<void> {
    try {
      const copywriting = await prisma.copywritingTemplate.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      await CacheManager.set("copywriting:active", copywriting, 300);
      console.log(`  ✓ 预热文案数据: ${copywriting.length} 条`);
    } catch (error) {
      console.error("  ✗ 预热文案数据失败:", error);
    }
  }

  /**
   * 预热计划数据
   */
  private static async warmupPlans(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const plans = await prisma.dailyPlan.findMany({
        where: {
          planDate: { gte: today },
          status: { in: ["PENDING", "RUNNING"] },
        },
        orderBy: { planDate: "asc" },
        take: 100,
      });

      await CacheManager.set("plans:active", plans, 300);
      console.log(`  ✓ 预热计划数据: ${plans.length} 条`);
    } catch (error) {
      console.error("  ✗ 预热计划数据失败:", error);
    }
  }

  /**
   * 预热统计数据
   */
  private static async warmupStats(): Promise<void> {
    try {
      // 账号统计
      const accountStats = await prisma.weiboAccount.groupBy({
        by: ["status"],
        _count: true,
      });

      await CacheManager.set("stats:accounts", accountStats, 300);

      // 计划统计
      const planStats = await prisma.dailyPlan.groupBy({
        by: ["status"],
        _count: true,
      });

      await CacheManager.set("stats:plans", planStats, 300);

      console.log("  ✓ 预热统计数据");
    } catch (error) {
      console.error("  ✗ 预热统计数据失败:", error);
    }
  }

  /**
   * 启动定时预热任务
   */
  static startScheduledWarmup(): void {
    // 防止重复启动
    if (this.hasStarted) {
      return;
    }
    this.hasStarted = true;

    // 立即执行一次
    void this.warmup();

    // 每 5 分钟执行一次，保存 interval ID 便于清理
    this.intervalId = setInterval(() => {
      void this.warmup();
    }, this.warmupInterval);

    console.log("🔥 缓存预热定时任务已启动");
  }

  /**
   * 停止定时预热任务
   */
  static stopScheduledWarmup(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.hasStarted = false;
      console.log("✅ 缓存预热定时任务已停止");
    }
  }

  /**
   * 清空所有预热缓存
   */
  static async clearWarmupCache(): Promise<void> {
    try {
      await Promise.all([
        CacheManager.del("accounts:active"),
        CacheManager.del("copywriting:active"),
        CacheManager.del("plans:active"),
        CacheManager.del("stats:accounts"),
        CacheManager.del("stats:plans"),
      ]);

      console.log("✅ 预热缓存已清空");
    } catch (error) {
      console.error("❌ 清空预热缓存失败:", error);
    }
  }
}
