# Session Handoff

## Working Agreement

- After each completed code change, push to GitHub unless the user explicitly asks not to.
- After each push, provide VPS update commands.
- Prefer fixing production issues and execution-chain stability over feature expansion.

## Current Infrastructure

### Main server

- Role: `controller`
- Hosts the primary database
- Hosts the main backend and management UI
- Runs daily plan generation and daily plan scheduling

### Second server

- Role: `worker`
- Shares the primary database on the main server
- Runs distributed `action-job` workloads
- Used mainly for comment control and repost rotation execution

### Shared secrets

These must stay identical across controller and worker nodes:

- `JWT_SECRET`
- `ACCOUNT_SECRET_KEY`
- AI provider credentials, if AI is used on both nodes

Changing these without care can break login and encrypted account cookies.

## Current Product Model

### Public vs private execution

- Comment control and repost rotation tasks are public/shared tasks.
- All users may jointly edit those tasks.
- Actual execution is private: each user only uses their own Weibo accounts.

### Main priorities

1. Comment control
2. Repost rotation
3. Daily plans
4. Account stability
5. Logs and recovery

## What Has Already Been Done

### Daily plans

- Plan time generation now uses business timezone (`Asia/Shanghai`).
- Default daily execution window is `01:00-18:00`.
- `PENDING` display was clarified from "待审核" to "待执行".
- Daily auto-generation now has missed-time recovery.
- Daily auto-execution and auto-generation use business-time comparisons.
- Plan page shows pending reasons.
- Auto-scheduled plans now distinguish "已入队" from true execution more clearly.
- First-comment plans now retry later in the day when no suitable zero-reply target is found.

### Comment control / repost rotation

- Recent task list now shows batch summaries.
- Batch details include AI risk, target info, and scheduling notes.
- Cancellation semantics were clarified.
- Comment control uses controlled account concurrency.
- Repost rotation uses controlled account concurrency.
- Comment control concurrency is configurable.
- Repost concurrency is configurable.
- S-tier comment control startup was made more aggressive.
- Action-job delays are now pre-scheduled at task creation time.
- Distributed action-job node assignment is implemented.
- Task list now shows target node and execution node.
- Action-job list auto-refreshes while tasks are pending/running.

### Comment-control execution quality

- Success checks for comment-like execution were tightened.
- Humanized execution flow was added:
  - warmup request before like
  - shuffled target order per account
  - round-robin progress across accounts
- Failure reasons for likes are more explicit.
- Failure categories are grouped in task summaries.
- Duplicate-like targets are skipped within the same batch for the same account.

### Accounts

- Accounts can now be created even when no proxy pool is available.
- Account list shows proxy binding state.
- Account list shows login-state warnings more clearly.
- Credential decrypt failures now show human-readable messages.
- The system no longer auto-marks accounts as `RISKY`; risk score remains, but account status is not automatically switched to `RISKY` anymore.

### Comment pool

- Comment pool supports extracting hot comments from a Weibo link.
- Optional keyword filtering is available during hot-comment extraction.
- Extraction has clearer inline feedback and better diagnostics.

### AI and auxiliary tooling

- AI provider configuration can be edited from the copywriting page.
- AI copywriting supports generation, rewrite, filtering, and preview.
- AI risk helper is connected for copywriting review, task risk hints, and log summaries.
- AI risk keywords are configurable.

## Current Open Thread

The latest mainline work has focused on comment-control execution realism and distributed execution stability.

The next likely area of work is one of:

- observe real comment-control batches and fix newly exposed bottlenecks
- improve worker-node observability if execution becomes hard to track
- continue execution-chain hardening without shifting focus back to secondary AI/copywriting work

## Important Known Caveat

The local development/build environment may show transient Prisma `ECONNREFUSED` messages during `next build` static page generation if no live database is present in the local environment. These messages have repeatedly appeared during validation but have not blocked successful application builds in the real deployment path. Do not confuse those local build-time warnings with current production failures unless runtime logs show the same issue.
