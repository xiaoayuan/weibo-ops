# 文档导航

## 核心文档

- `README.md`
  - 面向项目使用者与开发者的总入口
  - 负责：项目简介、本地启动、常用命令、目录与链路概览
- `docs/ops-runbook.md`
  - 面向部署与运维
  - 负责：双节点更新、恢复、自检、安全基线、数据库约束
- `docs/session-handoff.md`
  - 面向新会话接手
  - 负责：当前线上/阶段状态、最近关键结论、当前待办
- `apps/api/README.md`
  - 面向 `apps/api` 子项目维护者
  - 负责：`apps/api` 当前运行时、迁移状态与开发约定

## 联调文档

- `docs/web-api-integration-checklist.md`
  - 前后端联调检查顺序与验收点
- `docs/web-api-troubleshooting-map.md`
  - 前后端链路排障地图
- `docs/executor-validation-template.md`
  - 执行器验证记录模板

## 设计与历史文档

- `docs/superpowers/specs/*.md`
  - 历史设计稿与专题方案
  - 说明：这些文档用于理解设计演进，不默认代表当前线上实现
- `PHASE1_REVIEW_REPORT.md`
  - 历史阶段性代码审查报告
  - 说明：其中对 `apps/api/src/app/api/**` 的结论需要结合 `apps/api/README.md` 当前运行定位一起阅读

## 阅读顺序建议

### 新开发者

1. `README.md`
2. `docs/README.md`
3. `apps/api/README.md`

### 新会话接手

1. `docs/session-handoff.md`
2. `docs/ops-runbook.md`
3. 相关功能对应的专项文档

### 运维排障

1. `docs/ops-runbook.md`
2. `docs/web-api-troubleshooting-map.md`
3. `docs/session-handoff.md`
