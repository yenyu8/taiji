# Event Spec v0.1

技术设计文档提出的标准事件包含 `event_id`、`event_type`、`schema_version`、`timestamp`、`learner_id`、`session_id`、`source` 和 `payload`。Demo 数据库已预留事件表；当前闭环主要通过 Evidence 持久化完成，尚未启用跨组件的事件分发。后续接入真实 Sandbox 与 Tutor 时，再以这一协议连接服务。
