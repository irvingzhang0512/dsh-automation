# Proposal

## Why

「Irving · 自动化增强 → 官方配置」只显示参数，现有任务按钮会切到直接任务。用户需要在这里查看当前 DSH 连接中的官方会话任务，并进入官方页面查看完整投递记录或管理任务。

## What Changes

- 在「官方配置」顶部提供只读的「会话任务」概览。默认显示已排程或有执行信号的任务，可切换查看全部。
- 显示排程状态、下次投递、最近投递，以及官方明确报告的排队或执行信号。
- 提供「打开会话任务」入口，并将官方编辑状态传给同页包装内的官方组件。

## Capabilities

### New Capabilities

### Modified Capabilities

- `automation-settings`：在 F012 所属配置区加入官方会话任务概览和导航。
- `automation-tools-ui`：补齐 F016 同页入口对官方编辑状态的传递。

## Impact

客户端读取当前 DSH 连接的官方 Schedule 清单，并沿用官方访问权限。现有设置字段、保存契约、HTTP 接口、调度逻辑和持久数据沿用。
