<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Collaboration Rules

## Default Delivery Rules

- After each code change is completed and verified, push the change to GitHub unless the user explicitly says not to.
- After each pushed change, provide VPS update commands.
- Prefer fixing real production issues and core execution flows before adding secondary features.

## Project Priorities

Current core priorities, in order:

1. Comment control
2. Repost rotation
3. Daily plan generation and execution
4. Account availability and execution stability
5. Logs, observability, and recovery

Copywriting and AI features are auxiliary. Do not let them override the core execution roadmap unless the user explicitly redirects work there.

## Infrastructure Model

The project currently uses a two-node model:

- Main server: `controller`
- Second server: `worker`

Rules:

- The main server is the only management entrypoint.
- The main server owns the primary database.
- The second server executes distributed `action-job` workloads.
- Do not casually change secrets shared across servers.

## Secrets Safety

Do not rotate or rewrite these values without explicit user approval:

- `ACCOUNT_SECRET_KEY`
- `JWT_SECRET`

Changing either can break existing sessions or encrypted account cookies.

## Session Handoff

Before continuing work in a new session, read:

- `docs/session-handoff.md`
- `docs/ops-runbook.md`

These files contain the current system state, deployment expectations, and recovery notes.
