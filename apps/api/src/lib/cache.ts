import Redis from "ioredis";

// Redis 配置
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false";

// 创建 Redis 客户端
let redis: Redis | null = null;

if (REDIS_ENABLED) {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error("Redis 连接失败，已达到最大重试次数");
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      reconnectOnError: (err) => {
        console.error("Redis 连接错误:", err.message);
        return true;
      },
    });

    redis.on("connect", () => {
      console.log("✓ Redis 已连接");
    });

    redis.on("error", (err) => {
      console.error("Redis 错误:", err.message);
    });
  } catch (error) {
    console.error("Redis 初始化失败:", error);
    redis = null;
  }
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private static prefix = "weibo:";

  /**
   * 生成缓存键
   */
  private static key(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * 获取缓存
   */
  static async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;

    try {
      const value = await redis.get(this.key(key));
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`缓存读取失败 [${key}]:`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒），默认 5 分钟
   */
  static async set(key: string, value: unknown, ttl: number = 300): Promise<boolean> {
    if (!redis) return false;

    try {
      const serialized = JSON.stringify(value);
      await redis.setex(this.key(key), ttl, serialized);
      return true;
    } catch (error) {
      console.error(`缓存写入失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   */
  static async del(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      await redis.del(this.key(key));
      return true;
    } catch (error) {
      console.error(`缓存删除失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 批量删除缓存（支持通配符）
   */
  static async delPattern(pattern: string): Promise<number> {
    if (!redis) return 0;

    try {
      const keys = await redis.keys(this.key(pattern));
      if (keys.length === 0) return 0;
      return await redis.del(...keys);
    } catch (error) {
      console.error(`批量删除缓存失败 [${pattern}]:`, error);
      return 0;
    }
  }

  /**
   * 检查缓存是否存在
   */
  static async exists(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const result = await redis.exists(this.key(key));
      return result === 1;
    } catch (error) {
      console.error(`检查缓存失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 设置缓存过期时间
   */
  static async expire(key: string, ttl: number): Promise<boolean> {
    if (!redis) return false;

    try {
      await redis.expire(this.key(key), ttl);
      return true;
    } catch (error) {
      console.error(`设置过期时间失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 获取缓存剩余时间
   */
  static async ttl(key: string): Promise<number> {
    if (!redis) return -1;

    try {
      return await redis.ttl(this.key(key));
    } catch (error) {
      console.error(`获取 TTL 失败 [${key}]:`, error);
      return -1;
    }
  }

  /**
   * 清空所有缓存
   */
  static async flush(): Promise<boolean> {
    if (!redis) return false;

    try {
      const keys = await redis.keys(this.key("*"));
      if (keys.length === 0) return true;
      await redis.del(...keys);
      return true;
    } catch (error) {
      console.error("清空缓存失败:", error);
      return false;
    }
  }
}

/**
 * 缓存装饰器工厂
 * @param keyPrefix 缓存键前缀
 * @param ttl 过期时间（秒）
 */
export function cached(keyPrefix: string, ttl: number = 300) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // 生成缓存键
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;

      // 尝试从缓存获取
      const cached = await CacheManager.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 写入缓存
      await CacheManager.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}

export { redis };
