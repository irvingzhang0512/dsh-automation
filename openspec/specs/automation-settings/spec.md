# automation-settings

## Purpose

按真实配置所有者编辑八个字段，保留逐区保存、冲突、重载和草稿安全。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F008 配置所有权

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F008](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：八字段精确回写三个原所有者，保留未知字段／未改表达式。

#### Scenario: 修改一个所有者设置

- **WHEN** 保存直接执行超时但另一区有未保存时区草稿
- **THEN** 仅保存目标所有者的改动；未知字段、继承表达式和另一区草稿保留。


### Requirement: F010 配置生效

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F010](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：普通参数正常重载；直接运行期间拒绝automation及schedule保存。

#### Scenario: 运行中拒绝重载设置

- **WHEN** 直接执行任务尚在运行时尝试保存automation或schedule配置
- **THEN** 拒绝可能重载的保存并给出原因；普通空闲参数保存遵循官方重载路径，不伪造立即生效。


### Requirement: F012 双分区原生界面

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F012](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期：保留原 F012 的官方会话任务与直接执行两个独立配置区、草稿／保存／失败／重置语义，无全页保存、无重复侧栏；入口采用后续已确认 2026-10-17 适配位置，放在本插件详情，官方会话任务内建于 web-app。
- 验收：两个配置区和直接执行详情跳转均可达，互不覆盖草稿；不恢复已退役的旧插件包入口。
- 历史替代依据：[2026-10-17 升级契约](../../../docs/DSH-UPGRADE-20261017.md)。

#### Scenario: 独立两区设置

- **WHEN** 在当前插件详情编辑官方会话任务和直接执行两组设置
- **THEN** 各自拥有草稿、保存、重置和错误状态，无全局一键全保存；详情进入与任务标签一致的直接执行页。

#### Scenario: 一组保存失败

- **WHEN** 一个所有者保存成功而另一个冲突
- **THEN** 分别反馈实际结果，不显示整体成功，不清掉未保存草稿。


### Requirement: A005 八字段与三所有者契约

系统 SHALL 维护八个既有字段：timeZone默认系统、refreshIntervalMs默认600000且允许0；deliveryHistoryDays默认30/范围1–3650、deliveryHistoryRecords默认200/范围1–10000；dataDir默认空、defaultTimeoutSeconds默认1800/整数1–2147483、tickMs默认1000/整数1–2147483647、keepBackups默认10/非负整数。字段归属按[冻结CONFIG-UI](../../../docs/CONFIG-UI.md)和[2026-10-17升级](../../../docs/DSH-UPGRADE-20261017.md)的当前所有者执行。时间上下文在三个官方preset读取/保存；存在不一致时只读诊断，冲突拒绝，并按实际部分完成情况安全恢复；既有会话快照和任务时区不追溯改变。

#### Scenario: 时间上下文所有者不一致

- **WHEN** 三个官方preset的时区或刷新间隔不同
- **THEN** 显示只读差异，不选一个覆盖其余；用户后续明确处理前不伪装为单一有效值。

#### Scenario: 非法数值

- **WHEN** 提交负tickMs、超范围默认超时或无效时区
- **THEN** 拒绝保存，未知字段与旧有效值不变；refreshIntervalMs=0表示每个符合条件步骤注入时间读数，不是关闭刷新。


### Requirement: A006 受限设置桥和CAS

系统 SHALL 通过 GET/POST /api/automation/settings 返回/接收entryId、expectedRevisionToken及set/unset operations；写入前在锁内核对所有者、白名单字段、原始与继承层修订。恢复默认只unset用户覆盖，不整份覆盖配置。冲突和重载失败必须反映实际状态。来源：[冻结实施契约](../../../docs/IMPLEMENTATION-20261014.md)。

#### Scenario: 并发保存

- **WHEN** 窗口持有旧revisionToken，其他窗口已经保存同一entry
- **THEN** 旧写入失败并要求重读，不覆盖新值或未知表达式。

### Requirement: A009 恢复继承是可审阅草稿

系统 SHALL 在用户点击恢复继承时只修改对应所有者草稿，直到显式保存才删除持久覆盖；两区保存、状态刷新和失败均不清空另区草稿。来源：[冻结SPEC配置边界](../../../docs/SPEC.md)、[CONFIG-UI](../../../docs/CONFIG-UI.md)。

#### Scenario: 恢复后放弃

- **WHEN** 用户点击恢复继承后又放弃当前草稿
- **THEN** 原持久覆盖不变；只有随后明确保存才unset覆盖并继承base。
