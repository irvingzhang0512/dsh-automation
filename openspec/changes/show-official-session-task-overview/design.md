# Design

## Context

DSH Desktop 0.2.2-rc.3 的内置任务组件在 `schedule/catalog` 获授权时读取 `remote.schedule.catalog()`，并监听 `schedule/changed` 与 `connection/reset`。宿主清单返回官方任务的排程与最近投递回执，部分任务带有执行信号。插件现有同页包装保留了官方注入和语言配置，目标版本官方任务页也依赖自身的 `store`。

## Goals / Non-Goals

- 从当前连接呈现受官方权限保护的会话任务概览，并导航至原有官方任务管理。
- 由官方 Schedule 保持会话任务的调度、执行状态、历史与管理操作的所有权。现有 HTTP 路由、工具、配置字段、存储格式和迁移契约沿用。

## Decisions

- 客户端以官方 `remoteAccess.whenAccess('schedule/catalog', …)` 生命周期控制读取。可见的「官方配置」区在有权限时调用 `remote.schedule.catalog()`，消费官方 `{ ok, value }` 结果。权限撤销与 `connection/reset` 清除上次结果并作废在途请求。卸载或隐藏时释放事件订阅并停止发起读取。
- `schedule/changed`、重新连接、进入配置区和手动刷新都会使读取失效。合并并发刷新，在旧请求晚到时拒绝采纳。相同连接、相同授权下发生读取失败时保留成功结果并显示过时提示。清单状态独立于设置草稿。
- 客户端表格消费 `id`、`title`、`status`、`scheduledAt`、`target.kind`、`executionActive` 与 `lastDelivery.deliveredAt`。沿用官方排序。排程状态将 `active`、`paused`、`ended` 显示为「已排程」「已暂停」「已结束」。下次投递只取 `active.scheduledAt`，最近投递取 `lastDelivery.deliveredAt`，时间按本机时区呈现。执行标记仅使用 `executionActive === true`。目标为 `new` 且没有该信号时显示「未知」，其他无信号任务不显示执行标签。
- 使用现有 `TaskNavigation.select('session')` 与布局的 `selectPanel('schedules')`。入口在官方面板可用时启用，遵循现有离开保护。包装注册转发同一官方条目的 `store`、`inject` 与 `locale`，继续把框架绑定的属性传给原组件。
- 隔离验收使用合成任务和独立数据目录。日常使用现有任务只读核对。回退沿用固定版本和 Desktop 受保护更新流程。

## Risks / Trade-offs

- 官方 `executionActive` 表示复用目标会话中的最新投递还在排队或执行。每次创建新会话的执行结果超出该字段的可观测范围，投递历史也只记录收件。
- 现有配置曾独立读取和保存各所有者。任务刷新应与这些动作独立，避免丢失未保存设置或造成虚假的保存反馈。
