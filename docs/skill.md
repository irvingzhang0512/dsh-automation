# automation Skill

捆绑 [SKILL.md](../skills/automation/SKILL.md)通过宿主skills服务注册，缺少skills服务不阻止直接调度。

会话提示词／Skill需求调用官方Schedule工具，在原会话投递，不使用automation旧模型Action；直接命令／脚本使用automation_*。16工具名称与结果信封见 [工具](tools.md)。操作经工具或页面，不改数据库；明确时区、参数数组、工作目录和解释器。每隔两小时需对应Cron，不能冒充hourly每小时。

Skill解释投递记录与直接运行结果的区别、取消一次与暂停任务的区别；配置和迁移经官方详情中的独立分区与预览，不自动创建会话、切换日常安装或公开推送。
