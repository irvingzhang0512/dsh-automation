# automation-history-storage

## Purpose

保留任务、触发器、运行历史、日志和迁移元数据的持久化及一致备份。 本文是迁移后的活动规格；旧文档仅为冻结来源。迁移不新增功能、不等于重新完成运行验收。

## Requirements

### Requirement: F006 SQLite与历史

系统 SHALL 满足本条既有行为与验收约束。来源：冻结的 [SPEC F006](../../../docs/SPEC.md)；确认、历史实现与验证依据见 [迁移索引](../../MIGRATION.md)。

- 预期与验收：保留旧表与运行ID、输出／错误／退出码，追加元数据与一致性备份。

#### Scenario: 读取旧运行历史

- **WHEN** 迁移或升级后按旧RunID查询执行结果
- **THEN** 历史ID、输出、错误、退出码和元数据保持可读，不重建成另一条运行记录。

#### Scenario: 数据库备份

- **WHEN** 需要备份当前自动化数据
- **THEN** 获得一致SQLite备份；未宣称直接复制运行中的主文件即可覆盖WAL状态。


### Requirement: A003 SQLite布局与备份语义

系统 SHALL 保持tasks、triggers、runs、run_logs、automation_meta的持久边界；meta保存重试安排、规则复核与迁移映射。dataDir修改只改变后续使用目录，不隐式搬运旧资料。备份使用VACUUM INTO取得一致副本；迁移强制备份，即使keepBackups为0仍先保留本次恢复依据。来源：[冻结架构](../../../docs/architecture.md)、[实施契约](../../../docs/IMPLEMENTATION-20261014.md)。

#### Scenario: 修改数据目录

- **WHEN** 用户保存不同dataDir并重载
- **THEN** 不把旧库静默移动或覆盖新目录中的不同内容；目录恢复由明确维护流程处理。

#### Scenario: 关闭普通备份保留仍迁移

- **WHEN** keepBackups=0且用户显式应用旧任务迁移
- **THEN** 仍生成本次强制一致备份和迁移记录，才能执行写入。
