# 运维操作手册

## 标准更新流程

### 主服务器

```bash
cd /opt/weibo-ops
git pull origin main
docker compose up -d
```

### 第二台 worker 服务器

```bash
cd /opt/weibo-ops
git pull origin main
docker compose up -d
```

只有在确实需要重新构建镜像时，才使用：

```bash
docker compose up -d --build
```

## 双节点环境变量

### controller 节点

```env
NODE_ROLE="controller"
NODE_ID="main-1"
ACTION_JOB_NODES="main-1:主服务器,worker-1:第二执行节点"
```

### worker 节点

```env
NODE_ROLE="worker"
NODE_ID="worker-1"
ACTION_JOB_NODES="main-1:主服务器,worker-1:第二执行节点"
```

## 必须保持一致的密钥

以下值在主服务器和 worker 之间必须一致：

- `JWT_SECRET`
- `ACCOUNT_SECRET_KEY`
- 如果两边都启用 AI，则 AI 接口密钥也要一致

不要随意修改，否则会导致登录失效或 Cookie 解密失败。

## 数据库约束

- 主服务器承担主 PostgreSQL 数据库。
- worker 节点的 `DATABASE_URL` 必须指向主服务器数据库。
- 如果数据库密码不一致，应用会出现 Prisma `P1000` 认证错误。

## 常用恢复命令

### 将 PostgreSQL 密码恢复为 `password`

仅在两边都围绕这个密码配置，且应用明确报 `P1000` 时使用。

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
docker compose restart app
```

### 将历史上被标成 `RISKY` 的账号恢复成 `ACTIVE`

用于旧版本自动把账号状态切成 `RISKY` 后的恢复。

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "update \"WeiboAccount\" set status='ACTIVE' where status='RISKY';"
```

## 常用运行检查

### 主服务器 app 日志

```bash
cd /opt/weibo-ops
docker compose logs app --since=10m
```

### worker app 日志

```bash
cd /opt/weibo-ops
docker compose logs app --since=5m
```

### 查看容器内环境变量

```bash
docker compose exec app printenv NODE_ROLE
docker compose exec app printenv NODE_ID
docker compose exec app printenv DATABASE_URL
```

## Action-job 排查 SQL

### 看最新批次任务

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select id,status,config,summary from \"ActionJob\" order by \"createdAt\" desc limit 5;"
```

### 看账号级进度

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select \"accountId\", status, \"currentStep\", \"totalSteps\", \"errorMessage\" from \"ActionJobAccountRun\" where \"jobId\"='JOB_ID' order by \"createdAt\" asc;"
```

### 看 step 级进度

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select \"accountId\", \"sequenceNo\", status, \"startedAt\", \"finishedAt\", \"errorMessage\" from \"ActionJobStep\" where \"jobId\"='JOB_ID' order by \"accountId\", \"sequenceNo\" limit 50;"
```

## 每日计划检查

项目当前以 `Asia/Shanghai` 作为业务时区。

每日计划默认窗口：

- `01:00-18:00`

如果计划看起来卡住，先检查：

- 用户是否开启自动执行
- 计划时间是否已到
- 当前状态是待执行、已入队，还是执行中

## 代理评估说明

代理“能联网”不等于“能稳定通微博”。

一个代理可能：

- 能访问外网
- 但依然会被微博游客系统拦截

测试代理时，至少要区分这三类结果：

- 网络可达
- 微博可达但被游客系统拦截
- 微博业务真实可用
