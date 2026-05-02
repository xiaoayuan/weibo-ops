# 运维操作手册

## 标准更新流程

说明：

- 每次代码推送到 GitHub 后，默认都要同时考虑 `controller` 和 `worker` 两台服务器的更新动作。
- 即使某次改动看起来只影响主服务器，也要明确说明 `worker` 是否需要同步 `git pull`。
- 如果不确定，默认两台都执行 `git pull origin main`，避免代码版本漂移。

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

## 推荐答复格式

每次推送后，对用户的默认更新答复应至少包含：

1. 主服务器更新指令
2. 第二台 worker 更新指令
3. 是否需要 `--build`
4. 是否需要 `prisma generate` / `db push`

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

## 数据库防误删与安全基线

### 强制规则

- 生产环境禁止执行 `docker compose down -v`。
- 生产环境禁止执行 `docker volume prune` 和 `docker system prune --volumes`。
- `COMPOSE_PROJECT_NAME` 必须固定为 `weibo-ops`，避免切到新卷导致“像被删库”。
- 禁止让数据库直接暴露公网 `5432`。

`.env` 需要包含：

```env
COMPOSE_PROJECT_NAME=weibo-ops
```

### 5432 暴露检查

```bash
cd /opt/weibo-ops
docker compose config | sed -n '/^  db:/,/^  [a-zA-Z0-9_-]\+:/p'
docker compose ps
ss -lntp | grep 5432 || echo "OK: host not listening 5432"
```

通过标准：

- `db` 配置块里没有 `ports`。
- `docker compose ps` 里 `weibo-ops-db` 不是 `0.0.0.0:5432->5432`。
- `ss` 输出 `OK: host not listening 5432`。

### override 风险

如果 `docker-compose.override.yml` 存在，可能把 `db.ports` 合并回来：

```bash
cd /opt/weibo-ops
ls -l docker-compose*.yml
docker compose config | sed -n '/^  db:/,/^  [a-zA-Z0-9_-]\+:/p'
```

生产环境建议移除或重命名 `docker-compose.override.yml`。

### 异常重启后自检

```bash
cd /opt/weibo-ops
docker compose up -d
docker compose ps
docker compose logs --since=10m db app
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops -c "SELECT now();"'
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops -c "\dt" | sed -n "1,40p"'
```

若出现新卷初始化（日志含 `initdb` 且显示 `Volume ... Created`），需要立刻从最新备份回灌。

### 本地备份与回灌

备份脚本：`/opt/weibo-ops/scripts/backup_local.sh`

手动执行：

```bash
/opt/weibo-ops/scripts/backup_local.sh
```

从最新备份恢复：

```bash
cd /opt/weibo-ops
LATEST=$(ls -1t /opt/weibo-ops/backups/weibo_ops_*.sql.gz | head -n1)
docker compose exec -T db sh -lc 'dropdb -U "$POSTGRES_USER" --if-exists weibo_ops && createdb -U "$POSTGRES_USER" weibo_ops'
gunzip -c "$LATEST" | docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops'
docker compose restart app
```

## 常用恢复命令

### 将 PostgreSQL 密码恢复为 `password`

仅在两边都围绕这个密码配置，且应用明确报 `P1000` 时使用。

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
docker compose restart app
```

### 重置 `admin` 登录密码（修复 hash 异常）

当出现“用户名密码错误”且确认 `User` 表里已有 `admin` 时，优先检查 `passwordHash` 是否是有效 bcrypt（通常长度约 60）。

```bash
cd /opt/weibo-ops
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"'
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops -c "UPDATE \"User\" SET \"passwordHash\" = crypt('"'"'admin123'"'"', gen_salt('"'"'bf'"'"', 10)), \"updatedAt\" = now() WHERE username='"'"'admin'"'"';"'
docker compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d weibo_ops -c "SELECT username, length(\"passwordHash\") AS hash_len FROM \"User\" WHERE username='"'"'admin'"'"';"'
docker compose restart app
```

通过标准：

- `hash_len` 接近 60（明显大于 20，不是 5 这类异常值）。
- 清理浏览器旧 Cookie 后可用新密码登录。

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
