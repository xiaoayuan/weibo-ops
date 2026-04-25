# Ops Runbook

## Standard Update Flow

### Main server

```bash
cd /opt/weibo-ops
git pull origin main
docker compose up -d
```

### Second worker server

```bash
cd /opt/weibo-ops
git pull origin main
docker compose up -d
```

Use `docker compose up -d --build` only when an image rebuild is actually needed.

## Two-Node Environment Variables

### Controller

```env
NODE_ROLE="controller"
NODE_ID="main-1"
ACTION_JOB_NODES="main-1:主服务器,worker-1:第二执行节点"
```

### Worker

```env
NODE_ROLE="worker"
NODE_ID="worker-1"
ACTION_JOB_NODES="main-1:主服务器,worker-1:第二执行节点"
```

## Shared Secrets

These must stay identical on both nodes:

- `JWT_SECRET`
- `ACCOUNT_SECRET_KEY`
- AI provider credentials if AI is enabled on both nodes

Do not change them casually.

## Database Rules

- The main server hosts the primary PostgreSQL database.
- The worker must point `DATABASE_URL` to the main server database.
- If database credentials drift, the app will fail with Prisma `P1000` authentication errors.

## Common Recovery Commands

### Reset PostgreSQL password back to `password`

Use only if both nodes are already configured around that credential and the app is failing with `P1000`.

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
docker compose restart app
```

### Restore old accounts marked `RISKY`

Used after the risk-status automation was removed.

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "update \"WeiboAccount\" set status='ACTIVE' where status='RISKY';"
```

## Quick Runtime Checks

### Main server app logs

```bash
cd /opt/weibo-ops
docker compose logs app --since=10m
```

### Worker app logs

```bash
cd /opt/weibo-ops
docker compose logs app --since=5m
```

### Environment verification inside a container

```bash
docker compose exec app printenv NODE_ROLE
docker compose exec app printenv NODE_ID
docker compose exec app printenv DATABASE_URL
```

## Action-Job Verification

To inspect the latest action jobs directly in the database:

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select id,status,config,summary from \"ActionJob\" order by \"createdAt\" desc limit 5;"
```

To inspect account-run progress for a job:

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select \"accountId\", status, \"currentStep\", \"totalSteps\", \"errorMessage\" from \"ActionJobAccountRun\" where \"jobId\"='JOB_ID' order by \"createdAt\" asc;"
```

To inspect step-level progress for a job:

```bash
cd /opt/weibo-ops
docker compose exec db psql -U postgres -d weibo_ops -c "select \"accountId\", \"sequenceNo\", status, \"startedAt\", \"finishedAt\", \"errorMessage\" from \"ActionJobStep\" where \"jobId\"='JOB_ID' order by \"accountId\", \"sequenceNo\" limit 50;"
```

## Daily Plan Checks

The project uses business timezone scheduling (`Asia/Shanghai`).

Daily plan generation defaults to the business window:

- `01:00-18:00`

If plans appear stuck, first check:

- whether the user has auto-execute enabled
- whether the scheduled time has passed
- whether the plan is merely queued or actually executing

## Proxy Evaluation Notes

Proxy connectivity is not the same as Weibo usability.

A proxy may:

- connect successfully to the internet
- still be blocked by the Weibo visitor system

When testing residential proxies, treat these as separate outcomes:

- network reachable
- Weibo reachable but visitor-blocked
- Weibo actually usable
