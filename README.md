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

> ⚠️ **安全警告**：首次部署后请立即修改默认密码。生产环境请通过 `docs/ops-runbook.md` 中的"重置 admin 登录密码"流程修改。

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
npm run dev:web
npm run build
npm run build:web
npm run start
npm run start:web
npm run lint
npm run lint:web
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio
npm run seed
```

## 独立前端开发

当前仓库已经开始引入独立前端应用：`apps/web`

同时也新增了独立 API 应用骨架：`apps/api`

- 后端管理服务仍使用当前根目录应用
- 独立前端使用 `apps/web`
- 独立 API 骨架使用 `apps/api`
- 默认建议后端跑在 `http://127.0.0.1:3007`
- 独立前端默认跑在 `http://127.0.0.1:3008`
- 独立 API 默认跑在 `http://127.0.0.1:3009`
- Docker 部署时会拆成三层服务：`app`、`api`、`web`

启动方式：

1. 启动后端

```bash
npm run dev
```

2. 启动独立前端

```bash
npm run dev:web
```

3. 启动独立 API 骨架

```bash
npm run dev:api
```

前端会通过 `apps/web/.env.example` 中的 `BACKEND_ORIGIN` 代理到后端 API。

如果你要验证前后端进一步拆分后的调用路径，可以让 `apps/web` 指向 `apps/api`：

- `apps/web/.env.local`

```env
BACKEND_ORIGIN="http://127.0.0.1:3009"
```

- `apps/api/.env.local`

```env
LEGACY_BACKEND_ORIGIN="http://127.0.0.1:3007"
```

这样调用路径会变成：

`apps/web -> apps/api -> 当前根项目后端`

## Docker 三层链路

现在 Docker 部署默认链路是：

`浏览器 -> web(3008) -> api(3009) -> app(3000)`

说明：

- `app` 仍然是当前旧后端主体
- `api` 是正在逐步原生化的新后端入口
- `web` 统一只对 `api` 发请求

这样可以逐步减少 `api -> app` 的转发比例，而不需要一次性推翻线上链路。

## 环境变量

`.env.example` 中已提供模板：

```env
POSTGRES_DB="weibo_ops"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace_with_a_strong_db_password"
DATABASE_URL="postgresql://postgres:replace_with_a_strong_db_password@db:5432/weibo_ops?schema=public"
JWT_SECRET="replace_with_a_long_random_secret"
AUTH_COOKIE_SECURE="false"
ACCOUNT_SECRET_KEY="replace_with_a_32_plus_char_secret"
EXECUTOR_MODE="weibo"
APP_PORT="3007"
AI_API_KEY=""
AI_MODEL="gpt-4.1-mini"
AI_BASE_URL="https://api.openai.com/v1/chat/completions"
```

说明：

- `docker compose` 会从 `.env` 注入数据库、鉴权密钥与端口配置，生产环境请务必修改所有 `replace_with_...` 占位值
- 如果你当前通过 `http://NASIP:3007` 访问，`AUTH_COOKIE_SECURE` 请保持为 `false`
- 只有在你已经配置 `HTTPS` 时，才改成 `true`
- `EXECUTOR_MODE` 建议固定为 `weibo`，执行链路将走真实执行器
- `AI_API_KEY` 用于文案库的 AI 生成功能，走服务器直连，不会占用微博代理流量
- `AI_MODEL` 和 `AI_BASE_URL` 用于兼容 OpenAI 风格接口，默认可直接对接 OpenAI Chat Completions

可使用下面命令生成高强度密钥：

```bash
openssl rand -base64 48
```

## 当前状态

当前项目已经具备一套可演示的一期 MVP 后台，适合继续接真实执行逻辑、权限体系和部署流程。

## 执行器说明

- 当前项目默认走 `weibo executor` 真实执行链路
- `执行预检` 会校验账号登录态并写入日志
- `src/server/executors/http-client.ts` 提供统一请求封装
- `src/server/executors/weibo-executor.ts` 负责真实平台请求与结构化返回
- 若要扩展其他平台执行器，建议在 `src/server/executors/` 下新增实现，并保持统一接口

## 代理池与自动分配

- `代理中心` 支持代理池管理，支持在前端维护多个代理节点
- 代理节点支持配置国家/地区与轮换模式（粘性、1m、5m、10m）
- 新建微博账号后支持自动补齐主备代理（主代理、备代理1、备代理2）
- 账号可切换 `AUTO` / `MANUAL` 绑定模式，手动锁定后不参与自动重平衡
- 默认单 IP 上限为 `100` 账号（可调但最大仍为 100）
- 扫码登录与执行请求都会优先使用账号绑定的代理节点
- 当账号允许主机兜底且主备代理都不可用时，执行链路会自动尝试主机网络
