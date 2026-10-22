# deferred-automation-extensions

## Why

原始需求§14、§24、§28–31的条件/事件、插件动作、通知、实时日志和未来单次计划编辑未被现有F001–F018完整承诺。旧模型执行和独立daemon示例已被后续契约替代，不能复活为可运行命令。

本次仅搬迁历史候选需求，尚未获得该业务方案的具体版本确认，不是开发授权。

## What Changes

- 保留事件/条件、Plugin Action/Workflow、通知、实时日志和未来单次计划候选。
- 记录额外搜索/筛选与UI细节待核对项，不推定已实现。
- 独立daemon命令为历史方案；现行宿主生命周期和官方原对话任务保持。

## Capabilities

### New Capabilities

- `automation-extensions`: 待定触发、动作、可观察性与单次计划能力。

### Modified Capabilities

无已批准修改；若后续选择改变现有能力，须先把对应完整 Requirement 转为 MODIFIED 增量并重新确认。

## Impact

可能影响task/trigger/run、调度器、SQLite迁移、接口/工具、UI与外部通知。先决定与官方Schedule/其他插件的职责；本变更不运行任务或发消息。
