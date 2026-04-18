# 微博运营台

一个基于 `Next.js 16 + Prisma + PostgreSQL` 的后台项目，用于管理多账号、超话任务、文案库、每日计划、互动任务和执行日志。

## 功能概览

- 登录鉴权
- 账号管理
- 超话管理
- 任务配置
- 文案库
- 每日计划生成与编辑
- 互动任务管理
- 执行日志
- 控制台统计

## 技术栈

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Prisma 7`
- `PostgreSQL`

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 启动 PostgreSQL

如果你本机没有数据库，可以直接使用：

```bash
docker compose up -d db
```

4. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

5. 写入演示数据

```bash
npm run seed
```

6. 启动开发环境

```bash
npm run dev
```

访问：`http://localhost:3007/login`

默认管理员账号：

- 用户名：`admin`
- 密码：`admin123456`

## Docker 启动

直接启动完整环境：

```bash
docker compose up --build -d
```

首次启动后，在宿主机执行数据库初始化：

```bash
npm run db:generate
npm run db:push
npm run seed
```

然后访问：`http://localhost:3007/login`

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run seed
```

## 环境变量

`.env.example` 中已提供模板：

```env
DATABASE_URL="postgresql://postgres:password@db:5432/weibo_ops?schema=public"
JWT_SECRET="replace_me_with_a_strong_secret"
AUTH_COOKIE_SECURE="false"
ACCOUNT_SECRET_KEY="replace_me_with_a_32_char_secret"
EXECUTOR_MODE="mock"
```

说明：

- 如果你当前通过 `http://NASIP:3007` 访问，`AUTH_COOKIE_SECURE` 请保持为 `false`
- 只有在你已经配置 `HTTPS` 时，才改成 `true`
- `EXECUTOR_MODE` 默认使用 `mock`，切到 `weibo` 时会启用真实执行器骨架与连通性探测

## 当前状态

当前项目已经具备一套可演示的一期 MVP 后台，适合继续接真实执行逻辑、权限体系和部署流程。

## 执行器说明

- 当前项目默认接入的是 `mock executor`
- `执行预检` 会校验账号登录态并写入日志
- 当前不会直接对外部平台发起真实发帖、签到或互动动作
- 如果后续要扩展真实执行器，建议在 `src/server/executors/` 下新增实现，并保持统一接口
- `src/server/executors/http-client.ts` 提供统一请求封装
- `src/server/executors/weibo-executor.ts` 提供真实执行器骨架，当前仅做基础连通性探测与结构化返回
